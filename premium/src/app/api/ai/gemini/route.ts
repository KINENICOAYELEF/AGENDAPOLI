import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
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

        if (!process.env.GEMINI_API_KEY) {
            console.warn("GEMINI_API_KEY no encontrada. Configura la variable de entorno.");
            return NextResponse.json({ success: false, error: 'API Key ausente en servidor.' }, { status: 500 });
        }

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

        // RESTRICCIÓN ABSOLUTA Y OBLIGATORIA DEL SISTEMA KINE-POLI (Fase 8 & 2.2.1)
        const systemInstruction = `
[RESTRICCIÓN ABSOLUTA Y OBLIGATORIA]
ERES UN ASISTENTE EXPERTO EN KINESIOLOGÍA/FISIOTERAPIA MUSCULOESQUELÉTICA.
BAJO NINGUNA CIRCUNSTANCIA DEBES:
1. Sugerir, prescribir, dosificar o mencionar tratamientos farmacológicos (medicamentos).
2. Entregar diagnósticos médicos definitivos por imágenes (ej. "Tiene hernia L4-L5"). Usa síndromes o descripciones funcionales.
3. Sugerir terapias invasivas que excedan la práctica kinésica (Ej. Infiltraciones).
Siempre responde en FORMATO JSON VÁLIDO. Tu output debe ser estrictamente lo que se solicita.
`;

        const model = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash',
            systemInstruction: systemInstruction
        });

        const chat = model.startChat({
            generationConfig: {
                temperature: 0.2, // Baja variabilidad para asegurar estructura JSON
                responseMimeType: "application/json",
            }
        });

        const result = await chat.sendMessage(prompt);
        const text = result.response.text();

        // Manejar posibles delimitadores de markdown accidentales (aunque mimeType json suele evitarlos)
        const cleanJson = text.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();

        let parsed;
        try {
            parsed = JSON.parse(cleanJson);
        } catch (e) {
            console.error("Error parseando respuesta de Gemini a JSON:", cleanJson);
            return NextResponse.json({ success: false, error: 'Respuesta de IA no parseable' }, { status: 400 });
        }

        // Validación Zod Dirigida
        if (schemaType && Schemas[schemaType as keyof typeof Schemas]) {
            const schema = Schemas[schemaType as keyof typeof Schemas];
            const validation = schema.safeParse(parsed);
            if (!validation.success) {
                console.error("Zod Validation Failed para", schemaType, validation.error);
                return NextResponse.json({
                    success: false,
                    error: 'Violación de Esquema JSON (Zod)',
                    details: validation.error.format()
                }, { status: 400 });
            }
            parsed = validation.data;
        }

        return NextResponse.json({ success: true, data: parsed });

    } catch (error: any) {
        console.error("Ruta Gemini Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
