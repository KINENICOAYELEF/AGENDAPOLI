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
  "objetivo_general": { "problema_principal_caso": "... (2-3 líneas del problema central) ...", "opciones_sugeridas": ["Opción funcional...", "Opción participación...", "Opción integral BPS...", "Opción rendimiento deportivo..."], "seleccionado": "..." },
  "objetivos_smart": [
    { "texto": "...", "variable_base": "...", "basal": "...", "meta": "...", "plazo": "...", "prioridad": "Alta/Media/Baja", "cluster": "Dolor/ROM/Fuerza/Control Motor/Tolerancia/Psicosocial/Rendimiento" }
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
    { "titulo": "Educación", "prioridad": 1, "rol_clinico": "Pilar Central", "justificacion": "...", "objetivos_operacionales": ["paso1", "paso2", "paso3", "paso4"], "ejemplos_ejercicios": ["ej1", "ej2"], "foco_que_aborda": ["..."] }
  ],
  "plan_maestro": [
    { "fase": 1, "nombre": "Fase 1: Protección", "foco_principal": "...", "objetivo_fisiologico": "...", "duracion_estimada": "...", "criterios_entrada": "...", "intervenciones": ["int1","int2","int3","int4","int5"], "intervenciones_complementarias": ["Movilización articular grade I-II de la articulación afectada", "Educación en neurociencia del dolor: metáfora del sistema de alarma"], "tips_dosificacion": ["RPE 3-4 para ejercicios activos", "RIR 4-5 en isométricos submáximos", "Tempo: 5s excéntrico, 5s isométrico, 2s concéntrico", "Frecuencia: 3-4 sesiones/semana"], "progresiones": ["prog1","prog2","prog3"], "criterios_avance": "...", "criterios_regresion": "...", "errores_frecuentes": ["err1","err2"], "perla_docente": "...", "sesiones_tipo": [{"titulo": "Sesión tipo A: ...", "duracion": "~60 min", "estructura": ["Calentamiento (5-10 min): ...", "Bloque principal (35-40 min): ...", "Cool-down (10-15 min): ..."]}, {"titulo": "Sesión tipo B: ...", "duracion": "~60 min", "estructura": ["..."]}] },
    { "fase": 2, "nombre": "Fase 2: Recuperación", "foco_principal": "...", "objetivo_fisiologico": "...", "duracion_estimada": "...", "criterios_entrada": "...", "intervenciones": ["..."], "intervenciones_complementarias": ["..."], "tips_dosificacion": ["RPE 5-6 en fortalecimiento", "RIR 3-4", "TUT 30-45s por set"], "progresiones": ["..."], "criterios_avance": "...", "criterios_regresion": "...", "errores_frecuentes": ["..."], "perla_docente": "...", "sesiones_tipo": [{"titulo": "...", "duracion": "~60 min", "estructura": ["..."]}, {"titulo": "...", "duracion": "~60 min", "estructura": ["..."]}] },
    { "fase": 3, "nombre": "Fase 3: Fortalecimiento", "foco_principal": "...", "objetivo_fisiologico": "...", "duracion_estimada": "...", "criterios_entrada": "...", "intervenciones": ["..."], "intervenciones_complementarias": ["..."], "tips_dosificacion": ["RPE 7-8", "RIR 1-2", "Tempo explosivo concéntrico"], "progresiones": ["..."], "criterios_avance": "...", "criterios_regresion": "...", "errores_frecuentes": ["..."], "perla_docente": "...", "sesiones_tipo": [{"titulo": "...", "duracion": "~60 min", "estructura": ["..."]}, {"titulo": "...", "duracion": "~60 min", "estructura": ["..."]}] },
    { "fase": 4, "nombre": "Fase 4: Reintegro", "foco_principal": "...", "objetivo_fisiologico": "...", "duracion_estimada": "...", "criterios_entrada": "...", "intervenciones": ["..."], "intervenciones_complementarias": ["..."], "tips_dosificacion": ["..."], "progresiones": ["..."], "criterios_avance": "...", "criterios_regresion": "...", "errores_frecuentes": ["..."], "perla_docente": "...", "sesiones_tipo": [{"titulo": "...", "duracion": "~60 min", "estructura": ["..."]}, {"titulo": "...", "duracion": "~60 min", "estructura": ["..."]}] }
  ],
  "reglas_reevaluacion": {
    "signo_comparable_principal": "...",
    "signos_comparables": [
      {"evaluacion": "Test de Faber", "tipo": "Test especial", "justificacion": "Reproduce la queja y es sensible a cambios articulares"},
      {"evaluacion": "Rotación interna activa en decúbito", "tipo": "ROM funcional", "justificacion": "Variable crítica limitada al inicio"},
      {"evaluacion": "Sentadilla unipodal", "tipo": "Test funcional", "justificacion": "Integra fuerza, control motor y confianza en carga"}
    ],
    "razon_signo_comparable": "... (por qué estas evaluaciones guía) ...",
    "variables_seguimiento": ["...","..."],
    "instrumentos_sugeridos": ["PSFS","SANE","GROC","EVA"],
    "frecuencia_sugerida": "...",
    "criterio_mejora_real": "... (MÍNIMO 2-3 LÍNEAS) ...",
    "criterio_estancamiento_derivacion": "... (MÍNIMO 2-3 LÍNEAS) ...",
    "alertas_derivacion": ["alerta1","alerta2","alerta3"],
    "plan_reevaluacion_temporal": [
      {"momento": "Sesiones 1-3", "evaluaciones_incluidas": ["EVA","signo comparable"], "evaluaciones_excluidas": "Fuerza máxima (tejido en reparación)", "razon": "..."},
      {"momento": "Semana 4", "evaluaciones_incluidas": ["PSFS","ROM","fuerza submáxima"], "evaluaciones_excluidas": "Tests de rendimiento deportivo", "razon": "..."},
      {"momento": "Semana 8-10", "evaluaciones_incluidas": ["..."], "evaluaciones_excluidas": "...", "razon": "..."},
      {"momento": "Alta/Cierre", "evaluaciones_incluidas": ["..."], "evaluaciones_excluidas": null, "razon": "..."}
    ]
  },
  "banco_recursos": {
    "ejercicios_clave": [
      {"nombre_es": "Puente glúteo unilateral", "nombre_en": "Single leg glute bridge", "fase_recomendada": "Fase 2-3", "objetivo": "Fuerza glúteo medio"},
      {"nombre_es": "Sentadilla búlgara", "nombre_en": "Bulgarian split squat", "fase_recomendada": "Fase 3-4", "objetivo": "Fuerza unilateral de MMII"},
      {"nombre_es": "Bird-dog", "nombre_en": "Bird-dog exercise", "fase_recomendada": "Fase 1-2", "objetivo": "Control motor y estabilidad lumbopélvica"}
    ],
    "busquedas_sugeridas": ["sacroiliac joint physiotherapy exercises", "hip abductor strengthening rehab", "graded motor imagery chronic pain"],
    "referencias_bibliograficas": ["Vleeming, A. et al. (2012). The sacroiliac joint: an overview of its anatomy, function and potential clinical implications.", "Barton, C.J. et al. (2019). Running retraining to treat lower limb injuries."]
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
