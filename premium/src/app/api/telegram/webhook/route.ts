/**
 * Webhook del Bot de Telegram Independiente para Agenda Poli
 * Cumple con la Sección 4.5 y 20 del Plan Maestro.
 * Endpoint: POST /api/telegram/webhook
 * 
 * Acceso seguro restringido exclusivamente a tu chat_id de Telegram.
 */

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/server/firebaseAdmin';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_ALLOWED_CHAT_ID = process.env.TELEGRAM_ALLOWED_CHAT_ID;
const TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;

async function sendTelegramMessage(chatId: string | number, text: string) {
    if (!TELEGRAM_BOT_TOKEN) {
        console.log(`[Telegram Bot Output Mock] ChatId: ${chatId} | Text: ${text}`);
        return;
    }

    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            text,
            parse_mode: 'Markdown'
        })
    });
}

export async function POST(req: Request) {
    try {
        const secretHeader = req.headers.get('x-telegram-bot-api-secret-token');
        if (TELEGRAM_WEBHOOK_SECRET && secretHeader !== TELEGRAM_WEBHOOK_SECRET) {
            return NextResponse.json({ error: 'Unauthorized Telegram Webhook Secret' }, { status: 401 });
        }

        const update = await req.json();
        const message = update.message;

        if (!message || !message.text) {
            return NextResponse.json({ status: 'ignored_no_text' });
        }

        const senderChatId = String(message.chat.id);

        // Seguridad: Rechazar chats no autorizados
        if (TELEGRAM_ALLOWED_CHAT_ID && senderChatId !== TELEGRAM_ALLOWED_CHAT_ID) {
            await sendTelegramMessage(senderChatId, '⛔ *Acceso Denegado:* Este bot es privado para la supervisión docente de Agenda Poli.');
            return NextResponse.json({ status: 'unauthorized_chat_id' });
        }

        const text = message.text.trim();

        // Procesamiento de comandos
        if (text === '/start' || text === '/hoy') {
            const pendingSnap = await adminDb.collection('agent_reviews').where('status', '==', 'PENDIENTE').get();
            await sendTelegramMessage(senderChatId, 
                `🤖 *Agenda Poli Bot - Resumen Diario Docente*\n\n` +
                `📌 *Revisiones Pendientes:* ${pendingSnap.size}\n` +
                `Usa /resumen para la síntesis semanal o /estudiantes para consultar la cohorte.`
            );
        } else if (text === '/resumen') {
            const studentsSnap = await adminDb.collection('student_learning_profiles').get();
            await sendTelegramMessage(senderChatId,
                `📊 *Síntesis Semanal de Cátedra*\n\n` +
                `• Alumnos con perfiles activos: ${studentsSnap.size}\n` +
                `• Todas las revisiones privadas están listas en tu Bandeja Docente.`
            );
        } else if (text.startsWith('/estudiante') || text.startsWith('/alumno')) {
            await sendTelegramMessage(senderChatId,
                `🎓 *Consulta de Estudiante:* Ingresa a la Bandeja Docente en Agenda Poli para ver la ficha completa y el borrador de feedback.`
            );
        } else {
            await sendTelegramMessage(senderChatId,
                `ℹ️ *Comando recibido:* "${text}". Usa /hoy, /resumen o /estudiantes.`
            );
        }

        return NextResponse.json({ status: 'ok' });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || 'Telegram Webhook Error' }, { status: 500 });
    }
}
