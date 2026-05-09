import { NextResponse } from 'next/server';
import { executeAIAction } from '@/lib/ai/geminiClient';
import { generateSHA256 } from '@/lib/ai/hash';
import { z } from 'zod';

const ExpressStructureSchema = z.object({
    focoPrincipal: z.string().describe("Región principal o articulación afectada (ej: Rodilla Derecha)"),
    relatoEstructurado: z.string().describe("El texto de la entrevista, ordenado en viñetas o párrafos limpios y profesionales."),
    anamnesisRemota: z.string().describe("Antecedentes médicos, cirugías, fármacos, extraídos del texto."),
    examenFisico: z.string().describe("El examen físico estructurado (ROM, MMT, Pruebas Especiales, Palpación)."),
    sins: z.object({
        severidad: z.string(),
        irritabilidad: z.string(),
        naturaleza: z.string(),
        estadio: z.string()
    }).describe("Análisis SINS del caso"),
    hipotesis_orientativas: z.array(z.object({
        titulo: z.string(),
        fundamento: z.string()
    })).describe("1 a 3 hipótesis diagnósticas kinesiológicas"),
    sugerenciasFaltantes: z.array(z.object({
        pregunta: z.string(),
        por_que: z.string()
    })).describe("Lista de preguntas o evaluaciones cruciales que el kinesiólogo olvidó hacer, con su razón clínica.")
});

export async function POST(req: Request) {
    try {
        const { notasSubjetivas, notasObjetivas, userId } = await req.json();

        const inputHash = await generateSHA256(`express:${notasSubjetivas}:${notasObjetivas}`);

        const systemInstruction = `Eres un asistente clínico experto y Tutor Clínico Pedagógico de nivel avanzado. Tu rol es asistir a un kinesiólogo procesando sus "apuntes rápidos" (que incluyen tanto historia clínica como examen físico) tomados durante una sesión exprés.
Tu objetivo es:
1. Estructurar y redactar profesionalmente estos apuntes en un formato clínico de alto nivel.
2. Extraer y clasificar el SINS (Severidad, Irritabilidad, Naturaleza, Estadio/Tiempo).
3. Sugerir 1 a 3 hipótesis orientativas basadas en el relato y examen físico.
4. Actuar como un "Coach Clínico": Analiza la información exhaustivamente e identifica "vacíos de información" clínicos (ej: no descartó banderas rojas, faltan factores psicosociales, no evaluó fuerza). 
5. En 'sugerenciasFaltantes', entrega entre 3 y 5 preguntas o evaluaciones cruciales que el clínico olvidó, explicando el "por qué" clínico de cada una.
6. NO INVENTES DATOS. Si el examen físico o antecedentes están vacíos, indica "Sin datos registrados".`;

        const userPrompt = `A continuación los apuntes rápidos del clínico.

--- NOTAS SUBJETIVAS (Entrevista y Antecedentes) ---
${notasSubjetivas || 'Sin notas subjetivas'}

--- NOTAS OBJETIVAS (Examen Físico) ---
${notasObjetivas || 'Sin notas objetivas'}

Por favor, estructura esto EXACTAMENTE en el siguiente formato JSON. No incluyas markdown, no incluyas texto fuera del JSON. Debes incluir las 7 claves principales:

{
  "focoPrincipal": "string (Región o queja principal)",
  "relatoEstructurado": "string (Texto de entrevista ordenado)",
  "anamnesisRemota": "string (Antecedentes extraídos o 'Sin antecedentes registrados')",
  "examenFisico": "string (Examen físico estructurado o 'Sin datos registrados')",
  "sins": {
    "severidad": "string (Leve/Moderada/Severa)",
    "irritabilidad": "string (Baja/Media/Alta)",
    "naturaleza": "string (Mecánica/Neuropática/Nociplástica/Inflamatoria)",
    "estadio": "string (Agudo/Subagudo/Crónico)"
  },
  "hipotesis_orientativas": [
    { "titulo": "string", "fundamento": "string" }
  ],
  "sugerenciasFaltantes": [
    { "pregunta": "string (La pregunta o evaluación que falta)", "por_que": "string (El razonamiento docente)" }
  ]
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
