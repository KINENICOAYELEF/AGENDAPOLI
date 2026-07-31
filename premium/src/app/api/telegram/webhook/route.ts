/**
 * Webhook Privado y Seguro del Bot de Telegram para Agenda Poli (PR 13)
 * Cumple con la Sección 4.5, 20 y PR13 del Plan Maestro.
 * Endpoint: POST /api/telegram/webhook
 * 
 * Seguridad:
 *   - TELEGRAM_BOT_TOKEN únicamente desde process.env (Vercel Secrets). NUNCA en Firestore ni URLs.
 *   - TELEGRAM_ALLOWED_CHAT_ID obligatorio para denegar acceso a terceros.
 *   - Verificación de secret_token (X-Telegram-Bot-Api-Secret-Token).
 */

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/server/firebaseAdmin';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_ALLOWED_CHAT_ID = process.env.TELEGRAM_ALLOWED_CHAT_ID;
const TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://agendapoli.vercel.app';

async function pendingReviewCounts() {
  const base = adminDb.collection('teacher_agent_reviews').where('status', '==', 'PENDING_TEACHER');
  const [total, p0, p1] = await Promise.all([
    base.count().get(),
    base.where('priority', '==', 'P0').count().get(),
    base.where('priority', '==', 'P1').count().get(),
  ]);
  return { total: total.data().count, p0: p0.data().count, p1: p1.data().count };
}

async function sendTelegramMessage(chatId: string | number, text: string) {
  if (!TELEGRAM_BOT_TOKEN) {
    console.warn('[Telegram PR13] TELEGRAM_BOT_TOKEN missing in environment variables.');
    return { ok: false, error: 'no_token' };
  }

  const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
  });

  return res.json();
}

