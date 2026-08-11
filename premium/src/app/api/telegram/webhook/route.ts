/**
 * Webhook privado del asistente docente. Solo informa y crea borradores:
 * nunca modifica fichas ni contacta estudiantes.
 */
import { NextResponse, after } from 'next/server';
import { adminDb } from '@/lib/server/firebaseAdmin';
import {
  answerTelegramCallback,
  downloadTelegramFile,
  editTelegramMessage,
  getAllowedTelegramChatId,
  sendTelegramMessage,
  type TelegramInlineKeyboard,
} from '@/lib/server/telegram';
import { getRecentPendingReviewSummary } from '@/lib/agent/notificationTriage';
import { buildRotationSummary, formatRotationSummary } from '@/lib/agent/rotationSummary';
import { answerTeacherQuestion } from '@/lib/agent/assistant';
import { censoAsignaciones } from '@/lib/agent/clinicalQueries';
import { recordTeacherDecision } from '@/lib/agent/teacherCalibration';
import { clearPendingQuestion, getPendingQuestion, saveRotationPeriod } from '@/lib/agent/rotationPeriods';
import { buildActiveRoster, rosterInRotation } from '@/lib/agent/activeRoster';

/**
 * Interpreta una respuesta suelta del docente como la fecha de término que el
 * bot le preguntó.
 *
 * La fecha se extrae con el modelo y no con expresiones regulares porque él
 * responde como habla: "el jueves", "en dos semanas más", "22 de agosto".
 * Devuelve true si consumió el mensaje, para que no llegue también al
 * asistente y termine respondido como si fuera una consulta.
 */
/**
 * Registra varias fechas de término dichas en una sola frase.
 *
 * El docente comunica así de natural: "valentina y rocío se van este jueves,
 * además está luna, diego, mariam". Preguntarle de a una tardaría una semana en
 * completar la rotación, así que se acepta el mensaje entero.
 *
 * Los nombres se emparejan contra las internas reales; nunca se inventa una.
 */
async function tryBulkRotationDates(
  text: string,
  chatId: string,
  reply: (chatId: string, text: string) => Promise<void>,
): Promise<boolean> {
  // Solo vale la pena intentarlo si el mensaje menciona un término y a alguien.
  if (!/\b(termina|terminan|se va|se van|sale|salen|hasta|último día|ultimo dia)\b/i.test(text)) return false;

  const year = new Date().getFullYear().toString();
  const roster = await buildActiveRoster(year).catch(() => []);
  const active = rosterInRotation(roster);
  if (active.length === 0) return false;

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' });
  const parsed = await runAgentInteraction(
    `Hoy es ${today}. El docente está diciendo cuándo terminan su rotación algunas internas.

Internas reales (usa EXACTAMENTE estos identificadores):
${active.map(entry => `- ${entry.id} = ${entry.name}`).join('\n')}

Mensaje del docente: "${text}"

Devuelve SOLO un JSON con esta forma:
{"fechas":[{"id":"identificador","fecha":"AAAA-MM-DD"}]}

Reglas:
- Incluye únicamente a quienes el mensaje les asigna una fecha de término.
- Si solo se les menciona sin decir cuándo terminan, NO las incluyas.
- "este jueves" es el próximo jueves contando desde hoy.
- Si no hay ninguna fecha asignable, devuelve {"fechas":[]}.`,
    undefined,
    undefined,
    'routing',
  );

  if (parsed.status !== 'success') return false;

  let entries: Array<{ id: string; fecha: string }> = [];
  try {
    const match = String(parsed.result || '').match(/\{[\s\S]*\}/);
    entries = match ? (JSON.parse(match[0])?.fechas || []) : [];
  } catch {
    return false;
  }

  const valid = entries.filter(entry =>
    entry?.id && /^\d{4}-\d{2}-\d{2}$/.test(entry.fecha || '')
    && active.some(student => student.id === entry.id));
  if (valid.length === 0) return false;

  const byId = new Map(active.map(entry => [entry.id, entry.name]));
  await Promise.all(valid.map(entry => saveRotationPeriod(entry.id, entry.fecha, 'telegram')));
  await clearPendingQuestion();

  const lines = valid.map(entry => {
    const days = Math.ceil((new Date(entry.fecha).getTime() - Date.now()) / 86400000);
    return `• *${byId.get(entry.id)}* — ${entry.fecha}${days >= 0 ? ` (en ${days} día(s))` : ''}`;
  });

  await reply(
    chatId,
    `✅ *Fechas anotadas*\n\n${lines.join('\n')}\n\n`
    + `Te avisaré antes de que se vayan qué les queda pendiente.`,
  );
  return true;
}

