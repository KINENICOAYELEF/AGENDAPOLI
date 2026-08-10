import { featureFlags } from '@/lib/agent/config';
import { getAdminDb } from '@/lib/server/firebaseAdmin';
import { getAllowedTelegramChatId, sendTelegramMessage } from '@/lib/server/telegram';

export const RECENT_REVIEW_WINDOW_HOURS = 48;

type Priority = 'P0' | 'P1' | 'P2' | 'P3';

export type CensusNotificationInput = {
  runId: string;
  triggeredBy: string;
  status: string;
  reviewsCreated: number;
  reevaluationRemindersCreated?: number;
  initialEvaluationMissingCreated?: number;
  initialEvaluationInsufficientCreated?: number;
  priorityCounts: Record<Priority, number>;
};

function recentCutoff(hours = RECENT_REVIEW_WINDOW_HOURS) {
  return Date.now() - hours * 60 * 60 * 1000;
}

function isRecent(value: unknown, hours = RECENT_REVIEW_WINDOW_HOURS) {
  const time = new Date(String(value || '')).getTime();
  return Number.isFinite(time) && time >= recentCutoff(hours);
}

/** Solo muestra hallazgos recientes; el histórico se conserva pero no satura al docente. */
export async function getRecentPendingReviewSummary(hours = RECENT_REVIEW_WINDOW_HOURS) {
  const db = getAdminDb();
  const snapshot = await db.collection('teacher_agent_reviews').where('status', '==', 'PENDING_TEACHER').get();
  const persistent = new Set(['REEVALUATION_DUE', 'INITIAL_EVALUATION_MISSING', 'INITIAL_EVALUATION_INSUFFICIENT']);
  const reviews = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })).filter((review: any) => isRecent(review.createdAt, hours) || persistent.has(review.category));
  const count = (priority: Priority) => reviews.filter((review: any) => review.priority === priority).length;
  const categoryCount = (category: string) => reviews.filter((review: any) => review.category === category).length;
  return {
    total: reviews.length,
    p0: count('P0'), p1: count('P1'), p2: count('P2'), p3: count('P3'), hours,
    reevaluationDue: categoryCount('REEVALUATION_DUE'),
    initialMissing: categoryCount('INITIAL_EVALUATION_MISSING'),
    initialInsufficient: categoryCount('INITIAL_EVALUATION_INSUFFICIENT'),
  };
}

/**
 * Entrega solo un resumen breve por corrida y lo registra antes de enviarlo.
 * No incluye datos identificatorios ni contacta estudiantes.
 */
export async function notifyTeacherOfCensus(input: CensusNotificationInput) {
  if (!featureFlags.telegramTeacherEnabled || input.status !== 'completed') {
    return { delivered: false, reason: 'telegram_disabled_or_run_failed' };
  }

  // Antes bastaba con `reviewsCreated === 0` para no avisar nada. Como el ID de
  // hallazgo es determinista, una segunda corrida sobre los mismos registros
  // crea cero hallazgos nuevos: el docente dejaba de recibir aviso aunque
  // hubiera pendientes P0 sin revisar. Ahora el silencio exige que tampoco
  // queden pendientes acumulados.
  const pending = await getRecentPendingReviewSummary().catch(() => null);
  const hasPending = (pending?.total || 0) > 0;
  if (input.reviewsCreated === 0 && !hasPending) {
    return { delivered: false, reason: 'no_relevant_new_reviews' };
  }

  const chatId = getAllowedTelegramChatId();
  if (!chatId) return { delivered: false, reason: 'telegram_chat_not_configured' };

  const db = getAdminDb();
  const notificationRef = db.collection('teacher_notifications').doc(`census_${input.runId}`);
  const payload = {
    kind: 'CENSUS_SUMMARY',
    channel: 'telegram',
    audience: 'DOCENTE_ONLY',
    status: 'QUEUED',
    runId: input.runId,
    triggeredBy: input.triggeredBy,
    priorityCounts: input.priorityCounts,
    createdAt: new Date().toISOString(),
  };

  try {
    await notificationRef.create(payload);
  } catch (error: any) {
    if (error?.code === 6 || error?.code === 'already-exists') return { delivered: false, reason: 'already_notified' };
    throw error;
  }

  const urgent = input.priorityCounts.P0 > 0;
  const reevaluationLine = input.reevaluationRemindersCreated
    ? `\n🔄 Reevaluación sugerida: *${input.reevaluationRemindersCreated}*.`
    : '';
  const initialLine = input.initialEvaluationMissingCreated || input.initialEvaluationInsufficientCreated
    ? `\n📋 Sin evaluación inicial: *${input.initialEvaluationMissingCreated || 0}* · línea basal insuficiente: *${input.initialEvaluationInsufficientCreated || 0}*.`
    : '';
  // Distinguir "nuevo" de "acumulado" evita que un aviso de cero hallazgos
  // nuevos se lea como si no hubiera nada pendiente en la bandeja.
  const pendingLine = pending
    ? `\n📥 Pendientes sin revisar en bandeja: *${pending.total}* (P0 ${pending.p0} · P1 ${pending.p1}).`
    : '';
  const message = urgent
    ? `🔴 *Atención docente*\n\nEl censo detectó *${input.priorityCounts.P0}* hallazgo(s) P0 de seguridad y *${input.priorityCounts.P1}* P1 nuevos.${reevaluationLine}${initialLine}${pendingLine}\n\nAcción: revisa la Bandeja Docente antes de continuar.`
    : input.reviewsCreated === 0
      ? `🧠 *Censo Agenda Poli completado*\n\nSin hallazgos nuevos en esta corrida.${pendingLine}${reevaluationLine}${initialLine}\n\nAcción: la bandeja todavía tiene casos esperando tu decisión.`
      : `🧠 *Censo Agenda Poli completado*\n\nHay *${input.reviewsCreated}* hallazgo(s) nuevos para revisión: P1 ${input.priorityCounts.P1} · P2 ${input.priorityCounts.P2}.${reevaluationLine}${initialLine}${pendingLine}\n\nAcción: revisa la línea basal y decide si corresponde enviar un aviso al estudiante.`;

  try {
    await sendTelegramMessage(chatId, message, {
      inline_keyboard: [[{ text: '🔎 Abrir Bandeja Docente', url: 'https://agendapoli.vercel.app/app/revision-docente' }]],
    });
    await notificationRef.update({ status: 'DELIVERED', deliveredAt: new Date().toISOString() });
    return { delivered: true };
  } catch (error: any) {
    await notificationRef.update({ status: 'FAILED', failedAt: new Date().toISOString(), error: error?.message || 'Telegram delivery failed' });
    throw error;
  }
}
