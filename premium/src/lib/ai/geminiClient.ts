import { GoogleGenAI } from '@google/genai';
import { jsonrepair } from 'jsonrepair';
import { generateSHA256, normalizePayload } from './hash';
import { AIAction, resolveModelRoute } from './modelRouting';
import { validateGuardrails } from './guardrails';

// Wrapper unificado para comunicarse con la API de Gemini Flash 2.0
// Expone un método genérico que implementa en un futuro caching y reparaciones.

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const DEFAULT_MODEL = 'gemini-2.5-flash';

// CACHE EN MEMORIA (In-Memory Cache)
// Para producción masiva se sugeriría Redis, pero para este requerimiento basta memoria.
const globalAiCache = new Map<string, any>();

interface GeminiCallParams {
    systemInstruction: string;
    userPrompt: string;
    schema?: any; // El esquema Zod convertido a JSON Schema (Opcional por ahora si parseamos raw JSON)
    temperature?: number;
    topP?: number;
    topK?: number;
    modelId?: string;
    thinkingLevel?: 'low' | 'medium' | 'high';
    thinkingBudget?: number;
    responseMimeType?: string;
}

export async function callGemini(params: GeminiCallParams): Promise<string> {
    const { systemInstruction, userPrompt, temperature = 0.2 } = params;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY no detectada en las variables de entorno server-side.');
    }
    
    console.log(`[AUTH DEBUG] Next.js loaded API Key starting with: ${apiKey.substring(0, 15)}...`);

    const activeModel = params.modelId || DEFAULT_MODEL;

    // Build the request payload natively for the v1beta Google Generative Language API
    const requestPayload: any = {
        contents: [
            {
                role: 'user',
                parts: [{ text: userPrompt }]
            }
        ],
        generationConfig: {
            temperature: temperature,
            topP: params.topP,
            topK: params.topK,
            responseMimeType: params.responseMimeType || "application/json"
        }
    };

    if (systemInstruction) {
        requestPayload.systemInstruction = {
            role: 'system',
            parts: [{ text: systemInstruction }]
        };
    }

    if (activeModel.startsWith('gemini-3')) {
        if (params.thinkingBudget) {
            console.warn(`[AI Routing] MODELO ${activeModel} ignora thinkingBudget. Usando thinkingLevel en su lugar.`);
        }
        if (params.thinkingLevel) {
            requestPayload.generationConfig.thinkingConfig = { thinkingLevel: params.thinkingLevel === 'low' ? 'LOW' : params.thinkingLevel === 'high' ? 'HIGH' : 'STANDARD' };
        }
    } else if (activeModel.startsWith('gemini-2.5')) {
        if (params.thinkingLevel) {
            console.warn(`[AI Routing] MODELO ${activeModel} ignora thinkingLevel. Omitiendo.`);
            // DO NOT add thinkingLevel for 2.5 models — just skip it gracefully
        }
        if (params.thinkingBudget) {
            requestPayload.generationConfig.thinkingConfig = { thinkingBudget: params.thinkingBudget };
        }
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${activeModel}:generateContent?key=${apiKey}`;

    // Implementar AbortController para evitar hangs infinitos en Vercel
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 55000); // 55 segundos máximo por llamada individual (evita 504 global de Vercel)

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestPayload),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error?.message || `HTTP ${response.status}: ${JSON.stringify(data)}`);
        }

        const candidate = data.candidates?.[0];
        const finishReason = candidate?.finishReason;
        
        if (finishReason === 'SAFETY' || finishReason === 'BLOCKLIST' || finishReason === 'PROHIBITED_CONTENT' || finishReason === 'SPII' || finishReason === 'RECITATION') {
            throw new Error(`OUTPUT_BLOCKED: FinishReason=${finishReason}`);
        }

        const text = candidate?.content?.parts?.[0]?.text;

        if (!text) {
             throw new Error(`Respuesta vacía del modelo Gemini. Probable filtro de toxicidad sin finishReason explícito.`);
        }

        return text;
    } catch (error: any) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
             console.error(`[TIMEOUT] callGemini superó el límite de tiempo (55s) para el modelo ${activeModel}`);
             throw new Error(`Timeout: El modelo ${activeModel} tardó demasiado en responder.`);
        }
        console.error('Error in callGemini fetch:', error);
        throw new Error(`Fallo en llamada a Gemini: ${error.message}`);
    }
}

export const geminiClient = {
    generateStructuredObject: async (params: { schema: any, systemMessage: string, userMessage: string, temperature?: number, topP?: number, topK?: number }) => {
        let text = "";
        try {
            text = await callGemini({
                systemInstruction: params.systemMessage,
                userPrompt: params.userMessage,
                temperature: params.temperature,
                topP: params.topP,
                topK: params.topK
            });

            // Parseo Nivel 1: Limpieza básica
            let cleaned = text.trim();
            if (cleaned.startsWith('```json')) cleaned = cleaned.substring(7);
            if (cleaned.endsWith('```')) cleaned = cleaned.substring(0, cleaned.length - 3);
            cleaned = cleaned.trim();

            try {
                return JSON.parse(cleaned);
            } catch (pErr) {
                // Parseo Nivel 2: Extracción estricta del substring JSON
                console.warn("[geminiClient] Parseo Nivel 1 falló, intentando Nivel 2 (Regex)...");
                const jsonStrMatch = cleaned.match(/\{[\s\S]*\}/);
                if (!jsonStrMatch) throw new Error("Regex no pudo localizar un bloque JSON {}");
                const jsonStr = jsonStrMatch[0];

                try {
                    return JSON.parse(jsonStr);
                } catch (pErr2) {
                    // Parseo Nivel 3: Sanación inteligente con jsonrepair
                    console.warn("[geminiClient] Parseo Nivel 2 falló, intentando Nivel 3 (jsonrepair)...");
                    const repairedJson = jsonrepair(jsonStr);
                    return JSON.parse(repairedJson);
                }
            }
        } catch (error: any) {
            console.error("[geminiClient] Error crítico inescrutable. Generando fallback amigable para el frontend.", error);
            // Front-End interception trigger. Never throw a hard crash that white-screens the app.
            return {
                _IS_JSON_ERROR: true,
                raw_text: text,
                error_msg: error.message
            };
        }
    }
};

