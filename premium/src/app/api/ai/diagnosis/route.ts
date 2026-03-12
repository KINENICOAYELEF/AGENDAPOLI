import { NextResponse } from 'next/server';
import { executeAIAction } from '@/lib/ai/geminiClient';
import { PROMPTS, SYSTEM_PROMPT_BASE } from '@/lib/ai/prompts';
import { DiagnosisSchema } from '@/lib/ai/schemas';
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
            return NextResponse.json({ error: 'RATE_LIMIT_EXCEEDED', message: 'Has excedido el límite de peticiones (10 requests / 10 min).' }, { status: 429 });
        }

        // El frontend ahora entrega obj minimalistas/compactos (payload.compactInterview, payload.compactPhysical) en lugar del formData inmenso.
        const normalizedPayload = normalizePayload({
            compactInterview: payload.compactInterview,
            compactPhysical: payload.compactPhysical,
            p15_core: payload.p15_core,
            autoTrafficLight: payload.autoTrafficLight
        });

        const inputHash = await generateSHA256(`diagnosis:${normalizedPayload}`);

        const expectedJsonExample = `{
  "version": "1.0",
  "clinicalClassification": { "category": "Aparente nociceptivo|Aparente neuropático|Aparente nociplástico|Mixto|No concluyente", "subtype": "...", "rationale": "..." },
  "systems": { "primarySystem": "Tejido contráctil|Articulación / cápsula|Ligamento / estabilidad pasiva|Sistema neural|Control motor / movimiento|Carga ósea|Tejido conectivo / fascia|Mixto", "primaryStructure": "...", "secondaryStructures": ["..."] },
  "alterations": { "structural": [{ "name": "...", "certainty": "Posible|Probable|Casi confirmada", "comment": "..." }], "functional": [{ "name": "...", "severity": "Leve|Moderada|Severa" }] },
  "activityParticipation": { "limitations": [{ "name": "...", "severity": "Leve|Moderada|Severa" }], "restrictions": [{ "name": "...", "severity": "Leve|Moderada|Severa" }] },
  "bpsFactors": { "personalPos": ["..."], "personalNeg": ["..."], "envFacilitators": ["..."], "envBarriers": ["..."] },
  "clinicalReminders": ["..."]
}`;

        const userPrompt = `
Genera el output requerido usando EXCLUSIVAMENTE formato JSON parseable y cumpliendo estrictamente con la siguiente estructura y tipos exactos:
${expectedJsonExample}

DATOS CLÍNICOS ESTRUCTURADOS DE ENTRADA:
${normalizedPayload}
    `;

        const result = await executeAIAction({
            screen: 'P3',
            action: 'P3_SYNTHESIS',
            systemInstruction: SYSTEM_PROMPT_BASE + "\\n\\n" + PROMPTS.DIAGNOSIS,
            userPrompt,
            inputHash,
            promptVersion: 'v2.1',
            temperature: 0.2,
            validator: (data) => DiagnosisSchema.parse(data)
        });

        // The UI (Screen3_Sintesis) currently expects `{ success: true, data: ..., hash, latencyMs }`
        return NextResponse.json({
            success: true,
            data: result.data,
            hash: result.telemetry.inputHash,
            latencyMs: result.telemetry.latencyMs,
            telemetry: result.telemetry
        });

    } catch (err: any) {
        console.error('Error in /api/ai/diagnosis:', err);
        return NextResponse.json({ error: 'INTERNAL_ERROR', message: err.message }, { status: 500 });
    }
}
