type NotificationOutcome = 'SENT' | 'REJECTED' | 'UNKNOWN';

async function sendTelegramOutcome(chatId: string | number, message: string): Promise<NotificationOutcome> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !chatId) return 'REJECTED';
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(5000), redirect: 'error',
      body: JSON.stringify({ chat_id: String(chatId), text: message }),
    });
    const reader = response.body?.getReader();
    if (!reader) return 'UNKNOWN';
    let size = 0; const chunks: Uint8Array[] = [];
    try {
      for (;;) {
        const { done, value } = await reader.read(); if (done) break;
        size += value.byteLength;
        if (size > 16384) { await reader.cancel(); return 'UNKNOWN'; }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    const body: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!body || typeof body !== 'object' || !('ok' in body)) return 'UNKNOWN';
    if (response.ok && body.ok === true) return 'SENT';
    if (response.status >= 400 && response.status < 500 && response.status !== 429 && body.ok === false &&
        'error_code' in body && body.error_code === response.status) return 'REJECTED';
    return 'UNKNOWN';
  } catch {
    console.error('Telegram reply unavailable');
    return 'UNKNOWN';
  }
}

export async function sendTelegramReply(chatId: string | number, message: string): Promise<boolean> {
  return await sendTelegramOutcome(chatId, message) === 'SENT';
}

export async function sendTelegramNotificationOutcome(message: string): Promise<NotificationOutcome> {
  return sendTelegramOutcome(process.env.TELEGRAM_ADMIN_CHAT_ID || '', message);
}

export async function sendTelegramNotification(message: string): Promise<boolean> {
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!chatId) return false;
  return sendTelegramReply(chatId, message);
}
