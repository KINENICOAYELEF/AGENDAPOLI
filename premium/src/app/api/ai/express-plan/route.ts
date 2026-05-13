import { NextResponse } from 'next/server';
import { executeAIAction } from '@/lib/ai/geminiClient';
import { SYSTEM_PROMPT_BASE } from '@/lib/ai/prompts';

export const maxDuration = 120;

const rateLimitCache = new Map<string, { count: number; timestamp: number }>();
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS = 8;

function checkRateLimit(key: string): boolean {
    const now = Date.now();
    const record = rateLimitCache.get(key);
    if (!record) { rateLimitCache.set(key, { count: 1, timestamp: now }); return true; }
    if (now - record.timestamp > RATE_LIMIT_WINDOW_MS) { rateLimitCache.set(key, { count: 1, timestamp: now }); return true; }
    if (record.count >= MAX_REQUESTS) return false;
    record.count += 1;
    return true;
}

const EXPRESS_PLAN_SYSTEM = SYSTEM_PROMPT_BASE + `

═══ CONTEXTO ═══
Recibirás datos en formato LIBRE (notas de anamnesis, evaluación física y un razonamiento clínico previo generado por IA).
Tu tarea es producir el PLAN CLÍNICO COMPLETO equivalente a P3+P4, adaptado al formato v2.
NO tienes el Case Organizer de P3 estructurado. Debes INFERIR la clasificación CIF directamente de las notas.

═══ REGLA 1 — CLASIFICACIÓN DEL DOLOR ═══
1. "clasificacion_dolor":
   - "categoria": Mecanismo dominante: "Nociceptivo", "Neuropático", "Nociplástico" o "Mixto".
   - "subtipo": Apellido (Mecánico, Inflamatorio, Radicular, Isquémico, etc.).
   - "fundamento": Párrafo de 3-4 oraciones con hallazgos que APOYAN esta clasificación, cruzando anamnesis con evaluación física.
   - "duda_mezcla": Hallazgos que NO CALZAN o que podrían sugerir OTRO mecanismo. Datos discordantes. Si no hay ninguno, explicar por qué la clasificación es clara.
   - "sugerencia_diferencial": Si existen síntomas que podrían sugerir OTRO mecanismo de dolor, indicar: qué síntomas lo sugieren, qué tipo de dolor podría ser, y 3-4 pruebas o preguntas específicas para DESCARTARLO (solo si el evaluador NO las realizó). Si ya se descartó en la evaluación, escribir "Descartado en evaluación" con justificación.
   - "confianza": "Alta", "Moderada" o "Baja".

═══ REGLA 2 — DIAGNÓSTICO KINESIOLÓGICO ═══
2. "diagnostico_narrativo": Redactar ESTRUCTURADO con secciones CIF claras. Usar el siguiente formato con marcadores ■:

   ■ PRESENTACIÓN CLÍNICA: [Nombre/edad/sexo], consulta por [motivo + evolución]. Hipótesis diagnóstica funcional: "Disfunción de [región] con predominio de [patrón]".
   - Si un MÉDICO diagnosticó algo previamente, incluirlo: "Con diagnóstico médico previo de [X]".
   - Si las pruebas clínicas son altamente sugerentes (>80% concordancia de cluster diagnóstico), puede decirse: "Posible diagnóstico de [X] basado en [cluster de pruebas]". Aclarar: "pendiente de confirmación médica".
   - Si existe clasificación reconocida JOSPT aplicable al caso, mencionarla. Si NO existe, NO inventarla ni forzarla.

   ■ DEFICIENCIAS ESTRUCTURALES: SOLO alteraciones de estructura corporal VERIFICABLES y REALES: desgarro confirmado, cicatriz activa, fractura consolidada, deformidad articular objetiva, aumento de volumen articular medible. PROHIBIDO listar dolor como alteración estructural. Si NO hay alteraciones estructurales confirmadas, escribir "Sin alteraciones estructurales confirmadas al momento de la evaluación."

   ■ DEFICIENCIAS FUNCIONALES: Déficits de función corporal. Cubrir TODOS los dominios relevantes: Dolor (localización, intensidad, comportamiento), Rango de movimiento (activo, pasivo), Fuerza muscular (por grupo, escala Daniels), Control motor (patrones alterados), Propiocepción y equilibrio, Resistencia muscular local, Capacidad cardiorrespiratoria, Función sensoriomotora (coordinación, agilidad), Función neurológica periférica, Regulación del tono muscular. Cada deficiencia con severidad y lateralidad.

   ■ LIMITACIONES EN LA ACTIVIDAD: Actividades concretas afectadas con impacto funcional.

   ■ RESTRICCIONES EN LA PARTICIPACIÓN: Roles y contextos afectados.

   ■ FACTORES CONTEXTUALES: Positivos y negativos (personales + ambientales).

   REGLAS:
   - PROHIBIDO términos obsoletos: "Tendinitis" (usar "tendinopatía"), "Condromalacia" (usar terminología CIF).
   - Separar SIEMPRE estructural de funcional.
   - NO diagnosticar como kinesiólogo. Usar "Presentación funcional compatible con..." o "Posible diagnóstico pendiente de confirmación médica".

═══ REGLA 3 — OBJETIVO GENERAL (CON OPCIONES) ═══
3. "objetivo_general":
   - "problema_principal_caso": En 2-3 líneas, el PROBLEMA CENTRAL.
   - "opciones_sugeridas": 4 opciones AMPLIAS con ENFOQUES DISTINTOS (Funcional, Reintegro, BPS Integral, Preventivo).
   PROHIBIDO mencionar variables específicas (dolor, ROM, fuerza) → eso va en SMART.
   - "seleccionado": La opción más completa e integradora.

═══ REGLA 4 — OBJETIVOS ESPECÍFICOS SMART ═══
4. "objetivos_smart": Generar TODOS los objetivos necesarios para resolver integralmente el caso. NO HAY LÍMITE FIJO: genera tantos como deficiencias, limitaciones y factores modificables se hayan identificado.
   REGLA DE COBERTURA: 1 deficiencia = mínimo 1 SMART. Si una deficiencia tiene 2 variables (dolor + rigidez) = 2 SMART separados.
   FORMATO ESTRICTO (sin excepciones): "[Verbo] + [UNA variable medible] + de [valor basal] a [valor meta] + en [plazo temporal]."
   PROHIBIDO incluir "mediante" o estrategias de intervención en el objetivo. El "cómo" va en las Fases.
   VERBOS PERMITIDOS: Reducir, Aumentar, Mejorar, Restaurar, Recuperar, Incrementar, Optimizar, Normalizar, Desarrollar, Fortalecer, Alcanzar, Lograr.
   VERBOS PROHIBIDOS: Eliminar, Erradicar, Curar, Suprimir.
   JSON por objetivo: { "texto": "..." } — SOLO eso.

═══ REGLA 5 — PRONÓSTICO BIOPSICOSOCIAL ═══
5. "pronostico": CADA campo MÍNIMO 3-4 LÍNEAS.
   - "corto_plazo" (0-4 sem), "mediano_plazo" (4-12 sem), "largo_plazo" (>12 sem)
   - "factores_a_favor": MÍNIMO 3 factores CONCRETOS.
   - "factores_en_contra": MÍNIMO 2 factores CONCRETOS.
   - "historia_natural": Qué pasará si NO se trata.
   - "comparativa_adherencia": Alta adherencia vs abandono.
   - "categoria": "favorable" / "favorable con vigilancia" / "reservado" / "reservado dependiente" / "desfavorable" / "incierto"
   - "justificacion": Síntesis integradora.

═══ REGLA 6 — FASES DE REHABILITACIÓN ═══
6. "fases_rehabilitacion": 4 FASES. Cada fase DEBE cubrir el 100% de los objetivos específicos. Para CADA fase:
   - "fase", "nombre", "foco_principal", "objetivo_fisiologico", "duracion_estimada", "criterios_entrada"
   - "objetivos_operacionales": Array de objetivos operacionales concretos. Indica QUÉ se hará para avanzar hacia los objetivos específicos. Un objetivo específico puede tener MÚLTIPLES operacionales en diferentes fases.
   - "intervenciones": MÍNIMO 5 intervenciones ESPECÍFICAS con parámetros.
   - "tips_dosificacion": 3-5 tips MODERNOS (RPE, RIR, Tempo, TUT). PROHIBIDO "3x15 convencional".
   - "progresiones": MÍNIMO 3 criterios de progresión.
   - "criterios_avance": Criterios MEDIBLES.
   - "criterios_regresion": Señales de alarma.
   - "errores_frecuentes": 2-3 errores de kinesiólogo novato.
   - "sesiones_tipo": 2 sesiones tipo ~60 min.

═══ REGLA 7 — HERRAMIENTAS COMPLEMENTARIAS ═══
7. "herramientas_complementarias": Array de herramientas ADJUNTAS al ejercicio terapéutico activo (pilar central).
   CATEGORÍAS:
   a) TERAPIA MANUAL: Movilización articular (Maitland, Mulligan MWM), movilización neurodinámica, movilización de tejido blando funcional.
   b) MANEJO DE TEJIDO BLANDO: Foam rolling/auto-masaje (como herramienta de auto-regulación), masaje deportivo funcional, técnicas instrumentadas (IASTM). PROHIBIDO: "liberación miofascial", "trigger points", "puntos gatillo".
   c) AGENTES FÍSICOS (visión contemporánea): Crioterapia: uso selectivo (evidencia actual cuestiona uso sistemático post-lesión, puede retrasar remodelación tisular, considerar solo para manejo sintomático agudo). Termoterapia: como facilitador pre-ejercicio. BFR: evidencia creciente para hipertrofia con cargas bajas en fases tempranas. PROHIBIDO: ultrasonido, TENS, electroterapia convencional, láser.
   d) EDUCACIÓN: Neurociencia del dolor, autoeficacia, exposición gradual al movimiento.
   Para CADA: { "herramienta", "categoria", "justificacion", "aplicacion", "nota_evidencia" }

═══ REGLA 8 — REEVALUACIÓN ═══
8. "reglas_reevaluacion":
   - "signo_comparable", "razon_signo", "signos_comparables" (array), "variables_seguimiento", "frecuencia", "criterio_mejora", "criterio_estancamiento", "alertas_derivacion"

═══ REGLAS DE CALIDAD ═══
- NUNCA inventes datos. Si faltan, asume lo clínicamente más probable.
- NO resumas cuando dice "extenso". Cumple los mínimos.
- Redacción clínica útil con valor docente.
- En deportistas: incluir terminología de readaptación deportiva.
- PROHIBIDO incluir citas, autores o bibliografía.
- PROHIBIDO sugerir fármacos, punción seca, taping, vendaje neuromuscular.
`;