export interface AIExecutionOptions<T> {
    screen: string;
    action: AIAction;
    systemInstruction: string;
    userPrompt: string;
    inputHash: string;
    promptVersion: string;
    temperature?: number;
    validator: (data: any) => T; 
    responseMimeType?: string;
}

export async function executeAIAction<T>(opts: AIExecutionOptions<T>) {
    const route = resolveModelRoute(opts.screen, opts.action);
    const startOverall = Date.now();
    
    // BACKEND CACHE CHECK
    const cacheKey = `${route.cacheBucket}:${opts.inputHash}`;
    if (globalAiCache.has(cacheKey)) {
        const cachedResult = globalAiCache.get(cacheKey);
        return {
            success: true,
            data: cachedResult.data,
            telemetry: {
                ...cachedResult.telemetry,
                cacheHit: true,
                latencyMs: Date.now() - startOverall,
                timestamp: new Date().toISOString()
            }
        };
    }

    let lastError: any = null;
    let fallbackUsed = false;
    let triesCount = 0;

    for (let mIndex = 0; mIndex < route.orderedModels.length; mIndex++) {
        if (triesCount >= 3) break; // Máximo 3 intentos globales permitidos
        
        const modelInfo = route.orderedModels[mIndex];
        if (mIndex > 0) fallbackUsed = true;
        
        try {
            triesCount++;
            const rawText = await callGemini({
                systemInstruction: opts.systemInstruction,
                userPrompt: opts.userPrompt,
                temperature: opts.temperature || 0.2,
                modelId: modelInfo.modelId,
                thinkingLevel: modelInfo.thinkingLevel,
                thinkingBudget: modelInfo.thinkingBudget,
                responseMimeType: opts.responseMimeType
            });

            // Validacion vacia/truncada local
            if (!rawText || rawText.trim() === '') throw new Error("Respuesta vacía o truncada.");

            // Plaintext fallback bypass for non-json expectations
            if (opts.responseMimeType === 'text/plain') {
                const guardrailCheck = validateGuardrails(rawText);
                if (!guardrailCheck.valid) {
                     throw new Error("OUTPUT_BLOCKED: " + guardrailCheck.bannedTermsFound.join(', '));
                }
                const validData = opts.validator(rawText);
                const resultObj = {
                    success: true,
                    data: validData,
                    telemetry: {
                        modelUsed: modelInfo.modelId,
                        fallbackUsed,
                        cacheHit: false,
                        promptVersion: opts.promptVersion,
                        inputHash: opts.inputHash,
                        aiAction: opts.action,
                        screen: opts.screen,
                        latencyMs: Date.now() - startOverall,
                        timestamp: new Date().toISOString()
                    }
                };
                
                globalAiCache.set(cacheKey, resultObj);
                return resultObj;
            }

            let cleanJsonText = rawText.trim();
            // Forcefully extract JSON shape boundaries ignoring all hallucinated prefix/suffix text
            const jsonExtractionRegex = /(\{[\s\S]*\}|\[[\s\S]*\])/;
            const extractionMatch = cleanJsonText.match(jsonExtractionRegex);
            
            if (extractionMatch) {
                cleanJsonText = extractionMatch[0];
            }

            const guardrailCheck = validateGuardrails(cleanJsonText);
            if (!guardrailCheck.valid) {
                 throw new Error("OUTPUT_BLOCKED: " + guardrailCheck.bannedTermsFound.join(', '));
            }

            let parsed: any;
            try {
                parsed = JSON.parse(cleanJsonText);
            } catch (errParse) {
                console.warn(`[AI Router] JSON.parse nativo falló. Rescatando con jsonrepair...`);
                const repaired = jsonrepair(cleanJsonText);
                parsed = JSON.parse(repaired);
            }

            const validData = opts.validator(parsed);
            
            const resultObj = {
                success: true,
                data: validData,
                telemetry: {
                    modelUsed: modelInfo.modelId,
                    fallbackUsed,
                    cacheHit: false,
                    promptVersion: opts.promptVersion,
                    inputHash: opts.inputHash,
                    aiAction: opts.action,
                    screen: opts.screen,
                    timestamp: new Date().toISOString(),
                    latencyMs: Date.now() - startOverall
                }
            };
            
            globalAiCache.set(cacheKey, resultObj);
            return resultObj;

        } catch (err: any) {
            console.warn(`[AI Router] Falló intento ${triesCount} con modelo ${modelInfo.modelId}. Motivo: ${err.message}`);
            lastError = err;
            
            // Abortar instantáneamente todos los fallbacks si es un bloqueo de filtros de seguridad. 
            // Esto evita gastar cuota reintentando payloads que inminentemente fallarán de nuevo.
            if (err.message.includes("OUTPUT_BLOCKED")) {
                console.warn(`[AI Router] ABORTANDO FALLBACK LOOP POR BLOQUEO DE SEGURIDAD.`);
                break;
            }
            // Avanza en el loop usando la estrategia fallback telescópica nativa si es error de parsing o time-out
        }
    }

    throw new Error(`AI_FAILURE: Todas las rutas de fallback agotadas (intentos: ${triesCount}). Último error: ${lastError?.message}`);
}

