import { NextResponse } from 'next/server';
import { executeAIAction } from '@/lib/ai/geminiClient';
import { generateSHA256 } from '@/lib/ai/hash';
import { z } from 'zod';

const GroundingSchema = z.object({
    respuesta: z.string().describe("La explicación clínica o farmacológica solicitada, basada en la información encontrada."),
    fuentes_utilizadas: z.array(z.string()).describe("Lista de dominios o sitios web consultados (si aplica).")
});

export async function POST(req: Request) {
    try {
        const { query, userId } = await req.json();

        if (!query) {
            return NextResponse.json({ error: 'BAD_REQUEST', message: 'Falta la consulta (query).' }, { status: 400 });
        }

        const inputHash = await generateSHA256(`grounding:${query}`);

        const systemInstruction = `Eres un asistente clínico experto. Tu objetivo es proporcionar información médica factual y actualizada basada en tu herramienta de búsqueda en Google. 
Reglas:
1. Responde de forma concisa y directa al punto (idealmente 2-3 párrafos).
2. Usa lenguaje técnico apropiado para profesionales de la salud.
3. Si buscas un medicamento, indica su principio activo, uso principal, mecanismo de acción básico y efectos adversos relevantes para kinesiología (ej: mareos, sangrado, dolor muscular).
4. Si buscas un síndrome o técnica quirúrgica, resume en qué consiste y precauciones postoperatorias.`;

        const userPrompt = `Por favor, investiga y explica lo siguiente en contexto clínico: "${query}"

Por favor, entrega tu respuesta EXACTAMENTE en el siguiente formato JSON. No incluyas markdown, no incluyas texto fuera del JSON. Debes incluir las 2 claves:

{
  "respuesta": "string (Tu explicación detallada)",
  "fuentes_utilizadas": ["string", "string"] (Lista de URLs o fuentes consultadas, si las hay)
}`;

        const result = await executeAIAction({
            screen: 'EXPRESS',
            action: 'EXPRESS_GROUNDING',
            systemInstruction,
            userPrompt,
            inputHash,
            promptVersion: 'v1.0.0',
            temperature: 0.1,
            enableGrounding: true, // Habilita Google Search Grounding
            validator: (data) => GroundingSchema.parse(data)
        });

        return NextResponse.json({
            success: true,
            data: result.data,
            hash: result.telemetry.inputHash,
            latencyMs: result.telemetry.latencyMs,
            telemetry: result.telemetry
        });

    } catch (err: any) {
        console.error('Error in /api/ai/grounding:', err);
        return NextResponse.json({ error: 'INTERNAL_ERROR', message: err.message }, { status: 500 });
    }
}
