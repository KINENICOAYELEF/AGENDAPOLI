import { featureFlags } from '@/lib/agent/config';
import { getAdminDb } from '@/lib/server/firebaseAdmin';
import { getAllowedTelegramChatId, sendTelegramMessage } from '@/lib/server/telegram';

export const RECENT_REVIEW_WINDOW_HOURS = 48;

const APP_BASE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://agendapoli.vercel.app').replace(/\/$/, '');

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
  /** Diagnóstico del análisis generativo, para no confundir "sin hallazgos" con "no corrió". */
  llm?: {
    enabled: boolean;
    attempted: number;
    succeeded: number;
    failed: number;
    deferred: number;
    engines?: string[];
    skippedReason?: string;
    lastError?: string;
  };
};

function recentCutoff(hours = RECENT_REVIEW_WINDOW_HOURS) {
  return Date.now() - hours * 60 * 60 * 1000;
}

function isRecent(value: unknown, hours = RECENT_REVIEW_WINDOW_HOURS) {
  const time = new Date(String(value || '')).getTime();
  return Number.isFinite(time) && time >= recentCutoff(hours);
}

/**
 * Los casos concretos que el docente necesita para decidir sin abrir el navegador.
 *
 * El mensaje anterior solo llevaba conteos ("3 hallazgos P1"), que no permiten
 * saber de quién se trata ni si urge. Aquí se resuelven los nombres reales y el
 * enlace al registro exacto.
 */
async function getTopPendingCases(limit = 5) {
  const db = getAdminDb();
  const snapshot = await db.collection('teacher_agent_reviews').where('status', '==', 'PENDING_TEACHER').get();

  const priorityRank: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };
  const reviews = snapshot.docs
    .map((doc: any) => ({ id: doc.id, ...doc.data() }))
    .sort((a: any, b: any) => {
      const byPriority = (priorityRank[a.priority] ?? 9) - (priorityRank[b.priority] ?? 9);
      return byPriority !== 0 ? byPriority : String(b.createdAt).localeCompare(String(a.createdAt));
    })
    .slice(0, limit);

  // Un UID no le dice nada a nadie: resolvemos el nombre de cada estudiante.
  const studentIds = [...new Set(reviews.map((review: any) => review.studentId).filter(Boolean))];
  const names = new Map<string, string>();
  await Promise.all(studentIds.map(async (id: any) => {
    try {
      const userSnap = await db.collection('users').doc(id).get();
      const data = userSnap.data();
      if (data) names.set(id, data.displayName || data.email || id);
    } catch { /* si no se resuelve, se muestra el identificador */ }
  }));

  return reviews.map((review: any) => {
    const source = review.sourceReferences?.[0];
    const href = source?.recordId
      ? `${APP_BASE_URL}/app/revision-docente/registros/${source.collection === 'evoluciones' ? 'EVOLUCION' : 'EVALUACION'}/${source.recordId}`
      : `${APP_BASE_URL}/app/revision-docente`;

    // Las incoherencias son lo que el docente necesita ver de inmediato: son el
    // control real sobre lo que las internas están haciendo con sus pacientes.
    const coherence = Array.isArray(review.coherenceFindings)
      ? review.coherenceFindings
          .slice(0, 3)
          .map((finding: any) => `   ${finding.severity === 'ALTA' ? '🚩' : '•'} ${finding.explanation}`)
          .join('\n')
      : '';

    return {
      priority: review.priority as Priority,
      studentName: names.get(review.studentId) || review.studentId || 'Estudiante sin identificar',
      observation: String(review.observation || 'Sin observación registrada').slice(0, 220),
      coherence,
      // El feedback ya redactado viaja en el mensaje: puedes leerlo, y si te
      // sirve tal cual, reenviarlo sin abrir la plataforma.
      draftFeedback: String(review.draftFeedback || '').slice(0, 700),
      href,
    };
  });
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
  // Los casos concretos son lo que convierte el aviso en algo accionable.
  const cases = await getTopPendingCases(5).catch(() => []);
  const caseLines = cases.length
    ? `\n\n${cases.map((item: { priority: Priority; studentName: string; observation: string; coherence: string; draftFeedback: string; href: string }) => [
        `${item.priority === 'P0' ? '🔴' : item.priority === 'P1' ? '🟠' : '🔵'} *${item.studentName}* — ${item.observation}`,
        item.coherence ? `\n${item.coherence}` : '',
        item.draftFeedback ? `\n\n_Feedback propuesto:_\n${item.draftFeedback}` : '',
        `\n[Abrir y aprobar](${item.href})`,
      ].filter(Boolean).join('')).join('\n\n———\n\n')}`
    : '';

  // Estado real del motor de análisis: "sin hallazgos" y "la IA nunca corrió"
  // se veían idénticos, y eso ocultaba semanas de agente apagado.
  const llm = input.llm;
  const llmLine = !llm
    ? ''
    : !llm.enabled
      ? `\n\n⚠️ _Análisis de razonamiento clínico desactivado_${llm.skippedReason ? ` (${llm.skippedReason})` : ''}. Solo se revisó completitud de campos.`
      : llm.attempted === 0
        ? `\n\n⚠️ _La IA no analizó a nadie en esta corrida_ (sin actividad reciente que revisar).`
        : `\n\n🧠 _IA: ${llm.succeeded}/${llm.attempted} análisis completos${llm.failed ? `, ${llm.failed} fallidos` : ''}${llm.deferred ? `, ${llm.deferred} en cola` : ''}${llm.engines?.length ? ` · motor: ${llm.engines.join(', ')}` : ''}._${llm.failed && llm.lastError ? `\n⚠️ ${llm.lastError.slice(0, 180)}` : ''}`;

  const header = urgent
    ? `🔴 *Atención docente*\n\nEl censo detectó *${input.priorityCounts.P0}* hallazgo(s) P0 de seguridad y *${input.priorityCounts.P1}* P1 nuevos.`
    : input.reviewsCreated === 0
      ? `🧠 *Censo Agenda Poli completado*\n\nSin hallazgos nuevos en esta corrida.`
      : `🧠 *Censo Agenda Poli completado*\n\nHay *${input.reviewsCreated}* hallazgo(s) nuevos: P1 ${input.priorityCounts.P1} · P2 ${input.priorityCounts.P2}.`;

  const message = `${header}${reevaluationLine}${initialLine}${pendingLine}${llmLine}${caseLines}\n\n_Nada de esto se envía a las estudiantes: tú decides qué reenviar._`;

  try {
    await sendTelegramMessage(chatId, message, {
      inline_keyboard: [[{ text: '🔎 Abrir Bandeja Docente', url: `${APP_BASE_URL}/app/revision-docente` }]],
    });
    await notificationRef.update({ status: 'DELIVERED', deliveredAt: new Date().toISOString() });
    return { delivered: true };
  } catch (error: any) {
    await notificationRef.update({ status: 'FAILED', failedAt: new Date().toISOString(), error: error?.message || 'Telegram delivery failed' });
    throw error;
  }
}
