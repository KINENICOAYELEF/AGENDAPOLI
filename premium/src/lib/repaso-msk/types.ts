export type OptionId = 'A' | 'B' | 'C' | 'D';
export type Question = {
  id: string; stem: string; options: { id: string; text: string }[];
  objective: string; condition: string; domain: string;
};
export type ReviewedQuestion = Question & {
  correct: string; explanation: string; sources: { title: string; url: string }[];
};
export type Answer = {
  questionId: string; option: OptionId | null;
  reason: 'answer' | 'skip' | 'timeout'; elapsedMs: number; correct: boolean;
};
export type Attempt = {
  id: string; version: 'knee-v1' | 'hip-v1'; questionIds: string[]; answers: Answer[];
  revision: number; status: 'active' | 'completed'; remainingMs: number;
  selected: OptionId | null; createdAt: string; updatedAt: string; repeated: boolean;
};
export type AttemptView = { attempt: Attempt; questions: Question[]; review?: ReviewedQuestion[] };
export type AttemptSummary = Pick<Attempt, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'repeated'> & { version?: Attempt['version'];
  answered: number; correct: number; total: number;
};
export type QuizAction = {
  revision: number; index: number;
} & ({ type: 'answer'; option: OptionId | null; reason: Answer['reason']; elapsedMs: number }
  | { type: 'checkpoint'; remainingMs: number; selected: OptionId | null });

export const QUESTION_MS = 60_000;

export function summarise(attempt: Attempt, questions: Question[], group: 'domain' | 'condition' = 'domain') {
  const domains = [...new Set(questions.map(q => q[group]))];
  return domains.map(domain => {
    const ids = new Set(questions.filter(q => q[group] === domain).map(q => q.id));
    const answers = attempt.answers.filter(a => ids.has(a.questionId));
    return { domain, total: answers.length, correct: answers.filter(a => a.correct).length,
      skipped: answers.filter(a => a.reason === 'skip').length,
      timedOut: answers.filter(a => a.reason === 'timeout' && !a.option).length };
  });
}
