import crypto from 'node:crypto';
import { validateOtpCode } from './appsOtp';
import type { OtpReplyOutcome } from './appsOtpServer';

export interface ParsedTelegramOtpCommand {
  invoice: string;
  requestId: number | null;
  code: string;
}

/**
 * Constant-time secret verification that safely handles different byte lengths
 * without silently trimming or normalizing secrets.
 */
export function verifyTelegramSecretToken(
  expectedSecret: string | undefined,
  headerSecret: string | null | undefined,
): boolean {
  if (typeof expectedSecret !== 'string' || expectedSecret.length === 0) return false;
  if (typeof headerSecret !== 'string' || headerSecret.length === 0) return false;
  const expectedBuf = Buffer.from(expectedSecret, 'utf8');
  const actualBuf = Buffer.from(headerSecret, 'utf8');
  const expectedHash = crypto.createHash('sha256').update(expectedBuf).digest();
  const actualHash = crypto.createHash('sha256').update(actualBuf).digest();
  const hashesMatch = crypto.timingSafeEqual(expectedHash, actualHash);
  return hashesMatch && expectedBuf.byteLength === actualBuf.byteLength;
}

export function isAuthorizedTelegramSender(
  chat: { id?: number | string; type?: string } | undefined | null,
  from: { id?: number | string; is_bot?: boolean } | undefined | null,
  adminChatId: string | undefined,
  adminUserIdsCsv?: string | undefined,
): boolean {
  if (!chat || chat.id === undefined || chat.id === null) return false;
  if (typeof adminChatId !== 'string' || !adminChatId.trim()) return false;
  const normalizedAdminChat = adminChatId.trim();
  const chatIdStr = String(chat.id);
  if (chatIdStr !== normalizedAdminChat) return false;
  if (from?.is_bot === true) return false;

  const allowedUsers = (adminUserIdsCsv || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  const isGroupChat =
    chatIdStr.startsWith('-') ||
    (typeof chat.type === 'string' && chat.type !== 'private');

  if (isGroupChat) {
    // Group membership alone is not sufficient: require explicit sender allowlist.
    if (allowedUsers.length === 0) return false;
    if (from?.id === undefined || from?.id === null) return false;
    return allowedUsers.includes(String(from.id));
  }

  // Private chat with the authorized admin chat ID:
  if (from?.id !== undefined && from?.id !== null) {
    const fromIdStr = String(from.id);
    if (allowedUsers.length > 0) {
      return allowedUsers.includes(fromIdStr) || fromIdStr === normalizedAdminChat;
    }
    return fromIdStr === normalizedAdminChat;
  }

  return true;
}

export function otpRequestNotification(invoice: string, requestId: number, totalAmount: number): string {
  return (
    `🔔 PERMINTAAN KODE OTP BARU\n` +
    `Invoice: ${invoice}\n` +
    `Req ID: #${requestId}\n` +
    `Total: ${totalAmount}\n` +
    `Status: OTP_REQUESTED\n\n` +
    `Balas pesan ini dengan:\n` +
    `/otp <kode>\n` +
    `atau ketik:\n` +
    `/otp ${invoice} #${requestId} <kode>`
  );
}

function parsePositiveRequestId(raw: string | undefined): number | null {
  if (!raw || !/^\d{1,10}$/.test(raw)) return null;
  const n = Number(raw);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

export function parseTelegramOtpCommand(
  text: string | undefined | null,
  replyText?: string | null,
): ParsedTelegramOtpCommand | null {
  if (!text || typeof text !== 'string') return null;
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 256) return null;

  // Pattern 1a: /otp <invoice> #<requestId> <code>
  const correlatedMatch = trimmed.match(
    /^\/otp\s+([A-Za-z0-9_-]{4,64})\s+#?(\d{1,10})\s+([A-Za-z0-9 -]{3,24})$/i,
  );
  if (correlatedMatch) {
    const requestId = parsePositiveRequestId(correlatedMatch[2]);
    const code = validateOtpCode(correlatedMatch[3]);
    if (requestId && code) {
      return { invoice: correlatedMatch[1].toUpperCase(), requestId, code };
    }
  }

  // Pattern 1b: /otp <invoice> <code> (without requestId; caller can check replyText or require requestId)
  const directMatch = trimmed.match(/^\/otp\s+([A-Za-z0-9_-]{4,64})\s+([A-Za-z0-9 -]{3,24})$/i);
  if (directMatch) {
    const code = validateOtpCode(directMatch[2]);
    if (code) {
      const invoice = directMatch[1].toUpperCase();
      let requestId: number | null = null;
      if (replyText && typeof replyText === 'string') {
        const replyInv = replyText.match(/Invoice:\s*([A-Za-z0-9_-]{4,64})/i)?.[1]?.toUpperCase();
        const replyReq = parsePositiveRequestId(replyText.match(/Req\s*ID:\s*#?(\d{1,10})/i)?.[1]);
        if (replyInv === invoice && replyReq) requestId = replyReq;
      }
      return { invoice, requestId, code };
    }
  }

  // Pattern 2: Replying to an alert message containing "Invoice: INV-..." (and "Req ID: #42") with "/otp <code>" or "<code>"
  if (replyText && typeof replyText === 'string') {
    const invMatch = replyText.match(/Invoice:\s*([A-Za-z0-9_-]{4,64})/i);
    if (invMatch) {
      const invoice = invMatch[1].toUpperCase();
      const reqMatch = replyText.match(/Req\s*ID:\s*#?(\d{1,10})/i);
      const requestId = parsePositiveRequestId(reqMatch?.[1]);
      const codeMatch = trimmed.match(/^(?:\/otp\s+)?([A-Za-z0-9 -]{3,24})$/i);
      if (codeMatch && !trimmed.toLowerCase().startsWith('/start') && !trimmed.toLowerCase().startsWith('/help')) {
        const code = validateOtpCode(codeMatch[1]);
        if (code) {
          return { invoice, requestId, code };
        }
      }
    }
  }

  return null;
}

/**
 * Formats a non-sensitive Telegram confirmation message.
 * NEVER echoes the OTP code, customer email, tokens, or credentials.
 */
export function formatTelegramOtpReplyMessage(
  outcome: OtpReplyOutcome,
  invoice: string,
  requestId: number,
): string {
  switch (outcome) {
    case 'DELIVERED':
    case 'ALREADY_DELIVERED':
      return `✅ Berhasil! Kode verifikasi untuk pesanan ${invoice} (Req #${requestId}) telah diteruskan ke halaman invoice pembeli.`;
    case 'REQUEST_EXPIRED':
      return `⚠️ Gagal: Permintaan OTP #${requestId} untuk pesanan ${invoice} sudah kedaluwarsa (>15 menit). Pembeli perlu meminta kode baru.`;
    case 'REQUEST_SUPERSEDED':
      return `⚠️ Gagal: Permintaan OTP #${requestId} untuk pesanan ${invoice} sudah digantikan oleh permintaan baru. Silakan balas pesan notifikasi terbaru.`;
    case 'REQUEST_NOT_FOUND':
    case 'ORDER_INELIGIBLE':
    default:
      return `❌ Gagal: Permintaan OTP #${requestId} untuk pesanan ${invoice} tidak ditemukan atau pesanan tidak memenuhi syarat.`;
  }
}
