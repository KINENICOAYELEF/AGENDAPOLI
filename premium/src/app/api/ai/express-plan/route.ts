import { NextResponse } from 'next/server';
import { executeAIAction } from '@/lib/ai/geminiClient';
import { SYSTEM_PROMPT_BASE } from '@/lib/ai/prompts';

// Allow up to 2 minutes for generation
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

// ═══ PROMPT ADAPTADO DE P3+P4 PARA CONTEXTO V2 ═══
// En v2 NO tenemos P3 estructurado. Tenemos: razonamientoIA (markdown libre) + anamnesisProxima + anamnesisRemota + evaluacionFisica.
// El modelo debe hacer la síntesis P3 Y la planificación P4 en un solo paso.

const EXPRESS_PLAN_SYSTEM = SYSTEM_PROMPT_BASE + `

═══ CONTEXTO ═══
Recibirás datos en formato LIBRE (notas de anamnesis, evaluación física y un razonamiento clínico previo generado por IA).
Tu tarea es producir el PLAN CLÍNICO COMPLETO equivalente a P3+P4, adaptado al formato v2.
NO tienes el Case Organizer de P3 estructurado. Debes INFERIR la clasificación CIF directamente de las notas.

═══ REGLA 1 — CLASIFICACIÓN DEL DOLOR ═══
1. "clasificacion_dolor":
   - "categoria": Determina el mecanismo dominante según relato y hallazgos: "Nociceptivo", "Neuropático", "Nociplástico" o "Mixto".
   - "subtipo": Apellido del dolor (Mecánico, Inflamatorio, Radicular, Isquémico, etc.).
   - "fundamento": Párrafo de 3-4 oraciones cruzando anamnesis con evaluación física, explicando POR QUÉ clasificas así.
   - "confianza": "Alta", "Moderada" o "Baja".

═══ REGLA 2 — DIAGNÓSTICO KINESIOLÓGICO NARRATIVO ═══
2. "diagnostico_narrativo": Redactar en UN PÁRRAFO EXTENSO (MÍNIMO 8-10 LÍNEAS). Secuencia CIF:
   "[Nombre/edad/sexo], consulta por [motivo y tiempo]. Presenta [alteraciones estructurales]. A nivel funcional [disfunciones con severidad]. Lo anterior genera limitaciones en [actividades]. Restringiendo participación en [roles]. Factores personales positivos: [listar]. Factores negativos: [listar]. Facilitadores: [listar]. Barreras: [listar]."
   IMPORTANTE: NO resumas. Incluye ABSOLUTAMENTE TODO lo que las notas mencionen.
3. "razonamiento_diagnostico": Explicación docente de 4-6 líneas de CÓMO se construyó el diagnóstico.

═══ REGLA 3 — OBJETIVO GENERAL (CON OPCIONES) ═══
4. "objetivo_general":
   - "problema_principal_caso": En 2-3 líneas, el PROBLEMA CENTRAL.
   - "opciones_sugeridas": Proponer 4 opciones AMPLIAS con ENFOQUES DISTINTOS:
     * Funcional: "Restaurar la capacidad funcional del complejo [región] para participación en AVDs y recreativas."
     * Reintegro: "Reintegrar de forma segura y progresiva a [actividad/deporte/trabajo]."
     * Integral BPS: "Optimizar la condición física, funcional y psicosocial para máximo potencial de recuperación."
     * Preventivo: "Recuperar y fortalecer [región] para prevenir recurrencias y promover autoeficacia."
   PROHIBIDO mencionar variables específicas (dolor, ROM, fuerza) → eso va en SMART.
   - "seleccionado": La opción más completa.

═══ REGLA 4 — OBJETIVOS SMART ═══
5. "objetivos_smart": Generar entre 3-6 objetivos SMART priorizados.
   GRANULARIDAD: 1 variable = 1 SMART. Dolor + ROM = 2 SMARTs separados.
   Estructura: [verbo] + [UNA variable] + de [basal] a [meta] + en [plazo].
   Campos por objetivo: texto, variable_base, basal, meta, plazo ("1-2 sem" / "3-4 sem" / "5-8 sem" / "9-12 sem" / ">12 sem"), prioridad ("Alta"/"Media"/"Baja"), cluster ("Dolor"/"ROM"/"Fuerza"/"Control Motor"/"Tolerancia"/"Psicosocial"/"Rendimiento").

═══ REGLA 5 — PRONÓSTICO BIOPSICOSOCIAL PROFUNDO ═══
6. "pronostico": CADA campo MÍNIMO 3-4 LÍNEAS.
   - "corto_plazo" (0-4 sem), "mediano_plazo" (4-12 sem), "largo_plazo" (>12 sem)
   - "factores_a_favor": MÍNIMO 3 factores CONCRETOS del caso.
   - "factores_en_contra": MÍNIMO 2 factores CONCRETOS.
   - "historia_natural": Qué pasará si NO se trata. 3-4 líneas.
   - "comparativa_adherencia": Alta adherencia vs abandono. 3-4 líneas.
   - "categoria": "favorable" / "favorable con vigilancia" / "reservado" / "reservado dependiente" / "desfavorable" / "incierto"
   - "justificacion": Síntesis integradora de 4-5 líneas.

═══ REGLA 6 — FASES DE REHABILITACIÓN (PLAN MAESTRO) ═══
7. "fases_rehabilitacion": ESTRICTAMENTE 4 FASES. Para CADA fase:
   - "fase": Número (1-4)
   - "nombre": "Fase 1: Protección", "Fase 2: Recuperación", "Fase 3: Fortalecimiento", "Fase 4: Reintegro"
   - "foco_principal": Meta clínica de la fase.
   - "objetivo_fisiologico": Meta biológica/tisular.
   - "duracion_estimada": Ej: "Semanas 1-3"
   - "criterios_entrada": Qué debe cumplir para entrar a esta fase.
   - "intervenciones": MÍNIMO 5 intervenciones ESPECÍFICAS con parámetros.
   - "intervenciones_complementarias": 2-4 secundarias (terapia manual, educación, etc.)
   - "tips_dosificacion": 3-5 tips MODERNOS: RPE, RIR, Tempo, TUT, volumen semanal. PROHIBIDO "3x15 convencional".
   - "progresiones": MÍNIMO 3 criterios de progresión.
   - "criterios_avance": 2-3 líneas con criterios MEDIBLES.
   - "criterios_regresion": 2-3 líneas con señales de alarma.
   - "errores_frecuentes": 2-3 errores de kinesiólogo novato.
   - "perla_docente": 2-3 líneas con dato clínico basado en evidencia.
   - "sesiones_tipo": 2 sesiones tipo de ~60 min con estructura calentamiento → bloque principal → cool-down.

═══ REGLA 7 — REGLAS DE REEVALUACIÓN ═══
8. "reglas_reevaluacion":
   - "signo_comparable": El test MÁS sensible al cambio.
   - "razon_signo": Por qué se eligió. 2-3 líneas.
   - "signos_comparables": Array de 3-5 evaluaciones guía (evaluacion, tipo, justificacion).
   - "variables_seguimiento": Variables a medir.
   - "frecuencia": Frecuencia formal.
   - "criterio_mejora": Qué define mejora real. 2-3 líneas.
   - "criterio_estancamiento": Qué activa cambio/derivación. 2-3 líneas.
   - "alertas_derivacion": 3-4 alertas específicas del caso.

═══ REGLAS DE CALIDAD ═══
- NUNCA inventes datos. Si faltan, asume lo clínicamente más probable.
- NO resumas cuando dice "extenso". Cumple los mínimos de líneas.
- Redacción clínica útil con valor docente.
- En deportistas: incluir terminología de readaptación deportiva.
- PROHIBIDO incluir citas, autores o bibliografía.
- PROHIBIDO sugerir fármacos, punción seca, taping, vendaje neuromuscular, electroterapia, TENS o ultrasonido.
`;

