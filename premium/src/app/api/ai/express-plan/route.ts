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
2. PROHIBIDO usar el sufijo "-itis" a menos que sea inflamatorio sistémico (Ej. DEBES usar "Tendinopatía", NUNCA "Tendinitis").
3. PROHIBIDO usar "Condromalacia", usar "Dolor Patelofemoral".

═══ REGLA 1 — CLASIFICACIÓN DEL DOLOR ═══
1. "clasificacion_dolor":
   - "categoria": "Nociceptivo", "Neuropático", "Nociplástico" o "Mixto".
   - "subtipo": (Mecánico, Isquémico, Radicular, etc.).
   - "fundamento": Máximo 3 líneas cruzando anamnesis con examen físico.
   - "duda_y_descarte": Si hay datos discordantes, ESTRUCTURAR ASÍ: "Duda clínica: [X síntoma]. Para confirmar o descartar [Condición Y], se debe realizar [Prueba Z]". Si el evaluador ya la descartó, escribir: "Duda resuelta: [Condición Y] descartada mediante [Prueba Z]".
   - "confianza": "Alta", "Moderada" o "Baja".

═══ REGLA 2 — DIAGNÓSTICO KINESIOLÓGICO (ESTRUCTURA DE 2 PÁRRAFOS) ═══
2. "diagnostico_narrativo": Redactar EXACTAMENTE en dos párrafos fluidos, sin usar viñetas ni símbolos especiales (como cuadrados o guiones).
   - Párrafo 1 (Presentación y Estructura): [Paciente, edad, sexo] consulta por [motivo principal]. Presenta un cuadro clínico compatible con [Diagnóstico Kinesiológico Contemporáneo], caracterizado a nivel estructural por [Mencionar SOLO alteraciones estructurales reales y confirmadas, ej. desgarro, edema. Si NO hay, escribir: "sin alteraciones estructurales confirmadas al momento de la evaluación"]. 
   - Párrafo 2 (Función, Actividad y Contexto): Esta condición genera deficiencias funcionales en [listar las deficiencias evaluadas: dolor, ROM, fuerza, control motor], lo que limita su capacidad para [actividad específica limitada, ej. bajar escaleras] y restringe su participación en [rol deportivo, laboral o social]. Este cuadro se ve influenciado por factores contextuales [positivos/negativos detectados en la anamnesis].

═══ REGLA 3 — OBJETIVO GENERAL ═══
3. "objetivo_general":
   - "problema_principal": En 1-2 líneas, el problema funcional primario que motivó la consulta.
   - "opciones_sugeridas": Redactar 3 opciones de Objetivo General REALES. Las 3 deben apuntar directamente a resolver el problema principal del paciente, pero variando ligeramente la estrategia o el enfoque narrativo (ej. una más enfocada en la autonomía del paciente, otra en el rendimiento de la tarea). Deben usar verbos resolutivos (Restaurar, Lograr, Recuperar, Facilitar).
   - "seleccionado": Indicar cuál de las 3 opciones es la más certera para el caso y por qué.

═══ REGLA 4 — OBJETIVOS ESPECÍFICOS SMART (ORDEN Y RIGOR) ═══
4. "objetivos_smart": Generar 1 objetivo SMART por cada deficiencia o limitación, respetando el siguiente ORDEN JERÁRQUICO OBLIGATORIO:
   1° Objetivos de Modulación de Síntomas/Dolor.
   2° Objetivos de Movilidad/ROM.
   3° Objetivos de Fuerza/Control Motor.
   4° Objetivos Funcionales/Participación (Gesto específico).
   5° Objetivos de Educación/Autoeficacia (Basado en la evidencia y creencias del paciente, ej. educación en neurociencia, gestión de carga).
   - REGLA DE ORO INQUEBRANTABLE: SOLO genera objetivos para variables EXPLÍCITAMENTE evaluadas o reportadas. 
   - FORMATO ESTRICTO: "[Verbo de Acción] + [Variable Clínica/Educativa] + desde [Valor Basal o estado evaluado actual] hasta [Valor Meta] + en [Plazo Temporal]."
   - PROHIBIDO incluir el "cómo" o la intervención dentro del objetivo.
   - VERBOS PERMITIDOS: Reducir, Aumentar, Mejorar, Restaurar, Recuperar, Incrementar, Optimizar, Normalizar, Desarrollar, Fortalecer, Alcanzar, Lograr.
   - VERBOS PROHIBIDOS: Eliminar, Erradicar, Curar, Suprimir.
   - JSON por objetivo: { "texto": "..." } — SOLO eso.

