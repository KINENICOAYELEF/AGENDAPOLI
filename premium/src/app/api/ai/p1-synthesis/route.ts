import { NextResponse } from 'next/server';
import { executeAIAction } from '@/lib/ai/geminiClient';
import { P1SynthesisSchema } from '@/lib/ai/schemas';
import { generateSHA256, normalizePayload } from '@/lib/ai/hash';

const SYSTEM_PROMPT_P1_SYNTHESIS = `
[RESTRICCIÓN ABSOLUTA Y OBLIGATORIA]
Eres un asistente experto en kinesiología musculoesquelética y deportiva, con foco en:
- razonamiento clínico MSK
- clasificación del dolor
- irritabilidad
- descarte de red flags
- generación de hipótesis orientativas
- orientación de examen físico
- utilidad docente para internos
- lenguaje clínico riguroso pero sin sobrediagnóstico

NO DEBES BAJO NINGUNA CIRCUNSTANCIA:
- Entregar un diagnóstico médico definitivo por imágenes
- Escribir excesivamente largo, texto relleno o párrafos barrocos
- Inventar hipótesis sin fundamento
- Repetir de forma redundante todo lo que dijo la persona usuaria
- Pedir más de 5 preguntas faltantes
- Incluir salida narrativa adicional fuera del JSON solicitado

TU SALIDA DEBE SER EXCLUSIVAMENTE UN JSON VÁLIDO QUE CUMPLA CON LA ESTRUCTURA EXACTA. Piensa primero en descartar cuadros graves y luego en acercarte a confirmar tus hipótesis. Debe orientar el examen físico por módulos, no en bloque general. Debe ser especialmente bueno razonando irritabilidad, naturaleza del dolor y qué examen físico aporta realmente.
`;

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { payload } = body;

        if (!payload || !payload.interviewV4) {
            return NextResponse.json({ error: 'Missing payload or interviewV4' }, { status: 400 });
        }

        const normalizedPayload = normalizePayload(payload);
        const inputHash = await generateSHA256(`p1-synthesis:${normalizedPayload}`);

        const userPrompt = `
Genera la síntesis de P1 estructurada en json según las reglas. Responde de forma clínica, precisa y compacta.
DATOS CLÍNICOS ESTRUCTURADOS (ANAMNESIS Y MOTIVO DE CONSULTA):
${normalizedPayload}
        `;

        const result = await executeAIAction({
            screen: 'P1',
            action: 'P1_SYNTHESIS',
            systemInstruction: SYSTEM_PROMPT_P1_SYNTHESIS,
            userPrompt,
            inputHash,
            promptVersion: 'v1.0',
            temperature: 0.1, // Baja variabilidad
            validator: (data) => P1SynthesisSchema.parse(data)
        });

        return NextResponse.json({
            success: true,
            data: result.data,
            telemetry: result.telemetry
        });

    } catch (error: any) {
        console.error("Error en /api/ai/p1-synthesis:", error);
        return NextResponse.json(
            { error: 'Error generating P1 synthesis', details: error.message },
            { status: 500 }
        );
    }
}
