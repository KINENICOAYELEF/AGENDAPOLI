import { z } from 'zod';

export const SourceReferenceSchema = z.object({
  year: z.string(),
  collection: z.enum(['evaluaciones', 'evoluciones', 'simulador_intentos', 'defensas_voz_intentos']),
  recordId: z.string(),
  fieldPath: z.string(),
  contentHash: z.string(),
  redactedExcerpt: z.string(),
});
export type SourceReference = z.infer<typeof SourceReferenceSchema>;

export const TeacherAgentReviewSchema = z.object({
  id: z.string().optional(),
  year: z.string(),
  studentId: z.string(),
  patientId: z.string().optional(),
  processId: z.string().optional(),
  sourceReferences: z.array(SourceReferenceSchema),
  observation: z.string(),
  pedagogicalInference: z.string().optional(),
  /**
   * Feedback redactado por el modelo, pendiente de aprobación docente.
   *
   * Guardarlo aquí permite que el docente lo apruebe desde la bandeja o desde
   * Telegram sin reconstruir nada. Nunca se muestra al estudiante hasta que el
   * docente lo aprueba explícitamente.
   */
  draftFeedback: z.string().optional(),
  /** Incoherencias detectadas entre la evaluación del estudiante y lo ejecutado. */
  coherenceFindings: z.array(z.object({
    type: z.string(),
    explanation: z.string(),
    severity: z.enum(['ALTA', 'MEDIA', 'BAJA']),
  })).optional(),
  confidence: z.number().min(0).max(1),
  priority: z.enum(['P0', 'P1', 'P2', 'P3']),
  status: z.enum([
    'PENDING_TEACHER',
    'ACCEPTED_PRIVATE',
    'MESSAGE_DRAFTED',
    'SHARED',
    'DISMISSED',
    'SNOOZED',
  ]),
  createdAt: z.string(),
  reviewedAt: z.string().optional(),
  category: z.enum([
    'CLINICAL_AUDIT',
    'REEVALUATION_DUE',
    'INITIAL_EVALUATION_MISSING',
    'INITIAL_EVALUATION_INSUFFICIENT',
    'ROTATION_REMINDER',
    'INACTIVITY_REMINDER',
  ]).optional(),
  baselineEvaluationId: z.string().optional(),
  sessionsSinceBaseline: z.number().int().nonnegative().optional(),
});
export type TeacherAgentReview = z.infer<typeof TeacherAgentReviewSchema>;
