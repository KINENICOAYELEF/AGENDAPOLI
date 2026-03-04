import { NextResponse } from 'next/server';
import { geminiClient } from '@/lib/ai/geminiClient';
import { ExamPrioritizerSchema } from '@/lib/ai/schemas';
import { PROMPTS, SYSTEM_PROMPT_BASE } from '@/lib/ai/prompts';

export const maxDuration = 45; // Max execution time

export async function POST(req: Request) {
    try {
        const body = await req.json();

        if (!body.interview) {
            return NextResponse.json(
                { error: 'El objeto interview estructurado es requerido.' },
                { status: 400 }
            );
        }

        console.log('[AI_API] Priorizando Checklist de Examen Físico vía AI...');

        // Llamada a Gemini
        const result = await geminiClient.generateStructuredObject({
            schema: ExamPrioritizerSchema,
            systemMessage: SYSTEM_PROMPT_BASE + '\n\n' + PROMPTS.EXAM_PRIORITIZER,
            userMessage: `Anamnesis Estructurada y Resultados del Auto-Engine del Paciente:\n\n\`\`\`json\n${JSON.stringify(body.interview, null, 2)}\n\`\`\``
        });

        return NextResponse.json({
            success: true,
            data: result
        });

    } catch (error: any) {
        console.error('[AI_API] Error en /api/ai/exam-prioritizer:', error);

        let errorMsg = 'Error generando Plan de Examen';
        return NextResponse.json(
            { error: errorMsg, details: error.message },
            { status: 500 }
        );
    }
}
