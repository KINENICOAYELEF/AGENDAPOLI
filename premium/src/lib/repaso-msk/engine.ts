import type { Attempt, QuizAction, ReviewedQuestion } from './types';
import { QUESTION_MS } from './types';

// Shared validation is independent of Firebase, so retries and races can be tested.
export function advanceAttempt(attempt: Attempt, action: QuizAction, bank: ReviewedQuestion[], now: string): Attempt {
  if (attempt.status !== 'active' || action.revision !== attempt.revision || action.index !== attempt.answers.length) {
    throw new Error('CONFLICT');
  }
  if (action.type === 'checkpoint') {
    if (action.remainingMs < 0 || action.remainingMs > QUESTION_MS || !Number.isFinite(action.remainingMs)) throw new Error('INVALID');
    return { ...attempt, remainingMs: Math.min(attempt.remainingMs, action.remainingMs), selected: action.selected, revision: attempt.revision + 1, updatedAt: now };
  }
  const questionId = attempt.questionIds[action.index];
  const question = bank.find(q => q.id === questionId);
  if (!question || (action.option !== null && !question.options.some(o => o.id === action.option))) throw new Error('INVALID');
  if ((action.reason === 'answer' && !action.option) || (action.reason === 'skip' && action.option !== null)) throw new Error('INVALID');
  if (!Number.isFinite(action.elapsedMs) || action.elapsedMs < 0 || action.elapsedMs > QUESTION_MS) throw new Error('INVALID');
  if (action.reason === 'timeout' && action.elapsedMs !== QUESTION_MS) throw new Error('INVALID');
  const answers = [...attempt.answers, { questionId, option: action.option, reason: action.reason,
    elapsedMs: action.elapsedMs, correct: action.option === question.correct }];
  return { ...attempt, answers, remainingMs: QUESTION_MS, selected: null,
    status: answers.length === attempt.questionIds.length ? 'completed' : 'active',
    revision: attempt.revision + 1, updatedAt: now };
}
