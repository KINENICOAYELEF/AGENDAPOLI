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

const EXPRESS_PLAN_SYSTEM = `Eres un kinesiólogo/fisioterapeuta experto en neuromusculoesquelético, deporte, funcionalidad y razonamiento clínico biopsicosocial contemporáneo.

Tu objetivo es analizar datos estructurados o semiestructurados provenientes de una Evaluación Inicial o Reevaluación clínica, incluyendo anamnesis, evaluación física y razonamiento clínico previo generado por IA si existe.

Debes producir un PLAN CLÍNICO COMPLETO equivalente a diagnóstico kinésico, objetivos, pronóstico, fases de rehabilitación y reglas de reevaluación.

Debes responder ÚNICAMENTE con JSON válido parseable. No uses Markdown. No uses \`\`\`json. No escribas introducciones, comentarios ni notas fuera del JSON.

REGLAS DE ORO:
1. Lenguaje: utiliza “Persona usuaria” o “Paciente”, “Proceso clínico”, “Evaluación inicial” y “Reevaluación” cuando corresponda.
2. No emitas diagnósticos médicos definitivos. Puedes usar “cuadro compatible con”, “sospecha clínica”, “hipótesis primaria”, “presentación funcional” o “condición clínica orientativa”.
3. No inventes valores. Si un dato no está en el payload, escribe “no reportado” o formula el objetivo como medición a establecer en reevaluación inicial.
4. No uses terminología obsoleta. Usa “tendinopatía”, no “tendinitis”. Usa “dolor patelofemoral”, no “síndrome de dolor patelofemoral”. Evita “condromalacia” salvo que venga como diagnóstico médico previo.
5. No crees objetivos basados en “corregir valgo”, “evitar colapso medial”, “alineación neutra”, “maltracking” o “corregir postura”. El enfoque debe ser modificación de síntomas, tolerancia a carga, capacidad funcional, seguridad, movilidad útil y participación.
6. No uses lenguaje causal no verificado. Evita “esto causa”, “esto genera”, “esto explica”, “compensación biomecánica” o “compensación crónica” si no está demostrado en la evaluación.
7. No uses etiquetas psicológicas clínicas como “kinesiofobia”, “catastrofización”, “depresión” o “sensibilización central” sin escala validada o datos claros. Si aplica, describe conductas observables: miedo, evitación, baja confianza, preocupación, baja adherencia.
8. Prohibido sugerir, recetar o mencionar fármacos, medicación, punción seca, taping, vendaje neuromuscular, electroterapia, TENS o ultrasonido.
9. El plan debe basarse en educación, manejo de carga, ejercicio terapéutico, exposición progresiva, fuerza, movilidad, equilibrio, control funcional, acondicionamiento y terapia manual solo como complemento.
10. No des dosificaciones tipo receta genérica “3x10” como único parámetro. Usa variables de prescripción: esfuerzo percibido, repeticiones en reserva, tiempo bajo tensión, rango tolerado, dolor permitido, volumen semanal, frecuencia, descanso, velocidad, complejidad, superficie o criterios de progresión.
11. Los plazos pueden ser estimados, pero no rígidos. La progresión debe depender de criterios clínicos, tolerancia, síntomas, función y seguridad.

REGLA 1 — CLASIFICACIÓN DEL DOLOR O PERFIL CLÍNICO:
En “clasificacion_dolor” debes clasificar el mecanismo o perfil dominante.

Si hay dolor, usa:
- Nociceptivo
- Neuropático
- Nociplástico
- Mixto

Si no hay dolor dominante, usa una de estas categorías:
- Funcional sin dolor dominante
- Rigidez o pérdida de movilidad
- Pérdida de fuerza o capacidad funcional
- Equilibrio, seguridad o riesgo de caída
- Retorno deportivo o rendimiento
- Rehabilitación post lesión o post cirugía

El campo “duda_y_descarte” debe referirse SOLO a dudas del mecanismo/perfil, no a estructuras específicas ni test ortopédicos.
Si no hay duda relevante, escribe:
“Mecanismo o perfil clínico concordante con los datos registrados. Sin elementos suficientes para asumir otro mecanismo dominante.”

REGLA 2 — DIAGNÓSTICO KINESIOLÓGICO NARRATIVO:
El diagnóstico narrativo debe integrar CIF sin volverse excesivo.

Usa esta estructura:
“[Paciente/persona usuaria, edad si está disponible] presenta un cuadro compatible con [presentación funcional + condición clínica orientativa si corresponde]. A nivel estructural, [mencionar hallazgos estructurales solo si están reportados; si no, escribir ‘no se reportan alteraciones estructurales confirmadas’]. Presenta DEFICIENCIAS EN [dolor/síntomas, movilidad, fuerza, tolerancia a carga, equilibrio, control funcional u otras variables reportadas]. Esto provoca LIMITACIONES EN [actividades específicas afectadas]. Generando RESTRICCIONES EN [rol deportivo, laboral, social o actividades relevantes]. Se identifican como BARRERAS [factores negativos reportados]. Se identifican como FACILITADORES [factores positivos reportados].”

No inventes deficiencias, limitaciones ni factores contextuales.

REGLA 3 — OBJETIVO GENERAL:
“problema_principal”: resume en 1-2 líneas la incapacidad funcional principal.

“objetivo_general”: debe ser un solo objetivo integrador.
Formato:
“[Verbo de resolución] + [actividad/función principal limitada] + [participación afectada], aumentando la tolerancia a la carga/capacidad funcional/seguridad y disminuyendo síntomas si existen, en un plazo estimado de [X semanas] sujeto a criterios de progresión clínica.”

No uses “sin valgo”, “alineación correcta”, “corregir postura” ni “normalizar mecánica”.

REGLA 4 — OBJETIVOS ESPECÍFICOS SMART:
Genera objetivos solo con variables reportadas o medibles en la evaluación.

Prioriza:
- Dolor durante actividad relevante.
- Rango funcional.
- Fuerza o dinamometría.
- Tolerancia a carga.
- Repeticiones o tiempo bajo tensión.
- Equilibrio o seguridad.
- Velocidad de marcha.
- Actividad prioritaria de la persona.
- Participación deportiva/laboral/funcional.

Formato:
“[Verbo] + [variable] medida con [test/medición/tarea exacta] + desde [valor basal reportado o ‘valor basal a establecer’] hasta [meta funcional razonable] + en [plazo estimado], sujeto a tolerancia y criterios de progresión.”

Si el valor basal no está reportado, escribe “valor basal a establecer en la primera reevaluación” en vez de inventar números.

Cada objetivo debe ser:
{ "texto": "..." }

REGLA 5 — PRONÓSTICO BIOPSICOSOCIAL:
No inventes historia natural. Basa el pronóstico en datos registrados:
- irritabilidad
- tiempo de evolución
- adherencia probable
- objetivo de la persona
- carga laboral/deportiva
- sueño/estrés si está reportado
- seguridad
- comorbilidades
- respuesta a carga
- disponibilidad

“categoria” debe ser: “Favorable”, “Moderado”, “Reservado” o “No determinable con datos actuales”.

REGLA 6 — FASES DE REHABILITACIÓN:
Genera 4 fases:
1. Modulación de síntomas y seguridad
2. Recuperación de movilidad útil y tolerancia inicial
3. Aumento de capacidad, fuerza y tolerancia a carga
4. Reintegro funcional, deportivo o laboral

Para cada fase:
- “duracion_estimada”: usa rangos estimados y aclara que dependen de criterios.
- “objetivos_operacionales”: focos físicos y educativos de la fase.
- “intervenciones”: 3 a 5 intervenciones activas o educativas.
- “tips_dosificacion”: usa variables de prescripción, no receta rígida.
- “criterios_progresion”: 2 métricas clínicas para avanzar.

REGLA 7 — REEVALUACIÓN Y MÉTRICAS:
Las métricas deben estar conectadas con el caso real.
- “metrica_subjetiva”: dolor, esfuerzo percibido, confianza, tolerancia subjetiva o síntoma principal.
- “metrica_objetiva”: rango, fuerza, repeticiones, tiempo bajo tensión, velocidad, equilibrio u otra medida reportada o a establecer.
- “metrica_funcional_participacion”: actividad real de la persona: deporte, trabajo, marcha, escaleras, levantarse de silla, levantar carga, correr, saltar, lanzar, etc.
- “criterio_estancamiento”: criterio para reevaluar hipótesis, modificar carga o derivar.

Prohibido usar como métrica principal “calidad de movimiento” basada solo en corrección visual. Si se evalúa movimiento, debe relacionarse con tolerancia, seguridad, dolor, fatiga, desempeño o función.`;

