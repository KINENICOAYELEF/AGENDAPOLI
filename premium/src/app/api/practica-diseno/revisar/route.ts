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
Eres un docente universitario y kinesiólogo clínico experto evaluando una entrega de estudiantes de Kinesiología en su "Práctica: Diseño de Intervención".
Tu objetivo es realizar una auditoría clínica-pedagógica rigurosa, formativa y humana evaluando el informe presentado contra la pauta de evaluación oficial de 28 puntos.

REGLAS METODOLÓGICAS ESTRICTAS:
1. Evalúa ÚNICAMENTE lo que los estudiantes escribieron en el o los casos seleccionados. No inventes datos ni asumas información no registrada.
2. La retroalimentación debe sonar 100% natural, cercana, constructiva y profesional (como un docente clínico hablando a sus alumnos). NUNCA menciones que eres una IA, ni uses frases como "según mi análisis" o "como modelo de lenguaje".
3. Identifica fortalezas concretas y aspectos específicos a mejorar citando secciones del informe (Anamnesis, Evaluaciones, CIF, Diagnóstico, Objetivos, FITT-VP, Pronóstico).
4. Criterios de la Rúbrica Oficial (28 Puntos Totales, escala al 60%):
   - C1 · Requerimientos Formales (1 a 5 pts): Cumplimiento de estructura, completitud del informe, puntualidad e identificación.
   - C2 · Actitud, Trato Empático y Confidencialidad (1 a 5 pts): Manejo de iniciales de las personas usuarias (resguardo de confidencialidad), enfoque centrado en la persona y formalidad.
   - C3 · Evaluaciones Desarrolladas (1 a 5 pts): Pertinencia de las pruebas seleccionadas, justificación clínica, resultados y la interpretación oportuna respecto a normativas o nivel funcional.
   - C4 · Objetivos de Intervención acordes a CIF (1 a 5 pts): Problema kinesiológico principal biopsicosocial, Objetivo General como meta integradora en actividad/participación (sin micro-mediciones analíticas), y Objetivos Específicos priorizados con estructura clara (sin verbos operativos como elongar/masajear).
   - C5 · Plan de Intervención FITT-VP (1 a 3 pts): Prescripción estructurada en Frecuencia, Intensidad funcional (Borg/RPE/Talk test), Tiempo, Tipo, Volumen y Progresión/Seguridad, vinculada a los objetivos.
   - C6 · Pronóstico Incipiente Final (1 a 5 pts): Clasificación correcta (Favorable, Reservado, Desfavorable), fundamentación clínica, viabilidad respecto al diagnóstico y declaración de los 3 factores pronósticos biopsicosociales concretos (+/-).

5. Responde SIEMPRE con un JSON válido con la estructura exacta solicitada.
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
      instruccionAlcance = 'Evalúa ÚNICAMENTE el Caso Clínico #1.';
    } else if (modoEvaluacion === 'caso2') {
      casosPrompt = formatCaso(caso2Data, 2);
      instruccionAlcance = 'Evalúa ÚNICAMENTE el Caso Clínico #2.';
    } else {
      // Ambos casos (o solo caso1 si caso2 no existe)
      casosPrompt = `${formatCaso(caso1Data, 1)}\n\n${caso2Data?.datosUsuaria?.nombre ? formatCaso(caso2Data, 2) : '=== CASO 2: No registrado en esta entrega ==='}`;
      instruccionAlcance = caso2Data?.datosUsuaria?.nombre
        ? 'Evalúa el desempeño global de la entrega considerando AMBOS casos clínicos.'
        : 'Evalúa la entrega considerando el Caso Clínico #1 disponible.';
    }

    const userPrompt = `
Revisa la entrega de Práctica de Diseño de Intervención:
Estudiante 1: ${entrega.estudiante?.estudiante1 || 'Estudiante'}
Estudiante 2: ${entrega.estudiante?.estudiante2 || 'Individual'}
Fecha: ${entrega.estudiante?.fechaJornada || 'Reciente'}
Centro: ${entrega.estudiante?.centroAtencion || 'Polideportivo'}
Alcance solicitado: ${instruccionAlcance}

${casosPrompt}

---

EVALUACIÓN REQUERIDA:
${instruccionAlcance} Evalúa según los criterios C1 a C6:
- c1 (1-5 pts): Requerimientos formales y completitud.
- c2 (1-5 pts): Confidencialidad y trato empático reflejado.
- c3 (1-5 pts): Pertinencia y justificación de evaluaciones e interpretación oportuna.
- c4 (1-5 pts): Problema biopsicosocial, Objetivo general integrador y Objetivos específicos priorizados.
- c5 (1-3 pts): Dosificación FITT-VP estructurada y vinculada a objetivos.
- c6 (1-5 pts): Pronóstico incipiente coherente y 3 factores pronósticos.

Devuelve ÚNICAMENTE este JSON:
{
  "fortalezas": "Párrafo conciso con los principales aciertos clínicos del caso o entrega evaluada (máximo 80 palabras).",
  "errores": "Párrafo conciso con vacíos metodológicos, incoherencias o errores detectados (máximo 100 palabras).",
  "sugerencia": "Párrafo conciso con recomendaciones clave para mejorar su práctica clínica (máximo 80 palabras).",
  "puntajesSugeridos": {
    "c1": <número 1-5>,
    "c2": <número 1-5>,
    "c3": <número 1-5>,
    "c4": <número 1-5>,
    "c5": <número 1-3>,
    "c6": <número 1-5>
  },
  "comentarioRetroalimentacion": "Borrador de feedback pedagógico completo, cálido y profesional que el docente entregará al estudiante o dupla. Debe iniciar saludando, destacar los aspectos positivos, detallar con claridad los puntos que deben corregir o afinar, y cerrar con un mensaje motivador. (Máximo 150 palabras. Sin mencionar IA)."
}
`;

    let rawText = '';
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

    return NextResponse.json({ success: true, data: parsed });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido al evaluar entrega';
    console.error('[Práctica Diseño IA] Error:', msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
