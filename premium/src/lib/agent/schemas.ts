import { z } from 'zod';

// =============================================================================
// Schemas MCP (herramientas de escritura) — originales
// =============================================================================

export const ReviewFindingSchema = z.object({
  recordId: z.string(),
  section: z.string(),
  excerpt: z.string(),
  finding: z.string(),
  type: z.enum(['criticism', 'praise', 'neutral', 'correction']),
});

export const FeedbackDraftSchema = z.object({
  studentId: z.string(),
  draftText: z.string(),
  findingsRef: z.array(z.string()),
});

export const StudentProfileSnapshotSchema = z.object({
  studentId: z.string(),
  snapshotData: z.record(z.string(), z.unknown()),
  timestamp: z.string().datetime().optional(),
});

export const PatientContinuitySummarySchema = z.object({
  patientId: z.string(),
  summary: z.string(),
  studentIds: z.array(z.string()),
});

export const AgentResponseSchema = z.object({
  status: z.enum(['success', 'error', 'pending']),
  message: z.string(),
  data: z.any().optional(),
});

// =============================================================================
// Schemas de Dominio — Sección 7 del Plan Maestro
// =============================================================================

/**
 * AgentReview: Hallazgo individual generado por el agente al auditar un
 * registro clínico. Se persiste en Firestore colección `agent_reviews`.
 */
export const AgentReviewSchema = z.object({
  id: z.string().optional(),
  studentId: z.string(),
  patientId: z.string().optional(),
  recordId: z.string(),
  authorId: z.string().describe('UID del estudiante autor del registro auditado'),
  section: z.string().describe('Sección del registro donde se encontró el hallazgo'),
  excerpt: z.string().describe('Extracto literal del registro'),
  finding: z.string().describe('Descripción del hallazgo'),
  severity: z.enum(['info', 'minor', 'major', 'critical']).default('info'),
  type: z.enum(['criticism', 'praise', 'neutral', 'correction', 'gap', 'pattern']),
  skill: z.string().optional().describe('Nombre del skill que generó este hallazgo'),
  status: z.enum(['PENDIENTE', 'APROBADO', 'RECHAZADO', 'ARCHIVADO']).default('PENDIENTE'),
  createdAt: z.string().datetime(),
});
export type AgentReview = z.infer<typeof AgentReviewSchema>;

/**
 * StudentLearningProfile: Perfil longitudinal del estudiante construido
 * progresivamente por el agente. Colección `student_learning_profiles`.
 */
export const StudentLearningProfileSchema = z.object({
  studentId: z.string(),
  displayName: z.string().optional(),
  university: z.string().optional(),
  // Métricas acumuladas
  totalRecordsAudited: z.number().default(0),
  totalFindingsGenerated: z.number().default(0),
  findingsBySeverity: z.object({
    info: z.number().default(0),
    minor: z.number().default(0),
    major: z.number().default(0),
    critical: z.number().default(0),
  }).default({ info: 0, minor: 0, major: 0, critical: 0 }),
  // Errores recurrentes (detectados por student-reasoning skill)
  recurringPatterns: z.array(z.object({
    patternId: z.string(),
    description: z.string(),
    occurrences: z.number(),
    firstSeen: z.string().datetime(),
    lastSeen: z.string().datetime(),
  })).default([]),
  // Fortalezas detectadas
  strengths: z.array(z.string()).default([]),
  // Áreas de mejora detectadas
  areasForImprovement: z.array(z.string()).default([]),
  // Rubric scores por dimensión (skill rubric-mapping)
  rubricScores: z.record(z.string(), z.object({
    dimension: z.string(),
    score: z.number().min(0).max(7),
    evidence: z.array(z.string()),
    lastUpdated: z.string().datetime(),
  })).optional(),
  lastUpdatedAt: z.string().datetime(),
});
export type StudentLearningProfile = z.infer<typeof StudentLearningProfileSchema>;

/**
 * TeacherDecision: Cada acción del docente sobre un hallazgo del agente.
 * Se usa en teacher-calibration para aprender el estilo docente.
 * Colección `teacher_decisions`.
 */
export const TeacherDecisionSchema = z.object({
  id: z.string().optional(),
  reviewId: z.string().describe('ID del AgentReview sobre el que se decide'),
  teacherId: z.string(),
  action: z.enum(['APROBADO', 'RECHAZADO', 'EDITADO', 'ARCHIVADO']),
  editedText: z.string().optional().describe('Texto modificado si action = EDITADO'),
  reason: z.string().optional().describe('Razón del rechazo/edición'),
  createdAt: z.string().datetime(),
});
export type TeacherDecision = z.infer<typeof TeacherDecisionSchema>;

/**
 * AgentRun: Registro de cada ejecución del agente (censo, auditoría, etc.).
 * Colección `agent_runs`.
 */
export const AgentRunSchema = z.object({
  id: z.string().optional(),
  triggeredBy: z.enum(['cron', 'manual', 'webhook', 'census']),
  startedAt: z.string().datetime(),
  finishedAt: z.string().datetime().optional(),
  status: z.enum(['running', 'completed', 'failed', 'cancelled']).default('running'),
  studentsProcessed: z.number().default(0),
  recordsAudited: z.number().default(0),
  findingsGenerated: z.number().default(0),
  errors: z.array(z.string()).default([]),
  durationMs: z.number().optional(),
  summary: z.string().optional(),
});
export type AgentRun = z.infer<typeof AgentRunSchema>;

/**
 * SimulationAttempt: Datos de un intento de simulación o defensa oral,
 * usado por el skill simulation-analysis.
 */
export const SimulationAttemptSchema = z.object({
  id: z.string().optional(),
  studentId: z.string(),
  type: z.enum(['simulacion', 'defensa_oral', 'caso_clinico']),
  date: z.string().datetime(),
  patientContext: z.string().optional(),
  transcriptSummary: z.string().optional(),
  performanceNotes: z.string().optional(),
  agentFindings: z.array(z.string()).default([]),
  score: z.number().min(0).max(7).optional(),
});
export type SimulationAttempt = z.infer<typeof SimulationAttemptSchema>;

/**
 * RubricEvaluation: Evaluación de un estudiante contra la rúbrica
 * universitaria, generada por el skill rubric-mapping.
 */
export const RubricEvaluationSchema = z.object({
  studentId: z.string(),
  universityCode: z.string().describe('UCH | UST | UNAB | UDD | UDP'),
  evaluatedAt: z.string().datetime(),
  dimensions: z.array(z.object({
    name: z.string(),
    level: z.enum(['insuficiente', 'básico', 'competente', 'destacado']),
    suggestedScore: z.number().min(1).max(7),
    evidence: z.array(z.object({
      recordId: z.string(),
      excerpt: z.string(),
    })),
  })),
  overallSuggested: z.number().min(1).max(7).optional(),
  notes: z.string().optional(),
});
export type RubricEvaluation = z.infer<typeof RubricEvaluationSchema>;

/**
 * NotificationPayload: Estructura para notificaciones del skill
 * notification-triage al docente vía Telegram.
 */
export const NotificationPayloadSchema = z.object({
  recipientId: z.string(),
  channel: z.enum(['telegram', 'in_app', 'email']).default('telegram'),
  urgency: z.enum(['low', 'medium', 'high', 'critical']),
  title: z.string(),
  body: z.string(),
  relatedReviewIds: z.array(z.string()).default([]),
  sentAt: z.string().datetime().optional(),
  acknowledged: z.boolean().default(false),
});
export type NotificationPayload = z.infer<typeof NotificationPayloadSchema>;
