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
1. PROHIBIDO usar la palabra "Síndrome" para patologías musculoesqueléticas mecánicas (Ej. DEBES usar "Dolor Patelofemoral", NUNCA "Síndrome de Dolor Patelofemoral").
2. PROHIBIDO usar el sufijo "-itis" a menos que sea inflamatorio sistémico (Ej. DEBES usar "Tendinopatía", NUNCA "Tendinitis").
3. PROHIBIDO usar "Condromalacia", usar "Dolor Patelofemoral".

═══ REGLA 1 — CLASIFICACIÓN DEL DOLOR ═══
1. "clasificacion_dolor":
   - "categoria": "Nociceptivo", "Neuropático", "Nociplástico" o "Mixto".
   - "subtipo": (Mecánico, Isquémico, Radicular, etc.).
   - "fundamento": Máximo 3 líneas cruzando anamnesis con examen físico.
   - "duda_y_descarte": Si hay datos discordantes, ESTRUCTURAR ASÍ: "Duda clínica: [X síntoma]. Para confirmar o descartar [Condición Y], se debe realizar [Prueba Z]". Si el evaluador ya la descartó, escribir: "Duda resuelta: [Condición Y] descartada mediante [Prueba Z]".
   - "confianza": "Alta", "Moderada" o "Baja".

═══ REGLA 2 — DIAGNÓSTICO KINESIOLÓGICO (CIF NARRATIVO LIMPIO) ═══
2. "diagnostico_narrativo": Redactar un PÁRRAFO FLUIDO Y COHESIVO integrando la CIF, sin viñetas excesivas.
   ESTRUCTURA OBLIGATORIA:
   "[Paciente] presenta disfunción funcional compatible con [Diagnóstico Contemporáneo], caracterizado a nivel estructural por [X, solo si hay daño confirmado, si no omitir], lo que genera deficiencias funcionales de [listar 2-3 evaluadas: ej. dolor mecánico a la carga, déficit de fuerza]. Estas deficiencias limitan su capacidad para [actividad principal afectada] y restringen su participación en [rol o deporte]. Contextualmente, se ve influenciado por [factores positivos/negativos]."
   - REGLA: NO repetir el dolor como daño estructural. NO diagnosticar médicamente (usar "cuadro clínico compatible con...").

═══ REGLA 3 — OBJETIVO GENERAL (VÍAS CLÍNICAS ATINGENTES) ═══
3. "objetivo_general":
   - "problema_principal": En 1-2 líneas, el problema funcional primario que motivó la consulta.
   - "opciones_sugeridas": Generar 3 a 4 opciones de objetivo general. Estas alternativas NO DEBEN ser genéricas. Deben ser VÍAS CLÍNICAS DISTINTAS pero 100% ATINGENTES para resolver el problema principal de ESTE paciente (Ej. Vía de readaptación funcional conservadora, Vía de reintegro deportivo acelerado, Vía enfocada en automanejo guiado).
   - "seleccionado": Indicar cuál de las opciones es la más atingente y segura según el contexto actual del paciente.

═══ REGLA 4 — OBJETIVOS ESPECÍFICOS SMART (ESTRICTA FIDELIDAD A LA EVALUACIÓN) ═══
4. "objetivos_smart": Generar 1 objetivo SMART por cada deficiencia funcional y limitación identificada.
   - REGLA DE ORO INQUEBRANTABLE: SOLO puedes generar un objetivo para variables que fueron EXPLÍCITAMENTE evaluadas o reportadas en la anamnesis o examen físico. PROHIBIDO inventar objetivos para ROM, fuerza o control motor si no hay datos de ello en el caso.
   - FORMATO ARQUITECTÓNICO: "[Verbo de Acción] + [Variable Clínica] + desde [Valor Basal] hasta [Valor Meta] + en [Plazo Temporal]."
   - Si se evaluó la variable pero no hay valor numérico exacto (ej. fuerza disminuida por dolor), usar: "desde [estado limitante actual evaluado] hasta [meta funcional]".
   - PROHIBIDO: Usar el "cómo" o la intervención dentro del objetivo (ej. no usar "mediante ejercicios de fuerza").
   - VERBOS PERMITIDOS: Reducir, Aumentar, Mejorar, Restaurar, Recuperar, Incrementar, Optimizar, Normalizar, Desarrollar, Fortalecer, Alcanzar, Lograr.
   - VERBOS PROHIBIDOS: Eliminar, Erradicar, Curar, Suprimir.
   - JSON por objetivo: { "texto": "..." } — SOLO eso.

═══ REGLA 5 — PRONÓSTICO BIOPSICOSOCIAL ═══
5. "pronostico": Mantener la respuesta CONCISA en viñetas cortas.
   - "corto_plazo" (0-4 sem), "mediano_plazo" (4-12 sem), "largo_plazo" (>12 sem)
   - "factores_a_favor": Mínimo 3 factores en viñetas cortas.
   - "factores_en_contra": Mínimo 2 factores en viñetas cortas.
   - "historia_natural": 1 línea sobre qué pasaría sin intervención.
   - "categoria": Ej. "Favorable", "Reservado dependiente de adherencia", etc.

