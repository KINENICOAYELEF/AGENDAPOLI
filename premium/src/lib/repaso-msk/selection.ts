import type { ReviewedQuestion } from './types';
import { TEST_SIZE } from './types';

export const family = (q: ReviewedQuestion) => q.familyId ?? q.id;
export const domainGroup = (domain: string) => domain === 'Conocimientos esenciales' ? 'Fundamentos'
  : domain === 'Evaluación e interpretación' ? 'Interpretación' : domain;

function shuffle<T>(items: T[], random: (max: number) => number) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) { const j = random(i + 1); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
}
// Round-robin clinical blocks, favoring less represented knowledge domains.
// Unseen families ALWAYS take precedence over balancing and over repeats.
function balanced(pool: ReviewedQuestion[], count: number, random: (max: number) => number, initial: ReviewedQuestion[] = []) {
  const remaining = shuffle(pool, random), result: ReviewedQuestion[] = [];
  const groups = new Map<string, number>(), domains = new Map<string, number>();
  const record = (q: ReviewedQuestion) => {
    groups.set(q.condition, (groups.get(q.condition) ?? 0) + 1);
    const d = domainGroup(q.domain); domains.set(d, (domains.get(d) ?? 0) + 1);
  };
  initial.forEach(record);
  while (result.length < count && remaining.length) {
    remaining.sort((a, b) => (groups.get(a.condition) ?? 0) - (groups.get(b.condition) ?? 0)
      || (domains.get(domainGroup(a.domain)) ?? 0) - (domains.get(domainGroup(b.domain)) ?? 0));
    const q = remaining.shift()!; result.push(q); record(q);
  }
  return result;
}
export function selectQuestions(bank: ReviewedQuestion[], seen: string[], replay: boolean, random: (max: number) => number) {
  if (new Set(bank.map(family)).size !== bank.length || bank.length < TEST_SIZE) throw new Error('INVALID_BANK');
  const used = new Set(seen), fresh = bank.filter(q => !used.has(family(q)));
  if (fresh.length < TEST_SIZE && !replay) throw new Error('BANK_USED');
  const chosen = balanced(fresh, Math.min(TEST_SIZE, fresh.length), random);
  const repeats = balanced(bank.filter(q => used.has(family(q))), TEST_SIZE - chosen.length, random, chosen);
  return { questions: shuffle([...chosen, ...repeats], random), repeated: repeats.length > 0, repeatedCount: repeats.length };
}
