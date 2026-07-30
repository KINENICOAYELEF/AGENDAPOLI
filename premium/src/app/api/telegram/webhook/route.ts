/**
 * Webhook del Bot de Telegram Independiente para Agenda Poli
 * Cumple con la Sección 4.5 y 20 del Plan Maestro.
 * Endpoint: POST /api/telegram/webhook (recibe mensajes de Telegram)
 * Endpoint: GET  /api/telegram/webhook?token=XXX (registra webhook y guarda token)
 */

import { NextResponse } from 'next/server';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const TELEGRAM_ALLOWED_CHAT_ID = process.env.TELEGRAM_ALLOWED_CHAT_ID;

// Lee el token desde Firestore (funciona en cada cold start de Vercel)
async function getBotToken(): Promise<string> {
    // 1. Primero buscar en variables de entorno (más rápido si está configurado en Vercel)
    if (process.env.TELEGRAM_BOT_TOKEN) {
        return process.env.TELEGRAM_BOT_TOKEN;
    }
    // 2. Fallback: leer de Firestore (guardado cuando se activó por URL)
    try {
        const settingsDoc = await getDoc(doc(db, 'system_settings', 'telegram_bot'));
        if (settingsDoc.exists() && settingsDoc.data()?.botToken) {
            return settingsDoc.data().botToken as string;
        }
    } catch (e) {
        console.error('[Telegram] Error leyendo token de Firestore:', e);
    }
    return '';
}

async function sendMessage(chatId: string | number, text: string) {
    const token = await getBotToken();
    if (!token) {
        console.warn('[Telegram] No se encontró token. Configura TELEGRAM_BOT_TOKEN en Vercel.');
        return { ok: false, error: 'no_token' };
    }
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' })
    });
    return res.json();
}

// GET: Guardar token en Firestore y registrar webhook automáticamente
export async function GET(req: Request) {
    const url = new URL(req.url);
    const tokenParam = url.searchParams.get('token');

    if (!tokenParam) {
        const currentToken = await getBotToken();
        return NextResponse.json({
            status: currentToken ? 'CONFIGURADO' : 'SIN_CONFIGURAR',
            message: currentToken
                ? 'El bot ya tiene un token guardado. Envíale /start en Telegram.'
                : 'Abre esta URL con ?token=TU_TOKEN para configurar el bot.',
            hasToken: Boolean(currentToken)
        });
    }

    // Guardar token en Firestore para uso futuro
    try {
        await setDoc(doc(db, 'system_settings', 'telegram_bot'), {
            botToken: tokenParam,
            updatedAt: new Date().toISOString()
        }, { merge: true });
    } catch (e) {
        console.error('[Telegram] Error guardando token en Firestore:', e);
    }

    // Registrar webhook en Telegram
    const webhookUrl = `${url.origin}/api/telegram/webhook`;
    try {
        const res = await fetch(`https://api.telegram.org/bot${tokenParam}/setWebhook`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: webhookUrl })
        });
        const telegramRes = await res.json();
        return NextResponse.json({
            status: telegramRes.ok ? 'SUCCESS_WEBHOOK_CONFIGURED' : 'TELEGRAM_ERROR',
            webhookUrl,
            telegramResponse: telegramRes,
            message: telegramRes.ok
                ? '¡Webhook configurado! Ve a Telegram y escríbele /start a tu bot.'
                : `Error de Telegram: ${telegramRes.description}`
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// POST: Recibir mensajes de Telegram y responder
export async function POST(req: Request) {
    try {
        const update = await req.json();
        const message = update.message;

        if (!message || !message.text) {
            return NextResponse.json({ status: 'ignored' });
        }

        const senderChatId = String(message.chat.id);

        // Verificar si el chat está permitido (solo tu chat personal)
        if (TELEGRAM_ALLOWED_CHAT_ID && senderChatId !== TELEGRAM_ALLOWED_CHAT_ID) {
            await sendMessage(senderChatId, '⛔ *Acceso Denegado*: Este bot es privado.');
            return NextResponse.json({ status: 'unauthorized' });
        }

        const text = message.text.trim();

        if (text === '/start' || text === '/hoy') {
            // Consultar revisiones pendientes desde Firestore
            let pendingCount = 0;
            try {
                const { collection, query, where, getDocs } = await import('firebase/firestore');
                const q = query(collection(db, 'agent_reviews'), where('status', '==', 'PENDIENTE'));
                const snap = await getDocs(q);
                pendingCount = snap.size;
            } catch (e) {
                console.error('[Telegram] Error consultando revisiones:', e);
            }

            await sendMessage(senderChatId,
                `🤖 *Agenda Poli — Asistente Docente*\n\n` +
                `📌 *Revisiones pendientes en tu Bandeja:* ${pendingCount}\n\n` +
                `Comandos disponibles:\n` +
                `• /hoy — Resumen del día\n` +
                `• /resumen — Síntesis semanal\n` +
                `• /estudiantes — Estado de la cohorte`
            );

        } else if (text === '/resumen') {
            let profileCount = 0;
            try {
                const { collection, getDocs } = await import('firebase/firestore');
                const snap = await getDocs(collection(db, 'student_learning_profiles'));
                profileCount = snap.size;
            } catch (e) {
                console.error('[Telegram] Error consultando perfiles:', e);
            }

            await sendMessage(senderChatId,
                `📊 *Síntesis Semanal de Cátedra*\n\n` +
                `• Alumnos con perfiles activos: ${profileCount}\n` +
                `• Todas las observaciones clínicas esperan tu aprobación en la Bandeja Docente de Agenda Poli.`
            );

        } else if (text === '/estudiantes' || text.startsWith('/alumno') || text.startsWith('/estudiante')) {
            await sendMessage(senderChatId,
                `🎓 *Consulta de Estudiante*\n\nIngresa a tu Bandeja Docente en Agenda Poli para ver fichas completas y borradores de feedback listos para aprobar.`
            );

        } else {
            await sendMessage(senderChatId,
                `ℹ️ Comando "${text}" no reconocido.\n\nUsa /hoy, /resumen o /estudiantes.`
            );
        }

        return NextResponse.json({ status: 'ok' });
    } catch (e: any) {
        console.error('[Telegram Webhook Error]', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
