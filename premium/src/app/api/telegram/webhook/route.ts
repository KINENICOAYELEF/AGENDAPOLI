/**
 * Webhook privado del asistente docente. Solo informa y crea borradores:
 * nunca modifica fichas ni contacta estudiantes.
 */
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/server/firebaseAdmin';
import {
  answerTelegramCallback,
  editTelegramMessage,
  getAllowedTelegramChatId,
  sendTelegramMessage,
  type TelegramInlineKeyboard,
} from '@/lib/server/telegram';

const TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://agendapoli.vercel.app').replace(/\/$/, '');

const teacherMenu: TelegramInlineKeyboard = {
  inline_keyboard: [
    [{ text: '📌 Hoy', callback_data: 'today' }, { text: '📋 Pendientes', callback_data: 'pending' }],
    [{ text: '🎓 Estudiantes', callback_data: 'students' }, { text: '🔄 Rotaciones', callback_data: 'rotations' }],
    [{ text: '🧠 Resumen', callback_data: 'summary' }, { text: '⚡ Estado IA', callback_data: 'status' }],
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
    '/ejecutar': 'run', '/errores': 'errors', '/proxima_ejecucion': 'next_run',
  };
  if (commands[value]) return commands[value];
  if (value.startsWith('/alumno') || value.startsWith('/estudiante')) return 'students';
  return 'unknown';
}

async function pendingReviewCounts() {
  const base = adminDb.collection('teacher_agent_reviews').where('status', '==', 'PENDING_TEACHER');
  const [total, p0, p1] = await Promise.all([
    base.count().get(),
    base.where('priority', '==', 'P0').count().get(),
    base.where('priority', '==', 'P1').count().get(),
  ]);
  return { total: total.data().count, p0: p0.data().count, p1: p1.data().count };
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
      await adminDb.collection('telegram_intake_requests').add({
        kind: message.voice ? 'VOICE_NOTE' : 'AUDIO_FILE',
        status: 'RECEIVED_NOT_TRANSCRIBED',
        chatId: senderChatId,
        telegramMessageId: message.message_id || null,
        receivedAt: new Date().toISOString(),
      });
      await sendOrUpdate(
        senderChatId,
        `🎙️ *Nota de voz recibida*\n\nQuedó registrada de forma privada. Aún no se transcribe ni ejecuta acciones; no se modificó ninguna ficha, rotación ni evaluación.`,
      );
      return NextResponse.json({ status: 'voice_received_pending_transcription' });
    }

    if (!callback && !message?.text) return NextResponse.json({ status: 'ignored' });
    if (callback?.id) await answerTelegramCallback(callback.id);
    const command = callback?.data || normalizeCommand(message?.text || '');

    if (command === 'home' || command === 'today') {
      const pending = await pendingReviewCounts();
      await sendOrUpdate(senderChatId, `🤖 *Agenda Poli — Asistente Docente*\n\n📌 Pendientes: *${pending.total}*\n🔴 P0 seguridad: *${pending.p0}* · 🟠 P1 atención: *${pending.p1}*\n\nElige una opción del menú.`, callback);
    } else if (command === 'pending') {
      const pending = await pendingReviewCounts();
      await sendOrUpdate(senderChatId, `📋 *Revisiones pendientes*\n\n• Total: *${pending.total}*\n• P0 seguridad: *${pending.p0}*\n• P1 atención: *${pending.p1}*`, callback);
    } else if (command === 'summary') {
      const profilesSnap = await adminDb.collection('student_learning_profiles').get();
      await sendOrUpdate(senderChatId, `🧠 *Síntesis de cátedra*\n\n• Perfiles en seguimiento: *${profilesSnap.size}*\n• Los hallazgos quedan privados hasta tu revisión.`, callback);
    } else if (command === 'students') {
      await sendOrUpdate(senderChatId, `🎓 *Estudiantes*\n\nDesde la Bandeja Docente puedes revisar expediente, evidencia y borradores antes de aprobarlos.`, callback);
    } else if (command === 'rotations') {
      const year = new Date().getFullYear().toString();
      const rotSnap = await adminDb.collection(`programs/${year}/rotations`).get();
      await sendOrUpdate(senderChatId, `🔄 *Rotaciones clínicas ${year}*\n\n• Configuradas: *${rotSnap.size}*\n• Las ventanas formativas y finales se revisan desde Rotaciones Clínicas.`, callback);
    } else if (command === 'status') {
      const runsSnap = await adminDb.collection('agent_runs').orderBy('startedAt', 'desc').limit(1).get();
      const lastRun = runsSnap.empty ? null : runsSnap.docs[0].data();
      const lastRunText = lastRun ? `${lastRun.status || 'OK'} (${lastRun.finishedAt || lastRun.startedAt || 'reciente'})` : 'Sin ejecuciones registradas';
      await sendOrUpdate(senderChatId, `⚡ *Estado del Agente Antigravity*\n\n• Versión: \`antigravity-preview-05-2026\`\n• Ciclos: 07:30 y 21:30 (America/Santiago)\n• Última ejecución: ${lastRunText}`, callback);
    } else if (command === 'run') {
      const runRef = await adminDb.collection('agent_runs').add({
        status: 'queued', triggeredBy: 'telegram', requestedBy: 'teacher',
        requestedAt: new Date().toISOString(), scope: 'private_census_and_longitudinal_analysis',
      });
      await sendOrUpdate(senderChatId, `⏳ *Solicitud de censo registrada*\n\n• Solicitud: \`${runRef.id.slice(0, 8)}\`\n• Se procesará en el próximo ciclo programado.\n• No se enviará nada a estudiantes.`, callback);
    } else if (command === 'errors') {
      const errorSnap = await adminDb.collection('agent_execution_logs').where('status', '==', 'ERROR').get();
      await sendOrUpdate(senderChatId, `🛠 *Registro de errores*\n\n• Total registrado: *${errorSnap.size}*\n• Estado: \`${errorSnap.size === 0 ? 'configured / OK' : 'requiere revisión'}\``, callback);
    } else if (command === 'next_run') {
      await sendOrUpdate(senderChatId, `⏰ *Próximos ciclos*\n\n• 07:30 America/Santiago\n• 21:30 America/Santiago`, callback);
    } else {
      await sendOrUpdate(senderChatId, 'ℹ️ No reconocí esa opción. Usa los botones de abajo o escribe /hoy para volver al inicio.', callback);
    }

    return NextResponse.json({ status: 'ok' });
  } catch (error: any) {
    console.error('[Telegram Webhook Error]', error);
    return NextResponse.json({ error: error?.message || 'Internal Error' }, { status: 500 });
  }
}
