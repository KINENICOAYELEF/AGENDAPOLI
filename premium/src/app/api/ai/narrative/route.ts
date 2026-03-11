import { NextResponse } from 'next/server';
import { callGemini } from '@/lib/ai/geminiClient';
import { PROMPTS, SYSTEM_PROMPT_BASE } from '@/lib/ai/prompts';
import { NarrativeSchema } from '@/lib/ai/schemas';
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
        const payloadArgs = await req.json();
        // Puede venir como un json plano o encapsulado en .payload (soporta ambos casos antiguos)
        const payload = payloadArgs.payload || payloadArgs;
        const userId = payloadArgs.userId;

        if (userId && !checkRateLimit(userId)) {
            return NextResponse.json({ error: 'RATE_LIMIT_EXCEEDED', message: 'Has excedido el límite de peticiones (10 requests / 10 min).' }, { status: 429 });
        }

        const normalizedPayload = normalizePayload({
            interview: payload.interview,
            guidedExam: payload.exam || payload.guidedExam,
            synthesis: payload.synthesis || payload.autoSynthesis
        });

        const inputHash = await generateSHA256(`narrative:${normalizedPayload}`);

        const expectedJsonExample = `{
  "version": "1.0",
  "safety_alerts": ["..."],
  "clinical_considerations": ["..."],
  "missing_data_to_confirm": ["..."],
  "diagnosis_narrative": "...",
  "differential_functional": ["..."]
}`;

        const userPrompt = `
Genera el output requerido usando EXCLUSIVAMENTE formato JSON parseable y cumpliendo estrictamente con la siguiente estructura y tipos exactos:
${expectedJsonExample}

DATOS CLÍNICOS ESTRUCTURADOS DE ENTRADA:
${normalizedPayload}
    `;

        let finalJsonResult: any;

        try {
            const gStart = Date.now();
            const rawText = await callGemini({
                systemInstruction: SYSTEM_PROMPT_BASE + "\\n\\n" + PROMPTS.NARRATIVE,
                userPrompt: userPrompt,
                temperature: 0.2
            });

            const cleanJsonText = rawText.replace(/^[\r\n\s]*```json/gi, '').replace(/```[\r\n\s]*$/g, '').trim();

            const guardrailCheck = validateGuardrails(cleanJsonText);
            if (!guardrailCheck.valid) {
                return NextResponse.json({ error: 'OUTPUT_BLOCKED', message: 'El modelo intentó sugerir terapias no permitidas.', bannedTerms: guardrailCheck.bannedTermsFound }, { status: 400 });
            }

            const parsedObj = JSON.parse(cleanJsonText);
            finalJsonResult = NarrativeSchema.parse(parsedObj);

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
Devuelve un JSON STRICT que cumpla con TODOS los campos faltantes, la estructura exacta:
${expectedJsonExample}
            `;
                const rawText2 = await callGemini({ systemInstruction: SYSTEM_PROMPT_BASE + "\\n\\n" + PROMPTS.NARRATIVE, userPrompt: repairPrompt, temperature: 0.1 });
                const cleanJsonText2 = rawText2.replace(/^[\r\n\s]*```json/gi, '').replace(/```[\r\n\s]*$/g, '').trim();
                const guardrailCheck2 = validateGuardrails(cleanJsonText2);
                if (!guardrailCheck2.valid) {
                    return NextResponse.json({ error: 'OUTPUT_BLOCKED', message: 'Modelo insistió en términos prohibidos.', bannedTerms: guardrailCheck2.bannedTermsFound }, { status: 400 });
                }
                const parsedObj2 = JSON.parse(cleanJsonText2);
                finalJsonResult = NarrativeSchema.parse(parsedObj2);

                return NextResponse.json({ success: true, data: finalJsonResult, hash: inputHash, latencyMs: 9999, repaired: true });
            } catch (repairError: any) {
                console.error("Fallo irreparable", repairError);
                return NextResponse.json({ error: 'JSON_SCHEMA_FAILURE', message: 'El motor falló en construir respuesta válida tras reparar.' }, { status: 500 });
            }
        }

    } catch (err: any) {
        console.error('Error in /api/ai/narrative:', err);
        return NextResponse.json({ error: 'INTERNAL_ERROR', message: err.message }, { status: 500 });
    }
}
