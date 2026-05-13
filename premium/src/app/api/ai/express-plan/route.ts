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

═══ REGLA CERO — LENGUAJE CLÍNICO CONTEMPORÁNEO (INQUEBRANTABLE) ═══
PROHIBIDO el uso de terminología médica obsoleta o estructuralista pura.
1. PROHIBIDO usar la palabra "Síndrome" para patologías musculoesqueléticas mecánicas (Ej. DEBES usar "Dolor Patelofemoral", NUNCA "Síndrome de Dolor Patelofemoral". Usar "Dolor Lumbar", NUNCA "Síndrome Lumbar").
2. PROHIBIDO usar el sufijo "-itis" a menos que sea inflamatorio sistémico (Ej. usar "Tendinopatía", NUNCA "Tendinitis").
3. PROHIBIDO usar "Condromalacia", usar "Dolor Patelofemoral".

═══ REGLA 1 — CLASIFICACIÓN DEL DOLOR ═══
1. "clasificacion_dolor":
   - "categoria": "Nociceptivo", "Neuropático", "Nociplástico" o "Mixto".
   - "subtipo": (Mecánico, Isquémico, Radicular, etc.).
   - "fundamento": Máximo 3 líneas cruzando anamnesis con examen físico.
   - "duda_y_descarte": Si hay datos discordantes: "Duda clínica: [X síntoma]. Para confirmar/descartar [Condición Y], realizar [Prueba Z]". Si ya se descartó en la evaluación: "Duda resuelta: [Condición Y] descartada mediante [Prueba Z]".
   - "confianza": "Alta", "Moderada" o "Baja".

═══ REGLA 2 — DIAGNÓSTICO KINESIOLÓGICO (EXHAUSTIVO Y FLUIDO) ═══
2. "diagnostico_narrativo": Redactar en máximo 2 párrafos fluidos y cohesivos. DEBE remarcar TODO lo importante encontrado.
   - Párrafo 1 (Contexto, Anamnesis y Estructura): [Paciente, edad, contexto] consulta por [motivo y evolución]. El mecanismo o patrón reportado en la anamnesis indica [mencionar agravantes/atenuantes clave]. Presenta un cuadro clínico compatible con [Diagnóstico Contemporáneo], caracterizado a nivel estructural por [Solo alteraciones reales confirmadas, ej. desgarro. Si no hay, omitir este punto].
   - Párrafo 2 (Hallazgos del Examen Físico y Función): La examinación física destaca [Resumir exhaustivamente los hallazgos críticos: qué test ortopédicos fueron positivos, déficits exactos de ROM, fallas específicas de fuerza/control motor evaluadas]. Estas deficiencias limitan directamente su capacidad para [actividad afectada] y restringen su participación en [rol]. A nivel contextual, influyen [factores biopsicosociales relevantes].

═══ REGLA 3 — OBJETIVO GENERAL (TRADUCCIÓN DEL PROBLEMA) ═══
3. "objetivo_general":
   - "problema_principal": En 1-2 líneas, define exactamente qué le impide al paciente hacer lo que desea o necesita.
   - "opciones_sugeridas": Redactar 3 o 4 opciones. Las opciones NO DEBEN ser "vías" distintas, sino variaciones de redacción que resuelvan EXACTAMENTE el "problema_principal" (transformar el problema en un logro positivo). Deben usar verbos resolutivos (Lograr, Restaurar, Recuperar, Facilitar). Ej: Si el problema es incapacidad de saltar por dolor, las opciones deben ser variaciones de "Restaurar el salto sin dolor para...".
   - "seleccionado": Indicar la mejor opción redactada.

═══ REGLA 4 — OBJETIVOS ESPECÍFICOS SMART (FIDELIDAD DE MÉTRICA) ═══
4. "objetivos_smart": Generar 1 objetivo SMART por cada deficiencia o limitación, respetando este orden: 1° Dolor/Modulación, 2° Movilidad, 3° Fuerza/Control, 4° Función/Gesto, 5° Educación.
   - REGLA DE ORO INQUEBRANTABLE: La métrica de cambio DEBE ser el instrumento, test o escala EXACTA que el kinesiólogo usó en la examinación física o anamnesis. Si se evaluó con "Test de Lunge", la meta debe ser en "Test de Lunge". PROHIBIDO inventar métricas genéricas si hay un test específico reportado.
   - FORMATO ESTRICTO: "[Verbo de Acción] + [Variable] medida con [Test/Escala exacta de la evaluación] + desde [Valor Basal evaluado] hasta [Valor Meta] + en [Plazo Temporal]."
   - Para Educación: "[Verbo] + [Concepto a educar justificado por la entrevista] + en [Plazo]."
   - VERBOS PERMITIDOS: Reducir, Aumentar, Mejorar, Restaurar, Recuperar, Incrementar, Optimizar, Normalizar, Desarrollar, Fortalecer, Alcanzar, Lograr.
   - VERBOS PROHIBIDOS: Eliminar, Erradicar, Curar, Suprimir.
   - JSON por objetivo: { "texto": "..." } — SOLO eso.

═══ REGLA 5 — PRONÓSTICO BIOPSICOSOCIAL ═══
5. "pronostico": Formato conciso en viñetas.
   - "corto_plazo" (0-4 sem), "mediano_plazo" (4-12 sem), "largo_plazo" (>12 sem)
   - "factores_a_favor": Mínimo 3 factores.
   - "factores_en_contra": Mínimo 2 factores.
   - "historia_natural": Qué pasaría sin intervención.
   - "categoria": Ej. "Favorable", "Reservado", etc.

