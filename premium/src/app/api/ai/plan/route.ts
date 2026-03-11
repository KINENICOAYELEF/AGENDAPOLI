import { NextResponse } from 'next/server';
import { executeAIAction } from '@/lib/ai/geminiClient';
import { PROMPTS, SYSTEM_PROMPT_BASE } from '@/lib/ai/prompts';
import { PlanSchema, ReevaluationPlanSchema } from '@/lib/ai/schemas';
import { generateSHA256, normalizePayload } from '@/lib/ai/hash';

const rateLimitCache = new Map<string, { count: number; timestamp: number }>();
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS = 10;

function checkRateLimit(userId: string): boolean {
    const now = Date.now();
    const record = rateLimitCache.get(userId);

    if (!record) {
        rateLimitCache.set(userId, { count: 1, timestamp: now });
        return true;
    }
    if (now - record.timestamp > RATE_LIMIT_WINDOW_MS) {
        rateLimitCache.set(userId, { count: 1, timestamp: now });
        return true;
    }
    if (record.count >= MAX_REQUESTS) return false;
    record.count += 1;
    return true;
}

export async function POST(req: Request) {
    try {
        const { payload, userId } = await req.json();

        if (userId && !checkRateLimit(userId)) {
            return NextResponse.json({ error: 'RATE_LIMIT_EXCEEDED', message: 'Has excedido el límite de peticiones.' }, { status: 429 });
        }

        const normalizedPayload = normalizePayload({
            interview: payload.interview,
            guidedExam: payload.guidedExam,
            autoSynthesis: payload.autoSynthesis,
            autoEngineOutputs: payload.autoEngineOutputs,
            geminiDiagnosticState: payload.geminiDiagnostic, // Importante si ya existe diagnóstico para basar el plan en él
            reevaluation: payload.reevaluation // Para la rama de retest
        });

        const isReeval = payload.isReevaluation === true;
        const targetPrompt = isReeval ? PROMPTS.REEVALUATION : PROMPTS.PLAN;
        const targetSchema = isReeval ? ReevaluationPlanSchema : PlanSchema;

        const inputHash = await generateSHA256(`plan:${isReeval}:${normalizedPayload}`);

        const userPrompt = `
Genera el output requerido usando EXCLUSIVAMENTE formato JSON parseable y cumpliendo todas las reglas.
DATOS CLÍNICOS ESTRUCTURADOS DE ENTRADA:
${normalizedPayload}
    `;

        const result = await executeAIAction({
            screen: 'P4', // Plan is part of P4 logically
            action: 'PLAN',
            systemInstruction: SYSTEM_PROMPT_BASE + "\\n\\n" + targetPrompt,
            userPrompt,
            inputHash,
            promptVersion: 'v1.0',
            temperature: 0.3, // Slightly higher temp for plan proposals
            validator: (data) => targetSchema.parse(data)
        });

        return NextResponse.json({
            success: true,
            data: result.data,
            hash: result.telemetry.inputHash,
            latencyMs: result.telemetry.latencyMs,
            telemetry: result.telemetry
        });

    } catch (err: any) {
        console.error('Error in /api/ai/plan:', err);
        return NextResponse.json({ error: 'INTERNAL_ERROR', message: err.message }, { status: 500 });
    }
}
