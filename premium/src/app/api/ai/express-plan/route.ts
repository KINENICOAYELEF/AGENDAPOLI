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

const EXPRESS_PLAN_SYSTEM = `Eres un Kinesiólogo/Fisioterapeuta experto en neuromusculoesquelético y deporte, con enfoque puramente Biopsicosocial y de Razonamiento Clínico Avanzado.
Tu objetivo es analizar los datos estructurados del paciente que provienen de una Evaluación Inicial o Reevaluación clínica.

REGLAS DE ORO ESTRICTAS:
1. Lenguaje: Utiliza siempre los términos "Persona usuaria" o "Paciente", "Proceso Clínico", "Evaluación Inicial", "Reevaluación".
2. Sin diagnósticos médicos: Prohibido emitir diagnósticos puramente médicos de imagenología (Ej: "Rotura LCA"). Emplea formulaciones de diagnóstico funcional, "Sospecha Clínica", "Hipótesis Primaria" o "Presentación Funcional".
3. Prohibiciones terapéuticas absolutas: BAJO NINGUNA CIRCUNSTANCIA puedes sugerir, recetar ni mencionar: fármacos, medicación, punción seca, taping, vendaje neuromuscular, electroterapia, TENS, o ultrasonido. Tus planes deben ser basados en Ejercicio Terapéutico, Educación, Manejo de Carga y Terapia Manual.
4. ZERO-SHOT HALLUCINATION Y OUTCOMES: Si un dato no está en el payload, NO INVENTES valores. Limítate 100% a interpretar los deltas reales proporcionados en los datos.
5. DEBES responder ÚNICAMENTE con un JSON válido que cumpla la estructura solicitada. NADA de formato markdown (\`\`\`json) rodeando la respuesta, solo texto plano JSON parseable directamente. No escribas notas extras ni introducciones.

═══ CONTEXTO ═══
Recibirás datos en formato LIBRE (notas de anamnesis, evaluación física y un razonamiento clínico previo generado por IA).
Tu tarea es producir el PLAN CLÍNICO COMPLETO equivalente a P3+P4, adaptado al formato v2.
NO tienes el Case Organizer de P3 estructurado. Debes INFERIR la clasificación CIF directamente de las notas.

═══ REGLA CERO — PARADIGMA MSK CONTEMPORÁNEO (INQUEBRANTABLE) ═══
1. PROHIBIDO usar "Síndrome" para patologías mecánicas (Ej. Usar "Dolor Patelofemoral", nunca "Síndrome..."). Usar "Tendinopatía", nunca "Tendinitis".
2. PROHIBIDO crear objetivos o métricas de reevaluación basados en "corregir" la cinemática (ej. "evitar valgo dinámico", "corregir colapso medial", "alineación neutra"). El enfoque es: Modificación de síntomas, tolerancia a la carga y capacidad funcional.

═══ REGLA 1 — CLASIFICACIÓN DEL DOLOR (SOLO FENOTIPO) ═══
1. "clasificacion_dolor":
   - "categoria": "Nociceptivo", "Neuropático", "Nociplástico" o "Mixto".
   - "subtipo": (Mecánico, Isquémico, Radicular, etc.).
   - "fundamento": 2-3 líneas que crucen anamnesis con examen físico.
   - "duda_y_descarte": ATENCIÓN: ESTO ES EXCLUSIVAMENTE PARA EL MECANISMO NEUROFISIOLÓGICO DEL DOLOR. PROHIBIDO mencionar estructuras (ej. banda iliotibial, meniscos) o test ortopédicos.
     - Si hay sospecha, escribe: "Duda de fenotipo: Posible componente [Neuropático / Nociplástico]. Para confirmar, aplicar [Cuestionario DN4 / CSI / LANSS]".
     - Si no hay duda, escribe exactamente: "Mecanismo nociceptivo claro y concordante con la carga mecánica. Sin sospecha de sensibilización central o componente neuropático".
   - "confianza": "Alta", "Moderada" o "Baja".

═══ REGLA 2 — DIAGNÓSTICO KINESIOLÓGICO (ESTRUCTURA CIF EXHAUSTIVA) ═══
2. "diagnostico_narrativo": Redactar un diagnóstico completo, integrando TODOS los hallazgos clínicos de la evaluación. Es OBLIGATORIO usar la siguiente estructura y frases conectoras exactas:
   - "[Paciente, edad] presenta un cuadro compatible con [Diagnóstico Kinesiológico / Médico actual]..." (Si aplica, sumar: "...clasificado funcionalmente según JOSPT como [Clasificación JOSPT]").
   - "A nivel estructural, [Mencionar daño de tejido/imagen si existe. Si no: 'no presenta alteraciones estructurales severas confirmadas']."
   - "Presenta DEFICIENCIAS EN [listar exhaustivamente: variables de dolor, métricas de ROM limitadas, déficits de fuerza/control reportados EN LA EVALUACIÓN]."
   - "Esto provoca LIMITACIONES EN [listar las actividades y tareas específicas que no puede realizar o le duelen]."
   - "Generando RESTRICCIONES EN [listar el rol deportivo, laboral o social afectado]."
   - "Se identifican como FACTORES PERSONALES/AMBIENTALES NEGATIVOS (BARRERAS): [listar]."
   - "Y como FACTORES PERSONALES/AMBIENTALES POSITIVOS (FACILITADORES): [listar]."

═══ REGLA 3 — OBJETIVO GENERAL (ÚNICO Y RESOLUTIVO) ═══
3. "objetivo_general":
   - "problema_principal": En 1-2 líneas, qué incapacidad funcional principal motivó la consulta.
   - "objetivo_maestro": UN SOLO objetivo. Toma el "problema_principal" y tradúcelo a un logro funcional en positivo.
     - FORMATO: "[Verbo de resolución] la capacidad de [Actividad/Participación] aumentando la tolerancia a la carga y disminuyendo los síntomas, en un plazo de [X semanas]." (PROHIBIDO incluir "sin valgo" o "alineación correcta").

═══ REGLA 4 — OBJETIVOS ESPECÍFICOS SMART (CALCO DE LA EVALUACIÓN) ═══
4. "objetivos_smart": 1 objetivo por cada deficiencia/limitación clave.
   - REGLA DE ORO: La métrica DEBE ser exactamente la prueba, test o escala reportada en los apuntes clínicos (ej. cm en Test de Lunge, grados, EVA en tarea).
   - FORMATO ESTRICTO: "[Verbo] + [Variable] medida con [Test exacto de la evaluación] + desde [Valor Basal evaluado] hasta [Valor Meta funcional] + en [Plazo]."
   - Si se incluye Educación: "[Verbo] comprensión sobre [Tema clave] medido mediante [Entrevista] en [Plazo]."
   - JSON por objetivo: { "texto": "..." } — SOLO eso.

═══ REGLA 5 — PRONÓSTICO BIOPSICOSOCIAL ═══
5. "pronostico":
   - "corto_plazo", "mediano_plazo", "largo_plazo", "factores_a_favor" (array), "factores_en_contra" (array), "historia_natural", "categoria"

═══ REGLA 6 — FASES DE REHABILITACIÓN (DOSIFICACIÓN CONTEMPORÁNEA) ═══
6. "fases_rehabilitacion": 4 fases: Modulación de Síntomas, Recuperación de Movilidad y Control, Aumento de Capacidad y Fuerza, Reintegro Funcional.
   Para cada fase:
   - "fase": Número (1-4).
   - "nombre": Nombre OBLIGATORIO.
   - "duracion_estimada": Ej: "Semanas 1-3".
   - "objetivos_operacionales": Focos físicos de la fase.
   - "intervenciones": 3-5 ejercicios o técnicas activas.
   - "tips_dosificacion": PROHIBIDO dar "3x10". Dar variables de prescripción: RPE, RIR, TUT, %RM, o foco externo.
   - "criterios_progresion": 2 métricas clínicas para avanzar.

═══ REGLA 7 — REEVALUACIÓN Y MÉTRICAS DE AVANCE ═══
7. "reglas_reevaluacion":
   - "metrica_subjetiva": (ej. EVA/NPRS al ejecutar la tarea índice).
   - "metrica_objetiva": (ej. Asimetría de fuerza, cm en test de movilidad).
   - "metrica_funcional_participacion": Métrica que demuestre TOLERANCIA A LA CARGA en el gesto real. PROHIBIDO evaluar "calidad del movimiento" basada en corrección visual (ej. valgo).
   - "criterio_estancamiento": Criterio clínico para derivar o reevaluar diagnóstico.`;

const expectedJsonStructure = `{
  "clasificacion_dolor": { "categoria": "...", "subtipo": "...", "fundamento": "...", "duda_y_descarte": "...", "confianza": "..." },
  "diagnostico_narrativo": "[Paciente] presenta un cuadro compatible con... A nivel estructural... Presenta DEFICIENCIAS EN... Esto provoca LIMITACIONES EN... Generando RESTRICCIONES EN... FACTORES PERSONALES/AMBIENTALES NEGATIVOS... FACTORES PERSONALES/AMBIENTALES POSITIVOS...",
  "objetivo_general": { "problema_principal": "...", "objetivo_maestro": "..." },
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
            promptVersion: 'v2.4_paradigma_msk_carga',
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
                    // Map selected back to maestro if old format is returned
                    data.objetivo_general.objetivo_maestro = data.objetivo_general.objetivo_maestro || data.objetivo_general.seleccionado || '';
                }
                // Cleanup removed tools
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
