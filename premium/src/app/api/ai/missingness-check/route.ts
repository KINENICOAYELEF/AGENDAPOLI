import { NextResponse } from 'next/server';
import { geminiClient } from '@/lib/ai/geminiClient';
import { MissingnessCheckSchema } from '@/lib/ai/schemas';
import { PROMPTS, SYSTEM_PROMPT_BASE } from '@/lib/ai/prompts';

export const maxDuration = 45; // Max execution time

export async function POST(req: Request) {
    try {
        const body = await req.json();

        // Necesitamos el JSON de la entrevista a analizar
        if (!body.interview) {
            return NextResponse.json(
                { error: 'El objeto interview completo es requerido.' },
                { status: 400 }
            );
        }

        console.log('[AI_API] Auditando lagunas y sesgos de Missingness...');

        // Llamada
        const result = await geminiClient.generateStructuredObject({
            schema: MissingnessCheckSchema,
            systemMessage: SYSTEM_PROMPT_BASE + '\n\n' + PROMPTS.MISSINGNESS_CHECK,
            userMessage: `A continuación el Payload Estructurado de la Anamnesis Próxima:\n\n\`\`\`json\n${JSON.stringify(body.interview, null, 2)}\n\`\`\``
        });

        return NextResponse.json({
            success: true,
            data: result
        });

    } catch (error: any) {
        console.error('[AI_API] Error en /api/ai/missingness-check:', error);

        let errorMsg = 'Error auditando Entrevista';
        return NextResponse.json(
            { error: errorMsg, details: error.message },
            { status: 500 }
        );
    }
}
