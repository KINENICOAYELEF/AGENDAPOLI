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
  const reviews = snapshot.docs.map((doc: any) => doc.data()).filter((review: any) => isRecent(review.createdAt, hours));
  const count = (priority: Priority) => reviews.filter((review: any) => review.priority === priority).length;
  return { total: reviews.length, p0: count('P0'), p1: count('P1'), p2: count('P2'), p3: count('P3'), hours };
}

/**
 * Entrega solo un resumen breve por corrida y lo registra antes de enviarlo.
 * No incluye datos identificatorios ni contacta estudiantes.
 */
export async function notifyTeacherOfCensus(input: CensusNotificationInput) {
  if (!featureFlags.telegramTeacherEnabled || input.status !== 'completed' || input.reviewsCreated === 0) {
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
  const message = urgent
    ? `🔴 *Atención docente*\n\nEl censo detectó *${input.priorityCounts.P0}* hallazgo(s) P0 de seguridad y *${input.priorityCounts.P1}* P1 nuevos.${reevaluationLine}${initialLine}\n\nAcción: revisa la Bandeja Docente antes de continuar.`
    : `🧠 *Censo Agenda Poli completado*\n\nHay *${input.reviewsCreated}* hallazgo(s) nuevos para revisión: P1 ${input.priorityCounts.P1} · P2 ${input.priorityCounts.P2}.${reevaluationLine}${initialLine}\n\nAcción: revisa la línea basal y decide si corresponde enviar un aviso al estudiante.`;

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
