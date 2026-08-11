import { featureFlags } from '@/lib/agent/config';
import { getAdminDb } from '@/lib/server/firebaseAdmin';
import { getAllowedTelegramChatId, sendTelegramMessage } from '@/lib/server/telegram';
import { buildCoursePatterns, buildRotationSummary, buildWatchAlerts, formatRotationSummary } from '@/lib/agent/rotationSummary';
import { buildClosingReport, formatClosingReport } from '@/lib/agent/rotationClosing';
import { buildActiveRoster } from '@/lib/agent/activeRoster';
import { findStudentMissingEndDate, getRotationPeriods, setPendingQuestion } from '@/lib/agent/rotationPeriods';

export const RECENT_REVIEW_WINDOW_HOURS = 48;

const APP_BASE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://agendapoli.vercel.app').replace(/\/$/, '');

/** Los mismos nombres legibles que usa la bandeja, para no hablar dos idiomas. */
const COURSE_PATTERN_LABELS: Record<string, string> = {
  INTERVENCION_NO_CORRESPONDE: 'intervenciones sin relación con su diagnóstico',
  OBJETIVO_ABANDONADO: 'objetivos declarados que no trabajan',
  DOSIFICACION_INADECUADA: 'dosificación sin fundamento',
  PLAN_ESTANCADO: 'planes que no cambian pese a falta de progreso',
  RIESGO_SEGURIDAD: 'avanzan pese a señales de alarma',
  SIN_REEVALUACION: 'acumulan sesiones sin volver a medir',
};

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
  /** Personas que otra interna lleva varias sesiones atendiendo sin estar asignada. */
  staleAssignmentCases?: Array<{
    patientName: string;
    assignedTo: string;
    actuallyTreatedBy: string;
    sessions: number;
  }>;
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

/** Hallazgos que llevan días esperando la decisión del docente. */
async function buildTeacherBacklog() {
  const db = getAdminDb();
  const snapshot = await db.collection('teacher_agent_reviews')
    .where('status', '==', 'PENDING_TEACHER')
    .get();
  if (snapshot.empty) return { pending: 0, oldestDays: 0 };

  const ages = snapshot.docs
    .map((doc: any) => new Date(doc.data().createdAt || Date.now()).getTime())
    .filter((time: number) => Number.isFinite(time));
  const oldest = ages.length ? Math.min(...ages) : Date.now();

  return {
    pending: snapshot.size,
    oldestDays: Math.floor((Date.now() - oldest) / 86400000),
  };
}

/** Comentarios que la estudiante marcó como corregidos desde el último aviso. */
async function buildAnsweredComments() {
  const db = getAdminDb();
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const snapshot = await db.collection('record_comments')
    .where('status', '==', 'RESOLVED')
    .get();

  const recent = snapshot.docs
    .map((doc: any) => doc.data())
    .filter((comment: any) => String(comment.resolvedAt || '') >= since);
  if (recent.length === 0) return [];

  const studentIds = [...new Set(recent.map((comment: any) => comment.studentId).filter(Boolean))];
  const names = new Map<string, string>();
  await Promise.all(studentIds.map(async (id: any) => {
    try {
      const userSnap = await db.collection('users').doc(id).get();
      const data = userSnap.data();
      if (data) names.set(id, data.displayName || data.email || id);
    } catch { /* se muestra el identificador */ }
  }));

  return recent.map((comment: any) => ({
    studentName: names.get(comment.studentId) || comment.studentId,
    section: comment.section || 'sección no registrada',
  }));
}

/**
 * Análisis de período, dos veces por semana.
 *
 * El resumen diario responde "qué pasó hoy". Esto responde otra cosa: cómo
 * viene cada estudiante comparada consigo misma. Es el material que sirve para
 * la evaluación formativa, no para apagar incendios.
 *
 * Sale lunes y jueves, con marca por fecha para no repetirse entre corridas.
 */
