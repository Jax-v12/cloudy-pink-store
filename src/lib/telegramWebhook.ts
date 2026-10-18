import { validateOtpCode } from './appsOtp';

export interface ParsedTelegramOtpCommand {
  invoice: string;
  code: string;
}

export function parseTelegramOtpCommand(
  text: string | undefined | null,
  replyText?: string | null,
): ParsedTelegramOtpCommand | null {
  if (!text || typeof text !== 'string') return null;
  const trimmed = text.trim();

  // Pattern 1: /otp <invoice> <code>
  const fullMatch = trimmed.match(/^\/otp\s+([A-Za-z0-9_-]{4,64})\s+([A-Za-z0-9 -]{3,24})$/i);
  if (fullMatch) {
    const code = validateOtpCode(fullMatch[2]);
    if (code) {
      return { invoice: fullMatch[1].toUpperCase(), code };
    }
  }

  // Pattern 2: Replying to an alert message containing "Invoice: INV-..." with "/otp <code>" or "<code>"
  if (replyText && typeof replyText === 'string') {
    const invMatch = replyText.match(/Invoice:\s*([A-Za-z0-9_-]{4,64})/i);
    if (invMatch) {
      const invoice = invMatch[1].toUpperCase();
      const codeMatch = trimmed.match(/^(?:\/otp\s+)?([A-Za-z0-9 -]{3,24})$/i);
      if (codeMatch) {
        const code = validateOtpCode(codeMatch[1]);
        if (code) {
          return { invoice, code };
        }
      }
    }
  }

  return null;
}
