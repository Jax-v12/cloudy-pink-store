import { decryptData, encryptData } from './crypto';

export const OTP_REQUEST_ACTION = 'apps-otp-request';
export const OTP_REPLY_PREFIX = 'apps-otp-reply:';
export const OTP_TTL_MS = 15 * 60 * 1000;

export interface AppsOtpState {
  status: 'IDLE' | 'REQUESTED' | 'DELIVERED';
  code: string | null;
  updatedAt: string | null;
  expiresAt: string | null;
}

export function validateOtpCode(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!/^[A-Za-z0-9 -]{3,24}$/.test(trimmed)) return null;
  return trimmed;
}

export function encodeOtpReplyAction(code: string): string {
  const valid = validateOtpCode(code);
  if (!valid) throw new Error('INVALID_OTP_CODE');
  return `${OTP_REPLY_PREFIX}${encryptData(valid)}`;
}

export function resolveAppsOtpState(
  audits: ReadonlyArray<{ action: string; createdAt: Date }>,
  includeCode: boolean,
  now = Date.now(),
): AppsOtpState {
  let latestRequest: Date | null = null;
  let latestReply: { createdAt: Date; ciphertext: string } | null = null;

  for (const entry of audits) {
    if (entry.action === OTP_REQUEST_ACTION) {
      if (!latestRequest || entry.createdAt > latestRequest) {
        latestRequest = entry.createdAt;
      }
    } else if (entry.action.startsWith(OTP_REPLY_PREFIX)) {
      if (!latestReply || entry.createdAt > latestReply.createdAt) {
        latestReply = {
          createdAt: entry.createdAt,
          ciphertext: entry.action.slice(OTP_REPLY_PREFIX.length),
        };
      }
    }
  }

  if (latestReply && (!latestRequest || latestReply.createdAt >= latestRequest)) {
    const expiresAtMs = latestReply.createdAt.getTime() + OTP_TTL_MS;
    if (now <= expiresAtMs) {
      let code: string | null = null;
      if (includeCode) {
        try {
          code = decryptData(latestReply.ciphertext);
        } catch {
          code = null;
        }
      }
      return {
        status: 'DELIVERED',
        code,
        updatedAt: latestReply.createdAt.toISOString(),
        expiresAt: new Date(expiresAtMs).toISOString(),
      };
    }
  }

  if (latestRequest) {
    const expiresAtMs = latestRequest.getTime() + OTP_TTL_MS;
    if (now <= expiresAtMs) {
      return {
        status: 'REQUESTED',
        code: null,
        updatedAt: latestRequest.toISOString(),
        expiresAt: new Date(expiresAtMs).toISOString(),
      };
    }
  }

  return { status: 'IDLE', code: null, updatedAt: null, expiresAt: null };
}

export function buildAppsOtpWhatsappUrl(
  phone: string,
  invoice: string,
  productName: string,
  profileName: string | null | undefined,
  template: string,
): string {
  const profileLabel = profileName ? ` (${profileName})` : '';
  const text = template
    .replace('{invoice}', invoice)
    .replace('{product}', `${productName}${profileLabel}`);
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}
