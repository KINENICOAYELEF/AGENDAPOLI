import { NextResponse } from 'next/server';
import { executeAIAction } from '@/lib/ai/geminiClient';
import { PROMPTS, SYSTEM_PROMPT_BASE } from '@/lib/ai/prompts';
import { EvalMinimoSchema } from '@/lib/ai/schemas';
import { generateSHA256, normalizePayload } from '@/lib/ai/hash';

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

        const result = await executeAIAction({
            screen: 'EVAL_MINIMO',
            action: 'EVAL_MINIMO',
            systemInstruction: SYSTEM_PROMPT_BASE + "\\n\\n" + PROMPTS.EVAL_MINIMO,
            userPrompt,
            inputHash,
            promptVersion: 'v2.0',
            temperature: 0.1,
            validator: (data) => EvalMinimoSchema.parse(data)
        });

        // Current UI expects { success: true, data: ..., hash, latencyMs, repaired (optional) }
        return NextResponse.json({
            success: true,
            data: result.data,
            hash: result.telemetry.inputHash,
            latencyMs: result.telemetry.latencyMs,
            repaired: result.telemetry.fallbackUsed,
            telemetry: result.telemetry
        });

    } catch (err: any) {
        console.error('Error in /api/ai/eval-minimo:', err);
        return NextResponse.json({ error: 'INTERNAL_ERROR', message: err.message }, { status: 500 });
    }
}
