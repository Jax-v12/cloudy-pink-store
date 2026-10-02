export async function sendTelegramNotification(message: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!token || !chatId) return;
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(5000), redirect: 'error',
      body: JSON.stringify({ chat_id: chatId, text: message }),
    });
    if (!response.ok) console.error('Telegram notification failed', response.status);
  } catch {
    // Fetch errors can include the URL, which contains the bot token.
    console.error('Telegram notification unavailable');
  }
}
