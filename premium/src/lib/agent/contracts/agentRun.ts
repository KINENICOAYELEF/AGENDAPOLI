import { z } from 'zod';

export const AgentRunContractSchema = z.object({
  id: z.string().optional(),
  year: z.string(),
  triggeredBy: z.enum(['cron', 'manual', 'webhook', 'census']),
  status: z.enum(['running', 'completed', 'failed', 'cancelled']),
  startedAt: z.string(),
  finishedAt: z.string().optional(),
  studentsProcessed: z.number().default(0),
  recordsProcessed: z.number().default(0),
  reviewsCreated: z.number().default(0),
  agentVersion: z.string(),
  promptVersion: z.string(),
  errorMessage: z.string().optional(),
});
export type AgentRunContract = z.infer<typeof AgentRunContractSchema>;
