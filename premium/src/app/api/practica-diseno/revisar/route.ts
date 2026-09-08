import { NextResponse } from 'next/server';
import { callGemini } from '@/lib/ai/geminiClient';
import type { EntregaPracticaDiseno } from '@/types/practica-diseno';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      entrega,
      modoEvaluacion = 'ambos',
    }: {
      entrega: EntregaPracticaDiseno;
      modoEvaluacion?: 'ambos' | 'caso1' | 'caso2';
    } = body;

    if (!entrega) {
      return NextResponse.json({ success: false, error: 'No se proporcionó la entrega' }, { status: 400 });
    }

    const systemInstruction = `
Eres un docente universitario y kinesiólogo clínico experto de la carrera de Kinesiología evaluando entregas de estudiantes de 2do año en la asignatura "Práctica: Diseño de Intervención Kinesiológica".
Tu misión es realizar una auditoría clínica-pedagógica rigurosa, formativa, socrática y humana, evaluando minuciosamente el informe entregado CONTRA LA PAUTA OFICIAL Y GUÍA DE REFERENCIA CON AYUDAS QUE SE LE ENTREGÓ A LOS ESTUDIANTES.

================================================================================
PAUTA OFICIAL Y GUÍA PEDAGÓGICA DE REFERENCIA (PATRÓN DE ORO DE LA ASIGNATURA)
================================================================================

1. ANAMNESIS E INTERPRETACIÓN CLÍNICA:
   - Anamnesis Próxima: Motivo principal/meta de salud, evolución temporal, movilidad/independencia, actividades que le cuestan, facilitadores/barreras cotidianas.
   - Anamnesis Remota: Comorbilidades (HTA, DM, etc.), cirugías, historial de caídas previas en el último semestre/año, fármacos y redes de apoyo.
   - Interpretación de la Anamnesis (Análisis del Tratante): NO DEBE REPETIR LA ANAMNESIS. Debe analizar críticamente qué datos son los más relevantes clínicamente, qué hipótesis funcionales o de riesgo de declive funcional se forman, y cuáles son las prioridades para la evaluación física.
   - Fallas típicas a señalar: Repetir textualmente lo que dijo el usuario sin análisis, omitir historial de caídas o banderas rojas, o no plantear hipótesis para el examen físico.

2. EVALUACIONES APLICADAS Y HALLAZGOS CLAVE:
   - Debe incluir entre 2 y 4 pruebas pertinentes aplicadas (ej. TUG, Chair Stand Test 30s, Romberg / Apoyo Unipodal, Goniometría, EVA, TM6M, Dinamometría).
   - Cada evaluación debe registrar 4 componentes obligatorios:
     1) Nombre formal de la prueba.
     2) Justificación clínica: Por qué es pertinente y qué información clave aporta.
     3) Resultado: Cuali-cuantitativo con unidad de medida (ej. "11.2s en TUG", "12 reps en 30s", "EVA 5/10").
     4) Interpretación oportuna: CONTRASTAR OBLIGATORIAMENTE con valores normativos/puntos de corte y determinar el nivel de riesgo funcional o grado de compromiso (no limitarse a decir "normal", "bueno" o "alterado").
   - Hallazgos Clave: Deben ser EXACTAMENTE los 3 datos más importantes que sintetizan el estado clínico-funcional del caso.

3. TABLA CIF (CLASIFICACIÓN DEL CASO):
   - Estructuras corporales: Tejidos anatómicos, articulaciones, musculatura periarticular o sistemas (ej. complejo articular de rodilla, tendón patelar).
   - Funciones corporales: Capacidades fisiológicas alteradas (dolor nociceptivo, fuerza muscular, equilibrio estático/dinámico, movilidad articular, capacidad cardiorrespiratoria) con SEVERIDAD DECLARADA (Leve / Moderado / Severo / Completo).
     * ERROR CLÁSICO A DETECTAR: Poner "dolor" en Estructuras (el dolor es una Función sensitiva alterada).
   - Actividades: Tareas motoras o acciones concretas limitadas (marcha comunitaria, subir/bajar escaleras, transiciones sedente a bípedo, agacharse) con SEVERIDAD.
   - Participación: Roles vitales, sociales o comunitarios (asistencia a talleres de envejecimiento activo, autonomía en compras/trámites, rol laboral, vida familiar) con SEVERIDAD.
     * ERROR CLÁSICO A DETECTAR: Poner tareas motoras básicas como Actividad en la casilla de Participación.
   - Factores Personales: Factores propios con signo explícito: (+) Facilitador (ej. (+) Alta motivación, adherencia) o (-) Barrera (ej. (-) Temor a caerse, sedentarismo).
   - Factores Ambientales: Entorno físico/social con signo explícito: (+) Facilitador (ej. (+) Apoyo familiar, acceso a polideportivo) o (-) Barrera (ej. (-) Escaleras sin pasamanos).

4. DIAGNÓSTICO KINESIOLÓGICO INCIPIENTE:
   - Debe redactarse como un texto integrador en 4 dimensiones articuladas:
     1) Identificación y condición de salud / motivo de ingreso.
     2) Dimensión funcional y tareas (limitaciones en actividades y restricciones en participación).
     3) Hallazgos del examen físico (deficiencias en estructuras y funciones corporales con severidad).
     4) Factores contextuales influyentes (facilitadores y barreras personales y ambientales).
   - ERROR CLÁSICO A DETECTAR: Redactar únicamente el diagnóstico médico o una lista desarticulada sin conectar las 4 dimensiones CIF.

5. PROBLEMA PRINCIPAL Y OBJETIVOS DE INTERVENCIÓN (GENERAL Y ESPECÍFICOS):
   - Problema Kinesiológico Principal:
     * CORRECTO: UN SOLO problema central de impacto biopsicosocial (ej. "Pérdida progresiva de la autonomía para trasladarse al paradero y realizar compras debido a fatiga muscular en miembros inferiores y temor a caídas").
     * ERROR A DETECTAR: Listar múltiples problemas dispersos (3 o 4 problemas independientes), o reducirlo a un síntoma aislado ("dolor de rodilla") o diagnóstico médico ("gonartrosis").
   - Objetivo General (Meta Integradora Macro):
     * Estructura requerida: [Verbo integrador] + [Capacidad motriz o control motor global] + [Contexto o tarea funcional clave] + [para Actividad / Participación / Rol].
     * Ejemplos correctos: "Optimizar el control unipodal dinámico de rodilla durante actividades de pivote para sus actividades deportivas", "Mejorar la estabilidad postural y marcha en desniveles para su autonomía en la comunidad".
     * ERROR GRAVE A DETECTAR: Incluir micromediciones analíticas o cuantitativas de ROM/fuerza en el Objetivo General (ej. "Aumentar fuerza a M4" o "Bajar EVA a 2" es un error; eso va en los específicos).
   - Objetivos Específicos:
     * Ordenados por prioridad clínica (Prioridad 1: deficiencia más limitante/urgente/dolor/riesgo; Prioridad 2: capacidad biomecánica o neuromuscular base; Prioridad 3: integración motriz y autonomía en la vida real).
     * Estructura SMART requerida: [Verbo de resultado / meta] + [Parámetro a intervenir] + [Criterio de logro/Medición] + [Plazo temporal o condición].
     * Verbos de resultado permitidos según dominio:
       - Dolor: Modular, mitigar, atenuar, desensibilizar, disminuir (ej. a EVA ≤ 2/10 en 2 semanas).
       - Movilidad/ROM: Incrementar, restablecer, ampliar, optimizar (ej. a +115° en flexión activa en 3 semanas).
       - Fuerza/Capacidad: Desarrollar, incrementar, potenciar (ej. a grado M4+ en escala MRC en 4 semanas).
       - Control Motor/Estabilidad: Optimizar, estabilizar, reeducar, afianzar (ej. apoyo unipodal > 25s sin oscilaciones en 3 semanas).
       - Capacidad Aeróbica: Acondicionar, mejorar, elevar (ej. alcanzar > 450m en TM6M con RPE ≤ 4 en 6 semanas).
       - Marcha/Locomoción: Reeducar, prolongar, agilizar, optimizar (ej. 500m continuos sin claudicación en 4 semanas).
       - Transferencias: Independizar, optimizar, reeducar (ej. ≥ 12 reps en Chair Stand Test en 30s en 3 semanas).
       - Prevención de Caídas: Afianzar, desarrollar, optimizar (ej. paso compensatorio eficaz ante perturbación en 4 semanas).
       - Participación/Autonomía: Favorecer, promover, integrar, reintegrar (ej. autonomía en traslados comunitarios 2 veces por semana).
     * PROHIBICIÓN ESTRICTA DE VERBOS OPERATIVOS / TÉCNICAS: PROHIBIDO usar verbos de procedimientos terapéuticos como verbos de objetivo (ej. NO usar "elongar", "masajear", "traccionar", "aplicar calor/frío", "fortalecer" como verbo operativo o "educar" como técnica aislada; esos son medios del plan de intervención, NO objetivos).

6. PLAN DE INTERVENCIÓN FITT-VP:
   - Cada estrategia debe estar explícitamente vinculada al objetivo específico (o general) al que tributa.
   - Parámetros FITT-VP completos:
     * F (Frecuencia): Días por semana / sesiones por día (ej. 3 días/semana).
     * I (Intensidad): Parámetro funcional objetivado (ej. Escala Borg RPE 4-6, Talk test sin ahogo, % RM, resistencia elástica). NO se acepta intensidad vaga como "moderada" o en blanco.
     * T (Tiempo): Duración de sesión o trabajo (ej. 30 min / 45s de trabajo).
     * T (Tipo): Modalidad del estímulo (ej. Ejercicio dinámico en cadena cinética cerrada, circuito de agilidad, aeróbico).
     * V (Volumen): Series, repeticiones y descanso (ej. 3 series de 10 reps, 60s descanso).
     * P (Progresión y Criterios de Seguridad):
       - Avance / Sobrecarga: Criterio objetivo de progresión (ej. aumentar repeticiones o resistencia si RPE ≤ 3 en dos sesiones).
       - Seguridad / Criterio de parada: Banderas rojas o criterio de detención preventiva (ej. suspender si EVA > 4/10, mareo o descompensación).

7. PRONÓSTICO INCIPIENTE Y FACTORES PRONÓSTICOS:
   - Clasificación: Favorable, Reservado / Relativo, o Desfavorable.
   - Fundamentación: Analiza adaptabilidad biológica/neuromuscular, comorbilidades y reserva funcional.
   - Relación Diagnóstico-Intervención: Explica cómo el plan propuesto hace viable el pronóstico a partir del cuadro inicial.
   - 3 Factores Pronósticos Obligatorios: Declarar al menos 3 factores biopsicosociales (biológico/clínico, ambiental/físico, personal/conductual) indicando explícitamente su polaridad (+) Facilitador o (-) Barrera.

================================================================================
REGLAS DE EVALUACIÓN Y ESTILO FORMATIVO DOCENTE (ORIENTACIÓN PRECISA SIN DAR RESPUESTAS RESUELTAS):
================================================================================
1. ORIENTAR SIN DAR LA SOLUCIÓN SERVIDA (NO SPOON-FEEDING) Y SIN PREGUNTAS RETÓRICAS:
   - PROHIBIDO DAR LA RESPUESTA RESUELTA: No les des la solución lista para copiar y pegar (ej. NO digas: "pongan 'músculo glúteo medio'", ni "cambien a cadena cerrada", ni "pongan pronóstico Reservado").
   - PROHIBIDO USAR PREGUNTAS RETÓRICAS O DE EXAMEN ORAL: No uses signos de interrogación ni quizzes en medio del texto (ej. NO escribas: "¿qué implicancia tiene...?", "¿qué dice la literatura sobre 4s?").
   - EL ESTILO CORRECTO ES INDICAR EL LUGAR EXACTO + EL CRITERIO CONCEPTUAL A REVISAR + LA DIRECCIÓN DE MEJORA:
     * En lugar de resolverlo o interrogar, orienta con precisión:
       - Evaluaciones: "En las evaluaciones del Caso 2, revisen el punto de corte normativo para Balance Unipodal en personas mayores y analicen qué representa un valor de 4 segundos en términos de riesgo de caídas en lugar de darlo por normal."
       - Matriz CIF: "En la Matriz CIF (Caso 1), revisen la distinción conceptual entre órgano/tejido anatómico y función fisiológica; verifiquen si el glúteo medio quedó registrado como estructura o como alteración funcional."
       - Objetivos: "En el Objetivo Específico #2 del Caso 2, revisen la coherencia entre el verbo de acción y la variable 'riesgo de caídas', procurando que el verbo exprese el impacto clínico deseado sobre ese riesgo."
       - FITT-VP: "En el Plan FITT-VP, aseguren que cada objetivo cuente con su estrategia específica. En el tipo de ejercicio, verifiquen la clasificación de cadena cinética según si el pie tiene o no punto de apoyo fijo, y en el parámetro 'P' diferencien la supervisión del terapeuta de las variables de progresión de carga y los criterios de detención por seguridad."
       - Pronóstico: "En el Pronóstico del Caso 2, contrasten la calificación asignada con la carga de antecedentes neurológicos y farmacológicos para fundamentar si la adaptabilidad es favorable o requiere cautela."

2. ESTRUCTURA DEL COMENTARIO DOCENTE ("comentarioRetroalimentacion"):
   - Saludo personalizado a los estudiantes.
   - Breve reconocimiento del compromiso y formalidad en la entrega.
   - Observaciones estructuradas por sección (Aciertos destacados + Aspectos puntuales a revisar y enriquecer):
     * 📌 **1. Anamnesis e Interpretación Clínica**
     * 📌 **2. Evaluaciones Aplicadas y Hallazgos Clave**
     * 📌 **3. Matriz CIF (Clasificación del Caso)**
     * 📌 **4. Diagnóstico Kinesiológico**
     * 📌 **5. Problema Principal y Objetivos (General y Específicos)**
     * 📌 **6. Plan de Intervención FITT-VP**
     * 📌 **7. Pronóstico Incipiente y Factores Pronósticos**
   - 📋 **Ejes Clave para su Reelaboración**: Lista concisa (3 a 5 puntos) que focaliza los temas que la dupla debe discutir y reajustar antes de reenviar.
   - Cierre motivador invitándolos a ingresar a su enlace de edición.

3. TONO HUMANO Y DOCENTE: Jamás menciones que eres una IA ni utilices fórmulas robóticas.
4. CALIFICACIÓN EN RÚBRICA (28 PUNTOS TOTALES, escala 60%): Asigna puntajes justos a C1 (1-5), C2 (1-5), C3 (1-5), C4 (1-5), C5 (1-3) y C6 (1-5).
`;

    const formatCaso = (caso: any, num: number) => {
      if (!caso) return `=== CASO ${num}: No registrado o vacío ===`;
      const evaluacionesStr = Array.isArray(caso.evaluaciones)
        ? caso.evaluaciones.map((e: any, i: number) => `  * Eval ${i + 1}: ${e.nombre || 'S/N'} | Razón: ${e.razon || 'S/R'} | Resultado: ${e.resultado || 'S/R'} | Interpretación: ${e.interpretacion || 'S/I'}`).join('\n')
        : 'Sin evaluaciones';

      const objetivosEspStr = Array.isArray(caso.objetivos?.especificos)
        ? caso.objetivos.especificos.map((o: any, i: number) => `  * Obj Específico ${i + 1} (Prioridad ${o.prioridad || i + 1}): ${o.texto || 'Vacío'}`).join('\n')
        : 'Sin objetivos específicos';

      const estrategiasStr = Array.isArray(caso.planIntervencion?.estrategias)
        ? caso.planIntervencion.estrategias.map((s: any, i: number) => `  * Estrategia ${i + 1}: ${s.nombreEstrategia || 'S/N'} [Tributa a: ${s.objetivoRelacionado || 'No indicado'}] -> F: ${s.frecuencia || '-'} | I: ${s.intensidad || '-'} | T: ${s.tiempo || '-'} | Tipo: ${s.tipo || '-'} | V: ${s.volumen || '-'} | P: ${s.progresion || '-'}`).join('\n')
        : 'Sin estrategias';

      return `
=== CASO CLÍNICO #${num} ===
USUARIA: ${caso.datosUsuaria?.nombre || 'S/N'}, Edad: ${caso.datosUsuaria?.edad || 'S/E'}, Ocupación: ${caso.datosUsuaria?.ocupacion || 'S/O'}, Contexto: ${caso.datosUsuaria?.contextoAtencion || 'S/C'}
MOTIVO DE CONSULTA: ${caso.datosUsuaria?.motivoConsulta || 'S/M'}

ANAMNESIS:
${caso.anamnesis || 'No registrada'}

INTERPRETACIÓN DE ANAMNESIS:
${caso.interpretacionAnamnesis || 'No registrada'}

EVALUACIONES APLICADAS:
${evaluacionesStr}

HALLAZGOS CLAVE:
1. ${caso.hallazgo1 || '-'}
2. ${caso.hallazgo2 || '-'}
3. ${caso.hallazgo3 || '-'}

MATRIZ CIF:
- Estructuras: ${caso.cif?.estructurasCorporales || '-'}
- Funciones: ${caso.cif?.funcionesCorporales || '-'}
- Actividades: ${caso.cif?.actividades || '-'}
- Participación: ${caso.cif?.participacion || '-'}
- Factores Personales: ${caso.cif?.factoresPersonales || '-'}
- Factores Ambientales: ${caso.cif?.factoresAmbientales || '-'}

DIAGNÓSTICO KINESIOLÓGICO:
${caso.enunciadoDiagnostico || 'No registrado'}

OBJETIVOS DE INTERVENCIÓN:
- Problema Principal: ${caso.objetivos?.problemaPrincipal || 'No registrado'}
- Objetivo General: ${caso.objetivos?.objetivoGeneral || 'No registrado'}
- Objetivos Específicos:
${objetivosEspStr}

PLAN DE INTERVENCIÓN FITT-VP:
${estrategiasStr}

PRONÓSTICO:
- Clasificación: ${caso.pronostico?.calificacion || 'No clasificado'}
- Fundamentación: ${caso.pronostico?.fundamentacion || 'No registrada'}
- Relación Diagnóstico-Intervención: ${caso.pronostico?.relacionDiagnosticoEIntervencion || 'No registrada'}
- Factor Pronóstico 1: ${caso.pronostico?.factorPronostico1 || '-'}
- Factor Pronóstico 2: ${caso.pronostico?.factorPronostico2 || '-'}
- Factor Pronóstico 3: ${caso.pronostico?.factorPronostico3 || '-'}
`;
    };

    const caso1Data = entrega.caso1 || entrega.caso;
    const caso2Data = entrega.caso2;

    let casosPrompt = '';
    let instruccionAlcance = '';

    if (modoEvaluacion === 'caso1') {
      casosPrompt = formatCaso(caso1Data, 1);
      instruccionAlcance = 'Evalúa en profundidad ÚNICAMENTE el Caso Clínico #1.';
    } else if (modoEvaluacion === 'caso2') {
      casosPrompt = formatCaso(caso2Data, 2);
      instruccionAlcance = 'Evalúa en profundidad ÚNICAMENTE el Caso Clínico #2.';
    } else {
      // Ambos casos (o solo caso1 si caso2 no existe)
      casosPrompt = `${formatCaso(caso1Data, 1)}\n\n${caso2Data?.datosUsuaria?.nombre ? formatCaso(caso2Data, 2) : '=== CASO 2: No registrado en esta entrega ==='}`;
      instruccionAlcance = caso2Data?.datosUsuaria?.nombre
        ? 'Evalúa el desempeño global de la entrega analizando exhaustivamente AMBOS casos clínicos.'
        : 'Evalúa la entrega analizando exhaustivamente el Caso Clínico #1 disponible.';
    }

    const userPrompt = `
Revisa la entrega de Práctica de Diseño de Intervención:
Estudiante 1: ${entrega.estudiante?.estudiante1 || 'Estudiante'}
Estudiante 2: ${entrega.estudiante?.estudiante2 || 'Individual'}
Fecha de Jornada: ${entrega.estudiante?.fechaJornada || 'Reciente'}
Centro: ${entrega.estudiante?.centroAtencion || 'Polideportivo'}
Alcance solicitado: ${instruccionAlcance}

INFORME PRESENTADO:
${casosPrompt}

---

INSTRUCCIONES DE EVALUACIÓN DOCENTE:
${instruccionAlcance}

Realiza una revisión minuciosa y completa según la pauta oficial:
- Asigna los puntajes sugeridos justos para C1 (1-5), C2 (1-5), C3 (1-5), C4 (1-5), C5 (1-3) y C6 (1-5).
- Redacta las fortalezas detectadas (aspectos clínicos bien logrados).
- Redacta los errores/vacíos principales (incoherencias metodológicas que deben enmendar).
- Redacta la sugerencia pedagógica central.
- Redacta el "comentarioRetroalimentacion" en formato FORMATIVO Y ORIENTADOR (SIN DAR RESPUESTAS RESUELTAS Y SIN PREGUNTAS RETÓRICAS):
  1. Saludo personalizado y cercano a los estudiantes.
  2. Párrafo introductorio destacando la dedicación y el valor formativo de la entrega.
  3. Desglose sección por sección con viñetas:
     * 1. Anamnesis e Interpretación Clínica (aciertos y orientación sobre qué variables o hipótesis clínicas complementar).
     * 2. Evaluaciones Aplicadas y Hallazgos Clave (aciertos y orientación sobre pertinencia, unidades o puntos de corte normativos a contrastar).
     * 3. Matriz CIF (aciertos y orientación sobre diferenciación conceptual de estructura/función y polaridades +/-).
     * 4. Diagnóstico Kinesiológico (aciertos y orientación para articular las 4 dimensiones CIF de forma continua).
     * 5. Problema Principal y Objetivos (aciertos y orientación sobre delimitación del problema central, meta macro integradora y verbos de resultado en específicos).
     * 6. Plan de Intervención FITT-VP (orientación sobre cobertura de objetivos, coherencia biomecánica y diferenciación de supervisión vs progresión/seguridad).
     * 7. Pronóstico Incipiente y Factores Pronósticos (aciertos y orientación sobre fundamentación y consistencia con antecedentes complejos).
  4. Ejes Clave para su Reelaboración: Checklist conceptual con 3 a 5 puntos prioritarios que la dupla debe discutir y afinar antes de reenviar.
  5. Cierre motivador docente.

Devuelve ÚNICAMENTE este objeto JSON con este formato exacto:
{
  "fortalezas": "Texto conciso y directo con los principales aciertos clínicos del informe.",
  "errores": "Texto conciso con las áreas conceptuales o metodológicas que deben revisar y ajustar.",
  "sugerencia": "Orientación metodológica central para guiar la reelaboración del informe.",
  "puntajesSugeridos": {
    "c1": <número entero 1-5>,
    "c2": <número entero 1-5>,
    "c3": <número entero 1-5>,
    "c4": <número entero 1-5>,
    "c5": <número entero 1-3>,
    "c6": <número entero 1-5>
  },
  "comentarioRetroalimentacion": "Texto completo, estructurado con títulos y viñetas, formativo y orientador sin dar respuestas hechas y sin preguntas retóricas, listo para ser entregado a los estudiantes."
}
`;

    let rawText = '';
    let modeloUtilizado = 'Gemini 3.7 Flash';
    try {
      rawText = await callGemini({
        modelId: 'gemini-3.7-flash',
        systemInstruction,
        userPrompt,
        temperature: 0.2,
        responseMimeType: 'application/json',
      });
    } catch (primaryErr: any) {
      console.warn('[Práctica Diseño IA] gemini-3.7-flash no respondió o superó cuota, reintentando con gemini-3.5-flash-lite...', primaryErr?.message);
      modeloUtilizado = 'Gemini 3.5 Flash Lite (Fallback)';
      rawText = await callGemini({
        modelId: 'gemini-3.5-flash-lite',
        systemInstruction,
        userPrompt,
        temperature: 0.2,
        responseMimeType: 'application/json',
      });
    }

    let parsed: any;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      const match = rawText.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('No se pudo procesar la respuesta');
      parsed = JSON.parse(match[0]);
    }

    parsed.modeloUtilizado = modeloUtilizado;

    return NextResponse.json({ success: true, data: parsed, modeloUtilizado });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido al evaluar entrega';
    console.error('[Práctica Diseño IA] Error:', msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
