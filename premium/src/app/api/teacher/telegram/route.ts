import { NextResponse } from 'next/server';
import { getRequestId, apiSuccess, handleApiError } from '@/lib/server/apiResponse';
import { requireTeacher } from '@/lib/server/firebaseAdmin';
import {
  configureTelegramWebhook,
  getAllowedTelegramChatId,
  getTelegramWebhookStatus,
  sendTelegramMessage,
} from '@/lib/server/telegram';

export async function GET(req: Request) {
  const requestId = getRequestId(req);
  try {
    await requireTeacher(req.headers.get('authorization'));
    return apiSuccess(await getTelegramWebhookStatus(), requestId);
  } catch (error: any) {
    return handleApiError(error, requestId);
  }
}

export async function POST(req: Request) {
  const requestId = getRequestId(req);
  try {
    await requireTeacher(req.headers.get('authorization'));
    const { action } = await req.json().catch(() => ({}));

    if (action === 'configure') {
      return apiSuccess(await configureTelegramWebhook(), requestId);
    }

    if (action === 'test') {
      const chatId = getAllowedTelegramChatId();
      if (!chatId) throw new Error('Falta TELEGRAM_ALLOWED_CHAT_ID para enviar la prueba privada.');
      await sendTelegramMessage(chatId, '✅ *Agenda Poli*: conexión de Telegram verificada. Este mensaje fue enviado desde el Panel Docente.');
      return apiSuccess({ delivered: true }, requestId);
    }

    return NextResponse.json({ ok: false, error: { code: 'INVALID_ACTION', message: 'Acción no válida.' }, requestId }, { status: 400 });
  } catch (error: any) {
    return handleApiError(error, requestId);
  }
}
