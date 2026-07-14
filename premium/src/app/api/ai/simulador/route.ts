import { NextResponse } from 'next/server';
import { executeAIAction, callGemini } from '@/lib/ai/geminiClient';
import { SIM_GENERATE_PROMPT, SIM_INTERVIEW_PROMPT, SIM_INTERVIEW_FEEDBACK_PROMPT, SIM_EXAM_PROMPT, SIM_EVALUATE_PROMPT, SIM_COMMISSION_PROMPT, SIM_EVAL_DEFENSE_PROMPT, SIM_EVAL_TRAINING_PROMPT } from '@/lib/ai/simuladorPrompts';
import { SimCaseSchema, SimInterviewSchema, SimInterviewFeedbackSchema, SimExamSchema, SimEvaluationSchema, SimCommissionSchema, SimDefenseEvaluationSchema, SimTrainingEvaluationSchema } from '@/lib/ai/simuladorSchemas';

async function cleanVoiceTranscript(rawTranscript: string): Promise<string> {
    if (!rawTranscript || rawTranscript.trim().length < 10) return rawTranscript;

    const systemInstruction = `Eres un asistente de inteligencia artificial especializado en kinesiología y terapia física. Tu tarea exclusiva es corregir, limpiar y reconstruir de manera impecable la transcripción de texto (de voz a texto) de una conversación de examen o entrenamiento clínico entre el Estudiante (o Alumno) y el Tutor (o Comisión).

El sistema de reconocimiento de voz de la API comete errores ortográficos graves, a veces alucina transcribiendo en otros idiomas (como caracteres en Hindi, Coreano, etc. debido a ruidos), duplica palabras o frases debido al retraso del micrófono, introduce palabras aleatorias que el hablante no dijo (por ejemplo, transcribir "tonterías" en lugar de "sentadillas"), o corta frases.

INSTRUCCIONES CRÍTICAS DE LIMPIEZA:
1. **Deducción por Contexto del Tutor (Crucial):** El Tutor IA escucha el audio real del Estudiante y le responde de manera coherente. Si el Estudiante dice algo que se transcribió como absurdo, alucinación de otros idiomas, o inconexo (ej: si se transcribe en Hindi/Coreano o dice "tonterías" / "ceremonias concepticas") y el Tutor le responde en español hablando del tema real (ej: "Exacto, es isométrica..." o "Exacto, las sentadillas..."), deduce la palabra o frase correcta que el estudiante realmente pronunció en español basándote en la respuesta del Tutor, y corrígela en el turno del Estudiante.
2. **Corrección de Jerga Técnica y Kinesiología:** Corrige de forma exhaustiva términos médicos o kinesiológicos mal transcritos en español (ejemplos: "nocipectivo" -> "nociceptivo", "infraspinoso" -> "infraespinoso", "supraespinoso" -> "supraespinoso", "manguito rotador", "tens" -> "TENS", "gird" -> "GIRD", "artrocinemática", "neurofisiología", "dosificación", "evaluación", "contracciones concéntricas").
3. **Eliminación de Alucinaciones en Idiomas Extranjeros:** Si el reconocedor de voz de la API transcribe una respuesta del Estudiante en caracteres extranjeros (Hindi, Coreano, etc.), deduce lo que realmente dijo el Estudiante a partir de la respuesta en español del Tutor y reemplázalo por el término o frase en español correspondiente (el estudiante es 100% hispanohablante y solo habla español).
4. **Eliminación de Duplicaciones y Tartamudeos:** Elimina frases o palabras repetidas de forma consecutiva generadas por el flujo del micrófono (ej: "yo dije que yo dije que hiciéramos" -> "yo dije que hiciéramos").
5. **Flujo y Gramática Natural:** Repara la coherencia y gramática de las oraciones sin alterar la intención original del hablante. Si una frase quedó inconclusa o mal estructurada por el transcriptor, reescríbela de forma gramaticalmente correcta.
6. **Preservar Prefijos de Diálogo:** Mantén estrictamente los prefijos y formato del diálogo original del texto de entrada (por ejemplo, si el texto usa "Estudiante:" y "Tutor:", mantén "Estudiante:" y "Tutor:"; si usa "ESTUDIANTE:" y "COMISIÓN:", mantén esos).
7. **No Resumir:** No resumas el contenido. Conserva cada turno de habla completo y con toda su argumentación clínica original.

Retorna ÚNICAMENTE la transcripción limpia en formato de texto simple, respetando el formato de turnos.`;

    const userPrompt = `Limpia, corrige y repara la siguiente transcripción de voz a texto:\n\n${rawTranscript}`;

    try {
        const cleanedText = await callGemini({
            systemInstruction,
            userPrompt,
            modelId: 'gemini-3.1-flash-lite-preview', // Usar el modelo con 500 RPD por defecto para cuidar la cuota
            temperature: 0.1,
            responseMimeType: 'text/plain'
        });
        return cleanedText || rawTranscript;
    } catch (err) {
        console.error("Error al limpiar transcripción con Gemini 3.1 Flash Lite:", err);
        // Fallback resiliente 1: Intentar con gemini-2.5-flash-lite (20 RPD)
        try {
            console.log("Intentando fallback de limpieza con gemini-2.5-flash-lite...");
            const fallbackText = await callGemini({
                systemInstruction,
                userPrompt,
                modelId: 'gemini-2.5-flash-lite',
                temperature: 0.1,
                responseMimeType: 'text/plain'
            });
            return fallbackText || rawTranscript;
        } catch (fallbackErr) {
            console.error("Error en fallback de limpieza con Gemini 2.5 Flash Lite:", fallbackErr);
            // Fallback resiliente 2: Intentar con gemini-2.5-flash (20 RPD)
            try {
                console.log("Intentando fallback de limpieza con gemini-2.5-flash...");
                const fallbackText2 = await callGemini({
                    systemInstruction,
                    userPrompt,
                    modelId: 'gemini-2.5-flash',
                    temperature: 0.1,
                    responseMimeType: 'text/plain'
                });
                return fallbackText2 || rawTranscript;
            } catch (fallbackErr2) {
                console.error("Error en fallback final de limpieza con Gemini 2.5 Flash:", fallbackErr2);
                return rawTranscript; // Fallback final a la transcripción cruda
            }
        }
    }
}

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
PARÁMETROS FUNDAMENTALES:
- Tipo de caso: ${tipo || 'aleatorio'}
- Área corporal: ${area || 'aleatoria'}
- Dificultad: ${dificultad || 'intermedio'}
- Descripción adicional: ${descripcion || 'Ninguna, genera un caso interesante y desafiante'}

