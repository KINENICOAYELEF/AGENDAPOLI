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

// A legacy item may retain a factual answer, but a new attempt must ask the
// learner to weigh it as clinical evidence rather than merely recite a label.
// Individually rewritten items use one of the decision domains and pass through.
const legacyDomainToDecision: Record<string, string> = {
  Reconocimiento: 'Evaluación e interpretación',
  Fundamentos: 'Razonamiento aplicado',
  'Conocimientos esenciales': 'Integración clínico-funcional',
};
function asClinicalDecision(question: ReviewedQuestion): ReviewedQuestion {
  const domain = legacyDomainToDecision[question.domain];
  if (!domain) return question;
  const trimmed = question.stem.trim();
  const match = trimmed.match(/^([\s\S]*?)(?:\s*¿[^?]+\?)$/);
  const context = match?.[1]?.trim();
  const prefix = context && !context.startsWith('¿')
    ? context
    : `En la discusión de un caso de ${question.condition.toLowerCase()}, el equipo necesita usar este principio para cambiar una decisión y no sólo repetir una definición.`;
  const task = question.domain === 'Reconocimiento'
    ? '¿Cuál opción debe ganar mayor peso como hipótesis provisional, y qué hallazgo discordante obligaría a reconsiderarla?'
    : '¿Cuál opción cambia una decisión de evaluación, carga, educación o seguimiento sin exceder lo que permite inferir el dato?';
  return { ...question, domain, stem: `${prefix}\n\n${task}` };
}

// Keep immutable originals for attempts already saved; select only current revisions for new attempts.
const sourceBank = [...bankData, ...hipData, ...kneeAdditional, ...kneeBatch3, ...hipAdditional, ...hipBatch3, ...shoulderData, ...shoulderBatch2, ...revisions] as ReviewedQuestion[];
export const bank = sourceBank.map(asClinicalDecision);
const replaced = new Set(revisions.map(q => q.replaces));
export const bankQuestions = (version: Attempt['version']) => bank.filter(q => q.id.startsWith(`${version}-`) && !replaced.has(q.id));
export const bankQuestionsVisible = (version: Attempt['version'], hiddenIds: Iterable<string> = []) => {
  const hidden = new Set(hiddenIds);
  return bankQuestions(version).filter(q => !hidden.has(q.id));
};
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
