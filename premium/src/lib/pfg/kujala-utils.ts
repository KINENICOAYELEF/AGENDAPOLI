// ============================================================
// KUJALA AKPS — FUNCIONES DE CÁLCULO Y RESULTADO
// ============================================================

import { KUJALA_AKPS_ES, KujalaInstrument } from './kujala-config';

export type KujalaAnswers = Record<string, string>; // { q1: "A", q2: "B", ... }

export interface KujalaItemResult {
  id: string;
  question: string;
  selectedValue: string;
  selectedLabel: string;
  score: number;
}

export interface KujalaResult {
  instrumentId: string;
  instrumentName: string;
  completed: boolean;
  completionPercent: number;
  totalScore: number;
  maxScore: number;
  higherIsBetter: boolean;
  answeredAt: string;
  items: KujalaItemResult[];
}

export interface KujalaCompletion {
  answered: number;
  total: number;
  percent: number;
  missing: string[];
  complete: boolean;
}

// ── calculateKujalaScore ─────────────────────────────────────
export function calculateKujalaScore(
  answers: KujalaAnswers,
  instrument: KujalaInstrument = KUJALA_AKPS_ES
): number {
  let sum = 0;
  instrument.items.forEach((item) => {
    const selected = answers[item.id];
    if (selected) {
      const opt = item.options.find((o) => o.value === selected);
      if (opt) sum += opt.score;
    }
  });
  return sum;
}

// ── getKujalaCompletion ──────────────────────────────────────
export function getKujalaCompletion(
  answers: KujalaAnswers,
  instrument: KujalaInstrument = KUJALA_AKPS_ES
): KujalaCompletion {
  const total = instrument.items.length;
  const missing: string[] = [];
  instrument.items.forEach((item) => {
    if (!answers[item.id]) missing.push(item.id);
  });
  const answered = total - missing.length;
  return {
    answered,
    total,
    percent: Math.round((answered / total) * 100),
    missing,
    complete: missing.length === 0,
  };
}

// ── buildKujalaResultObject ──────────────────────────────────
export function buildKujalaResultObject(
  answers: KujalaAnswers,
  instrument: KujalaInstrument = KUJALA_AKPS_ES,
  previousResult?: KujalaResult | null
): KujalaResult & { delta: number | null; deltaLabel: string | null } {
  const completion = getKujalaCompletion(answers, instrument);
  const totalScore = calculateKujalaScore(answers, instrument);

  const items: KujalaItemResult[] = instrument.items.map((item) => {
    const selected = answers[item.id];
    const opt = item.options.find((o) => o.value === selected);
    return {
      id: item.id,
      question: item.text,
      selectedValue: selected || '',
      selectedLabel: opt?.label || '',
      score: opt?.score ?? 0,
    };
  });

  const result: KujalaResult = {
    instrumentId: instrument.id,
    instrumentName: instrument.title,
    completed: completion.complete,
    completionPercent: completion.percent,
    totalScore,
    maxScore: instrument.maxScore,
    higherIsBetter: instrument.higherIsBetter,
    answeredAt: new Date().toISOString(),
    items,
  };

  let delta: number | null = null;
  let deltaLabel: string | null = null;
  if (previousResult && previousResult.completed && completion.complete) {
    delta = totalScore - previousResult.totalScore;
    if (delta > 0) deltaLabel = 'Mejoró';
    else if (delta < 0) deltaLabel = 'Empeoró';
    else deltaLabel = 'Sin cambio';
  }

  return { ...result, delta, deltaLabel };
}
