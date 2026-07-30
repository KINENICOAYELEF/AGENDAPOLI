import { z } from 'zod';

// schemas for MCP tools based on AGENTS.md rules
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

// agent responses
export const AgentResponseSchema = z.object({
  status: z.enum(['success', 'error', 'pending']),
  message: z.string(),
  data: z.any().optional(),
});