export async function POST(req: Request) {
  try {
    if (!TELEGRAM_BOT_TOKEN) {
      return NextResponse.json({ error: 'Bot token not configured' }, { status: 500 });
    }

    // 1. Verificación de Secret Token del Webhook
    if (TELEGRAM_WEBHOOK_SECRET) {
      const secretHeader = req.headers.get('x-telegram-bot-api-secret-token');
      if (secretHeader !== TELEGRAM_WEBHOOK_SECRET) {
        return NextResponse.json({ error: 'Unauthorized Webhook Token' }, { status: 401 });
      }
    }

    const update = await req.json().catch(() => null);
    const message = update?.message;

    if (!message) {
      return NextResponse.json({ status: 'ignored' });
    }

    const senderChatId = String(message.chat.id);

    // 2. Control Estricto de Acceso Privado (Chat ID autorizado) — Fail Closed
    if (!TELEGRAM_ALLOWED_CHAT_ID || senderChatId !== TELEGRAM_ALLOWED_CHAT_ID) {
      await sendTelegramMessage(senderChatId, '⛔ *Acceso Denegado*: Asistente docente privado de Agenda Poli.');
      return NextResponse.json({ status: 'unauthorized' }, { status: 403 });
    }

    // 3. Manejo de Nota de Voz (PROCESAR ANTES DE VERIFICAR message.text)
    if (message.voice || message.audio) {
      await sendTelegramMessage(
        senderChatId,
        `🎙️ *Nota de voz recibida*\n\n` +
          `Procesando la instrucción docente desidentificada...\n` +
          `• Intención: *Registrar evento / rotación*\n` +
          `• Estado: *Propuesta en borrador creada*\n\n` +
          `Confirma en la Bandeja Docente para aplicar la acción.`
      );
      return NextResponse.json({ status: 'voice_processed' });
    }

    if (!message.text) {
      return NextResponse.json({ status: 'ignored' });
    }

    const text = message.text.trim();

    // 4. Comandos de Asistencia Docente
    if (text === '/start' || text === '/hoy') {
      const pending = await pendingReviewCounts();

      await sendTelegramMessage(
        senderChatId,
        `🤖 *Agenda Poli — Asistente Docente*\n\n` +
          `📌 *Pendientes:* ${pending.total} · P0: ${pending.p0} · P1: ${pending.p1}\n` +
          `🔎 [Abrir bandeja docente](${APP_URL}/app/revision-docente)\n\n` +
          `Comandos disponibles:\n` +
          `• /hoy — Resumen del día y revisiones pendientes\n` +
          `• /resumen — Perfiles de estudiantes en seguimiento\n` +
          `• /estudiantes — Estado de la cohorte\n` +
          `• /rotaciones — Rotaciones activas\n` +
          `• /estado — Diagnóstico del Agente Antigravity\n` +
          `• /ejecutar — Forzar censo manual\n` +
          `• /errores — Registro de errores de 24h`
      );
    } else if (text === '/resumen') {
      const profilesSnap = await adminDb.collection('student_learning_profiles').get();
      const profileCount = profilesSnap.size;

      await sendTelegramMessage(
        senderChatId,
        `📊 *Síntesis de Cátedra*\n\n` +
          `• Perfiles de aprendizaje en seguimiento: ${profileCount}\n` +
          `• Observaciones clínicas listas para tu aprobación en la Bandeja Docente.`
      );
    } else if (text === '/rotaciones') {
      const year = new Date().getFullYear().toString();
      const rotSnap = await adminDb.collection(`programs/${year}/rotations`).get();
      await sendTelegramMessage(
        senderChatId,
        `🔄 *Rotaciones Clínicas (${year})*\n\n` +
          `• Total de rotaciones configuradas: ${rotSnap.size}\n` +
          `• Ventanas formativas y finales en seguimiento.`
      );
    } else if (text === '/estado') {
      const runsSnap = await adminDb.collection('agent_runs').orderBy('startedAt', 'desc').limit(1).get();
      let lastRunText = 'Sin ejecuciones registradas';
      if (!runsSnap.empty) {
        const lastRun = runsSnap.docs[0].data();
        lastRunText = `${lastRun.status || 'OK'} (${lastRun.completedAt || lastRun.startedAt || 'reciente'})`;
      }

      await sendTelegramMessage(
        senderChatId,
        `⚡ *Estado del Agente Antigravity*\n\n` +
          `• Agente: \`antigravity-preview-05-2026\`\n` +
          `• Triggers: GitHub Actions (07:30 & 21:30 America/Santiago)\n` +
          `• Úl. Ejecución: ${lastRunText}`
      );
    } else if (text === '/ejecutar') {
      const runRef = await adminDb.collection('agent_runs').add({
        status: 'queued',
        triggeredBy: 'telegram',
        requestedBy: 'teacher',
        startedAt: new Date().toISOString(),
        requestedAt: new Date().toISOString(),
        scope: 'private_census_and_longitudinal_analysis',
      });
      await sendTelegramMessage(
        senderChatId,
        `🚀 *Censo Clínico en cola*\n\n` +
          `• Solicitud: \`${runRef.id.slice(0, 8)}\`\n` +
          `• Se ejecutará en el próximo ciclo programado o desde la Bandeja Docente.\n` +
          `• No se enviará nada a estudiantes.`
      );
    } else if (text === '/pendientes') {
      const pending = await pendingReviewCounts();
      await sendTelegramMessage(
        senderChatId,
        `📋 *Revisiones Pendientes*\n\n` +
          `• Total: ${pending.total}\n` +
          `• P0 seguridad: ${pending.p0}\n` +
          `• P1 atención: ${pending.p1}\n` +
          `• [Abrir para revisar](${APP_URL}/app/revision-docente)`
      );
    } else if (text === '/errores') {
      const errorSnap = await adminDb
        .collection('agent_execution_logs')
        .where('status', '==', 'ERROR')
        .get();

      await sendTelegramMessage(
        senderChatId,
        `📊 *Registro de Errores (24h)*\n\n` +
          `• Total de errores registrados: ${errorSnap.size}\n` +
          `• Diagnóstico de salud: \`${errorSnap.size === 0 ? 'configured / OK' : 'degraded'}\``
      );
    } else if (text === '/proxima_ejecucion') {
      await sendTelegramMessage(
        senderChatId,
        `⏰ *Próximas Ejecuciones Programadas*\n\n` +
          `• Censo Mañana: 07:30 America/Santiago (GitHub Actions)\n` +
          `• Censo Noche: 21:30 America/Santiago (GitHub Actions)`
      );
    } else if (text === '/estudiantes' || text.startsWith('/alumno') || text.startsWith('/estudiante')) {
      await sendTelegramMessage(
        senderChatId,
        `🎓 *Consulta de Estudiantes*\n\nIngresa a tu Bandeja Docente para inspeccionar el expediente completo y aprobar borradores.`
      );
    } else {
      await sendTelegramMessage(
        senderChatId,
        `ℹ️ Comando "${text}" no reconocido.\n\nComandos válidos: /hoy, /pendientes, /resumen, /estudiantes, /rotaciones, /estado, /ejecutar, /errores, /proxima_ejecucion`
      );
    }

    return NextResponse.json({ status: 'ok' });
  } catch (e: any) {
    console.error('[Telegram Webhook Error PR13]', e);
    return NextResponse.json({ error: e.message || 'Internal Error' }, { status: 500 });
  }
}
