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
  sourceReferences: z.array(SourceReferenceSchema),
  observation: z.string(),
  pedagogicalInference: z.string().optional(),
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
  category: z.enum(['CLINICAL_AUDIT', 'REEVALUATION_DUE', 'ROTATION_REMINDER', 'INACTIVITY_REMINDER']).optional(),
  baselineEvaluationId: z.string().optional(),
  sessionsSinceBaseline: z.number().int().nonnegative().optional(),
});
export type TeacherAgentReview = z.infer<typeof TeacherAgentReviewSchema>;
