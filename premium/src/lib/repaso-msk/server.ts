import { getAdminDb } from '@/lib/server/firebaseAdmin';
import type { Firestore } from 'firebase-admin/firestore';
import bankData from './knee-bank.json';
import hipData from './hip-bank.json';
import type { Attempt, AttemptView, ReviewedQuestion } from './types';

export const bank = [...bankData, ...hipData] as ReviewedQuestion[];
export const bankQuestions = (version: Attempt['version']) => bank.filter(q => q.id.startsWith(`${version}-`));
export const attemptsRef = (uid: string) => (getAdminDb() as Firestore).collection('msk_quiz_private').doc(uid).collection('attempts');
export function attemptView(attempt: Attempt): AttemptView {
  const ordered = attempt.questionIds.map(id => {
    const question = bank.find(q => q.id === id);
    if (!question) throw new Error('Unknown bank version');
    return question;
  });
  return { attempt: attempt.status === 'completed' ? attempt : { ...attempt, answers: attempt.answers.map(a => ({ ...a, correct: false })) },
    questions: ordered.map(q => ({ id: q.id, stem: q.stem, options: q.options, objective: q.objective, condition: q.condition, domain: q.domain })),
    ...(attempt.status === 'completed' ? { review: ordered } : {}) };
}
