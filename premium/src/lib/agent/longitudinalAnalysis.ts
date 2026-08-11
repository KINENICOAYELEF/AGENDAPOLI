import { jsonrepair } from 'jsonrepair';
import { z } from 'zod';
import { runAgentInteraction } from './client';

type ClinicalRecord = Record<string, any> & {
  id: string;
  collection: 'evaluaciones' | 'evoluciones';
};

const EvidenceSchema = z.object({
  recordId: z.string(),
  collection: z.enum(['evaluaciones', 'evoluciones']),
  section: z.string().min(1).max(120),
  excerpt: z.string().min(1).max(400),
});

/** Una incoherencia concreta entre lo planificado y lo ejecutado. */
const CoherenceFindingSchema = z.object({
  type: z.enum([
    'INTERVENCION_NO_CORRESPONDE',   // el ejercicio o técnica no se explica por el diagnóstico
    'OBJETIVO_ABANDONADO',           // objetivos declarados que nunca se trabajan
    'DOSIFICACION_INADECUADA',       // carga o progresión sin sustento
    'PLAN_ESTANCADO',                // sin progreso y sin cambio de conducta
    'RIESGO_SEGURIDAD',              // se avanza pese a señales de alarma
    'SIN_REEVALUACION',              // muchas sesiones sin volver a medir
  ]),
  explanation: z.string().min(1).max(600),
  severity: z.enum(['ALTA', 'MEDIA', 'BAJA']),
});

const LongitudinalAnalysisSchema = z.object({
  strengths: z.array(z.string().min(1).max(300)).max(4).default([]),
  improvementGaps: z.array(z.string().min(1).max(300)).max(4).default([]),
  recurringPattern: z.string().min(1).max(500).optional(),
  /** Incoherencias entre la evaluación propia de la interna y lo que ejecuta. */
  coherenceFindings: z.array(CoherenceFindingSchema).max(5).default([]),
  observation: z.string().min(1).max(800),
  pedagogicalInference: z.string().min(1).max(800),
  socraticQuestion: z.string().min(1).max(500),
  recommendation: z.string().min(1).max(500),
  /**
   * Feedback redactado, listo para que el docente apruebe y reenvíe.
   *
   * Antes se armaba pegando trozos de texto fijo en el navegador; el resultado
   * no se leía como algo escrito por un docente. Ahora lo redacta el modelo.
   */
  draftFeedback: z.string().min(1).max(1800),
  priority: z.enum(['P0', 'P1', 'P2', 'P3']),
  confidence: z.number().min(0).max(1),
  evidence: z.array(EvidenceSchema).min(1).max(4),
});

export type LongitudinalAnalysis = z.infer<typeof LongitudinalAnalysisSchema>;

function text(value: unknown, maximum = 1200) {
  const normalized = typeof value === 'string'
    ? value
    : value && typeof value === 'object'
      ? JSON.stringify(value)
      : '';
  return normalized.trim().slice(0, maximum);
}

/**
 * Evidencia agrupada por proceso clínico.
 *
 * Una lista plana de registros no permite juzgar coherencia: para saber si lo
 * que la interna hace en las sesiones corresponde a su propio diagnóstico y
 * objetivos, el agente necesita ver la evaluación y las evoluciones de ESE
 * mismo proceso una al lado de la otra. Sin esta agrupación solo se puede
 * revisar completitud de campos, que es lo que venía haciendo.
 */