async function tryAnswerRotationQuestion(
  text: string,
  chatId: string,
  reply: (chatId: string, text: string) => Promise<void>,
): Promise<boolean> {
  const pending = await getPendingQuestion();
  if (!pending) return false;

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' });
  const parsed = await runAgentInteraction(
    `Hoy es ${today}. El docente respondió a la pregunta "¿cuándo termina su rotación ${pending.studentName}?".

Su respuesta literal: "${text}"

Devuelve SOLO un JSON con esta forma exacta:
{"fecha":"AAAA-MM-DD"}

Reglas:
- Si la respuesta indica una fecha, conviértela a formato AAAA-MM-DD usando el año en curso salvo que diga otro.
- "el jueves" significa el próximo jueves a partir de hoy.
- Si la respuesta NO contiene ninguna fecha —por ejemplo es una pregunta sobre otra cosa— devuelve {"fecha":null}.`,
    undefined,
    undefined,
    'routing',
  );

  if (parsed.status !== 'success') return false;

  let fecha: string | null = null;
  try {
    const match = String(parsed.result || '').match(/\{[\s\S]*\}/);
    fecha = match ? JSON.parse(match[0])?.fecha ?? null : null;
  } catch {
    return false;
  }

  // Sin fecha reconocible, el mensaje era otra cosa: se deja pasar al asistente
  // y la pregunta sigue abierta.
  if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false;

  await saveRotationPeriod(pending.studentId, fecha, 'telegram');
  await clearPendingQuestion();

  const days = Math.ceil((new Date(fecha).getTime() - Date.now()) / 86400000);
  await reply(
    chatId,
    `✅ Anotado: *${pending.studentName}* termina el ${fecha}`
    + `${days >= 0 ? ` (en ${days} día(s))` : ' (ya pasó)'}.\n\n`
    + `Te avisaré con anticipación qué le queda pendiente antes de que se vaya.`,
  );
  return true;
}

const APP_BASE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://agendapoli.vercel.app').replace(/\/$/, '');
import { callGemini } from '@/lib/ai/geminiClient';
import { runAgentInteraction } from '@/lib/agent/client';

const TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://agendapoli.vercel.app').replace(/\/$/, '');

const teacherMenu: TelegramInlineKeyboard = {
  inline_keyboard: [
    [{ text: '📌 Hoy', callback_data: 'today' }, { text: '📋 Pendientes', callback_data: 'pending' }],
    [{ text: '🎓 Estudiantes', callback_data: 'students' }, { text: '🔄 Rotaciones', callback_data: 'rotations' }],
    [{ text: '🧠 Resumen', callback_data: 'summary' }, { text: '🗺 Quién atiende a quién', callback_data: 'assignments' }],
    [{ text: '⚡ Estado IA', callback_data: 'status' }],
    [{ text: '🧾 Líneas basales', callback_data: 'initials' }, { text: '🔁 Reevaluaciones', callback_data: 'reevaluations' }],
    [{ text: '▶️ Solicitar censo', callback_data: 'run' }, { text: '🛠 Errores', callback_data: 'errors' }],
    [{ text: '🔎 Abrir bandeja docente', url: `${APP_URL}/app/revision-docente` }],
  ],
};