═══ REGLA 6 — FASES DE REHABILITACIÓN (RANGOS Y TIPS) ═══
6. "fases_rehabilitacion": 4 FASES obligatorias: "Fase 1: Modulación de Síntomas", "Fase 2: Recuperación de Movilidad y Control Motor", "Fase 3: Aumento de Capacidad y Fuerza", "Fase 4: Reintegro Funcional / Deportivo".
   Para cada fase:
   - "fase": Número (1-4).
   - "nombre": Nombre OBLIGATORIO según la lista anterior.
   - "duracion_estimada": Ej: "Semanas 1-3".
   - "objetivos_operacionales": Qué se buscará lograr físicamente.
   - "intervenciones": 3 a 5 ejercicios o estrategias activas.
   - "tips_dosificacion": PROHIBIDO dar series y repeticiones fijas (ej. no usar "3x10"). DEBES proporcionar rangos terapéuticos, focos mecánicos o métricas de esfuerzo (ej. RPE 7-8, TUT 40 seg, RIR 2, enfoque excéntrico lento).
   - "criterios_progresion": 2 métricas claras para avanzar.

═══ REGLA 7 — REEVALUACIÓN Y MÉTRICAS DE AVANCE ═══
7. "reglas_reevaluacion":
   - "metrica_subjetiva": Medición reportada por el paciente (ej. EVA al realizar la tarea índice).
   - "metrica_objetiva": Medición clínica pura vinculada a los test del examen físico (ej. grados de asimetría, cm en test funcional).
   - "metrica_funcional_participacion": Métrica que emule el gesto real al que desea reintegrarse (ej. dolor al replicar postura de combate o gesto laboral).
   - "criterio_estancamiento": Qué señal clínica indica derivación o replanteo total.

═══ REGLAS DE CALIDAD ═══
- NUNCA inventes datos. Si faltan, asume lo clínicamente más probable.
- Redacción clínica útil con valor docente.
- En deportistas: incluir terminología de readaptación deportiva.
- PROHIBIDO incluir citas, autores o bibliografía.
- PROHIBIDO sugerir fármacos, punción seca, taping, vendaje neuromuscular.
`;

const expectedJsonStructure = `{
  "clasificacion_dolor": { "categoria": "...", "subtipo": "...", "fundamento": "...", "duda_y_descarte": "...", "confianza": "..." },
  "diagnostico_narrativo": "Párrafo 1...\\n\\nPárrafo 2...",
  "objetivo_general": { "problema_principal": "...", "opciones_sugeridas": ["...", "...", "..."], "seleccionado": "..." },
  "objetivos_smart": [{ "texto": "Reducir... medida con... desde X hasta Y en Z semanas." }],
  "pronostico": { "corto_plazo": "...", "mediano_plazo": "...", "largo_plazo": "...", "factores_a_favor": ["..."], "factores_en_contra": ["..."], "historia_natural": "...", "categoria": "..." },
  "fases_rehabilitacion": [{ "fase": 1, "nombre": "Fase 1: Modulación de Síntomas", "duracion_estimada": "...", "objetivos_operacionales": ["..."], "intervenciones": ["..."], "tips_dosificacion": ["..."], "criterios_progresion": ["..."] }],
  "reglas_reevaluacion": { "metrica_subjetiva": "...", "metrica_objetiva": "...", "metrica_funcional_participacion": "...", "criterio_estancamiento": "..." }
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
            promptVersion: 'v2.3_metrics_fidelity_ranges',
            temperature: 0.3,
            validator: (data: any) => {
                if (typeof data === 'string') {
                    const clean = data.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
                    return JSON.parse(clean);
                }
                // Sanitize fases
                if (data?.fases_rehabilitacion && Array.isArray(data.fases_rehabilitacion)) {
                    data.fases_rehabilitacion = data.fases_rehabilitacion.map((f: any) => ({
                        ...f,
                        objetivos_operacionales: f?.objetivos_operacionales || [],
                        intervenciones: f?.intervenciones || [],
                        tips_dosificacion: f?.tips_dosificacion || f?.dosificacion_contemporanea || [],
                        criterios_progresion: f?.criterios_progresion || f?.progresiones || [],
                    }));
                }
                // Sanitize reevaluacion
                if (data?.reglas_reevaluacion) {
                    data.reglas_reevaluacion.metrica_subjetiva = data.reglas_reevaluacion.metrica_subjetiva || '';
                    data.reglas_reevaluacion.metrica_objetiva = data.reglas_reevaluacion.metrica_objetiva || '';
                    data.reglas_reevaluacion.metrica_funcional_participacion = data.reglas_reevaluacion.metrica_funcional_participacion || '';
                    data.reglas_reevaluacion.criterio_estancamiento = data.reglas_reevaluacion.criterio_estancamiento || '';
                }
                // Sanitize clasificacion
                if (data?.clasificacion_dolor) {
                    data.clasificacion_dolor.duda_y_descarte = data.clasificacion_dolor.duda_y_descarte || data.clasificacion_dolor.duda_mezcla || '';
                }
                // Sanitize objetivo_general
                if (data?.objetivo_general) {
                    data.objetivo_general.problema_principal = data.objetivo_general.problema_principal || data.objetivo_general.problema_principal_caso || '';
                }
                // Cleanup removed fields
                if (data?.herramientas_complementarias) delete data.herramientas_complementarias;
                return data;
            }
        });

        return NextResponse.json({ success: true, data: result.data, telemetry: result.telemetry });
    } catch (err: any) {
        console.error('[express-plan] Error:', err);
        return NextResponse.json({ error: 'INTERNAL_ERROR', message: err.message }, { status: 500 });
    }
}
