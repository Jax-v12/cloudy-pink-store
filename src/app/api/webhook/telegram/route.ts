import { NextResponse } from 'next/server';
import { sendTelegramReply } from '@/lib/telegram';
import {
  formatTelegramOtpReplyMessage,
  isAuthorizedTelegramSender,
  parseTelegramOtpCommand,
  verifyTelegramSecretToken,
} from '@/lib/telegramWebhook';
import { replyAppsOtp } from '@/lib/appsOtpServer';
import { InputError, logFailure, privateHeaders, readJson } from '@/lib/http';

interface TelegramMessage {
  chat?: { id?: number | string; type?: string };
  from?: { id?: number | string; is_bot?: boolean };
  text?: string;
  reply_to_message?: { text?: string };
}

export async function POST(req: Request) {
  try {
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
    const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    // 1. Fail closed when required webhook authentication/configuration is absent.
    if (!secret || !adminChatId || !botToken) {
      return NextResponse.json(
        { ok: false, error: 'SERVICE_UNAVAILABLE' },
        { status: 503, headers: privateHeaders },
      );
    }

    // 2. Constant-time header token check before reading body or touching DB.
    const headerSecret = req.headers.get('x-telegram-bot-api-secret-token');
    if (!verifyTelegramSecretToken(secret, headerSecret)) {
      return NextResponse.json(
        { ok: false, error: 'UNAUTHORIZED' },
        { status: 401, headers: privateHeaders },
      );
    }

    // 3. Bounded JSON read and runtime structure validation.
    const body = await readJson(req, 16_384);
    const updateId = body.update_id;
    if (typeof updateId !== 'number' || !Number.isSafeInteger(updateId) || updateId < 0) {
      throw new InputError();
    }

    const rawMessage = body.message;
    if (!rawMessage || typeof rawMessage !== 'object' || Array.isArray(rawMessage)) {
      return NextResponse.json({ ok: true, ignored: true }, { headers: privateHeaders });
    }
    const message = rawMessage as TelegramMessage;

    if (!isAuthorizedTelegramSender(message.chat, message.from, adminChatId, process.env.TELEGRAM_ADMIN_USER_IDS)) {
      return NextResponse.json({ ok: true, ignored: true }, { headers: privateHeaders });
    }

    const chatId = String(message.chat!.id);
    const senderId = message.from?.id !== undefined ? String(message.from.id) : chatId;
    const text = typeof message.text === 'string' ? message.text.trim() : '';

    if (text === '/start' || text === '/help') {
      await sendTelegramReply(
        chatId,
        'ℹ️ *Format Perintah OTP Apps:*\n' +
          '1. Balas (Reply) langsung pesan notifikasi permintaan OTP dengan `/otp <KODE>` atau `<KODE>`\n' +
          '2. Atau ketik: `/otp <INVOICE> #<ReqID> <KODE>` (contoh: `/otp INV-20261018-001 #42 482910`)',
      );
      return NextResponse.json({ ok: true }, { headers: privateHeaders });
    }

    const replyText =
      message.reply_to_message && typeof message.reply_to_message.text === 'string'
        ? message.reply_to_message.text
        : null;

    const cmd = parseTelegramOtpCommand(text, replyText);
    if (!cmd) {
      return NextResponse.json({ ok: true, ignored: true }, { headers: privateHeaders });
    }

    // Require explicit requestId correlation so delayed/replayed commands cannot hit a newer request.
    if (cmd.requestId === null) {
      await sendTelegramReply(
        chatId,
        `⚠️ Mohon balas (Reply) langsung pesan notifikasi permintaan OTP terbaru atau sertakan nomor Req ID:\n/otp ${cmd.invoice} #<ReqID> <KODE>`,
      );
      return NextResponse.json({ ok: true, outcome: 'MISSING_REQUEST_ID' }, { headers: privateHeaders });
    }

    const result = await replyAppsOtp({
      requestId: cmd.requestId,
      code: cmd.code,
      invoice: cmd.invoice,
      telegramUpdateId: updateId,
      sessionId: `telegram:${senderId}`,
    });

    if (result.outcome === 'DUPLICATE_UPDATE') {
      return NextResponse.json({ ok: true, duplicate: true }, { headers: privateHeaders });
    }

    await sendTelegramReply(
      chatId,
      formatTelegramOtpReplyMessage(result.outcome, result.invoice ?? cmd.invoice, cmd.requestId),
    );

    return NextResponse.json({ ok: true, outcome: result.outcome }, { headers: privateHeaders });
  } catch (error) {
    if (error instanceof InputError) {
      return NextResponse.json(
        { ok: false, error: 'INVALID_INPUT' },
        { status: error.status, headers: privateHeaders },
      );
    }
    logFailure('Telegram webhook failed', error);
    return NextResponse.json(
      { ok: false, error: 'SYSTEM_ERROR' },
      { status: 500, headers: privateHeaders },
    );
  }
}
