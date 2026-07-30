import { z } from 'zod';

export const TeacherDecisionContractSchema = z.object({
  id: z.string().optional(),
  year: z.string(),
  teacherId: z.string(),
  reviewId: z.string(),
  action: z.enum([
    'ACCEPTED',
    'EDITED',
    'REJECTED_INCORRECT',
    'REJECTED_IRRELEVANT',
    'REJECTED_TOO_STRICT',
    'ALREADY_DISCUSSED',
    'SNOOZED',
  ]),
  originalDraftText: z.string().optional(),
  finalText: z.string().optional(),
  reason: z.string().optional(),
  createdAt: z.string(),
});
export type TeacherDecisionContract = z.infer<typeof TeacherDecisionContractSchema>;
