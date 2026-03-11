import { NextResponse } from 'next/server';
import { executeAIAction } from '@/lib/ai/geminiClient';
import { generateSHA256 } from '@/lib/ai/hash';
import { z } from 'zod';

// Fase 2.2.1: Zod Schemas para Validación Estricta
const Schemas = {
    m10_eval: z.object({
        razonamiento: z.string(),
        sugerenciasUniversal: z.array(z.string()),
        sugerenciasCondicional: z.array(z.string())
    }),
    m11_dx: z.object({
        narrative: z.string(),
        icfStructure: z.string(),
        differentialFunctional: z.string()
    }),
    m12_obj: z.object({
        objectives: z.array(z.object({
            id: z.string(),
            tipo: z.enum(['General', 'Específico']),
            descripcion: z.string(),
            medida: z.string(),
            tiempoDignostico: z.string() // expected timeframe
        })),
        loadTrafficLight: z.enum(['Verde', 'Amarillo', 'Rojo']),
        loadTrafficLightJustification: z.string(),
        prognosisLabel: z.string(),
        operationalPlan: z.object({
            educationPlan: z.string(),
            interventionsPlanned: z.array(z.string())
        })
    })
};

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { prompt, schemaType } = body;

        const systemInstruction = `
[RESTRICCIÓN ABSOLUTA Y OBLIGATORIA]
ERES UN ASISTENTE EXPERTO EN KINESIOLOGÍA/FISIOTERAPIA MUSCULOESQUELÉTICA.
BAJO NINGUNA CIRCUNSTANCIA DEBES:
1. Sugerir, prescribir, dosificar o mencionar tratamientos farmacológicos (medicamentos).
2. Entregar diagnósticos médicos definitivos por imágenes (ej. "Tiene hernia L4-L5"). Usa síndromes o descripciones funcionales.
3. Sugerir terapias invasivas que excedan la práctica kinésica (Ej. Infiltraciones).
Siempre responde en FORMATO JSON VÁLIDO. Tu output debe ser estrictamente lo que se solicita.
`;

        const inputHash = await generateSHA256(`gemini-proxy:${prompt}:${schemaType}`);

        const aiResult = await executeAIAction({
            screen: 'GENERAL',
            action: 'GENERAL',
            systemInstruction: systemInstruction,
            userPrompt: prompt,
            inputHash,
            promptVersion: 'v1.0',
            temperature: 0.2,
            validator: (data) => {
                if (schemaType && Schemas[schemaType as keyof typeof Schemas]) {
                    const schema = Schemas[schemaType as keyof typeof Schemas];
                    return schema.parse(data);
                }
                return data; // Return raw object if no schema provided
            }
        });

        return NextResponse.json({ success: true, data: aiResult.data, telemetry: aiResult.telemetry });

    } catch (error: any) {
        console.error("Ruta Gemini Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
