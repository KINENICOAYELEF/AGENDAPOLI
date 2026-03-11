import { GoogleGenAI } from '@google/genai';
import { jsonrepair } from 'jsonrepair';
import { generateSHA256, normalizePayload } from './hash';
import { AIAction, resolveModelRoute } from './routing';
import { validateGuardrails } from './guardrails';

// Wrapper unificado para comunicarse con la API de Gemini Flash 2.0
// Expone un método genérico que implementa en un futuro caching y reparaciones.

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const DEFAULT_MODEL = 'gemini-2.5-flash';

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
}

export async function callGemini(params: GeminiCallParams): Promise<string> {
    const { systemInstruction, userPrompt, temperature = 0.2 } = params;

    if (!process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY no detectada en las variables de entorno server-side.');
    }

    try {
        const configParams: any = {
            systemInstruction: systemInstruction,
            temperature: temperature,
            topP: params.topP,
            topK: params.topK,
            responseMimeType: "application/json"
        };

        if (params.thinkingLevel) {
            configParams.thinkingConfig = { thinkingLevel: params.thinkingLevel };
        } else if (params.thinkingBudget) {
            configParams.thinkingConfig = { thinkingBudget: params.thinkingBudget };
        }

        const response = await ai.models.generateContent({
            model: params.modelId || DEFAULT_MODEL,
            contents: userPrompt,
            config: configParams
        });

        if (!response.text) {
            throw new Error("Respuesta vacía del modelo Gemini.");
        }

        return response.text;
    } catch (error: any) {
        console.error('Error in callGemini SDK:', error);
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
}

export async function executeAIAction<T>(opts: AIExecutionOptions<T>) {
    const route = resolveModelRoute(opts.screen, opts.action);
    const startOverall = Date.now();
    
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
                thinkingBudget: modelInfo.thinkingBudget
            });

            // Validacion vacia/truncada local
            if (!rawText || rawText.trim() === '') throw new Error("Respuesta vacía o truncada.");

            const cleanJsonText = rawText.replace(/^[\r\n\s]*```json/gi, '').replace(/```[\r\n\s]*$/g, '').trim();
            
            const guardrailCheck = validateGuardrails(cleanJsonText);
            if (!guardrailCheck.valid) {
                 throw new Error("OUTPUT_BLOCKED: " + guardrailCheck.bannedTermsFound.join(', '));
            }

            const parsed = JSON.parse(cleanJsonText);
            const validData = opts.validator(parsed);
            
            return {
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

        } catch (err: any) {
            console.warn(`[AI Router] Falló intento ${triesCount} con modelo ${modelInfo.modelId}. Motivo: ${err.message}`);
            lastError = err;
            // Avanza en el loop usando la estrategia fallback telescópica nativa
        }
    }

    throw new Error(`AI_FAILURE: Todas las rutas de fallback agotadas (intentos: ${triesCount}). Último error: ${lastError?.message}`);
}

