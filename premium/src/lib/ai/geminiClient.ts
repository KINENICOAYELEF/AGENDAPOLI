import { GoogleGenAI } from '@google/genai';
import { jsonrepair } from 'jsonrepair';
import { generateSHA256, normalizePayload } from './hash';

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
}

export async function callGemini(params: GeminiCallParams): Promise<string> {
    const { systemInstruction, userPrompt, temperature = 0.2 } = params;

    if (!process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY no detectada en las variables de entorno server-side.');
    }

    try {
        const response = await ai.models.generateContent({
            model: DEFAULT_MODEL,
            contents: userPrompt,
            config: {
                systemInstruction: systemInstruction,
                temperature: temperature,
                topP: params.topP,
                topK: params.topK,
                responseMimeType: "application/json",
                // Si usamos responseSchema, importamos de zodToJsonSchema
                // responseSchema: params.schema 
            }
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
