import { NextResponse } from 'next/server';
import { callGemini } from '@/lib/ai/geminiClient';
import { PROMPTS, SYSTEM_PROMPT_BASE } from '@/lib/ai/prompts';
import { PlanSchema, ReevaluationPlanSchema } from '@/lib/ai/schemas';
import { generateSHA256, normalizePayload } from '@/lib/ai/hash';
import { validateGuardrails } from '@/lib/ai/guardrails';

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

        let finalJsonResult: any;

        try {
            const gStart = Date.now();
            const rawText = await callGemini({
                systemInstruction: SYSTEM_PROMPT_BASE + "\\n\\n" + targetPrompt,
                userPrompt: userPrompt,
                temperature: 0.3 // Ligeramente más var para proponer ejercicios
            });

            const cleanJsonText = rawText.replace(/^[\r\n\s]*```json/gi, '').replace(/```[\r\n\s]*$/g, '').trim();

            const guardrailCheck = validateGuardrails(cleanJsonText);
            if (!guardrailCheck.valid) {
                return NextResponse.json({ error: 'OUTPUT_BLOCKED', message: 'El modelo intentó sugerir terapias no permitidas.', bannedTerms: guardrailCheck.bannedTermsFound }, { status: 400 });
            }

            const parsedObj = JSON.parse(cleanJsonText);
            finalJsonResult = targetSchema.parse(parsedObj);

            const latencyMs = Date.now() - gStart;

            return NextResponse.json({ success: true, data: finalJsonResult, hash: inputHash, latencyMs });

        } catch (parseError: any) {
            console.warn("Fallo el parseo o validación Zod. Iniciando Repair. Error:", parseError.message);
            try {
                const repairPrompt = `
FALLO LA VALIDACIÓN ZOD O EL PARSEO JSON DEL INTENTO ANTERIOR. Error:
${parseError.message}

DATOS CLÍNICOS ESTRUCTURADOS DE ENTRADA ORIGINALES:
${normalizedPayload}

TU OBLIGACIÓN:
Devuelve un JSON STRICT que cumpla con TODOS los campos faltantes, según el esquema exigido.
            `;
                const rawText2 = await callGemini({ systemInstruction: SYSTEM_PROMPT_BASE + "\\n\\n" + targetPrompt, userPrompt: repairPrompt, temperature: 0.1 });
                const cleanJsonText2 = rawText2.replace(/^[\r\n\s]*```json/gi, '').replace(/```[\r\n\s]*$/g, '').trim();
                const guardrailCheck2 = validateGuardrails(cleanJsonText2);
                if (!guardrailCheck2.valid) {
                    return NextResponse.json({ error: 'OUTPUT_BLOCKED', message: 'Modelo insistió en términos prohibidos.', bannedTerms: guardrailCheck2.bannedTermsFound }, { status: 400 });
                }
                const parsedObj2 = JSON.parse(cleanJsonText2);
                finalJsonResult = targetSchema.parse(parsedObj2);

                return NextResponse.json({ success: true, data: finalJsonResult, hash: inputHash, latencyMs: 9999, repaired: true });
            } catch (repairError: any) {
                console.error("Fallo irreparable", repairError);
                return NextResponse.json({ error: 'JSON_SCHEMA_FAILURE', message: 'El motor falló en construir respuesta válida tras reparar.' }, { status: 500 });
            }
        }

    } catch (err: any) {
        console.error('Error in /api/ai/plan:', err);
        return NextResponse.json({ error: 'INTERNAL_ERROR', message: err.message }, { status: 500 });
    }
}