export async function sendPeriodicAnalysis(year: string) {
  if (!featureFlags.telegramTeacherEnabled) return { delivered: false, reason: 'telegram_disabled' };

  const santiagoNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Santiago' }));
  const weekday = santiagoNow.getDay(); // 1 = lunes, 4 = jueves
  if (weekday !== 1 && weekday !== 4) return { delivered: false, reason: 'not_a_report_day' };

  const chatId = getAllowedTelegramChatId();
  if (!chatId) return { delivered: false, reason: 'telegram_chat_not_configured' };

  const db = getAdminDb();
  const today = santiagoNow.toLocaleDateString('en-CA');
  const reportRef = db.collection('teacher_notifications').doc(`periodic_${today}`);

  try {
    await reportRef.create({
      kind: 'PERIODIC_ANALYSIS',
      channel: 'telegram',
      audience: 'DOCENTE_ONLY',
      status: 'QUEUED',
      forDate: today,
      createdAt: new Date().toISOString(),
    });
  } catch (error: any) {
    if (error?.code === 6 || error?.code === 'already-exists') {
      return { delivered: false, reason: 'already_sent_today' };
    }
    throw error;
  }

  try {
    // Se comparan dos ventanas iguales: los últimos días contra los anteriores.
    const [current, previous] = await Promise.all([
      buildRotationSummary(year, 3),
      buildRotationSummary(year, 7),
    ]);

    const previousById = new Map(previous.lines.map(line => [line.studentId, line]));
    const movements = current.lines.map(line => {
      const older = previousById.get(line.studentId);
      const olderActivity = Math.max(0, (older?.evolutions || 0) - line.evolutions);
      const nowActivity = line.evolutions;
      const trend = nowActivity > olderActivity ? '📈'
        : nowActivity < olderActivity ? '📉'
        : '➡️';
      return { name: line.name, trend, nowActivity, olderActivity, drafts: line.drafts, p0: line.p0Findings };
    });

    const body = movements
      .sort((a, b) => (b.p0 - a.p0) || (a.nowActivity - b.nowActivity))
      .slice(0, 12)
      .map(item =>
        `${item.trend} *${item.name}* — ${item.nowActivity} sesión(es) en los últimos 3 días `
        + `(antes ${item.olderActivity})`
        + `${item.drafts ? ` · 📝 ${item.drafts} sin firmar` : ''}`
        + `${item.p0 ? ` · 🔴 ${item.p0} P0` : ''}`,
      ).join('\n');

    const day = weekday === 1 ? 'Inicio de semana' : 'Medio de semana';
    await sendTelegramMessage(
      chatId,
      `🗓 *${day} — cómo viene cada estudiante*\n\n${body || '_Sin actividad registrada en el período._'}`
      + `\n\n📈 subió · ➡️ igual · 📉 bajó, comparado con los días previos.`
      + `\n\n[Ver fichas completas](${APP_BASE_URL}/app/revision-docente)`,
    );
    await reportRef.update({ status: 'DELIVERED', deliveredAt: new Date().toISOString() });
    return { delivered: true };
  } catch (error: any) {
    await reportRef.update({ status: 'FAILED', error: error?.message || 'fallo de entrega' });
    return { delivered: false, reason: error?.message || 'telegram_delivery_failed' };
  }
}

/**
 * Alerta inmediata por riesgo clínico.
 *
 * Un P0 detectado a media mañana esperaba hasta el resumen de la noche. Lo que
 * compromete la seguridad de una persona atendida no puede compartir cola con
 * "faltan tres borradores por firmar".
 *
 * Se envía una sola vez por hallazgo: la marca por ID evita que las cuatro
 * corridas diarias repitan la misma alarma.
 */
export async function sendCriticalAlerts() {
  if (!featureFlags.telegramTeacherEnabled) return { delivered: 0, reason: 'telegram_disabled' };
  const chatId = getAllowedTelegramChatId();
  if (!chatId) return { delivered: 0, reason: 'telegram_chat_not_configured' };

  const db = getAdminDb();
  const snapshot = await db.collection('teacher_agent_reviews')
    .where('status', '==', 'PENDING_TEACHER')
    .where('priority', '==', 'P0')
    .get();

  let delivered = 0;
  for (const doc of snapshot.docs) {
    const review: any = doc.data();
    const alertRef = db.collection('teacher_notifications').doc(`critical_${doc.id}`);
    try {
      await alertRef.create({
        kind: 'CRITICAL_ALERT',
        channel: 'telegram',
        audience: 'DOCENTE_ONLY',
        status: 'QUEUED',
        reviewId: doc.id,
        createdAt: new Date().toISOString(),
      });
    } catch (error: any) {
      // Ya se avisó de este hallazgo: no se repite en cada corrida.
      if (error?.code === 6 || error?.code === 'already-exists') continue;
      throw error;
    }

    let studentName = review.studentId;
    try {
      const userSnap = await db.collection('users').doc(review.studentId).get();
      studentName = userSnap.data()?.displayName || userSnap.data()?.email || review.studentId;
    } catch { /* se muestra el identificador */ }

    const coherence = Array.isArray(review.coherenceFindings)
      ? review.coherenceFindings.map((finding: any) => `\n🚩 ${finding.explanation}`).join('')
      : '';
    const source = review.sourceReferences?.[0];
    const href = source?.recordId
      ? `${APP_BASE_URL}/app/revision-docente/registros/${source.collection === 'evoluciones' ? 'EVOLUCION' : 'EVALUACION'}/${source.recordId}`
      : `${APP_BASE_URL}/app/revision-docente`;

    try {
      await sendTelegramMessage(
        chatId,
        `🔴 *RIESGO CLÍNICO DETECTADO*\n\n*${studentName}*\n${review.observation || ''}${coherence}\n\n[Abrir el registro](${href})\n\n_Esto no espera al resumen diario. Nada se envió a la estudiante._`,
      );
      await alertRef.update({ status: 'DELIVERED', deliveredAt: new Date().toISOString() });
      delivered++;
    } catch (error: any) {
      await alertRef.update({ status: 'FAILED', error: error?.message || 'fallo de entrega' });
    }
  }

  return { delivered };
}