═══ REGLA 5 — PRONÓSTICO BIOPSICOSOCIAL ═══
5. "pronostico": Mantener la respuesta CONCISA en viñetas cortas.
   - "corto_plazo" (0-4 sem), "mediano_plazo" (4-12 sem), "largo_plazo" (>12 sem)
   - "factores_a_favor": Mínimo 3 factores en viñetas cortas.
   - "factores_en_contra": Mínimo 2 factores en viñetas cortas.
   - "historia_natural": 1 línea sobre qué pasaría sin intervención.
   - "categoria": Ej. "Favorable", "Reservado", "Desfavorable", etc.

═══ REGLA 6 — FASES DE REHABILITACIÓN (NOMENCLATURA OBLIGATORIA) ═══
6. "fases_rehabilitacion": 4 FASES con los siguientes nombres OBLIGATORIOS:
   - "Fase 1: Modulación de Síntomas".
   - "Fase 2: Recuperación de Movilidad y Control Motor".
   - "Fase 3: Aumento de Capacidad y Fuerza".
   - "Fase 4: Reintegro Funcional / Deportivo".
   Para cada fase generar:
   - "fase": Número (1-4).
   - "nombre": Nombre OBLIGATORIO según la lista anterior.
   - "duracion_estimada": Ej: "Semanas 1-3".
   - "objetivos_operacionales": QUÉ se buscará lograr físicamente en esta fase.
   - "intervenciones": 3 a 5 ejercicios específicos con parámetros.
   - "dosificacion_contemporanea": OBLIGATORIO prescribir usando RPE, RIR, o TUT. Prohibido usar "3x10" genérico.
   - "criterios_progresion": 2 métricas claras para avanzar de fase.

═══ REGLA 7 — REEVALUACIÓN Y MÉTRICAS DE AVANCE ═══
7. "reglas_reevaluacion":
   - "metrica_subjetiva": Medición reportada por el paciente intra/inter sesión (ej. EVA/NPRS al realizar una tarea específica, RPE percibido).
   - "metrica_objetiva": Medición clínica pura (ej. grados de dorsiflexión en Test de Lunge, asimetría de fuerza en dinamometría, tiempo en test de equilibrio).
   - "metrica_funcional_participacion": Una métrica que EMULE el gesto o actividad real a la que el paciente desea reintegrarse (ej. dolor al replicar postura de combate, tiempo de caminata sin claudicación simulando ir de compras).
   - "criterio_estancamiento": Qué señal clínica o de tiempo indicará que se debe derivar a médico o replantear completamente el tratamiento.

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
  "objetivos_smart": [{ "texto": "Reducir... desde X hasta Y en Z semanas." }],
  "pronostico": { "corto_plazo": "...", "mediano_plazo": "...", "largo_plazo": "...", "factores_a_favor": ["..."], "factores_en_contra": ["..."], "historia_natural": "...", "categoria": "..." },
  "fases_rehabilitacion": [{ "fase": 1, "nombre": "Fase 1: Modulación de Síntomas", "duracion_estimada": "...", "objetivos_operacionales": ["..."], "intervenciones": ["..."], "dosificacion_contemporanea": ["..."], "criterios_progresion": ["..."] }],
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
            promptVersion: 'v2.2_no_tools_clean_rules',
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
                        dosificacion_contemporanea: f?.dosificacion_contemporanea || f?.tips_dosificacion || [],
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
                // Force delete herramientas if still injected
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
