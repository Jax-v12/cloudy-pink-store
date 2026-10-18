// Pure OTP helpers and DTO types. Never import Prisma here so Client Components
// and isolated unit tests can import this module without database side effects.
import { decryptData, encryptData } from './crypto';

export const OTP_REQUEST_ACTION = 'apps-otp-request';
export const OTP_REPLY_PREFIX = 'apps-otp-reply:';
export const OTP_TTL_MS = 15 * 60 * 1000;

export interface AppsOtpState {
  status: 'IDLE' | 'REQUESTED' | 'DELIVERED';
  /** AdminAudit id of the customer request this state belongs to (null for legacy replies). */
  requestId: number | null;
  code: string | null;
  updatedAt: string | null;
  expiresAt: string | null;
}

export const IDLE_OTP_STATE: AppsOtpState = {
  status: 'IDLE',
  requestId: null,
  code: null,
  updatedAt: null,
  expiresAt: null,
};

export function validateOtpCode(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!/^[A-Za-z0-9 -]{3,24}$/.test(trimmed)) return null;
  return trimmed;
}

/**
 * Encodes an encrypted OTP reply action bound to a specific requestId when provided.
 * Format with requestId: `apps-otp-reply:r<requestId>:<iv:tag:ciphertext>`
 * Legacy format (when requestId omitted): `apps-otp-reply:<iv:tag:ciphertext>`
 */
export function encodeOtpReplyAction(code: string, requestId?: number | null): string {
  const valid = validateOtpCode(code);
  if (!valid) throw new Error('INVALID_OTP_CODE');
  if (requestId !== undefined && requestId !== null) {
    if (!Number.isSafeInteger(requestId) || requestId <= 0) {
      throw new Error('INVALID_OTP_REQUEST_ID');
    }
    return `${OTP_REPLY_PREFIX}r${requestId}:${encryptData(valid)}`;
  }
  return `${OTP_REPLY_PREFIX}${encryptData(valid)}`;
}

export function parseOtpReplyAction(action: string): { requestId: number | null; ciphertext: string } | null {
  if (!action.startsWith(OTP_REPLY_PREFIX)) return null;
  const rest = action.slice(OTP_REPLY_PREFIX.length);
  const match = /^r(\d{1,10}):(.+)$/.exec(rest);
  if (match) {
    const reqId = Number(match[1]);
    if (!Number.isSafeInteger(reqId) || reqId <= 0) return null;
    return { requestId: reqId, ciphertext: match[2] };
  }
  return { requestId: null, ciphertext: rest };
}

export interface OtpAuditEntry {
  id?: number;
  action: string;
  createdAt: Date;
}

/**
 * Resolves the current OTP state from audit rows.
 * Uses `AdminAudit.id` for deterministic event ordering when available (even when `createdAt` ties),
 * and `createdAt` for TTL calculation. State expires strictly when `now >= expiresAt`.
 */
export function resolveAppsOtpState(
  audits: ReadonlyArray<OtpAuditEntry>,
  includeCode: boolean,
  now = Date.now(),
): AppsOtpState {
  let latest: OtpAuditEntry | null = null;

  for (const entry of audits) {
    if (entry.action !== OTP_REQUEST_ACTION && !entry.action.startsWith(OTP_REPLY_PREFIX)) {
      continue;
    }
    if (!latest) {
      latest = entry;
      continue;
    }
    if (typeof entry.id === 'number' && typeof latest.id === 'number') {
      if (entry.id > latest.id) latest = entry;
    } else if (entry.createdAt.getTime() > latest.createdAt.getTime()) {
      latest = entry;
    } else if (
      entry.createdAt.getTime() === latest.createdAt.getTime() &&
      entry.action.startsWith(OTP_REPLY_PREFIX) &&
      latest.action === OTP_REQUEST_ACTION
    ) {
      latest = entry;
    }
  }

  if (!latest) return { ...IDLE_OTP_STATE };

  const expiresAtMs = latest.createdAt.getTime() + OTP_TTL_MS;
  if (now >= expiresAtMs) return { ...IDLE_OTP_STATE };

  const base = {
    updatedAt: latest.createdAt.toISOString(),
    expiresAt: new Date(expiresAtMs).toISOString(),
  };

  if (latest.action === OTP_REQUEST_ACTION) {
    return {
      status: 'REQUESTED',
      requestId: typeof latest.id === 'number' ? latest.id : null,
      code: null,
      ...base,
    };
  }

  const parsed = parseOtpReplyAction(latest.action);
  if (!parsed) return { ...IDLE_OTP_STATE };

  let code: string | null = null;
  if (includeCode) {
    try {
      code = decryptData(parsed.ciphertext);
    } catch {
      code = null;
    }
  }

  return {
    status: 'DELIVERED',
    requestId: parsed.requestId,
    code,
    ...base,
  };
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
