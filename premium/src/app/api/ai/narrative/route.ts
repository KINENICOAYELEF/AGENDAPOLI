import { NextResponse } from 'next/server';
import { executeAIAction } from '@/lib/ai/geminiClient';
import { PROMPTS, SYSTEM_PROMPT_BASE } from '@/lib/ai/prompts';
import { NarrativeSchema } from '@/lib/ai/schemas';
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
        const payloadArgs = await req.json();
        // Puede venir como un json plano o encapsulado en .payload (soporta ambos casos antiguos)
        const payload = payloadArgs.payload || payloadArgs;
        const userId = payloadArgs.userId;

        if (userId && !checkRateLimit(userId)) {
            return NextResponse.json({ error: 'RATE_LIMIT_EXCEEDED', message: 'Has excedido el límite de peticiones (10 requests / 10 min).' }, { status: 429 });
        }

        // El frontend ahora entrega la estructura destilada (normalizedContext) junto con la synthesis P3 íntegra
        const normalizedPayload = normalizePayload({
            normalizedContext: payload.normalizedContext,
            synthesis: payload.synthesis || payload.autoSynthesis
        });

        const inputHash = await generateSHA256(`narrative:${normalizedPayload}`);

        const expectedJsonExample = `{
  "narrativeDiagnosis": "...",
  "generalObjectiveOptions": ["...", "..."],
  "smartGoals": [
    { "description": "...", "linkedVariable": "..." }
  ],
  "prognosis": {
    "shortTerm": "...",
    "mediumTerm": "...",
    "category": "...",
    "justification": "..."
  },
  "pillars": [
    { "name": "...", "description": "..." }
  ],
  "masterPlan": "...",
  "reassessmentRules": {
    "comparableSign": "...",
    "variables": ["..."],
    "frequency": "...",
    "progressCriteria": "...",
    "stagnationCriteria": "..."
  }
}`;

        const userPrompt = `
Genera el output requerido usando EXCLUSIVAMENTE formato JSON parseable y cumpliendo estrictamente con la siguiente estructura y tipos exactos:
${expectedJsonExample}

DATOS CLÍNICOS ESTRUCTURADOS DE ENTRADA:
${normalizedPayload}
    `;

        const requestedAction = payloadArgs.aiAction === 'P4_PREMIUM' ? 'P4_PREMIUM' : 'P4_BASE';

        const result = await executeAIAction({
            screen: 'P4',
            action: requestedAction,
            systemInstruction: SYSTEM_PROMPT_BASE + "\\n\\n" + PROMPTS.NARRATIVE,
            userPrompt,
            inputHash,
            promptVersion: 'v1.0',
            temperature: 0.2, // Base temperature
            validator: (data) => NarrativeSchema.parse(data)
        });

        // The UI currently expects `{ success: true, data: ..., hash, latencyMs }`
        return NextResponse.json({
            success: true,
            data: result.data,
            hash: result.telemetry.inputHash,
            latencyMs: result.telemetry.latencyMs,
            telemetry: result.telemetry
        });

    } catch (err: any) {
        console.error('Error in /api/ai/narrative:', err);
        return NextResponse.json({ error: 'INTERNAL_ERROR', message: err.message }, { status: 500 });
    }
}
