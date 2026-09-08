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
Tu misión es realizar una auditoría clínica-pedagógica rigurosa, formativa, socrática y humana, evaluando minuciosamente el informe entregado contra la pauta de evaluación oficial de 28 puntos.

REGLAS METODOLÓGICAS Y PEDAGÓGICAS ESTRICTAS:
1. EVALÚA ÚNICAMENTE LO REGISTRADO: Audita con base en la evidencia factual escrita en el informe del o los casos evaluados. No inventes hallazgos ni asumas datos no documentados.
2. TONO DOCENTE 100% HUMANO, FORMATIVO Y CERCANO: Escribe exactamente como un docente clínico dedicado que retroalimenta a sus alumnos universitarios. Jamás menciones que eres una IA, ni uses frases como "según mi análisis", "como modelo de lenguaje", "algoritmo", etc.
3. ENFOQUE SOCRÁTICO (NO DAR RESPUESTAS HECHAS): Señala con precisión quirúrgica dónde está el error, vacío, incoherencia o debilidad en cada ítem, pero NO redactes la respuesta final resuelta por ellos. Formula preguntas reflexivas, pistas conceptuales y directrices claras para que la dupla piense, discuta y reescriba su informe.
4. AUDITORÍA DETALLADA SECCIÓN POR SECCIÓN: Debes revisar y desglosar observaciones específicas para CADA UNO de los siguientes 7 ítems del informe:
   - Ítem 1 · Anamnesis e Interpretación: Evalúa si recopilaron cronología, contexto y banderas rojas, y si la "Interpretación" formula hipótesis clínicas para orientar el examen físico o solo repite textualmente lo dicho por la persona usuaria.
   - Ítem 2 · Evaluaciones Aplicadas y Hallazgos Clave: Evalúa pertinencia clínica de las pruebas elegidas para el motivo de consulta, justificación de su elección, y si interpretaron los resultados comparando con rangos normativos o riesgo funcional (no solo poner números sueltos). Revisa si los 3 hallazgos sintetizan el déficit real.
   - Ítem 3 · Matriz CIF: Revisa que Estructuras anatómicas, Funciones fisiológicas, Actividades (limitaciones) y Participación (restricciones sociales) estén correctamente clasificadas sin confusiones (ej. dolor es Función, no Estructura; marcha o aseo es Actividad, no Participación; trabajo/rol social es Participación). Verifica que los Factores Contextuales (Personales y Ambientales) tengan signo/polaridad clara (+ facilitador / - barrera).
   - Ítem 4 · Diagnóstico Kinesiológico: Revisa si articula de forma coherente Condición de salud + Deficiencia (estructura/función) + Limitación en la actividad + Restricción en la participación, o si cometieron el error de limitarse al diagnóstico médico.
   - Ítem 5 · Problema Principal y Objetivos (General vs. Específicos):
     * Problema Principal: Debe ser UN SOLO problema medular de impacto biopsicosocial funcional. Advierte si listaron múltiples problemas dispersos (ej. 3 o 4 problemas cuando se pide el foco principal) o si lo redujeron a un síntoma aislado como "dolor".
     * Objetivo General: Meta integradora centrada en actividad/participación y autonomía. Advierte si colocaron micromediciones analíticas o cuantitativas de ROM/fuerza dentro del objetivo general.
     * Objetivos Específicos: Jerarquizados por prioridad clínica y con verbos de resultado CIF (mejorar, optimizar, restablecer, favorecer). EXIGE LA ELIMINACIÓN DE VERBOS OPERATIVOS / TÉCNICAS KINÉSICAS (prohibido usar "elongar", "masajear", "fortalecer", "educar", "aplicar calor", ya que son medios y no objetivos).
   - Ítem 6 · Plan de Intervención FITT-VP: Revisa que cada estrategia tribute a un objetivo específico declarado. Evalúa la completitud de la prescripción F-I-T-T-V-P (especialmente que la Intensidad esté objetivada con escalas como Borg, RPE, %RM o Talk Test, y que la Progresión declare sobrecarga y criterios de parada o seguridad clínica).
   - Ítem 7 · Pronóstico Incipiente y Factores Pronósticos: Evalúa si la calificación (Favorable, Reservado, Desfavorable) es coherente con el cuadro, si la fundamentación conecta diagnóstico y viabilidad del plan, y si declararon claramente al menos 3 factores pronósticos biopsicosociales con su respectivo impacto (+/-).