const expectedJsonStructure = `{
  "clasificacion_dolor": { "categoria": "...", "subtipo": "...", "fundamento": "...", "duda_mezcla": "...", "sugerencia_diferencial": "...", "confianza": "..." },
  "diagnostico_narrativo": "■ PRESENTACIÓN CLÍNICA: ...\\n■ DEFICIENCIAS ESTRUCTURALES: ...\\n■ DEFICIENCIAS FUNCIONALES: ...\\n■ LIMITACIONES EN LA ACTIVIDAD: ...\\n■ RESTRICCIONES EN LA PARTICIPACIÓN: ...\\n■ FACTORES CONTEXTUALES: ...",
  "objetivo_general": { "problema_principal_caso": "...", "opciones_sugeridas": ["...", "...", "...", "..."], "seleccionado": "..." },
  "objetivos_smart": [{ "texto": "Reducir... de X a Y en Z semanas." }],
  "pronostico": { "corto_plazo": "...", "mediano_plazo": "...", "largo_plazo": "...", "factores_a_favor": ["..."], "factores_en_contra": ["..."], "historia_natural": "...", "comparativa_adherencia": "...", "categoria": "...", "justificacion": "..." },
  "fases_rehabilitacion": [{ "fase": 1, "nombre": "...", "foco_principal": "...", "objetivo_fisiologico": "...", "duracion_estimada": "...", "criterios_entrada": "...", "objetivos_operacionales": ["..."], "intervenciones": ["..."], "tips_dosificacion": ["..."], "progresiones": ["..."], "criterios_avance": "...", "criterios_regresion": "...", "errores_frecuentes": ["..."], "sesiones_tipo": [{"titulo": "...", "duracion": "~60 min", "estructura": ["..."]}] }],
  "herramientas_complementarias": [{ "herramienta": "...", "categoria": "...", "justificacion": "...", "aplicacion": "...", "nota_evidencia": "..." }],
  "reglas_reevaluacion": { "signo_comparable": "...", "razon_signo": "...", "signos_comparables": [{"evaluacion": "...", "tipo": "...", "justificacion": "..."}], "variables_seguimiento": ["..."], "frecuencia": "...", "criterio_mejora": "...", "criterio_estancamiento": "...", "alertas_derivacion": ["..."] }
}`;

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { razonamientoIA, anamnesisProxima, anamnesisRemota, evaluacionFisica, userId } = body;

        if (userId && !checkRateLimit(userId)) {
            return NextResponse.json({ error: 'RATE_LIMIT_EXCEEDED', message: 'Límite alcanzado (8/10min).' }, { status: 429 });
        }

        const context = [
            razonamientoIA ? `## RAZONAMIENTO CLÍNICO IA PREVIO:\n${razonamientoIA}` : null,
            anamnesisProxima ? `## ANAMNESIS PRÓXIMA:\n${anamnesisProxima}` : null,
            anamnesisRemota ? `## ANAMNESIS REMOTA:\n${anamnesisRemota}` : null,
            evaluacionFisica ? `## EVALUACIÓN FÍSICA:\n${evaluacionFisica}` : null,
        ].filter(Boolean).join('\n\n---\n\n');

        if (!context.trim()) {
            return NextResponse.json({ error: 'NO_DATA', message: 'No hay datos clínicos suficientes.' }, { status: 400 });
        }

        const userPrompt = `Genera el output requerido usando EXCLUSIVAMENTE formato JSON parseable y cumpliendo estrictamente con la siguiente estructura y tipos exactos:
${expectedJsonStructure}

DATOS CLÍNICOS DEL CASO:
${context}`;

        const result = await executeAIAction({
            screen: 'EXPRESS_V2',
            action: 'EXPRESS_PLAN',
            systemInstruction: EXPRESS_PLAN_SYSTEM,
            userPrompt,
            inputHash: `express_plan_${Buffer.from(context).length}`,
            promptVersion: 'v2.0_approved',
            temperature: 0.3,
            validator: (data: any) => {
                if (typeof data === 'string') {
                    const clean = data.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
                    return JSON.parse(clean);
                }
                if (data?.fases_rehabilitacion && Array.isArray(data.fases_rehabilitacion)) {
                    data.fases_rehabilitacion = data.fases_rehabilitacion.map((f: any) => ({
                        ...f,
                        objetivos_operacionales: f?.objetivos_operacionales || [],
                        intervenciones_complementarias: f?.intervenciones_complementarias || [],
                        tips_dosificacion: f?.tips_dosificacion || [],
                        sesiones_tipo: f?.sesiones_tipo || [],
                        errores_frecuentes: f?.errores_frecuentes || [],
                        progresiones: f?.progresiones || [],
                    }));
                }
                if (data?.reglas_reevaluacion) {
                    data.reglas_reevaluacion.signos_comparables = (data.reglas_reevaluacion.signos_comparables || []).map((sc: any) => ({
                        evaluacion: sc?.evaluacion || '', tipo: sc?.tipo || '', justificacion: sc?.justificacion || '',
                    }));
                    data.reglas_reevaluacion.alertas_derivacion = data.reglas_reevaluacion.alertas_derivacion || [];
                }
                if (!data?.herramientas_complementarias) data.herramientas_complementarias = [];
                if (!data?.clasificacion_dolor?.duda_mezcla) data.clasificacion_dolor.duda_mezcla = '';
                if (!data?.clasificacion_dolor?.sugerencia_diferencial) data.clasificacion_dolor.sugerencia_diferencial = '';
                return data;
            }
        });

        return NextResponse.json({ success: true, data: result.data, telemetry: result.telemetry });
    } catch (err: any) {
        console.error('[express-plan] Error:', err);
        return NextResponse.json({ error: 'INTERNAL_ERROR', message: err.message }, { status: 500 });
    }
}