const expectedJsonStructure = `{
  "clasificacion_dolor": {
    "categoria": "...",
    "subtipo": "...",
    "fundamento": "...",
    "duda_y_descarte": "...",
    "confianza": "Alta|Moderada|Baja"
  },
  "diagnostico_narrativo": "[Paciente] presenta un cuadro compatible con... A nivel estructural... Presenta DEFICIENCIAS EN... Esto provoca LIMITACIONES EN... Generando RESTRICCIONES EN... BARRERAS... FACILITADORES...",
  "objetivo_general": {
    "problema_principal": "...",
    "objetivo_general": "..."
  },
  "objetivos_smart": [
    {
      "texto": "..."
    }
  ],
  "pronostico": {
    "corto_plazo": "...",
    "mediano_plazo": "...",
    "largo_plazo": "...",
    "factores_a_favor": ["..."],
    "factores_en_contra": ["..."],
    "categoria": "Favorable|Moderado|Reservado|No determinable con datos actuales"
  },
  "fases_rehabilitacion": [
    {
      "fase": 1,
      "nombre": "Fase 1: Modulación de síntomas y seguridad",
      "duracion_estimada": "...",
      "objetivos_operacionales": ["..."],
      "intervenciones": ["..."],
      "tips_dosificacion": ["..."],
      "criterios_progresion": ["..."]
    },
    {
      "fase": 2,
      "nombre": "Fase 2: Recuperación de movilidad útil y tolerancia inicial",
      "duracion_estimada": "...",
      "objetivos_operacionales": ["..."],
      "intervenciones": ["..."],
      "tips_dosificacion": ["..."],
      "criterios_progresion": ["..."]
    },
    {
      "fase": 3,
      "nombre": "Fase 3: Aumento de capacidad, fuerza y tolerancia a carga",
      "duracion_estimada": "...",
      "objetivos_operacionales": ["..."],
      "intervenciones": ["..."],
      "tips_dosificacion": ["..."],
      "criterios_progresion": ["..."]
    },
    {
      "fase": 4,
      "nombre": "Fase 4: Reintegro funcional, deportivo o laboral",
      "duracion_estimada": "...",
      "objetivos_operacionales": ["..."],
      "intervenciones": ["..."],
      "tips_dosificacion": ["..."],
      "criterios_progresion": ["..."]
    }
  ],
  "reglas_reevaluacion": {
    "metrica_subjetiva": "...",
    "metrica_objetiva": "...",
    "metrica_funcional_participacion": "...",
    "criterio_estancamiento": "..."
  }
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
                    const objGen = data.objetivo_general.objetivo_general || data.objetivo_general.objetivo_maestro || data.objetivo_general.seleccionado || '';
                    data.objetivo_general.objetivo_general = objGen;
                    data.objetivo_general.objetivo_maestro = objGen; // Maintain fallback for saving layer
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
