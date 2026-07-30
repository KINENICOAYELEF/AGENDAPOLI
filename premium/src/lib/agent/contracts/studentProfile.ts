import { z } from 'zod';

export const StudentLearningProfileContractSchema = z.object({
  year: z.string(),
  studentId: z.string(),
  displayName: z.string().optional(),
  universityCode: z.string().optional(),
  studentCode: z.string().optional(),
  auditedRecordsCount: z.number().default(0),
  strengths: z.array(z.string()).default([]),
  improvementGaps: z.array(z.string()).default([]),
  recurringErrorPatterns: z.array(z.object({
    patternId: z.string(),
    description: z.string(),
    occurrences: z.number(),
    lastSeenAt: z.string(),
  })).default([]),
  simulationStats: z.object({
    attemptsCompleted: z.number().default(0),
    minCompleted: z.boolean().default(false),
    oralVsWrittenConcordance: z.number().min(0).max(1).optional(),
  }).default({ attemptsCompleted: 0, minCompleted: false }),
  lastUpdatedAt: z.string(),
});
export type StudentLearningProfileContract = z.infer<typeof StudentLearningProfileContractSchema>;
