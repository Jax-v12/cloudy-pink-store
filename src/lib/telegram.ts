export async function sendTelegramNotification(message: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;

  if (!token || !chatId) {
    console.warn('[Telegram] Token atau Chat ID belum diset di .env');
    return;
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML', // Biar bisa pakai bold atau emoji
      }),
    });

    if (!res.ok) {
      console.error('[Telegram] Gagal kirim notif:', await res.text());
    }
  } catch (error) {
    console.error('[Telegram] Error saat request ke Telegram:', error);
  }
}