INSTRUCCIÓN ESPECIAL DE DIFICULTAD (${dificultad || 'intermedio'}):
${dificultad === 'Principiante' ? '- Genera un cuadro agudo, traumático o mecánico simple (ej. esguince reciente, desgarro muscular). Paciente colaborador, sin banderas amarillas complejas. Foco biomecánico.' : ''}
${dificultad === 'Intermedio' ? '- Genera un cuadro subagudo o crónico con inicio insidioso. Sobrecarga repetitiva o mala gestión de carga. Paciente ligeramente ansioso o con factores BPS moderados.' : ''}
${dificultad === 'Avanzado' ? '- OBLIGATORIO: Dolor crónico persistente, patologías degenerativas (ej. artrosis severa) o dolor nociplástico/neuropático. Banderas amarillas severas (kinesiofobia, catastrofización) o azules (licencias, estrés laboral extremo). Múltiples comorbilidades (ej. diabetes, obesidad, insomnio crónico).' : ''}

REGLA DE VARIABILIDAD CRÓNICA: Si el tipo es 'aleatorio', prioriza patologías crónicas como tendinopatías de larga data, artrosis, dolor lumbar crónico o síndromes de dolor persistente, para evitar que todos los casos sean deportistas agudos.

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

            // ─── CALL 2.5: Interview Feedback (Docente Maestro) ───
            case 'interview_feedback': {
                const { perfil_secreto, preguntas_estudiante } = payload;
                const userPrompt = `
PERFIL DEL PACIENTE Y LA VERDAD OCULTA DEL CASO:
Personalidad: ${perfil_secreto.personalidad}
Historia completa: ${perfil_secreto.historia_completa}
Datos ocultos: ${JSON.stringify(perfil_secreto.datos_ocultos)}
Antecedentes: ${perfil_secreto.antecedentes_relevantes?.join(', ') || 'Ninguno'}
BPS oculto: ${JSON.stringify(perfil_secreto.bps_oculto)}

TRANSCRIPCIÓN COMPLETA DE LA ENTREVISTA (ESTUDIANTE Y PACIENTE):
${preguntas_estudiante}

Evalúa esta transcripción con la rigurosidad de un Docente Maestro de postgrado.
`;
                result = await executeAIAction({
                    screen: 'SIMULADOR',
                    action: 'SIM_INTERVIEW_FEEDBACK',
                    systemInstruction: SIM_INTERVIEW_FEEDBACK_PROMPT,
                    userPrompt,
                    inputHash: `sim_intfb_${Date.now()}_${userId}`,
                    promptVersion: 'sim_v1',
                    temperature: 0.2,
                    validator: (data) => SimInterviewFeedbackSchema.parse(data),
                    skipGuardrails: true,
                });
                break;
            }

            // ─── CALL 3: Exam Findings ───
            case 'exam': {
                const { hallazgos_todos_modulos, rubrica_ideal, modulos_seleccionados, transcripcion_examen } = payload;
                
                let finalModules = modulos_seleccionados || [];
                
                if (transcripcion_examen) {
                    const detectionPrompt = `
Dada la siguiente transcripción de un examen físico por voz en kinesiología:
"${transcripcion_examen}"

Determina cuáles de los siguientes 8 módulos de examen clínico solicitó evaluar el estudiante de forma explícita o implícita:
1. observacion_movimiento_inicial (marcha, postura, inspección visual)
2. rango_movimiento_analitico (ROM, flexión, extensión, grados)
3. fuerza_tolerancia_carga (MMT, fuerza muscular, resistir carga)
4. palpacion (tocar estructuras, interlínea, tendón, dolor a la presión)
5. neuro_vascular (reflejos, dermatomas, pulsos, sensibilidad)
6. control_motor_sensoriomotor (equilibrio, monopodal, estabilidad dinámica)
7. pruebas_ortopedicas (pruebas especiales como Lachman, cajón, pivot shift, etc.)
8. pruebas_funcionales_reintegro (Hop tests, saltos, Y-balance)

Retorna un objeto JSON con la llave "modulos_detectados", que contiene un arreglo con las keys de los módulos detectados (ej: ["palpacion", "pruebas_ortopedicas"]).
`;
                    try {
                        const detectionResult = await callGemini({
                            systemInstruction: "Eres un asistente clínico que analiza transcripciones de examen físico de kinesiología y mapea los términos a categorías estructuradas.",
                            userPrompt: detectionPrompt,
                            modelId: 'gemini-3.1-flash-lite-preview',
                            temperature: 0.1,
                            responseMimeType: 'application/json'
                        });
                        
                        let cleanResult = detectionResult.trim();
                        if (cleanResult.startsWith('```json')) cleanResult = cleanResult.substring(7);
                        if (cleanResult.endsWith('```')) cleanResult = cleanResult.substring(0, cleanResult.length - 3);
                        cleanResult = cleanResult.trim();
                        
                        const parsed = JSON.parse(cleanResult);
                        const detectedKeys = parsed.modulos_detectados || [];
                        
                        const modulesMap: Record<string, string> = {
                            observacion_movimiento_inicial: 'Observación / Movimiento Inicial',
                            rango_movimiento_analitico: 'Rango de Movimiento Analítico',
                            fuerza_tolerancia_carga: 'Fuerza / Tolerancia a la Carga',
                            palpacion: 'Palpación',
                            neuro_vascular: 'Neuro-Vascular / Somatosensorial',
                            control_motor_sensoriomotor: 'Control Motor / Sensoriomotor',
                            pruebas_ortopedicas: 'Pruebas Ortopédicas Dirigidas',
                            pruebas_funcionales_reintegro: 'Pruebas Funcionales / Reintegro'
                        };
                        
                        finalModules = detectedKeys.map((k: string) => ({
                            modulo: modulesMap[k] || k,
                            justificacion: 'Solicitado verbalmente en el examen por voz',
                            pruebas: 'Especificado en la transcripción'
                        })).filter((m: any) => m.modulo);
                    } catch (e) {
                        console.error("Error in exam module detection:", e);
                    }
                }

                const modulosTexto = finalModules.map((m: any) =>
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

== PREGUNTAS DE ENTREVISTA / ANAMNESIS ==
${trabajo_estudiante.preguntas_entrevista || '(No registradas)'}

== RAZONAMIENTO CLÍNICO I (Oral) ==
${trabajo_estudiante.razonamiento1_voz || '(No registrado)'}
Hipótesis orientativas (borrador escrito): ${JSON.stringify(trabajo_estudiante.hipotesis_previas || [])}
Clasificación dolor tentativa (escrito): ${trabajo_estudiante.clasificacion_dolor_previa || 'No completó'}
Irritabilidad estimada (escrito): ${trabajo_estudiante.irritabilidad_previa || 'No completó'}
Banderas detectadas (escrito): ${JSON.stringify(trabajo_estudiante.banderas || {})}

== EXAMEN FÍSICO / EVALUACIÓN ORAL ==
${trabajo_estudiante.examen_fisico_voz || '(No registrado)'}

== RAZONAMIENTO CLÍNICO II (Oral) ==
${trabajo_estudiante.razonamiento2_voz || '(No registrado)'}
Hipótesis confirmadas/descartadas/nuevas (escrito): ${trabajo_estudiante.hipotesis_confirmadas || '(No completó)'}
Clasificación del dolor actualizada (escrito): ${trabajo_estudiante.clasificacion_dolor_final || '(No completó)'}
Diagnóstico presuntivo (escrito): ${trabajo_estudiante.diagnostico_presuntivo || '(No completó)'}
Hallazgos clave integrados (escrito): ${trabajo_estudiante.hallazgos_clave_integrados || '(No completó)'}

== MÓDULOS DE EXAMEN SELECCIONADOS ==
${trabajo_estudiante.modulos_seleccionados || '(No registrados)'}

== INTERVENCIONES KINESIOLÓGICAS PROPUESTAS (Oral) ==
${trabajo_estudiante.intervenciones_voz || '(No registrado)'}
Detalles escritos: ${trabajo_estudiante.intervenciones || '(No completó)'}

== DIAGNÓSTICO KINESIOLÓGICO CIF ==
${trabajo_estudiante.diagnostico || '(No completó)'}

== OBJETIVO GENERAL ==
${trabajo_estudiante.objetivo_general || '(No completó)'}

== OBJETIVOS ESPECÍFICOS ==
${trabajo_estudiante.objetivos_especificos || '(No completó)'}

== OBJETIVOS OPERACIONALES ==
${trabajo_estudiante.objetivos_operacionales || '(No completó)'}

== PLAN DE INTERVENCIÓN POR FASES ==
${trabajo_estudiante.plan_fases || '(No completó)'}

== REEVALUACIÓN Y PRONÓSTICO ==
${trabajo_estudiante.reevaluacion || '(No completó)'}

== EXPOSICIÓN CONTINUA DEL CASO (Oral - Presentación de 15 minutos) ==
${trabajo_estudiante.exposicion_caso_voz || '(No registrada)'}

== DEFENSA DE COMISIÓN (Oral - Ronda de preguntas del tribunal) ==
${trabajo_estudiante.defensa_comision_voz || '(No registrada)'}

Evalúa RIGUROSAMENTE el trabajo completo, incluyendo las defensas orales, el razonamiento y la coherencia general. Genera scorecard, errores, aciertos y preguntas de comisión.
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

            // ─── CALL: Evaluate Voice Defense ───
            case 'evaluate-defense': {
                const { caso_resumen, construccion, transcripcion_defensa } = payload;
                const cleanedTranscript = await cleanVoiceTranscript(transcripcion_defensa);
                const userPrompt = `
CASO CLÍNICO:
${JSON.stringify(caso_resumen)}

CONSTRUCCIÓN DEL ESTUDIANTE:
Problema Principal: ${construccion.problema_principal}
Diagnóstico CIF: ${construccion.diagnostico}
Objetivo General: ${construccion.objetivo_general}
Objetivos Específicos: ${construccion.objetivos_especificos}
Objetivos Operacionales: ${construccion.objetivos_operacionales}
Plan de Fases: ${construccion.plan_fases}
Reevaluación: ${construccion.reevaluacion}

TRANSCRIPCIÓN DE LA DEFENSA ORAL CON LA COMISIÓN:
${cleanedTranscript}

Evalúa el desempeño integral del estudiante (Construcción + Defensa Oral).
1. Calcula la nota_chilena: Escala de 1.0 a 7.0, donde el 60% de rendimiento equivale a un 4.0.
2. Completa la rubrica_detallada desglosando el feedback cualitativo y el puntaje (0-100) para: Problema/Diagnóstico, Objetivos, Plan Operacional y Defensa Oral.
3. El feedback_final debe ser extenso, justificando la nota.
4. Identifica las debilidades del estudiante y genera una lista de 3 a 5 "temas_a_estudiar" concretos para que pueda repasar.
`;
                result = await executeAIAction({
                    screen: 'SIMULADOR',
                    action: 'SIM_EVAL_DEFENSE',
                    systemInstruction: SIM_EVAL_DEFENSE_PROMPT,
                    userPrompt,
                    inputHash: `sim_eval_def_${Date.now()}_${userId}`,
                    promptVersion: 'sim_v1',
                    temperature: 0.2,
                    validator: (data) => SimDefenseEvaluationSchema.parse(data),
                    skipGuardrails: true,
                });
                result.data = {
                    ...result.data,
                    cleanedTranscript
                };
                break;
            }


            // ─── CALL 7: Daily Training Evaluation ───
            case 'evaluate-training': {
                const { transcript } = payload;
                const cleanedTranscript = await cleanVoiceTranscript(transcript);
                const userPrompt = `
TRANSCRIPCIÓN COMPLETA DE LA SESIÓN DE ENTRENAMIENTO:
${cleanedTranscript}

Evalúa la sesión y extrae el JSON requerido.
`;
                result = await executeAIAction({
                    screen: 'SIMULADOR',
                    action: 'SIM_EVAL_TRAINING',
                    systemInstruction: SIM_EVAL_TRAINING_PROMPT,
                    userPrompt,
                    inputHash: `sim_eval_train_${Date.now()}_${userId}`,
                    promptVersion: 'sim_v1',
                    temperature: 0.2,
                    validator: (data) => SimTrainingEvaluationSchema.parse(data),
                    skipGuardrails: true,
                });
                result.data = {
                    ...result.data,
                    cleanedTranscript
                };
                break;
            }

            // ─── CALL: Transcribe Audio File ───
            case 'transcribe': {
                const { audioBase64, mimeType } = payload;
                if (!audioBase64 || !mimeType) {
                    return NextResponse.json({ error: 'MISSING_PARAMS', message: 'audioBase64 y mimeType son requeridos.' }, { status: 400 });
                }
                const transcriptionPrompt = `
Transcribe exactamente la conversación del audio en español, respetando la puntuación, ortografía técnica y de kinesiología (por ejemplo, nombres de test como Lachman, cajón, FADIR, Slump, y términos como nociceptivo, artrocinemática, dosificación, etc.).
Distingue los turnos de habla. Si se escucha al Alumno (Estudiante/Kinesiólogo) y al Paciente (o Tutor), identifícalos como:
Kinesiólogo: [Texto]
Paciente: [Texto]
Si es un monólogo o exposición, simplemente transcribe el texto continuo.
Retorna ÚNICAMENTE la transcripción limpia en texto plano, sin explicaciones, sin introducciones y sin resúmenes.
`;
                const text = await callGemini({
                    systemInstruction: "Eres un asistente experto en transcripción médica de kinesiología y rehabilitación física. Transcribes de audio a texto de forma impecable.",
                    userPrompt: transcriptionPrompt,
                    audioData: {
                        data: audioBase64,
                        mimeType: mimeType
                    },
                    modelId: 'gemini-3.5-flash',
                    temperature: 0.1,
                    responseMimeType: 'text/plain'
                });
                result = { data: { text } };
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
