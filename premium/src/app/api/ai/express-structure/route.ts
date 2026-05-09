import { NextResponse } from 'next/server';
import { executeAIAction } from '@/lib/ai/geminiClient';
import { generateSHA256 } from '@/lib/ai/hash';
import { z } from 'zod';

const ExpressStructureSchema = z.object({
    focoPrincipal: z.string().describe("Región principal o articulación afectada (ej: Rodilla Derecha)"),
    relatoEstructurado: z.string().describe("El texto de la entrevista, ordenado en viñetas o párrafos limpios y profesionales."),
    anamnesisRemota: z.string().describe("Antecedentes médicos, cirugías, fármacos, extraídos del texto."),
    examenFisico: z.string().describe("El examen físico estructurado (ROM, MMT, Pruebas Especiales, Palpación)."),
    sugerenciasFaltantes: z.array(z.string()).describe("Lista de preguntas o evaluaciones cruciales que el kinesiólogo olvidó hacer, basándose en la queja principal (banderas rojas, etc.)")
});

export async function POST(req: Request) {
    try {
        const { notasSubjetivas, notasObjetivas, userId } = await req.json();

        const inputHash = await generateSHA256(`express:${notasSubjetivas}:${notasObjetivas}`);

        const systemInstruction = `Eres un asistente clínico avanzado que asiste a un kinesiólogo/fisioterapeuta durante la evaluación inicial de un paciente.
El profesional te enviará sus "apuntes rápidos" o notas sueltas tomadas durante la sesión.
Tu objetivo es:
1. Estructurar y redactar profesionalmente estos apuntes.
2. Separar claramente lo que es historia actual, antecedentes remotos, y examen físico.
3. Actuar como un "Coach Clínico": Si notas que en los apuntes el profesional olvidó mencionar cosas críticas (ej: descartar banderas rojas para dolor lumbar, preguntar por comportamiento nocturno del dolor, o evaluar fuerza específica), debes sugerirlo en la lista de 'sugerenciasFaltantes'.
4. NO INVENTES DATOS. Si el examen físico está vacío, simplemente déjalo en blanco o indica "Sin datos registrados".`;

        const userPrompt = `A continuación los apuntes rápidos del clínico.

--- NOTAS SUBJETIVAS (Entrevista y Antecedentes) ---
${notasSubjetivas || 'Sin notas subjetivas'}

--- NOTAS OBJETIVAS (Examen Físico) ---
${notasObjetivas || 'Sin notas objetivas'}

Por favor, estructura esto EXACTAMENTE en el siguiente formato JSON. No incluyas markdown, no incluyas texto fuera del JSON. Debes incluir las 5 claves:

{
  "focoPrincipal": "string (Región o queja principal)",
  "relatoEstructurado": "string (Texto de entrevista ordenado)",
  "anamnesisRemota": "string (Antecedentes extraídos o 'Sin antecedentes registrados')",
  "examenFisico": "string (Examen físico estructurado o 'Sin datos registrados')",
  "sugerenciasFaltantes": ["string", "string"]
}`;

        const result = await executeAIAction({
            screen: 'EXPRESS',
            action: 'EXPRESS_STRUCTURE',
            systemInstruction,
            userPrompt,
            inputHash,
            promptVersion: 'v1.0.0',
            temperature: 0.1,
            validator: (data) => ExpressStructureSchema.parse(data)
        });

        return NextResponse.json({
            success: true,
            data: result.data,
            hash: result.telemetry.inputHash,
            latencyMs: result.telemetry.latencyMs,
            telemetry: result.telemetry
        });

    } catch (err: any) {
        console.error('Error in /api/ai/express-structure:', err);
        return NextResponse.json({ error: 'INTERNAL_ERROR', message: err.message }, { status: 500 });
    }
}