/**
 * Resumen diario de la rotación, enviado una sola vez por día.
 *
 * Es el mensaje que el docente pidió: quién trabajó, quién está en silencio y
 * qué quedó sin firmar, sin tener que preguntarlo. La marca por fecha impide
 * que las cuatro corridas diarias del cron lo manden cuatro veces.
 */
export async function sendDailyRotationDigest(year: string) {
  if (!featureFlags.telegramTeacherEnabled) {
    return { delivered: false, reason: 'telegram_disabled' };
  }
  const chatId = getAllowedTelegramChatId();
  if (!chatId) return { delivered: false, reason: 'telegram_chat_not_configured' };

  const db = getAdminDb();
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' });
  const digestRef = db.collection('teacher_notifications').doc(`rotation_digest_${today}`);

  try {
    await digestRef.create({
      kind: 'ROTATION_DIGEST',
      channel: 'telegram',
      audience: 'DOCENTE_ONLY',
      status: 'QUEUED',
      forDate: today,
      createdAt: new Date().toISOString(),
    });
  } catch (error: any) {
    // Ya se envió hoy: la segunda corrida no vuelve a escribir en el chat.
    if (error?.code === 6 || error?.code === 'already-exists') {
      return { delivered: false, reason: 'already_sent_today' };
    }
    throw error;
  }

  try {
    const [summary, watchAlerts, coursePatterns, closingReport, teacherBacklog, answeredComments] = await Promise.all([
      buildRotationSummary(year, 7),
      buildWatchAlerts(year).catch(() => []),
      buildCoursePatterns(year).catch(() => []),
      buildClosingReport(year).catch(() => []),
      buildTeacherBacklog().catch(() => null),
      buildAnsweredComments().catch(() => []),
    ]);

    // Preguntar por UNA estudiante sin fecha de término. De a una: preguntar
    // por seis de golpe convierte el aviso en el formulario que se quiso evitar.
    let askBlock = '';
    try {
      const [roster, periods] = await Promise.all([buildActiveRoster(year), getRotationPeriods()]);
      const missing = findStudentMissingEndDate(roster, periods);
      if (missing) {
        await setPendingQuestion(missing.id, missing.name);
        askBlock = `\n\n❓ *¿Cuándo termina su rotación ${missing.name}?*\n`
          + `_Respóndeme por aquí como quieras ("el 22", "en dos semanas") y lo anoto._`;
      }
    } catch (error) {
      console.warn('No se pudo preparar la pregunta de fecha de término:', error);
    }
    // Agenda, simulaciones, exámenes y personas abandonadas: datos que ya
    // existían y que nadie auditaba.
    const watchBlock = watchAlerts.length
      ? `\n\n👀 *Vigilancia*\n${watchAlerts.map(alert => `${alert.severity === 'ALTA' ? '🔴' : '🟡'} ${alert.message}`).join('\n')}`
      : '';
    // Cuando varias cometen el mismo error, la conducta docente no es dar N
    // feedbacks individuales sino hacer una clase.
    const patternBlock = coursePatterns.length
      ? `\n\n🎓 *Patrón del curso — esto es materia de clase*\n`
        + coursePatterns.slice(0, 4).map(pattern =>
            `• *${pattern.studentCount} estudiantes*: ${COURSE_PATTERN_LABELS[pattern.type] || pattern.type}\n`
            + `   _${pattern.studentNames.slice(0, 5).join(', ')}_`,
          ).join('\n')
      : '';
    // Cierre de rotación: el momento donde más cosas quedan huérfanas.
    const closingBlock = closingReport.length ? `\n\n${formatClosingReport(closingReport)}` : '';

    // Lo que espera decisión del propio docente. Sin este recordatorio la
    // bandeja se llena, deja de mirarse, y los avisos nunca llegan a nadie.
    const backlogBlock = teacherBacklog && teacherBacklog.pending > 0
      ? `\n\n📥 *Te esperan a ti*: ${teacherBacklog.pending} hallazgo(s) sin decidir`
        + `${teacherBacklog.oldestDays > 0 ? `, el más antiguo de hace ${teacherBacklog.oldestDays} día(s)` : ''}.`
      : '';

    // Cierra el círculo del feedback: sin esto, él comenta y nunca se entera
    // de si la estudiante corrigió.
    const answeredBlock = answeredComments.length
      ? `\n\n✅ *Corrigieron lo que les comentaste*\n`
        + answeredComments.slice(0, 5).map((item: { studentName: string; section: string }) =>
            `• ${item.studentName} — ${item.section}`).join('\n')
      : '';

    await sendTelegramMessage(chatId, `${formatRotationSummary(summary, APP_BASE_URL)}${closingBlock}${watchBlock}${patternBlock}${backlogBlock}${answeredBlock}${askBlock}`, {
      inline_keyboard: [[{ text: '🔎 Abrir Bandeja Docente', url: `${APP_BASE_URL}/app/revision-docente` }]],
    });
    await digestRef.update({ status: 'DELIVERED', deliveredAt: new Date().toISOString() });
    return { delivered: true, silentStudents: summary.silentStudents };
  } catch (error: any) {
    await digestRef.update({ status: 'FAILED', error: error?.message || 'fallo de entrega' });
    return { delivered: false, reason: error?.message || 'telegram_delivery_failed' };
  }
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

  // Token corto por hallazgo: los botones de Telegram admiten 64 bytes de
  // callback_data y los IDs de hallazgo los exceden.
  const tokens = new Map<string, string>();
  await Promise.all(reviews.map(async (review: any) => {
    try {
      const ref = await db.collection('telegram_actions').add({
        reviewId: review.id,
        createdAt: new Date().toISOString(),
      });
      tokens.set(review.id, ref.id);
    } catch (error) {
      console.warn('No se pudo crear el token de acción para', review.id, error);
    }
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
      id: review.id as string,
      token: tokens.get(review.id) || '',
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
  // Estos hallazgos ya NO se le publican solos a la estudiante: esperan que el
  // docente apruebe el aviso. Si nadie los mira, la estudiante nunca se entera,
  // así que el mensaje tiene que dejar claro que están detenidos esperándolo.
  const initialLine = input.initialEvaluationMissingCreated || input.initialEvaluationInsufficientCreated
    ? `\n📋 Sin evaluación inicial: *${input.initialEvaluationMissingCreated || 0}* · línea basal insuficiente: *${input.initialEvaluationInsufficientCreated || 0}*.`
      + `\n   _Esperan tu aprobación para avisarle; no se envió nada todavía._`
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

  // Suplencias que dejaron de ser puntuales: la asignación quedó obsoleta y
  // los avisos de continuidad estaban yendo a quien ya no atiende.
  const staleLine = input.staleAssignmentCases?.length
    ? `\n\n🔄 *Asignaciones desactualizadas* (${input.staleAssignmentCases.length})\n`
      + input.staleAssignmentCases.slice(0, 5).map(item =>
          `• *${item.patientName}* figura con ${item.assignedTo}, pero las últimas `
          + `${item.sessions} sesiones las hizo ${item.actuallyTreatedBy}.`,
        ).join('\n')
      + `\n_Si ya no es suplencia, conviene reasignar desde el Panel Admin._`
    : '';

  const message = `${header}${reevaluationLine}${initialLine}${pendingLine}${llmLine}${staleLine}${caseLines}\n\n_Nada de esto llega a las estudiantes hasta que tú lo apruebes._`;

  // Un botón de aprobar y otro de descartar por caso: la decisión se toma desde
  // el celular sin abrir el navegador. Aprobar deja el texto guardado y listo;
  // no lo envía a la estudiante.
  const caseButtons = cases
    .filter((item: any) => item.token)
    .slice(0, 3)
    .map((item: any) => ([
      { text: `✅ Aprobar · ${String(item.studentName).split(' ')[0]}`, callback_data: `approve:${item.token}` },
      { text: '🗑 Descartar', callback_data: `dismiss:${item.token}` },
    ]));

  try {
    await sendTelegramMessage(chatId, message, {
      inline_keyboard: [
        ...caseButtons,
        [{ text: '🔎 Abrir Bandeja Docente', url: `${APP_BASE_URL}/app/revision-docente` }],
      ],
    });
    await notificationRef.update({ status: 'DELIVERED', deliveredAt: new Date().toISOString() });
    return { delivered: true };
  } catch (error: any) {
    await notificationRef.update({ status: 'FAILED', failedAt: new Date().toISOString(), error: error?.message || 'Telegram delivery failed' });
    throw error;
  }
}
