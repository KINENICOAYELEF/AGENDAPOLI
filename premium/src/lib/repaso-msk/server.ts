import { getAdminDb } from '@/lib/server/firebaseAdmin';
import type { Firestore } from 'firebase-admin/firestore';
import bankData from './knee-bank.json';
import hipData from './hip-bank.json';
import kneeAdditional from './knee-additional.json';
import kneeBatch3 from './knee-batch3.json';
import hipAdditional from './hip-additional.json';
import hipBatch3 from './hip-batch3.json';
import shoulderData from './shoulder-bank.json';
import shoulderBatch2 from './shoulder-batch2.json';
import revisions from './revisions.json';
import type { Attempt, AttemptView, ReviewedQuestion } from './types';

// Keep immutable originals for attempts already saved; select only current revisions for new attempts.
export const bank = [...bankData, ...hipData, ...kneeAdditional, ...kneeBatch3, ...hipAdditional, ...hipBatch3, ...shoulderData, ...shoulderBatch2, ...revisions] as ReviewedQuestion[];
const replaced = new Set(revisions.map(q => q.replaces));
export const bankQuestions = (version: Attempt['version']) => bank.filter(q => q.id.startsWith(`${version}-`) && !replaced.has(q.id));
export const attemptsRef = (uid: string) => (getAdminDb() as Firestore).collection('msk_quiz_private').doc(uid).collection('attempts');
// Keep the order stable for a resumed attempt, but remove any answer-position cue
// embedded in authoring order. Option IDs remain unchanged for scoring and review.
function optionsForAttempt(question: ReviewedQuestion, attemptId: string) {
  let hash = 0;
  for (const char of `${attemptId}:${question.id}`) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  const ordered = [...question.options];
  for (let index = ordered.length - 1; index > 0; index--) {
    const swap = Math.abs(hash + index * 31) % (index + 1);
    [ordered[index], ordered[swap]] = [ordered[swap], ordered[index]];
  }
  return ordered;
}
export function attemptView(attempt: Attempt): AttemptView {
  const ordered = attempt.questionIds.map(id => {
    const question = bank.find(q => q.id === id);
    if (!question) throw new Error('Unknown bank version');
    return question;
  });
  return { attempt: attempt.status === 'completed' ? attempt : { ...attempt, answers: attempt.answers.map(a => ({ ...a, correct: false })) },
    questions: ordered.map(q => ({ id: q.id, stem: q.stem, options: optionsForAttempt(q, attempt.id), objective: q.objective, condition: q.condition, domain: q.domain })),
    ...(attempt.status === 'completed' ? { review: ordered.map(q => ({ ...q, options: optionsForAttempt(q, attempt.id) })) } : {}) };
}
