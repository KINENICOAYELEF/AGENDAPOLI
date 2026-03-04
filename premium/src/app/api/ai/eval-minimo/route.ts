import { NextResponse } from 'next/server';
import { callGemini } from '@/lib/ai/geminiClient';
import { PROMPTS, SYSTEM_PROMPT_BASE } from '@/lib/ai/prompts';
import { EvalMinimoSchema } from '@/lib/ai/schemas';
import { generateSHA256, normalizePayload } from '@/lib/ai/hash';
import { validateGuardrails } from '@/lib/ai/guardrails';

// Simple in-memory rate limiting (Para MVP, ideal Redis en prod)
const rateLimitCache = new Map<string, { count: number; timestamp: number }>();
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 min
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

    if (record.count >= MAX_REQUESTS) {
        return false;
    }

    record.count += 1;
    return true;
}

export async function POST(req: Request) {
    try {
        const { year, procesoId, evaluacionId, evaluationType, payload, userId } = await req.json();

        // 1. Rate Limiting Check
        if (userId && !checkRateLimit(userId)) {
            return NextResponse.json({ error: 'RATE_LIMIT_EXCEEDED', message: 'Has excedido el límite de peticiones (10 requests / 10 min).' }, { status: 429 });
        }

        // 2. Normalizar Payload
        const normalizedPayload = normalizePayload({ interview: payload.interview, autoEngineOutputs: payload.autoEngineOutputs });

        // 3. Crear Hash (esto debería validarse en cliente y no enviar si es igual, pero por seguridad lo calculamos)
        const inputHash = await generateSHA256(`eval-minimo:${normalizedPayload}`);

        // Si pasamos el payload a Gemini, le recordamos usar JSON
        const userPrompt = `
Genera el output requerido usando EXCLUSIVAMENTE formato JSON parseable y cumpliendo todas las reglas.
DATOS CLÍNICOS ESTRUCTURADOS DE ENTRADA:
${normalizedPayload}
    `;

        let finalJsonResult: any;

        try {
            const gStart = Date.now();
            const rawText = await callGemini({
                systemInstruction: SYSTEM_PROMPT_BASE + "\\n\\n" + PROMPTS.EVAL_MINIMO,
                userPrompt: userPrompt,
                temperature: 0.1
            });

            // Lógica de sanitización de markdown codeblocks si Gemini falló en devolver texto puro
            const cleanJsonText = rawText.replace(/^[\r\n\s]*```json/gi, '').replace(/```[\r\n\s]*$/g, '').trim();

            // Validación Guardrails post-respuesta
            const guardrailCheck = validateGuardrails(cleanJsonText);
            if (!guardrailCheck.valid) {
                return NextResponse.json({
                    error: 'OUTPUT_BLOCKED',
                    message: 'El modelo intentó sugerir terapias no permitidas.',
                    bannedTerms: guardrailCheck.bannedTermsFound
                }, { status: 400 });
            }

            // Parse JSON
            const parsedObj = JSON.parse(cleanJsonText);

            // Zod Validation Strict
            finalJsonResult = EvalMinimoSchema.parse(parsedObj);

            const latencyMs = Date.now() - gStart;

            return NextResponse.json({
                success: true,
                data: finalJsonResult,
                hash: inputHash,
                latencyMs
            });

        } catch (parseError: any) {
            // Intento 1 de "repair"
            console.warn("Fallo el parseo o validación Zod en primera pasada. Iniciando Repair. Error:", parseError.message);
            try {
                const repairPrompt = `
FALLO LA VALIDACIÓN ZOD O EL PARSEO JSON DEL INTENTO ANTERIOR.
El error arrojado por el validador estricto fue:
${parseError.message}

DATOS CLÍNICOS ESTRUCTURADOS DE ENTRADA ORIGINALES:
${normalizedPayload}

TU OBLIGACIÓN:
Devuelve un JSON STRICT que cumpla con TODOS los campos que falten, según el esquema exigido. NO agregues notas, solo el JSON raw.
            `;

                const rawText2 = await callGemini({
                    systemInstruction: SYSTEM_PROMPT_BASE + "\\n\\n" + PROMPTS.EVAL_MINIMO,
                    userPrompt: repairPrompt,
                    temperature: 0.1
                });
                const cleanJsonText2 = rawText2.replace(/^[\r\n\s]*```json/gi, '').replace(/```[\r\n\s]*$/g, '').trim();

                const guardrailCheck2 = validateGuardrails(cleanJsonText2);
                if (!guardrailCheck2.valid) {
                    return NextResponse.json({ error: 'OUTPUT_BLOCKED', message: 'Modelo insistió en términos prohibidos.', bannedTerms: guardrailCheck2.bannedTermsFound }, { status: 400 });
                }

                const parsedObj2 = JSON.parse(cleanJsonText2);
                finalJsonResult = EvalMinimoSchema.parse(parsedObj2);

                return NextResponse.json({
                    success: true,
                    data: finalJsonResult,
                    hash: inputHash,
                    latencyMs: 9999,
                    repaired: true
                });

            } catch (repairError: any) {
                console.error("Fallo irreparable en generación JSON", repairError);
                return NextResponse.json({ error: 'JSON_SCHEMA_FAILURE', message: 'El motor falló en construir una respuesta válida tras la reparación.' }, { status: 500 });
            }
        }

    } catch (err: any) {
        console.error('Error in /api/ai/eval-minimo:', err);
        return NextResponse.json({ error: 'INTERNAL_ERROR', message: err.message }, { status: 500 });
    }
}
