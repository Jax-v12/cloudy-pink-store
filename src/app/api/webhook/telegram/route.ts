import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendTelegramReply } from '@/lib/telegram';
import { parseTelegramOtpCommand } from '@/lib/telegramWebhook';
import { encodeOtpReplyAction } from '@/lib/appsOtp';
import { privateHeaders, readJson } from '@/lib/http';

interface TelegramUpdate {
  message?: {
    chat?: { id: number | string };
    text?: string;
    reply_to_message?: { text?: string };
  };
}

export async function POST(req: Request) {
  try {
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (secret) {
      const headerSecret = req.headers.get('x-telegram-bot-api-secret-token');
      if (headerSecret !== secret) {
        return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401, headers: privateHeaders });
      }
    }

    const body = (await readJson(req, 16384)) as TelegramUpdate;
    const message = body?.message;
    if (!message || !message.chat) {
      return NextResponse.json({ ok: true, ignored: true }, { headers: privateHeaders });
    }

    const chatId = String(message.chat.id);
    const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
    if (!adminChatId || chatId !== String(adminChatId)) {
      // Discard messages from non-admin chats safely
      return NextResponse.json({ ok: true, ignored: true }, { headers: privateHeaders });
    }

    const text = typeof message.text === 'string' ? message.text.trim() : '';
    if (text === '/start' || text === '/help') {
      await sendTelegramReply(
        chatId,
        'ℹ️ *Format Perintah OTP:*\n' +
        '1. `/otp <INVOICE> <KODE>` (contoh: `/otp INV-20261018-001 482910`)\n' +
        '2. Atau reply langsung pesan notifikasi pesanan dengan `/otp <KODE>` atau `<KODE>`',
      );
      return NextResponse.json({ ok: true }, { headers: privateHeaders });
    }

    const replyText = typeof message.reply_to_message?.text === 'string' ? message.reply_to_message.text : null;
    const cmd = parseTelegramOtpCommand(text, replyText);
    if (!cmd) {
      // Not an OTP command, acknowledge to avoid Telegram retry loop
      return NextResponse.json({ ok: true, ignored: true }, { headers: privateHeaders });
    }

    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { invoice: cmd.invoice },
        select: { id: true, invoice: true, type: true, status: true, accountStockId: true, removedFromAdminAt: true },
      });

      if (!order || order.removedFromAdminAt || order.type !== 'APPS' || order.status !== 'PAID' || order.accountStockId === null) {
        return { ok: false as const, error: 'NOT_FOUND_OR_INELIGIBLE' as const };
      }

      await tx.$queryRaw`SELECT id FROM \`Order\` WHERE id = ${order.id} FOR UPDATE`;
      await tx.adminAudit.create({
        data: {
          orderId: order.id,
          sessionId: 'telegram-bot',
          action: encodeOtpReplyAction(cmd.code),
        },
      });

      return { ok: true as const, invoice: order.invoice };
    });

    if (!result.ok) {
      await sendTelegramReply(
        chatId,
        `❌ Gagal: Pesanan ${cmd.invoice} tidak ditemukan, belum berstatus LUNAS, atau bukan produk Apps.`,
      );
    } else {
      await sendTelegramReply(
        chatId,
        `✅ Berhasil! Kode [${cmd.code}] untuk ${result.invoice} telah dikirim ke halaman invoice pembeli.`,
      );
    }

    return NextResponse.json({ ok: true }, { headers: privateHeaders });
  } catch (error) {
    console.error('Telegram webhook processing error:', error);
    // Always return 200 OK with error payload to prevent Telegram infinite retries
    return NextResponse.json({ ok: false, error: 'INTERNAL_ERROR' }, { headers: privateHeaders });
  }
}