5. CRITERIOS DE LA RÚBRICA OFICIAL (28 Puntos Totales, escala al 60%):
   - C1 · Requerimientos Formales (1 a 5 pts): Cumplimiento de estructura, completitud del informe e identificación.
   - C2 · Actitud, Trato Empático y Confidencialidad (1 a 5 pts): Manejo de iniciales de las usuarias (confidencialidad), enfoque centrado en la persona y ética.
   - C3 · Evaluaciones Desarrolladas (1 a 5 pts): Pertinencia de pruebas, justificación clínica, resultados e interpretación según normativas/riesgo.
   - C4 · Objetivos de Intervención acordes a CIF (1 a 5 pts): Problema biopsicosocial, Objetivo General integrador y Objetivos Específicos sin verbos operativos.
   - C5 · Plan de Intervención FITT-VP (1 a 3 pts): Prescripción completa FITT-VP estructurada por estrategia y vinculada a objetivos.
   - C6 · Pronóstico Incipiente Final (1 a 5 pts): Clasificación correcta, fundamentación y declaración de 3 factores pronósticos (+/-).

6. SIEMPRE devuelve un JSON válido con la estructura exacta solicitada.
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

Realiza una revisión minuciosa y completa según la pauta de 28 puntos:
- Asigna los puntajes sugeridos justos para C1 (1-5), C2 (1-5), C3 (1-5), C4 (1-5), C5 (1-3) y C6 (1-5).
- Redacta las fortalezas detectadas (aspectos clínicos bien logrados).
- Redacta los errores/vacíos principales (incoherencias metodológicas que deben enmendar).
- Redacta la sugerencia pedagógica central.
- Redacta el "comentarioRetroalimentacion" COMPLETO, EXTENSO Y PROFUNDO, estructurado ítem por ítem con viñetas y títulos claros:
  1. Saludo personalizado y cercano a los estudiantes.
  2. Desglose detallado de observaciones y correcciones por cada ítem del informe:
     * 1. Anamnesis e Interpretación Clínica (qué está bien y qué faltó indagar o conectar con hipótesis de examen físico).
     * 2. Evaluaciones Aplicadas y Hallazgos Clave (pertinencia de las pruebas, justificación e interpretación de resultados contra normativas/riesgo; pertinencia de los 3 hallazgos).
     * 3. Matriz CIF (clasificación correcta en Estructura, Función, Actividad, Participación, y signos +/- en factores contextuales).
     * 4. Diagnóstico Kinesiológico (integración biopsicosocial CIF vs diagnóstico médico simple).
     * 5. Problema Principal y Objetivos (análisis de si el problema es 1 solo impacto funcional central, si el objetivo general es integrador sin micromediciones, y si los específicos están priorizados y libres de verbos operativos prohibidos como elongar/masajear/fortalecer/educar).
     * 6. Plan de Intervención FITT-VP (relación estrategia-objetivo, parámetros F-I-T-T-V-P completos, objetivación de intensidad y criterios de progresión/seguridad).
     * 7. Pronóstico Incipiente y Factores Pronósticos (calificación, fundamentación clínica y declaración de 3 factores pronósticos con +/-).
  3. Preguntas socráticas clave para guiarlos a pensar y discutir en su corrección (sin darles la solución masticada).
  4. Cierre motivador y recordatorio de enviar sus correcciones.

Devuelve ÚNICAMENTE este objeto JSON con este formato exacto:
{
  "fortalezas": "Texto detallado con los principales aciertos clínicos del informe.",
  "errores": "Texto detallado con los vacíos metodológicos, confusiones en CIF, objetivos con verbos operativos o fallas en FITT-VP.",
  "sugerencia": "Orientación formativa y metodológica para su proceso de corrección.",
  "puntajesSugeridos": {
    "c1": <número entero 1-5>,
    "c2": <número entero 1-5>,
    "c3": <número entero 1-5>,
    "c4": <número entero 1-5>,
    "c5": <número entero 1-3>,
    "c6": <número entero 1-5>
  },
  "comentarioRetroalimentacion": "Texto completo, estructurado con títulos y viñetas, minucioso y socrático, sin restricciones de brevedad, listo para ser entregado a los estudiantes."
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