const expectedJsonStructure = `{
  "clasificacion_dolor": { "categoria": "...", "subtipo": "...", "fundamento": "...", "confianza": "..." },
  "diagnostico_narrativo": "... (MÍNIMO 8-10 LÍNEAS) ...",
  "razonamiento_diagnostico": "... (4-6 líneas) ...",
  "objetivo_general": { "problema_principal_caso": "...", "opciones_sugeridas": ["Opción 1...", "Opción 2...", "Opción 3...", "Opción 4..."], "seleccionado": "..." },
  "objetivos_smart": [{ "texto": "...", "variable_base": "...", "basal": "...", "meta": "...", "plazo": "...", "prioridad": "...", "cluster": "..." }],
  "pronostico": { "corto_plazo": "...", "mediano_plazo": "...", "largo_plazo": "...", "factores_a_favor": ["..."], "factores_en_contra": ["..."], "historia_natural": "...", "comparativa_adherencia": "...", "categoria": "...", "justificacion": "..." },
  "fases_rehabilitacion": [{ "fase": 1, "nombre": "Fase 1: Protección", "foco_principal": "...", "objetivo_fisiologico": "...", "duracion_estimada": "...", "criterios_entrada": "...", "intervenciones": ["..."], "intervenciones_complementarias": ["..."], "tips_dosificacion": ["RPE 3-4...", "RIR 4-5...", "Tempo: 5s exc..."], "progresiones": ["..."], "criterios_avance": "...", "criterios_regresion": "...", "errores_frecuentes": ["..."], "perla_docente": "...", "sesiones_tipo": [{"titulo": "Sesión tipo A", "duracion": "~60 min", "estructura": ["Calentamiento (10 min): ...", "Bloque principal (40 min): ...", "Cool-down (10 min): ..."]}] }],
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
            promptVersion: 'v1.0_p3p4_adapted',
            temperature: 0.3,
            validator: (data: any) => {
                // Parse JSON if it comes back as string
                if (typeof data === 'string') {
                    const clean = data.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
                    return JSON.parse(clean);
                }
                // Sanitize fases_rehabilitacion
                if (data?.fases_rehabilitacion && Array.isArray(data.fases_rehabilitacion)) {
                    data.fases_rehabilitacion = data.fases_rehabilitacion.map((f: any) => ({
                        ...f,
                        intervenciones_complementarias: f?.intervenciones_complementarias || [],
                        tips_dosificacion: f?.tips_dosificacion || [],
                        sesiones_tipo: f?.sesiones_tipo || [],
                        errores_frecuentes: f?.errores_frecuentes || [],
                        progresiones: f?.progresiones || [],
                    }));
                }
                // Sanitize reglas_reevaluacion
                if (data?.reglas_reevaluacion) {
                    data.reglas_reevaluacion.signos_comparables = (data.reglas_reevaluacion.signos_comparables || []).map((sc: any) => ({
                        evaluacion: sc?.evaluacion || '',
                        tipo: sc?.tipo || '',
                        justificacion: sc?.justificacion || '',
                    }));
                    data.reglas_reevaluacion.alertas_derivacion = data.reglas_reevaluacion.alertas_derivacion || [];
                }
                return data;
            }
        });

        return NextResponse.json({
            success: true,
            data: result.data,
            telemetry: result.telemetry
        });

    } catch (err: any) {
        console.error('[express-plan] Error:', err);
        return NextResponse.json({ error: 'INTERNAL_ERROR', message: err.message }, { status: 500 });
    }
}