═══ REGLA 6 — FASES DE REHABILITACIÓN (NOMENCLATURA OBLIGATORIA) ═══
6. "fases_rehabilitacion": 4 FASES con los siguientes nombres OBLIGATORIOS:
   - "Fase 1: Modulación de Síntomas".
   - "Fase 2: Recuperación de Movilidad y Control Motor".
   - "Fase 3: Aumento de Capacidad y Fuerza".
   - "Fase 4: Reintegro Funcional / Deportivo".
   Para cada fase:
   - "fase": Número (1-4).
   - "nombre": Nombre OBLIGATORIO según la lista anterior.
   - "duracion_estimada": Ej: "Semanas 1-3".
   - "objetivos_operacionales": QUÉ se hará concretamente para avanzar hacia los objetivos específicos.
   - "intervenciones": 3 a 5 ejercicios específicos con parámetros.
   - "dosificacion_contemporanea": OBLIGATORIO usar RPE, RIR, o TUT. Prohibido "3x10" genérico.
   - "criterios_progresion": 2 métricas claras para avanzar de fase.

═══ REGLA 7 — HERRAMIENTAS COMPLEMENTARIAS (VISIÓN CONTEMPORÁNEA) ═══
7. "herramientas_complementarias": Coadyuvantes al ejercicio activo (ventana terapéutica).
   - PERMITIDO Y AVALADO (Evidencia 2024-2026): TENS, Termoterapia y Crioterapia (usados estrictamente para modulación de síntomas y facilitar movimiento).
   - PERMITIDO: "Tratamiento / Manejo del dolor miofascial" (Enfoque contemporáneo neurofisiológico), Educación en neurociencia, BFR, Movilización articular (Maitland/Mulligan).
   - PROHIBIDO: Usar los términos "Liberación Miofascial", "Desactivación de puntos gatillo" o "Trigger Points".
   Para CADA: { "herramienta", "categoria", "justificacion", "aplicacion", "nota_evidencia" }

═══ REGLA 8 — REEVALUACIÓN ═══
8. "reglas_reevaluacion":
   - "signo_comparable": Un test o movimiento explícito (reportado en la evaluación) que reproduce el síntoma principal para medir sesión a sesión.
   - "variables_seguimiento": Métricas a medir (ej. ROM activo, EVA a la carga).
   - "criterio_estancamiento": Cuándo derivar o replantear el plan.

═══ REGLAS DE CALIDAD ═══
- NUNCA inventes datos. Si faltan, asume lo clínicamente más probable.
- Redacción clínica útil con valor docente.
- En deportistas: incluir terminología de readaptación deportiva.
- PROHIBIDO incluir citas, autores o bibliografía.
- PROHIBIDO sugerir fármacos, punción seca, taping, vendaje neuromuscular.
`;

const expectedJsonStructure = `{
  "clasificacion_dolor": { "categoria": "...", "subtipo": "...", "fundamento": "...", "duda_y_descarte": "...", "confianza": "..." },
  "diagnostico_narrativo": "[Paciente] presenta disfunción funcional compatible con...",
  "objetivo_general": { "problema_principal": "...", "opciones_sugeridas": ["Vía 1...", "Vía 2...", "Vía 3..."], "seleccionado": "..." },
  "objetivos_smart": [{ "texto": "Reducir... desde X hasta Y en Z semanas." }],
  "pronostico": { "corto_plazo": "...", "mediano_plazo": "...", "largo_plazo": "...", "factores_a_favor": ["..."], "factores_en_contra": ["..."], "historia_natural": "...", "categoria": "..." },
  "fases_rehabilitacion": [{ "fase": 1, "nombre": "Fase 1: Modulación de Síntomas", "duracion_estimada": "...", "objetivos_operacionales": ["..."], "intervenciones": ["..."], "dosificacion_contemporanea": ["..."], "criterios_progresion": ["..."] }],
  "herramientas_complementarias": [{ "herramienta": "...", "categoria": "...", "justificacion": "...", "aplicacion": "...", "nota_evidencia": "..." }],
  "reglas_reevaluacion": { "signo_comparable": "...", "variables_seguimiento": ["..."], "criterio_estancamiento": "..." }
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
            promptVersion: 'v2.1_user_rules',
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
                    data.reglas_reevaluacion.variables_seguimiento = data.reglas_reevaluacion.variables_seguimiento || [];
                    data.reglas_reevaluacion.criterio_estancamiento = data.reglas_reevaluacion.criterio_estancamiento || '';
                }
                // Sanitize herramientas
                if (!data?.herramientas_complementarias) data.herramientas_complementarias = [];
                // Sanitize clasificacion — merge old field names if present
                if (data?.clasificacion_dolor) {
                    data.clasificacion_dolor.duda_y_descarte = data.clasificacion_dolor.duda_y_descarte || data.clasificacion_dolor.duda_mezcla || '';
                }
                // Sanitize objetivo_general — merge old field name
                if (data?.objetivo_general) {
                    data.objetivo_general.problema_principal = data.objetivo_general.problema_principal || data.objetivo_general.problema_principal_caso || '';
                }
                return data;
            }
        });

        return NextResponse.json({ success: true, data: result.data, telemetry: result.telemetry });
    } catch (err: any) {
        console.error('[express-plan] Error:', err);
        return NextResponse.json({ error: 'INTERNAL_ERROR', message: err.message }, { status: 500 });
    }
}
