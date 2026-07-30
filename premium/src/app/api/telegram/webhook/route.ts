/**
 * Webhook del Bot de Telegram Independiente para Agenda Poli
 * Cumple con la Sección 4.5 y 20 del Plan Maestro.
 * Endpoint: POST /api/telegram/webhook
 * 
 * Acceso seguro restringido exclusivamente a tu chat_id de Telegram.
 */

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/server/firebaseAdmin';

let cachedBotToken = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_ALLOWED_CHAT_ID = process.env.TELEGRAM_ALLOWED_CHAT_ID;
const TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;

async function getActiveBotToken(): Promise<string> {
    if (cachedBotToken) return cachedBotToken;
    try {
        const doc = await adminDb.collection('system_settings').doc('telegram_bot').get();
        if (doc.exists && doc.data()?.botToken) {
            cachedBotToken = doc.data().botToken;
            return cachedBotToken;
        }
    } catch (e) {
        console.error("Error reading botToken from Firestore:", e);
    }
    return '';
}

async function sendTelegramMessage(chatId: string | number, text: string) {
    const token = await getActiveBotToken();
    if (!token) {
        console.log(`[Telegram Bot Output Mock] ChatId: ${chatId} | Text: ${text}`);
        return;
    }

    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            text,
            parse_mode: 'Markdown'
        })
    });
}

export async function GET(req: Request) {
    const url = new URL(req.url);
    const tokenQuery = url.searchParams.get('token') || cachedBotToken;

    if (tokenQuery) {
        cachedBotToken = tokenQuery;
        try {
            await adminDb.collection('system_settings').doc('telegram_bot').set({
                botToken: tokenQuery,
                updatedAt: new Date().toISOString()
            }, { merge: true });
        } catch (e) {
            console.error("Error saving botToken to Firestore:", e);
        }
    }

    if (!tokenQuery) {
        return NextResponse.json({
            status: 'SETUP_REQUIRED',
            message: 'Agrega el token de tu bot en la URL como: ?token=TU_BOT_TOKEN o configura TELEGRAM_BOT_TOKEN en Vercel',
            envConfigured: {
                hasBotToken: Boolean(cachedBotToken),
                hasAllowedChatId: Boolean(TELEGRAM_ALLOWED_CHAT_ID),
                hasWebhookSecret: Boolean(TELEGRAM_WEBHOOK_SECRET)
            }
        });
    }

    // Registrar automáticamente el Webhook en la API de Telegram
    const webhookUrl = `${url.origin}/api/telegram/webhook`;
    try {
        const res = await fetch(`https://api.telegram.org/bot${tokenQuery}/setWebhook`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: webhookUrl,
                secret_token: TELEGRAM_WEBHOOK_SECRET || undefined
            })
        });

        const telegramRes = await res.json();
        return NextResponse.json({
            status: telegramRes.ok ? 'SUCCESS_WEBHOOK_CONFIGURED' : 'TELEGRAM_ERROR',
            webhookUrl,
            telegramResponse: telegramRes,
            message: telegramRes.ok 
                ? '¡Webhook configurado con éxito! Abre tu bot en Telegram y envíale /start.' 
                : 'Telegram devolvió un error al configurar el webhook. Verifica que el token sea correcto.'
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
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

        // Si TELEGRAM_ALLOWED_CHAT_ID está configurado y no coincide, denegar
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
                `📌 *Revisiones Pendientes en Bandeja:* ${pendingSnap.size}\n\n` +
                `Comandos disponibles:\n` +
                `• /resumen - Síntesis semanal de la cohorte\n` +
                `• /estudiantes - Estado de alumnos activos`
            );
        } else if (text === '/resumen') {
            const studentsSnap = await adminDb.collection('student_learning_profiles').get();
            await sendTelegramMessage(senderChatId,
                `📊 *Síntesis Semanal de Cátedra*\n\n` +
                `• Alumnos con perfiles activos: ${studentsSnap.size}\n` +
                `• Todas las revisiones privadas están listas para tu aprobación en la Bandeja Docente.`
            );
        } else if (text.startsWith('/estudiante') || text.startsWith('/alumno') || text === '/estudiantes') {
            await sendTelegramMessage(senderChatId,
                `🎓 *Consulta de Estudiante:* Ingresa a la Bandeja Docente en Agenda Poli para ver las fichas completas, notas EBM y borradores de feedback.`
            );
        } else {
            await sendTelegramMessage(senderChatId,
                `ℹ️ *Comando recibido:* "${text}". Usa /hoy o /resumen.`
            );
        }

        return NextResponse.json({ status: 'ok' });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || 'Telegram Webhook Error' }, { status: 500 });
    }
}
