export async function sendTelegramReply(chatId: string | number, message: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !chatId) return;
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(5000), redirect: 'error',
      body: JSON.stringify({ chat_id: String(chatId), text: message }),
    });
    if (!response.ok) console.error('Telegram reply failed', response.status);
  } catch {
    console.error('Telegram reply unavailable');
  }
}

export async function sendTelegramNotification(message: string) {
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!chatId) return;
  return sendTelegramReply(chatId, message);
}
