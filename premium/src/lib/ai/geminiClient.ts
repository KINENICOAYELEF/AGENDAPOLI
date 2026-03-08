import { GoogleGenAI } from '@google/genai';
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
        const text = await callGemini({
            systemInstruction: params.systemMessage,
            userPrompt: params.userMessage,
            temperature: params.temperature,
            topP: params.topP,
            topK: params.topK
        });

        let cleaned = text.trim();
        if (cleaned.startsWith('```json')) cleaned = cleaned.substring(7);
        if (cleaned.endsWith('```')) cleaned = cleaned.substring(0, cleaned.length - 3);

        return JSON.parse(cleaned.trim());
    }
};
