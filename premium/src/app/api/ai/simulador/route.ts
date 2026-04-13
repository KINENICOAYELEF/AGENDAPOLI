import { NextResponse } from 'next/server';
import { executeAIAction } from '@/lib/ai/geminiClient';
import { SIM_GENERATE_PROMPT, SIM_INTERVIEW_PROMPT, SIM_EXAM_PROMPT, SIM_EVALUATE_PROMPT, SIM_COMMISSION_PROMPT } from '@/lib/ai/simuladorPrompts';
import { SimCaseSchema, SimInterviewSchema, SimExamSchema, SimEvaluationSchema, SimCommissionSchema } from '@/lib/ai/simuladorSchemas';

// Vercel: allow up to 120s for complex AI calls
export const maxDuration = 120;

// Rate limiter: max 5 requests per user per hour
const rateLimitCache = new Map<string, { count: number; timestamp: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_REQUESTS = 8; // 5 calls per exam + buffer for retries

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
        const body = await req.json();
        const { action, payload, userId } = body;

        if (!action || !userId) {
            return NextResponse.json({ error: 'MISSING_PARAMS', message: 'action y userId son requeridos.' }, { status: 400 });
        }

        if (!checkRateLimit(userId)) {
            return NextResponse.json({
                error: 'RATE_LIMIT_EXCEEDED',
                message: 'Has excedido el límite de simulaciones (1 examen por hora). Intenta más tarde.'
            }, { status: 429 });
        }

        let result: any;

        switch (action) {
            // ─── CALL 1: Generate Case ───
            case 'generate': {
                const { tipo, area, dificultad, descripcion } = payload;
                const userPrompt = `
Genera un caso clínico completo para un examen de kinesiología MSK/Deportiva.
PARÁMETROS:
- Tipo de caso: ${tipo || 'aleatorio'}
- Área corporal: ${area || 'aleatoria'}
- Dificultad: ${dificultad || 'intermedio'}
- Descripción adicional: ${descripcion || 'Ninguna, genera un caso interesante y desafiante'}

Devuelve el JSON completo del caso siguiendo ESTRICTAMENTE la estructura solicitada.
`;
                result = await executeAIAction({
                    screen: 'SIMULADOR',
                    action: 'SIM_GENERATE',
                    systemInstruction: SIM_GENERATE_PROMPT,
                    userPrompt,
                    inputHash: `sim_gen_${Date.now()}_${userId}`,
                    promptVersion: 'sim_v1',
                    temperature: 0.7,
                    validator: (data) => SimCaseSchema.parse(data),
                    skipGuardrails: true,
                });
                break;
            }

            // ─── CALL 2: Patient Interview ───
            case 'interview': {
                const { perfil_secreto, ficha_visible, preguntas_estudiante } = payload;
                const userPrompt = `
PERFIL DEL PACIENTE (SECRETO — TÚ ERES ESTA PERSONA):
Nombre: ${ficha_visible.nombre}
Edad: ${ficha_visible.edad}
Personalidad: ${perfil_secreto.personalidad}
Historia completa: ${perfil_secreto.historia_completa}
Datos que solo revelas si preguntan: ${JSON.stringify(perfil_secreto.datos_ocultos)}
Antecedentes: ${perfil_secreto.antecedentes_relevantes?.join(', ') || 'Ninguno reportado'}
Medicamentos: ${perfil_secreto.medicamentos?.join(', ') || 'Ninguno'}
Contexto BPS oculto: Sueño: ${perfil_secreto.bps_oculto?.sueno}, Estrés: ${perfil_secreto.bps_oculto?.estres}, Miedos: ${perfil_secreto.bps_oculto?.miedos}, Expectativa real: ${perfil_secreto.bps_oculto?.expectativa_real}

PREGUNTAS QUE HACE EL ESTUDIANTE (KINESIÓLOGO):
${preguntas_estudiante}

Responde como el paciente descrito arriba. Además genera el "analisis_oculto" como docente.
`;
                result = await executeAIAction({
                    screen: 'SIMULADOR',
                    action: 'SIM_INTERVIEW',
                    systemInstruction: SIM_INTERVIEW_PROMPT,
                    userPrompt,
                    inputHash: `sim_int_${Date.now()}_${userId}`,
                    promptVersion: 'sim_v1',
                    temperature: 0.5,
                    validator: (data) => SimInterviewSchema.parse(data),
                    skipGuardrails: true,
                });
                break;
            }

            // ─── CALL 3: Exam Findings ───
            case 'exam': {
                const { hallazgos_todos_modulos, rubrica_ideal, modulos_seleccionados, justificaciones } = payload;
                const modulosTexto = modulos_seleccionados.map((m: any) =>
                    `- ${m.modulo}: "${m.justificacion}" / Pruebas específicas: ${m.pruebas || 'No especificó'}`
                ).join('\n');

                const userPrompt = `
HALLAZGOS COMPLETOS PRE-GENERADOS DEL CASO (TODOS LOS MÓDULOS):
${JSON.stringify(hallazgos_todos_modulos)}

MÓDULOS DE EXAMEN OBLIGATORIOS SEGÚN LA RÚBRICA:
${rubrica_ideal.modulos_examen_obligatorios?.join(', ') || 'No especificados'}

MÓDULOS QUE EL ESTUDIANTE SELECCIONÓ CON SUS JUSTIFICACIONES:
${modulosTexto}

Narra los hallazgos SOLO de los módulos seleccionados. Analiza omisiones y justificaciones.
`;
                result = await executeAIAction({
                    screen: 'SIMULADOR',
                    action: 'SIM_EXAM',
                    systemInstruction: SIM_EXAM_PROMPT,
                    userPrompt,
                    inputHash: `sim_exam_${Date.now()}_${userId}`,
                    promptVersion: 'sim_v1',
                    temperature: 0.2,
                    validator: (data) => SimExamSchema.parse(data),
                    skipGuardrails: true,
                });
                break;
            }

            // ─── CALL 4: Full Evaluation + Commission Questions ───
            case 'evaluate': {
                const { caso_resumen, rubrica_ideal, trabajo_estudiante } = payload;
                const userPrompt = `
CASO CLÍNICO Y RÚBRICA IDEAL:
${JSON.stringify(caso_resumen)}

RÚBRICA DE EVALUACIÓN:
${JSON.stringify(rubrica_ideal)}

TRABAJO COMPLETO DEL ESTUDIANTE:

== PREGUNTAS DE ENTREVISTA ==
${trabajo_estudiante.preguntas_entrevista || '(No registradas)'}

== RAZONAMIENTO CLÍNICO ==
Hipótesis: ${JSON.stringify(trabajo_estudiante.hipotesis || [])}
Clasificación dolor: ${trabajo_estudiante.clasificacion_dolor || 'No completó'}
Irritabilidad: ${trabajo_estudiante.irritabilidad || 'No completó'}
Banderas detectadas: ${JSON.stringify(trabajo_estudiante.banderas || {})}

== MÓDULOS DE EXAMEN SELECCIONADOS ==
${trabajo_estudiante.modulos_seleccionados || '(No registrados)'}

== DIAGNÓSTICO KINESIOLÓGICO ==
${trabajo_estudiante.diagnostico || '(No completó)'}

== OBJETIVO GENERAL ==
${trabajo_estudiante.objetivo_general || '(No completó)'}

== OBJETIVOS SMART ==
${trabajo_estudiante.objetivos_smart || '(No completó)'}

== PLAN DE INTERVENCIÓN POR FASES ==
${trabajo_estudiante.plan_fases || '(No completó)'}

== REEVALUACIÓN Y PRONÓSTICO ==
${trabajo_estudiante.reevaluacion || '(No completó)'}

Evalúa RIGUROSAMENTE el trabajo completo. Genera scorecard, errores, aciertos y preguntas de comisión.
`;
                result = await executeAIAction({
                    screen: 'SIMULADOR',
                    action: 'SIM_EVALUATE',
                    systemInstruction: SIM_EVALUATE_PROMPT,
                    userPrompt,
                    inputHash: `sim_eval_${Date.now()}_${userId}`,
                    promptVersion: 'sim_v1',
                    temperature: 0.25,
                    validator: (data) => SimEvaluationSchema.parse(data),
                    skipGuardrails: true,
                });
                break;
            }

            // ─── CALL 5: Commission Answer Evaluation ───
            case 'commission': {
                const { preguntas_con_respuesta_ideal, respuestas_estudiante } = payload;
                const preguntasTexto = preguntas_con_respuesta_ideal.map((p: any, i: number) =>
                    `PREGUNTA ${i + 1}: ${p.pregunta}\nRESPUESTA IDEAL: ${p.respuesta_esperada}\nRESPUESTA DEL ESTUDIANTE: ${respuestas_estudiante[i] || '(Sin respuesta)'}`
                ).join('\n\n');

                const userPrompt = `
Evalúa las respuestas del estudiante a las preguntas de la comisión evaluadora:

${preguntasTexto}

Genera la evaluación detallada para cada respuesta y el feedback final.
`;
                result = await executeAIAction({
                    screen: 'SIMULADOR',
                    action: 'SIM_COMMISSION',
                    systemInstruction: SIM_COMMISSION_PROMPT,
                    userPrompt,
                    inputHash: `sim_com_${Date.now()}_${userId}`,
                    promptVersion: 'sim_v1',
                    temperature: 0.2,
                    validator: (data) => SimCommissionSchema.parse(data),
                    skipGuardrails: true,
                });
                break;
            }

            default:
                return NextResponse.json({ error: 'INVALID_ACTION', message: `Acción '${action}' no reconocida.` }, { status: 400 });
        }

        return NextResponse.json({
            success: true,
            data: result.data,
            telemetry: result.telemetry,
        });

    } catch (err: any) {
        console.error('[Simulador API Error]', err);
        return NextResponse.json({
            error: 'INTERNAL_ERROR',
            message: err.message || 'Error interno del simulador.'
        }, { status: 500 });
    }
}