function normalizeCommand(text: string) {
  const value = text.trim().toLowerCase();
  const commands: Record<string, string> = {
    '/start': 'home', '/ayuda': 'home', '/help': 'home',
    '/hoy': 'today', '/pendientes': 'pending', '/resumen': 'summary',
    '/estudiantes': 'students', '/rotaciones': 'rotations', '/estado': 'status',
    '/iniciales': 'initials', '/reevaluaciones': 'reevaluations',
    '/ejecutar': 'run', '/errores': 'errors', '/proxima_ejecucion': 'next_run',
    '/asignaciones': 'assignments', '/pacientes': 'assignments', '/censo': 'assignments',
  };
  if (commands[value]) return commands[value];
  if (value.startsWith('/alumno') || value.startsWith('/estudiante')) return 'students';
  return 'unknown';
}

function inferVoiceCommand(transcript: string) {
  const value = transcript.toLowerCase();

  // Un atajo de menú solo tiene sentido para una orden corta ("pendientes",
  // "ejecuta el censo"). Una pregunta real —"cómo va la Javiera con la señora
  // del hombro"— contiene esas mismas palabras y terminaba respondida con un
  // resumen genérico. Todo lo que parezca pregunta va al asistente.
  const looksLikeQuestion = /[?¿]/.test(transcript)
    || /\b(qu[ée]|qui[ée]n|c[oó]mo|cu[aá]l|cu[aá]nt|cu[aá]ndo|d[oó]nde|por qu[ée]|dime|cu[eé]ntame|revisa a|mira a)\b/.test(value);
  if (looksLikeQuestion || value.split(/\s+/).length > 6) return 'unknown';

  if (/\b(hoy|resumen del día|qué tengo hoy)\b/.test(value)) return 'today';
  if (/\b(pendiente|bandeja|revisiones)\b/.test(value)) return 'pending';
  if (/\b(línea basal|evaluación inicial|evaluaciones iniciales)\b/.test(value)) return 'initials';
  if (/\b(reevaluación|reevaluaciones|revaluación)\b/.test(value)) return 'reevaluations';
  if (/\b(estudiante|alumno|interno|cohorte)\b/.test(value)) return 'students';
  if (/\b(rotación|rotaciones)\b/.test(value)) return 'rotations';
  if (/\b(estado|funcionando|última ejecución)\b/.test(value)) return 'status';
  if (/\b(ejecuta|ejecutar|corre el censo|revisa ahora)\b/.test(value)) return 'run';
  if (/\b(error|errores|fallas)\b/.test(value)) return 'errors';
  return 'unknown';
}

async function sendOrUpdate(chatId: string, text: string, callback?: any) {
  const messageId = callback?.message?.message_id;
  if (!messageId) {
    await sendTelegramMessage(chatId, text, teacherMenu);
    return;
  }
  try {
    await editTelegramMessage(chatId, messageId, text, teacherMenu);
  } catch (error: any) {
    if (!String(error?.message || '').includes('message is not modified')) throw error;
  }
}

