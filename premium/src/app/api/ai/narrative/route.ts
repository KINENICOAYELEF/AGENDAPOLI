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
  "diagnostico_kinesiologico_narrativo": "... (MÍNIMO 8-10 LÍNEAS) ...",
  "razonamiento_diagnostico": "... (explicación docente) ...",
  "objetivo_general": { "opciones_sugeridas": ["Opción funcional...", "Opción participación...", "Opción integral BPS..."], "seleccionado": "..." },
  "objetivos_smart": [
    { "texto": "...", "variable_base": "...", "basal": "...", "meta": "...", "plazo": "...", "prioridad": "Alta/Media/Baja", "cluster": "Dolor/ROM/Fuerza/Control Motor/Tolerancia/Psicosocial" }
  ],
  "pronostico_biopsicosocial": {
    "corto_plazo": "... (MÍNIMO 3-4 LÍNEAS) ...",
    "mediano_plazo": "... (MÍNIMO 3-4 LÍNEAS) ...",
    "largo_plazo": "... (MÍNIMO 3-4 LÍNEAS) ...",
    "categoria": "favorable",
    "justificacion_clinica_integral": "... (MÍNIMO 4-5 LÍNEAS) ...",
    "factores_a_favor": ["factor1", "factor2", "factor3", "factor4"],
    "factores_en_contra": ["factor1", "factor2", "factor3"],
    "comparativa_adherencia": "... (MÍNIMO 3-4 LÍNEAS) ...",
    "historia_natural": "... (MÍNIMO 3-4 LÍNEAS) ...",
    "impacto_biologico": "... (MÍNIMO 3-4 LÍNEAS) ..."
  },
  "pilares_intervencion": [
    { "titulo": "Educación", "prioridad": 1, "rol_clinico": "Pilar Central", "justificacion": "...", "objetivos_operacionales": ["paso1", "paso2", "paso3", "paso4"], "ejemplos_ejercicios": ["ej1", "ej2"], "foco_que_aborda": ["..."] },
    { "titulo": "Ejercicio Terapéutico", "prioridad": 2, "rol_clinico": "Pilar Central", "justificacion": "...", "objetivos_operacionales": ["..."], "ejemplos_ejercicios": ["..."], "foco_que_aborda": ["..."] },
    { "titulo": "Manejo de Carga", "prioridad": 3, "rol_clinico": "Pilar Central", "justificacion": "...", "objetivos_operacionales": ["..."], "ejemplos_ejercicios": ["..."], "foco_que_aborda": ["..."] },
    { "titulo": "Control Motor", "prioridad": 4, "rol_clinico": "Adjunto/Complementario", "justificacion": "...", "objetivos_operacionales": ["..."], "ejemplos_ejercicios": ["..."], "foco_que_aborda": ["..."] }
  ],
  "plan_maestro": [
    { "fase": 1, "nombre": "Fase 1: Protección", "foco_principal": "...", "objetivo_fisiologico": "...", "duracion_estimada": "...", "criterios_entrada": "...", "intervenciones": ["int1","int2","int3","int4","int5"], "progresiones": ["prog1","prog2","prog3"], "criterios_avance": "...", "criterios_regresion": "...", "errores_frecuentes": ["err1","err2"], "perla_docente": "..." },
    { "fase": 2, "nombre": "Fase 2: Recuperación", "foco_principal": "...", "objetivo_fisiologico": "...", "duracion_estimada": "...", "criterios_entrada": "...", "intervenciones": ["..."], "progresiones": ["..."], "criterios_avance": "...", "criterios_regresion": "...", "errores_frecuentes": ["..."], "perla_docente": "..." },
    { "fase": 3, "nombre": "Fase 3: Fortalecimiento", "foco_principal": "...", "objetivo_fisiologico": "...", "duracion_estimada": "...", "criterios_entrada": "...", "intervenciones": ["..."], "progresiones": ["..."], "criterios_avance": "...", "criterios_regresion": "...", "errores_frecuentes": ["..."], "perla_docente": "..." },
    { "fase": 4, "nombre": "Fase 4: Reintegro", "foco_principal": "...", "objetivo_fisiologico": "...", "duracion_estimada": "...", "criterios_entrada": "...", "intervenciones": ["..."], "progresiones": ["..."], "criterios_avance": "...", "criterios_regresion": "...", "errores_frecuentes": ["..."], "perla_docente": "..." }
  ],
  "reglas_reevaluacion": {
    "signo_comparable_principal": "...",
    "razon_signo_comparable": "... (por qué ese signo) ...",
    "variables_seguimiento": ["...","..."],
    "instrumentos_sugeridos": ["PSFS","SANE","GROC","EVA"],
    "frecuencia_sugerida": "...",
    "criterio_mejora_real": "... (MÍNIMO 2-3 LÍNEAS) ...",
    "criterio_estancamiento_derivacion": "... (MÍNIMO 2-3 LÍNEAS) ...",
    "alertas_derivacion": ["alerta1","alerta2","alerta3"]
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
            systemInstruction: SYSTEM_PROMPT_BASE + "\n\n" + PROMPTS.NARRATIVE,
            userPrompt,
            inputHash,
            promptVersion: 'v5.0_p4',
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
