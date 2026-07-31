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

const LongitudinalAnalysisSchema = z.object({
  strengths: z.array(z.string().min(1).max(300)).max(4).default([]),
  improvementGaps: z.array(z.string().min(1).max(300)).max(4).default([]),
  recurringPattern: z.string().min(1).max(500).optional(),
  observation: z.string().min(1).max(800),
  pedagogicalInference: z.string().min(1).max(800),
  socraticQuestion: z.string().min(1).max(500),
  recommendation: z.string().min(1).max(500),
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

/** Contexto clínico mínimo, sin nombres, RUT, contactos ni campos de identidad. */
export function buildDeidentifiedEvidence(records: ClinicalRecord[]) {
  return records
    .slice(0, 12)
    .map((record) => ({
      recordId: record.id,
      collection: record.collection,
      sessionAt: text(record.sessionAt || record.fechaHoraAtencion || record.audit?.createdAt, 40),
      sections: record.collection === 'evaluaciones'
        ? {
            interview: text(record.interview, 1200),
            guidedExam: text(record.guidedExam, 1200),
            clinicalSynthesis: text(record.clinicalSynthesis, 1000),
            therapeuticPlan: text(record.p4_plan_structured?.diagnostico_kinesiologico_narrativo, 1000),
          }
        : {
            sessionGoal: text(record.sessionGoal || record.objetivoSesion, 700),
            interventions: text(record.interventions, 1200),
            nextPlan: text(record.nextPlan, 700),
            painReason: text(record.pain?.contradictionReason, 500),
          },
    }));
}

export function parseLongitudinalAnalysis(raw: string): LongitudinalAnalysis | null {
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    return LongitudinalAnalysisSchema.parse(JSON.parse(jsonrepair(match[0])));
  } catch {
    return null;
  }
}

export async function analyzeStudentLongitudinal(
  studentId: string,
  records: ClinicalRecord[],
  preferredTone: 'direct' | 'constructive' | 'detailed' = 'constructive',
) {
  const evidence = buildDeidentifiedEvidence(records);
  if (evidence.length === 0) return null;

  const prompt = `Analiza exclusivamente el razonamiento clínico longitudinal de un estudiante identificado como ${studentId}.
Usa únicamente la evidencia entregada. No infieras acciones no documentadas. La historia de la persona atendida es contexto: no penalices cronicidad ni atribuyas al estudiante registros de otra autoría.
Cada conclusión debe citar recordId, collection, section y un extracto literalmente presente en la evidencia. Si no hay evidencia suficiente, responde prioridad P3 y explica la limitación.
El feedback es privado para el docente; nunca contactes al estudiante.
Responde SOLO JSON válido con esta forma exacta:
{"strengths":["..."],"improvementGaps":["..."],"recurringPattern":"... opcional","observation":"...","pedagogicalInference":"...","socraticQuestion":"...","recommendation":"...","priority":"P0|P1|P2|P3","confidence":0.0,"evidence":[{"recordId":"...","collection":"evaluaciones|evoluciones","section":"...","excerpt":"..."}]}
Tono recomendado para un posterior borrador docente: ${preferredTone}.
EVIDENCIA DESIDENTIFICADA:\n${JSON.stringify(evidence)}`;

  const response = await runAgentInteraction(prompt, undefined, { preferredTone });
  if (response.status !== 'success') return null;
  return parseLongitudinalAnalysis(response.result || '');
}