export function buildProcessGroupedEvidence(records: ClinicalRecord[]) {
  const flat = buildDeidentifiedEvidence(records);
  const byRecordId = new Map(flat.map(item => [item.recordId, item]));

  const groups = new Map<string, {
    processId: string;
    evaluation: any | null;
    reassessments: any[];
    sessions: any[];
  }>();

  records.forEach((record) => {
    const evidence = byRecordId.get(record.id);
    if (!evidence) return;
    const processId = String(record.procesoId || record.casoId || 'sin_proceso');
    if (!groups.has(processId)) {
      groups.set(processId, { processId, evaluation: null, reassessments: [], sessions: [] });
    }
    const group = groups.get(processId)!;

    if (record.collection === 'evaluaciones') {
      if (record.type === 'REEVALUATION') group.reassessments.push(evidence);
      // La evaluación inicial es la línea basal contra la que se juzga todo lo
      // demás: si hay varias, se conserva la más reciente.
      else if (!group.evaluation || String(evidence.sessionAt) > String(group.evaluation.sessionAt)) {
        group.evaluation = {
          ...evidence,
          declaredObjectives: text(record.p4_plan_structured?.objetivos_especificos
            || record.expressDraft?.p4_plan?.objetivos_especificos
            || record.objectives, 900),
          diagnosis: text(record.p4_plan_structured?.diagnostico_kinesiologico_narrativo
            || record.expressDraft?.p4_plan?.diagnostico
            || record.clinicalSynthesis, 700),
        };
      }
    } else {
      group.sessions.push({
        ...evidence,
        // Lo que efectivamente se hizo, que es lo que hay que contrastar.
        exercisesPrescribed: text(record.exerciseRx?.rows || record.exercises, 900),
        objectivesWorked: text(record.selectedObjectivesSnapshot || record.objectiveWork, 500),
        painStart: text(String(record.pain?.evaStart ?? ''), 10),
        painEnd: text(String(record.pain?.evaEnd ?? ''), 10),
        toleranceResponse: text(record.responseTolerance || record.pain?.contradictionReason, 400),
      });
    }
  });

  return Array.from(groups.values())
    .map(group => ({
      ...group,
      sessions: group.sessions.sort((a, b) => String(a.sessionAt).localeCompare(String(b.sessionAt))),
      reassessments: group.reassessments.sort((a, b) => String(a.sessionAt).localeCompare(String(b.sessionAt))),
    }))
    .filter(group => group.evaluation || group.sessions.length > 0);
}

/** Contexto clínico mínimo, sin nombres, RUT, contactos ni campos de identidad. */
export function buildDeidentifiedEvidence(records: ClinicalRecord[]) {
  return records
    .slice(0, 12)
    .map((record) => ({
      recordId: record.id,
      collection: record.collection,
      sessionAt: text(record.sessionAt || record.fechaHoraAtencion || record.audit?.createdAt, 40),
      sections: record.collection === 'evaluaciones'
        ? record.type === 'REEVALUATION' && record.reevaluationExpress
          ? {
              reassessmentInterview: text(record.reevaluationExpress.interview, 1200),
              comparablePhysicalExam: text(record.reevaluationExpress.exam, 1200),
              clinicalIntegration: text(record.reevaluationExpress.reasoning, 1200),
            }
          : {
              interview: text(record.interview || record.expressDraft?.anamnesisProxima, 1200),
              guidedExam: text(record.guidedExam || record.expressDraft?.evaluacionFisica, 1200),
              clinicalSynthesis: text(record.clinicalSynthesis || record.expressDraft?.razonamientoIA, 1000),
              therapeuticPlan: text(record.p4_plan_structured?.diagnostico_kinesiologico_narrativo || record.expressDraft?.p4_plan, 1000),
            }
        : {
            sessionGoal: text(record.sessionGoal || record.objetivoSesion, 700),
            interventions: text(record.interventions, 1200),
            nextPlan: text(record.nextPlan, 700),
            painReason: text(record.pain?.contradictionReason, 500),
          },
    }));
}

/**
 * Recorta y rellena antes de validar.
 *
 * El contrato rechazaba respuestas por detalles que no invalidan el análisis:
 * un extracto de 420 caracteres, un feedback un poco largo, una evidencia de
 * más. Tirar todo el razonamiento por eso desperdicia una llamada al modelo y
 * deja al docente sin nada. Se ajusta lo ajustable y solo se descarta cuando
 * falta lo esencial.
 */
