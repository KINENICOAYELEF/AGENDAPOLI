type TelegramResponse<T> = {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
};

type WebhookInfo = {
  url?: string;
  has_custom_certificate?: boolean;
  pending_update_count?: number;
  last_error_date?: number;
  last_error_message?: string;
  max_connections?: number;
  allowed_updates?: string[];
};

export type TelegramInlineKeyboard = {
  inline_keyboard: Array<Array<{
    text: string;
    callback_data?: string;
    url?: string;
  }>>;
};

const appUrl = () => (process.env.NEXT_PUBLIC_APP_URL || 'https://agendapoli.vercel.app').replace(/\/$/, '');
const expectedWebhookUrl = () => `${appUrl()}/api/telegram/webhook`;

function config() {
  return {
    token: process.env.TELEGRAM_BOT_TOKEN,
    allowedChatId: process.env.TELEGRAM_ALLOWED_CHAT_ID,
    webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET,
  };
}

async function telegramApi<T>(method: string, body?: Record<string, unknown>): Promise<T> {
  const { token } = config();
  if (!token) throw new Error('Telegram no tiene TELEGRAM_BOT_TOKEN configurado.');

  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => null) as TelegramResponse<T> | null;

  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.description || `Telegram rechazó ${method} (HTTP ${response.status}).`);
  }
  return payload.result as T;
}

export type TelegramWebhookStatus = {
  enabled: boolean;
  expectedWebhookUrl: string;
  configuredWebhookUrl?: string;
  isWebhookConnected: boolean;
  menuReady: boolean;
  securityReady: boolean;
  missing: string[];
  pendingUpdates?: number;
  lastError?: string;
  lastErrorAt?: string;
  detail?: string;
};

export async function getTelegramWebhookStatus(): Promise<TelegramWebhookStatus> {
  const { token, allowedChatId, webhookSecret } = config();
  const missing = [
    !token && 'TELEGRAM_BOT_TOKEN',
    !allowedChatId && 'TELEGRAM_ALLOWED_CHAT_ID',
    !webhookSecret && 'TELEGRAM_WEBHOOK_SECRET',
  ].filter(Boolean) as string[];

  const base = {
    enabled: Boolean(token),
    expectedWebhookUrl: expectedWebhookUrl(),
    securityReady: missing.length === 0,
    missing,
  };

  if (!token) return { ...base, isWebhookConnected: false, menuReady: false };

  try {
    const info = await telegramApi<WebhookInfo>('getWebhookInfo');
    return {
      ...base,
      configuredWebhookUrl: info.url || undefined,
      isWebhookConnected: info.url === expectedWebhookUrl(),
      menuReady: info.allowed_updates?.includes('callback_query') ?? false,
      pendingUpdates: info.pending_update_count ?? 0,
      lastError: info.last_error_message,
      lastErrorAt: info.last_error_date ? new Date(info.last_error_date * 1000).toISOString() : undefined,
    };
  } catch (error: any) {
    return {
      ...base,
      isWebhookConnected: false,
      menuReady: false,
      detail: error?.message || 'No fue posible consultar Telegram.',
    };
  }
}

export async function configureTelegramWebhook() {
  const { token, allowedChatId, webhookSecret } = config();
  if (!token || !allowedChatId || !webhookSecret) {
    throw new Error('Faltan variables de Telegram; configura token, chat autorizado y secreto antes de conectar el webhook.');
  }

  await telegramApi<boolean>('setWebhook', {
    url: expectedWebhookUrl(),
    secret_token: webhookSecret,
    allowed_updates: ['message', 'callback_query'],
    drop_pending_updates: false,
  });

  return getTelegramWebhookStatus();
}

export async function sendTelegramMessage(
  chatId: string | number,
  text: string,
  replyMarkup?: TelegramInlineKeyboard,
) {
  return telegramApi<{ message_id: number }>('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'Markdown',
    disable_web_page_preview: true,
    reply_markup: replyMarkup,
  });
}

export async function editTelegramMessage(
  chatId: string | number,
  messageId: number,
  text: string,
  replyMarkup?: TelegramInlineKeyboard,
) {
  return telegramApi<{ message_id: number }>('editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: 'Markdown',
    disable_web_page_preview: true,
    reply_markup: replyMarkup,
  });
}

export async function answerTelegramCallback(callbackQueryId: string) {
  return telegramApi<boolean>('answerCallbackQuery', { callback_query_id: callbackQueryId });
}

export function getAllowedTelegramChatId() {
  return config().allowedChatId;
}
