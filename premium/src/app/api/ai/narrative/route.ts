import { NextResponse } from 'next/server';
import { executeAIAction } from '@/lib/ai/geminiClient';
import { PROMPTS, SYSTEM_PROMPT_BASE } from '@/lib/ai/prompts';
import { P4PlanStructuredSchema } from '@/lib/ai/schemas';
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
        const payload = payloadArgs.payload || payloadArgs;
        const userId = payloadArgs.userId;

        if (userId && !checkRateLimit(userId)) {
            return NextResponse.json({ error: 'RATE_LIMIT_EXCEEDED', message: 'Has excedido el límite de peticiones (10 requests / 10 min).' }, { status: 429 });
        }

        const normalizedPayload = normalizePayload({
            p3_case_organizer: payload.p3_case_organizer,
            compact_case_package: payload.compact_case_package,
            p2_summary_structured: payload.p2_summary_structured,
            // Fallbacks if existing legacy requests hit this endpoint
            normalizedContext: payload.normalizedContext,
            synthesis: payload.synthesis || payload.autoSynthesis
        });

        const inputHash = await generateSHA256(`narrative:${normalizedPayload}`);

        const expectedJsonExample = `{
  "referencia_p3_breve": "...",
  "diagnostico_kinesiologico_narrativo": "...",
  "objetivo_general": { "opciones_sugeridas": ["...", "..."], "seleccionado": "..." },
  "objetivos_smart": [
    { "texto": "...", "variable_base": "...", "basal": "...", "meta": "...", "plazo": "...", "prioridad": "..." }
  ],
  "pronostico_biopsicosocial": {
    "corto_plazo": "...",
    "mediano_plazo": "...",
    "categoria": "favorable",
    "justificacion_clinica_integral": "..."
  },
  "pilares_intervencion": [
    { "titulo": "...", "justificacion": "...", "foco_que_aborda": ["..."] }
  ],
  "plan_maestro": "...",
  "reglas_reevaluacion": {
    "signo_comparable_principal": "...",
    "variables_seguimiento": ["..."],
    "frecuencia_sugerida": "...",
    "criterio_mejora_real": "...",
    "criterio_estancamiento_derivacion": "..."
  }
}`;

        const userPrompt = `
Genera el output requerido usando EXCLUSIVAMENTE formato JSON parseable y cumpliendo estrictamente con la siguiente estructura y tipos exactos:
${expectedJsonExample}

DATOS CLÍNICOS ESTRUCTURADOS DE ENTRADA:
${normalizedPayload}
    `;

        const requestedAction = payloadArgs.aiAction === 'P4_PREMIUM' ? 'P4_PREMIUM' : 'P4_BASE';
        const modelTemp = requestedAction === 'P4_PREMIUM' ? 0.4 : 0.2; // Premium gets slightly more narrative variance

        const result = await executeAIAction({
            screen: 'P4',
            action: requestedAction,
            systemInstruction: SYSTEM_PROMPT_BASE + "\\n\\n" + PROMPTS.NARRATIVE,
            userPrompt,
            inputHash,
            promptVersion: 'v2.0_p4_refactor',
            temperature: modelTemp,
            validator: (data) => P4PlanStructuredSchema.parse(data)
        });

        const finalData = {
            ...result.data,
            ia_metadata: {
                model_used: result.telemetry.modelUsed,
                fallback_used: !!result.telemetry.fallbackUsed,
                input_hash: result.telemetry.inputHash,
                cache_hit: false,
                draft_mode: requestedAction
            }
        };

        return NextResponse.json({
            success: true,
            data: finalData,
            hash: result.telemetry.inputHash,
            latencyMs: result.telemetry.latencyMs,
            telemetry: result.telemetry
        });

    } catch (err: any) {
        console.error('Error in /api/ai/narrative:', err);
        return NextResponse.json({ error: 'INTERNAL_ERROR', message: err.message }, { status: 500 });
    }
}