function coerceAnalysisShape(raw: any): any {
  if (!raw || typeof raw !== 'object') return raw;
  const cut = (value: unknown, max: number) =>
    typeof value === 'string' ? value.trim().slice(0, max) : value;

  return {
    ...raw,
    strengths: Array.isArray(raw.strengths) ? raw.strengths.slice(0, 4).map((item: any) => cut(item, 300)) : [],
    improvementGaps: Array.isArray(raw.improvementGaps) ? raw.improvementGaps.slice(0, 4).map((item: any) => cut(item, 300)) : [],
    recurringPattern: raw.recurringPattern ? cut(raw.recurringPattern, 500) : undefined,
    coherenceFindings: Array.isArray(raw.coherenceFindings)
      ? raw.coherenceFindings
          .filter((finding: any) => finding?.type && finding?.explanation)
          .slice(0, 5)
          .map((finding: any) => ({
            type: finding.type,
            explanation: cut(finding.explanation, 600),
            // Una severidad fuera del catálogo no justifica perder el hallazgo.
            severity: ['ALTA', 'MEDIA', 'BAJA'].includes(finding.severity) ? finding.severity : 'MEDIA',
          }))
      : [],
    observation: cut(raw.observation, 800),
    pedagogicalInference: cut(raw.pedagogicalInference, 800),
    socraticQuestion: cut(raw.socraticQuestion, 500),
    recommendation: cut(raw.recommendation, 500),
    draftFeedback: cut(raw.draftFeedback, 1800),
    priority: ['P0', 'P1', 'P2', 'P3'].includes(raw.priority) ? raw.priority : 'P2',
    confidence: typeof raw.confidence === 'number'
      ? Math.min(1, Math.max(0, raw.confidence))
      : 0.5,
    evidence: Array.isArray(raw.evidence)
      ? raw.evidence
          .filter((item: any) => item?.recordId && item?.section && item?.excerpt)
          .slice(0, 4)
          .map((item: any) => ({
            recordId: String(item.recordId),
            collection: item.collection === 'evoluciones' ? 'evoluciones' : 'evaluaciones',
            section: cut(item.section, 120),
            excerpt: cut(item.excerpt, 400),
          }))
      : [],
  };
}

export function parseLongitudinalAnalysis(raw: string): LongitudinalAnalysis | null {
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(jsonrepair(match[0]));
    return LongitudinalAnalysisSchema.parse(coerceAnalysisShape(parsed));
  } catch (error) {
    // El motivo concreto sirve para saber si el prompt necesita ajuste o si el
    // modelo simplemente devolvió basura.
    console.warn('[Análisis longitudinal] JSON fuera de contrato:',
      error instanceof Error ? error.message.slice(0, 300) : error);
    return null;
  }
}

/** Resultado del análisis y por qué falló, cuando falla. */
export type LongitudinalAnalysisOutcome = {
  analysis: LongitudinalAnalysis | null;
  engine: string | null;
  note: string;
};