export async function POST(req: Request) {
  try {
    if (!process.env.TELEGRAM_BOT_TOKEN) {
      return NextResponse.json({ error: 'Bot token not configured' }, { status: 500 });
    }
    if (TELEGRAM_WEBHOOK_SECRET && req.headers.get('x-telegram-bot-api-secret-token') !== TELEGRAM_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized Webhook Token' }, { status: 401 });
    }

    const update = await req.json().catch(() => null);
    const callback = update?.callback_query;
    const message = update?.message;
    if (!message && !callback) return NextResponse.json({ status: 'ignored' });

    const senderChatId = String((callback?.message?.chat || message?.chat)?.id || '');
    const allowedChatId = getAllowedTelegramChatId();
    if (!allowedChatId || senderChatId !== allowedChatId) {
      if (senderChatId) await sendTelegramMessage(senderChatId, '⛔ *Acceso denegado*: este bot es privado para la supervisión docente.');
      return NextResponse.json({ status: 'unauthorized' }, { status: 403 });
    }

    if (message?.voice || message?.audio) {
      const intakeRef = await adminDb.collection('telegram_intake_requests').add({
        kind: message.voice ? 'VOICE_NOTE' : 'AUDIO_FILE',
        status: 'PROCESSING',
        chatId: senderChatId,
        telegramMessageId: message.message_id || null,
        receivedAt: new Date().toISOString(),
      });
      const fileId = message.voice?.file_id || message.audio?.file_id;
      after(async () => {
        try {
          const telegramFile = await downloadTelegramFile(fileId);
          const transcript = (await callGemini({
            systemInstruction: 'Transcribe fielmente esta nota de voz en español chileno. Corrige solo puntuación; no agregues contenido. Devuelve únicamente la transcripción.',
            userPrompt: 'Transcribe la nota de voz del docente.',
            audioData: telegramFile,
            responseMimeType: 'text/plain',
            modelId: 'gemini-2.5-flash',
            temperature: 0,
            maxOutputTokens: 1200,
          })).trim();
          const inferredCommand = inferVoiceCommand(transcript);
          await intakeRef.update({ status: 'TRANSCRIBED', transcript, inferredCommand, processedAt: new Date().toISOString() });
          if (inferredCommand !== 'unknown') {
            const commandText: Record<string, string> = {
              today: '/hoy', pending: '/pendientes', initials: '/iniciales', reevaluations: '/reevaluaciones',
              students: '/estudiantes', rotations: '/rotaciones', status: '/estado', run: '/ejecutar', errors: '/errores',
            };
            const response = await fetch(`${APP_URL}/api/telegram/webhook`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(TELEGRAM_WEBHOOK_SECRET ? { 'x-telegram-bot-api-secret-token': TELEGRAM_WEBHOOK_SECRET } : {}),
              },
              body: JSON.stringify({ message: { text: commandText[inferredCommand], chat: { id: senderChatId }, message_id: message.message_id } }),
            });
            if (!response.ok) throw new Error(`No se pudo ejecutar el comando entendido (HTTP ${response.status}).`);
            await intakeRef.update({ status: 'COMMAND_EXECUTED' });
            return;
          }
          // Antes el modelo recibía solo la transcripción, sin acceso a la base
          // de datos: por eso respondía en generalidades. Ahora consulta de
          // verdad antes de contestar.
          const year = new Date().getFullYear().toString();
          const answer = await answerTeacherQuestion(transcript, year);
          await intakeRef.update({
            status: answer.failed ? 'TRANSCRIBED_AGENT_FAILED' : 'ANSWERED',
            toolUsed: answer.toolUsed || null,
            toolArgs: answer.toolArgs || null,
          });
          await sendOrUpdate(
            senderChatId,
            `🎙️ *${transcript.slice(0, 90)}${transcript.length > 90 ? '…' : ''}*\n\n${answer.text}`
            + (answer.toolUsed ? `\n\n_Consulté: ${answer.toolUsed}_` : ''),
          );
        } catch (voiceError: any) {
          await intakeRef.update({ status: 'FAILED', error: voiceError?.message || 'voice_processing_failed', failedAt: new Date().toISOString() });
          await sendOrUpdate(senderChatId, '⚠️ No pude procesar esa nota de voz. Puedes reintentarlo o usar los botones del menú.');
        }
      });
      await sendOrUpdate(senderChatId, '🎙️ *Nota recibida*\n\nLa estoy transcribiendo y te responderé por este chat.');
      return NextResponse.json({ status: 'voice_processing_started' });
    }

    if (!callback && !message?.text) return NextResponse.json({ status: 'ignored' });
    if (callback?.id) await answerTelegramCallback(callback.id);
    const command = callback?.data || normalizeCommand(message?.text || '');

    if (command === 'home' || command === 'today') {
      const pending = await getRecentPendingReviewSummary();
      await sendOrUpdate(senderChatId, `🤖 *Agenda Poli — Asistente Docente*\n\n📌 Hallazgos accionables: *${pending.total}*\n🔴 P0 seguridad: *${pending.p0}* · 🟠 P1 atención: *${pending.p1}*\n🧾 Inicial ausente/insuficiente: *${pending.initialMissing + pending.initialInsufficient}* · 🔁 Reevaluación: *${pending.reevaluationDue}*\n\nElige una opción del menú.`, callback);
    } else if (command === 'pending') {
      const pending = await getRecentPendingReviewSummary();
      await sendOrUpdate(senderChatId, `📋 *Revisiones recientes*\n\n• Últimas ${pending.hours} h: *${pending.total}*\n• P0 seguridad: *${pending.p0}*\n• P1 atención: *${pending.p1}*`, callback);
    } else if (command === 'initials') {
      const pending = await getRecentPendingReviewSummary();
      await sendOrUpdate(senderChatId, `🧾 *Líneas basales pendientes*\n\n• Sin evaluación inicial: *${pending.initialMissing}*\n• Evaluación insuficiente: *${pending.initialInsufficient}*\n\nAcción: abre la Bandeja Docente y decide a quién publicar el aviso persistente.`, callback);
    } else if (command === 'reevaluations') {
      const pending = await getRecentPendingReviewSummary();
      await sendOrUpdate(senderChatId, `🔁 *Reevaluaciones sugeridas*\n\n• Pendientes de decisión docente: *${pending.reevaluationDue}*\n\nAcción: revisa la evidencia y publica el aviso solo si corresponde.`, callback);
    } else if (command === 'summary' || command === 'students') {
      // Estos dos comandos devolvían texto genérico sin un solo dato real.
      // Ahora entregan el estado concreto de la rotación, ordenado por urgencia.
      const year = new Date().getFullYear().toString();
      const summary = await buildRotationSummary(year, command === 'summary' ? 7 : 14);
      await sendOrUpdate(senderChatId, formatRotationSummary(summary, APP_BASE_URL), callback);
    } else if (command === 'rotations') {
      const year = new Date().getFullYear().toString();
      const rotSnap = await adminDb.collection(`programs/${year}/rotations`).get();
      await sendOrUpdate(senderChatId, `🔄 *Rotaciones clínicas ${year}*\n\n• Configuradas: *${rotSnap.size}*\n• Las ventanas formativas y finales se revisan desde Rotaciones Clínicas.`, callback);
    } else if (command === 'status') {
      const [runsSnap, deliverySnap] = await Promise.all([
        adminDb.collection('agent_runs').orderBy('startedAt', 'desc').limit(1).get(),
        adminDb.collection('teacher_notifications').orderBy('createdAt', 'desc').limit(1).get(),
      ]);
      const lastRun = runsSnap.empty ? null : runsSnap.docs[0].data();
      const lastRunText = lastRun ? `${lastRun.status || 'OK'} (${lastRun.finishedAt || lastRun.startedAt || 'reciente'})` : 'Sin ejecuciones registradas';
      const lastDelivery = deliverySnap.empty ? null : deliverySnap.docs[0].data();
      const deliveryText = lastDelivery ? `${lastDelivery.status || 'desconocido'} (${lastDelivery.deliveredAt || lastDelivery.failedAt || lastDelivery.createdAt || 'sin fecha'})` : 'Sin envíos registrados';
      const lastRunAt = new Date(lastRun?.finishedAt || lastRun?.startedAt || 0).getTime();
      const stale = !lastRunAt || Date.now() - lastRunAt > 16 * 60 * 60 * 1000;
      await sendOrUpdate(senderChatId, `⚡ *Estado del Agente Antigravity*\n\n• Versión: \`antigravity-preview-05-2026\`\n• Ciclos: 07:30 y 21:30 (America/Santiago)\n• Última ejecución: ${lastRunText}\n• Último Telegram automático: ${deliveryText}\n• Vigilancia: ${stale ? '⚠️ ejecución atrasada' : '✅ dentro de ventana'}`, callback);
    } else if (command === 'run') {
      const secret = process.env.AGENT_MCP_SECRET;
      if (!secret) throw new Error('AGENT_MCP_SECRET no está configurado para iniciar el censo.');
      const response = await fetch(`${APP_URL}/api/agent/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
        body: JSON.stringify({ triggeredBy: 'telegram', sync: false }),
      });
      const run = await response.json().catch(() => ({}));
      if (!response.ok || !run.success) throw new Error(run.error || 'No se pudo iniciar el censo.');
      await sendOrUpdate(senderChatId, `▶️ *Censo iniciado ahora*\n\n• Ejecución: \`${String(run.runId || '').slice(0, 8)}\`\n• Te avisaré por este chat si aparecen hallazgos nuevos.\n• No se enviará nada a estudiantes sin tu aprobación.`, callback);
    } else if (command === 'errors') {
      // Consultaba `agent_execution_logs`, una colección que ningún código
      // escribe: siempre informaba cero errores aunque el agente estuviera
      // fallando. Las ejecuciones reales viven en `agent_runs`.
      const cutoff = Date.now() - 24 * 60 * 60 * 1000;
      const runsSnap = await adminDb.collection('agent_runs').get();
      const recentRuns = runsSnap.docs
        .map((item: any) => ({ id: item.id, ...item.data() }))
        .filter((run: any) => new Date(run.startedAt || run.createdAt || 0).getTime() >= cutoff);
      const failedRuns = recentRuns.filter((run: any) => run.status === 'failed' || run.errorMessage);

      // Una corrida "completed" puede haber dejado la IA sin ejecutar: eso
      // también es un fallo operativo, aunque GitHub aparezca en verde.
      const withoutLlm = recentRuns.filter((run: any) => {
        const llm = run.censusResult?.llm;
        return llm && llm.enabled && llm.attempted > 0 && llm.succeeded === 0;
      });

      const detail = failedRuns.slice(0, 3)
        .map((run: any) => `  · \`${String(run.id).slice(0, 8)}\`: ${String(run.errorMessage || 'sin mensaje').slice(0, 120)}`)
        .join('\n');

      await sendOrUpdate(
        senderChatId,
        `🛠 *Registro de errores (24 h)*\n\n`
        + `• Ejecuciones: *${recentRuns.length}*\n`
        + `• Fallidas: *${failedRuns.length}*\n`
        + `• Terminaron sin análisis de IA: *${withoutLlm.length}*\n`
        + `• Estado: \`${failedRuns.length === 0 && withoutLlm.length === 0 ? 'OK' : 'requiere revisión'}\``
        + (detail ? `\n\n${detail}` : ''),
        callback,
      );
    } else if (command === 'next_run') {
      await sendOrUpdate(senderChatId, `⏰ *Próximos ciclos*\n\n• 07:30 America/Santiago\n• 21:30 America/Santiago`, callback);
    } else if (command === 'assignments') {
      // El mapa que el docente pidió: qué persona tiene cada interna, en qué
      // está y qué coherencia muestra lo que registra.
      const year = new Date().getFullYear().toString();
      const censo: any = await censoAsignaciones(year);
      const blocks = (censo.students || [])
        .filter((student: any) => student.patientCount > 0)
        .map((student: any) => {
          const patients = student.patients.slice(0, 6).map((patient: any) => {
            const silence = patient.daysSinceLastSession !== null && patient.daysSinceLastSession >= 14
              ? ` ⚠️ ${patient.daysSinceLastSession}d sin sesión`
              : '';
            return `   · ${patient.name} — ${patient.currentDiagnosis.slice(0, 90)}${silence}`;
          }).join('\n');
          const issues = student.coherenceIssues.length
            ? `\n   🚩 ${student.coherenceIssues.length} incoherencia(s) detectada(s)`
            : '';
          return `👤 *${student.name}* (${student.patientCount} persona(s))${issues}\n${patients}`;
        });
      await sendOrUpdate(
        senderChatId,
        blocks.length
          ? `🗺 *Quién atiende a quién*\n\n${blocks.join('\n\n')}\n\n_Pregúntame por cualquiera de ellas para ver el detalle._`
          : '🗺 *Quién atiende a quién*\n\nNo hay personas asignadas a estudiantes en el año activo.',
        callback,
      );
    } else if (command.startsWith('approve:') || command.startsWith('dismiss:')) {
      // Aprobar o descartar un hallazgo sin salir del chat. La decisión sigue
      // siendo del docente: el bot nunca resuelve nada por su cuenta, y aprobar
      // NO envía el texto a la estudiante — lo deja guardado y listo.
      // callback_data de Telegram admite 64 bytes y los IDs de hallazgo son más
      // largos, así que viaja un token corto que se resuelve aquí.
      const [action, token] = command.split(':');
      const tokenSnap = await adminDb.collection('telegram_actions').doc(token).get();
      const reviewId = tokenSnap.data()?.reviewId;

      if (!reviewId) {
        await sendOrUpdate(senderChatId, '⚠️ Ese botón ya expiró. Abre la bandeja docente para resolverlo.', callback);
        return NextResponse.json({ status: 'ok' });
      }

      const reviewRef = adminDb.collection('teacher_agent_reviews').doc(reviewId);
      const reviewSnap = await reviewRef.get();

      if (!reviewSnap.exists) {
        await sendOrUpdate(senderChatId, '⚠️ Ese hallazgo ya no existe. Puede que lo hayas resuelto desde la plataforma.', callback);
      } else if (reviewSnap.data()?.status !== 'PENDING_TEACHER') {
        await sendOrUpdate(senderChatId, 'ℹ️ Ese hallazgo ya fue resuelto antes. No se cambió nada.', callback);
      } else if (action === 'dismiss') {
        await reviewRef.update({ status: 'DISMISSED', reviewedAt: new Date().toISOString(), reviewedVia: 'telegram' });
        const dismissed = reviewSnap.data() || {};
        await recordTeacherDecision({
          reviewId, kind: 'DISMISSED', category: dismissed.category, priority: dismissed.priority,
          coherenceTypes: (dismissed.coherenceFindings || []).map((finding: any) => finding.type),
          via: 'telegram',
        });
        await sendOrUpdate(senderChatId, '🗑 *Hallazgo descartado.* No quedó nada pendiente ni se avisó a la estudiante.', callback);
      } else {
        const review = reviewSnap.data() || {};
        await adminDb.collection('student_message_drafts').doc(reviewId).set({
          studentId: review.studentId,
          reviewId,
          year: review.year,
          messageBody: review.draftFeedback || review.observation || '',
          priority: review.priority,
          status: 'APPROVED_BY_TEACHER',
          approvedVia: 'telegram',
          approvedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        }, { merge: true });
        await reviewRef.update({ status: 'ACCEPTED_PRIVATE', reviewedAt: new Date().toISOString(), reviewedVia: 'telegram' });
        await recordTeacherDecision({
          reviewId, kind: 'APPROVED', category: review.category, priority: review.priority,
          coherenceTypes: (review.coherenceFindings || []).map((finding: any) => finding.type),
          via: 'telegram',
        });
        await sendOrUpdate(
          senderChatId,
          '✅ *Feedback aprobado y guardado.*\n\nQueda disponible en la ficha de la estudiante para cuando quieras enviárselo. No se envió nada automáticamente.',
          callback,
        );
      }
    } else if (!callback && message?.text && await tryBulkRotationDates(message.text, senderChatId, sendOrUpdate)) {
      // Varias fechas dichas de una vez: ya quedaron guardadas.
    } else if (!callback && message?.text && await tryAnswerRotationQuestion(message.text, senderChatId, sendOrUpdate)) {
      // La respuesta se consumió como fecha de término: no pasa al asistente.
    } else if (!callback && message?.text) {
      // Cualquier cosa escrita que no sea un comando pasa al asistente, que
      // consulta la base antes de responder. Antes se devolvía "no reconocí esa
      // opción", lo que obligaba a usar el menú para todo.
      const year = new Date().getFullYear().toString();
      const answer = await answerTeacherQuestion(message.text, year);
      await sendOrUpdate(
        senderChatId,
        `${answer.text}${answer.toolUsed ? `\n\n_Consulté: ${answer.toolUsed}_` : ''}`,
      );
    } else {
      await sendOrUpdate(senderChatId, 'ℹ️ No reconocí esa opción. Usa los botones de abajo o escribe /hoy para volver al inicio.', callback);
    }

    return NextResponse.json({ status: 'ok' });
  } catch (error: any) {
    console.error('[Telegram Webhook Error]', error);
    return NextResponse.json({ error: error?.message || 'Internal Error' }, { status: 500 });
  }
}
