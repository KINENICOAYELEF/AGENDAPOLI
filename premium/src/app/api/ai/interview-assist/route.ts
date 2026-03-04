import { NextResponse } from 'next/server';
import { geminiClient } from '@/lib/ai/geminiClient';
import { InterviewAssistSchema } from '@/lib/ai/schemas';
import { PROMPTS, SYSTEM_PROMPT_BASE } from '@/lib/ai/prompts';

export const maxDuration = 45; // Max execution time para hobby Vercel

export async function POST(req: Request) {
    try {
        const body = await req.json();

        // Validación básica
        if (!body.freeNarrative) {
            return NextResponse.json(
                { error: 'freeNarrative es requerido para esta función.' },
                { status: 400 }
            );
        }

        console.log('[AI_API] Generando Interview Assist desde Relato Libre...');

        // Llamada a Gemini con validación estructurada JSON Zod
        const result = await geminiClient.generateStructuredObject({
            schema: InterviewAssistSchema,
            systemMessage: SYSTEM_PROMPT_BASE + '\n\n' + PROMPTS.INTERVIEW_ASSIST,
            userMessage: `Relato Libre Ingresado:\n\n"""\n${body.freeNarrative}\n"""`
        });

        // 5) Responder
        return NextResponse.json({
            success: true,
            data: result
        });

    } catch (error: any) {
        console.error('[AI_API] Error en /api/ai/interview-assist:', error);

        let errorMsg = 'Error procesando solicitud de IA';
        if (error.parsedOutput) {
            errorMsg = 'Error en parseo ZOD. Output crudo: ' + JSON.stringify(error.parsedOutput);
        }

        return NextResponse.json(
            { error: errorMsg, details: error.message },
            { status: 500 }
        );
    }
}