export async function analyzeStudentLongitudinal(
  studentId: string,
  records: ClinicalRecord[],
  preferredTone: 'direct' | 'constructive' | 'detailed' = 'constructive',
  /** Lo que el agente ya aprendió del criterio docente; evita repetir lo que él descarta. */
  calibrationNote = '',
  /** Resultados de OSCE y defensas: el razonamiento oral, que las fichas no muestran. */
  oralEvidence: any[] = [],
): Promise<LongitudinalAnalysisOutcome> {
  const evidence = buildDeidentifiedEvidence(records);
  if (evidence.length === 0) {
    return { analysis: null, engine: null, note: 'Sin evidencia utilizable para analizar.' };
  }
  const processGroups = buildProcessGroupedEvidence(records);

  const prompt = `Eres el asistente de un kinesiólogo docente a cargo de un internado clínico. Analizas a un estudiante identificado como ${studentId}.

TU TAREA PRINCIPAL ES JUZGAR COHERENCIA CLÍNICA.
No basta con revisar si los campos están llenos. Debes contrastar, dentro de cada proceso, lo que el propio estudiante concluyó contra lo que efectivamente ejecutó:
- ¿Las intervenciones y ejercicios prescritos se explican por SU diagnóstico kinesiológico? Un ejercicio que no tiene relación con el problema declarado es un hallazgo.
- ¿Los objetivos que él mismo declaró se están trabajando en las sesiones, o quedaron abandonados?
- ¿La dosificación y la progresión tienen fundamento, o cambian sin justificación? ¿Progresa carga cuando la respuesta no lo permite?
- ¿El plan sigue igual sesión tras sesión pese a que no hay mejoría? Eso es estancamiento, no constancia.
- ¿Se avanza pese a señales de alarma o mala tolerancia? Eso es prioridad P0.
- ¿Acumula sesiones sin volver a medir nada comparable?

REGLAS QUE NO PUEDES ROMPER:
- NUNCA escribas identificadores internos (cadenas como "mnqjzjm02233bw5jhs9"). Al docente no le dicen nada. Refiérete a los casos por lo clínico —"el proceso de codo y muñeca", "la sesión del 8 de agosto"— usando el motivo de ingreso, el diagnóstico o la fecha que aparecen en la evidencia.
- Usa únicamente la evidencia entregada. No inventes hallazgos, ejercicios ni mediciones.
- "No documentado" no es lo mismo que "no realizado". Si falta el dato, dilo como falta de registro, no como error clínico.
- No penalices la cronicidad de la persona atendida ni le atribuyas al estudiante registros de otra autoría.
- Si la evidencia es insuficiente para concluir, responde prioridad P3 y explica la limitación. Es preferible no afirmar nada a afirmar de más.
- Cada conclusión debe citar recordId, collection, section y un extracto literalmente presente en la evidencia.

ADEMÁS, REDACTA EL FEEDBACK (campo draftFeedback).
Escríbelo como lo escribiría un docente clínico dirigiéndose a su estudiante: en español de Chile, tono ${preferredTone}, tuteando, entre 80 y 200 palabras. Parte reconociendo algo concreto que hizo bien, luego plantea la observación principal apoyada en su propio registro, y cierra con una pregunta que la haga razonar en vez de darle la respuesta. No uses viñetas ni encabezados: es un mensaje, no un informe. No firmes.
Este texto es un BORRADOR para que el docente lo apruebe. Nunca contactas tú al estudiante.

Responde SOLO JSON válido con esta forma exacta:
{"strengths":["..."],"improvementGaps":["..."],"recurringPattern":"... opcional","coherenceFindings":[{"type":"INTERVENCION_NO_CORRESPONDE|OBJETIVO_ABANDONADO|DOSIFICACION_INADECUADA|PLAN_ESTANCADO|RIESGO_SEGURIDAD|SIN_REEVALUACION","explanation":"...","severity":"ALTA|MEDIA|BAJA"}],"observation":"...","pedagogicalInference":"...","socraticQuestion":"...","recommendation":"...","draftFeedback":"...","priority":"P0|P1|P2|P3","confidence":0.0,"evidence":[{"recordId":"...","collection":"evaluaciones|evoluciones","section":"...","excerpt":"..."}]}

EVIDENCIA AGRUPADA POR PROCESO (evaluación y objetivos declarados junto a las sesiones ejecutadas):
${JSON.stringify(processGroups)}

REGISTROS COMPLETOS DESIDENTIFICADOS:
${JSON.stringify(evidence)}
${oralEvidence.length ? `
DESEMPEÑO ORAL (simulaciones OSCE y defensas de comisión):
${JSON.stringify(oralEvidence)}

Contrasta lo escrito con lo oral. Una estudiante puede redactar fichas impecables y no sostener su razonamiento al ser preguntada, o al revés. Si ves esa disociación, señálala: es información que las fichas por sí solas no muestran.` : ''}${calibrationNote}`;

  const response = await runAgentInteraction(prompt, undefined, { preferredTone });
  if (response.status !== 'success') {
    // Devolver `null` a secas hacía que el censo continuara como exitoso sin
    // haber analizado nada. El motivo tiene que poder llegar al resumen.
    return { analysis: null, engine: null, note: (response as any).message || 'El motor de análisis no respondió.' };
  }

  const analysis = parseLongitudinalAnalysis(response.result || '');
  return {
    analysis,
    engine: (response as any).engine || 'antigravity',
    note: analysis
      ? (response as any).engineNote || ''
      : 'El motor respondió, pero el JSON no cumplió el contrato esperado.',
  };
}
