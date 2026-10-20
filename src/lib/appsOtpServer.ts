// Server-only OTP transaction service: imports Prisma. Client code must import ./appsOtp instead.
import { Prisma } from '@prisma/client';
import { CommerceError } from './commerce';
import { InputError } from './http';
import { adminMutation } from './adminMutation';
import {
  OTP_REPLY_PREFIX,
  OTP_REQUEST_ACTION,
  OTP_TTL_MS,
  encodeOtpReplyAction,
  parseOtpReplyAction,
  resolveAppsOtpState,
  validateOtpCode,
  type AppsOtpState,
} from './appsOtp';

export {
  OTP_REPLY_PREFIX,
  OTP_REQUEST_ACTION,
  OTP_TTL_MS,
  encodeOtpReplyAction,
  parseOtpReplyAction,
  resolveAppsOtpState,
  validateOtpCode,
  type AppsOtpState,
};

/** Audit filter for OTP rows; the latest row by id alone determines the current state. */
export const OTP_AUDIT_WHERE = {
  OR: [{ action: OTP_REQUEST_ACTION }, { action: { startsWith: OTP_REPLY_PREFIX } }],
};

export interface LockedOtpOrder {
  id: number;
  invoice: string;
  totalAmount: number;
  type: string;
  status: string;
  accountStockId: number | null;
  removedFromAdminAt: Date | null;
  refundStatus: string;
}

// Locking read returns the latest committed row regardless of snapshot isolation level.
async function lockOrder(tx: Prisma.TransactionClient, orderId: number): Promise<LockedOtpOrder | null> {
  const rows = await tx.$queryRaw<LockedOtpOrder[]>`SELECT id, invoice, totalAmount, type, status, accountStockId, removedFromAdminAt, refundStatus FROM \`Order\` WHERE id = ${orderId} FOR UPDATE`;
  return rows[0] ?? null;
}

export function otpEligible(order: LockedOtpOrder | null | undefined): order is LockedOtpOrder {
  return Boolean(
    order &&
      order.type === 'APPS' &&
      order.status === 'PAID' &&
      order.accountStockId !== null &&
      order.removedFromAdminAt === null &&
      order.refundStatus === 'NONE',
  );
}

async function latestOtpAudit(tx: Prisma.TransactionClient, orderId: number) {
  return tx.adminAudit.findFirst({
    where: { orderId, ...OTP_AUDIT_WHERE },
    orderBy: { id: 'desc' },
    select: { id: true, action: true, createdAt: true },
  });
}

export const OTP_NOTIFY_SENT_PREFIX = 'APPS_OTP_NOTIFIED:';
export const OTP_NOTIFY_ATTEMPT_PREFIX = 'APPS_OTP_NOTIFY_TRY:';
export const OTP_NOTIFY_REJECTED_PREFIX = 'APPS_OTP_NOTIFY_REJECTED:';
export const OTP_MAX_NOTIFY_ATTEMPTS = 3;

export interface OtpRequestResult {
  state: AppsOtpState;
  created: boolean;
  shouldNotify: boolean;
  notificationAttempt?: number;
  invoice: string;
  totalAmount: number;
}

type MutationRunner = <T>(operation: string, work: (tx: Prisma.TransactionClient) => Promise<T>) => Promise<T>;

/**
 * Customer request. A still-active request keeps the same requestId; if initial Telegram
 * notification was explicitly rejected, bounded retries are permitted for that requestId.
 */
export async function requestAppsOtp(
  orderId: number,
  now: () => number = () => Date.now(),
  runMutation: MutationRunner = adminMutation,
): Promise<OtpRequestResult> {
  return runMutation('apps-otp-request', async tx => {
    const order = await lockOrder(tx, orderId);
    if (!otpEligible(order)) throw new CommerceError('ORDER_NOT_FOUND', 404);
    const latest = await latestOtpAudit(tx, order.id);
    const current = resolveAppsOtpState(latest ? [latest] : [], false, now());
    if (current.status === 'REQUESTED' && current.requestId) {
      const requestId = current.requestId;
      const sentMarker = `${OTP_NOTIFY_SENT_PREFIX}${requestId}`;
      const alreadySent = await tx.adminAudit.findFirst({
        where: { orderId: order.id, action: sentMarker },
        select: { id: true },
      });
      if (alreadySent) {
        return {
          state: current,
          created: false,
          shouldNotify: false,
          invoice: order.invoice,
          totalAmount: order.totalAmount,
        };
      }
      for (let attempt = 1; attempt <= OTP_MAX_NOTIFY_ATTEMPTS; attempt++) {
        const tryMarker = `${OTP_NOTIFY_ATTEMPT_PREFIX}${requestId}:${attempt}`;
        const existingTry = await tx.adminAudit.findFirst({
          where: { orderId: order.id, action: tryMarker },
          select: { id: true },
        });
        if (!existingTry) {
          await tx.adminAudit.create({
            data: { orderId: order.id, sessionId: 'customer-otp', action: tryMarker },
            select: { id: true },
          });
          return {
            state: current,
            created: false,
            shouldNotify: true,
            notificationAttempt: attempt,
            invoice: order.invoice,
            totalAmount: order.totalAmount,
          };
        }
        // A durable claim without explicit rejection is in-flight or ambiguous.
        const rejected = await tx.adminAudit.findFirst({ where: { orderId: order.id, action: `${OTP_NOTIFY_REJECTED_PREFIX}${requestId}:${attempt}` }, select: { id: true } });
        if (!rejected) break;
      }
      return {
        state: current,
        created: false,
        shouldNotify: false,
        invoice: order.invoice,
        totalAmount: order.totalAmount,
      };
    }
    const audit = await tx.adminAudit.create({
      data: { orderId: order.id, sessionId: 'customer-otp', action: OTP_REQUEST_ACTION },
      select: { id: true, action: true, createdAt: true },
    });
    await tx.adminAudit.create({
      data: {
        orderId: order.id,
        sessionId: 'customer-otp',
        action: `${OTP_NOTIFY_ATTEMPT_PREFIX}${audit.id}:1`,
      },
      select: { id: true },
    });
    return {
      state: resolveAppsOtpState([audit], false, audit.createdAt.getTime()),
      created: true,
      shouldNotify: true,
      notificationAttempt: 1,
      invoice: order.invoice,
      totalAmount: order.totalAmount,
    };
  });
}

export async function markAppsOtpRejected(orderId: number, requestId: number, attempt: number, runMutation: MutationRunner = adminMutation) {
  if (!Number.isSafeInteger(requestId) || requestId <= 0 || !Number.isInteger(attempt) || attempt < 1 || attempt > OTP_MAX_NOTIFY_ATTEMPTS) return;
  await runMutation('apps-otp-notify-rejected', async tx => {
    await lockOrder(tx, orderId);
    const claim = await tx.adminAudit.findFirst({ where: { orderId, action: `${OTP_NOTIFY_ATTEMPT_PREFIX}${requestId}:${attempt}` }, select: { id: true } });
    if (!claim) return;
    const action = `${OTP_NOTIFY_REJECTED_PREFIX}${requestId}:${attempt}`;
    if (!await tx.adminAudit.findFirst({ where: { orderId, action }, select: { id: true } })) await tx.adminAudit.create({ data: { orderId, sessionId: 'customer-otp', action }, select: { id: true } });
  });
}

/** Records that the Telegram notification for a specific requestId was delivered. */
export async function markAppsOtpNotified(
  orderId: number,
  requestId: number,
  runMutation: MutationRunner = adminMutation,
): Promise<void> {
  if (!Number.isSafeInteger(requestId) || requestId <= 0) return;
  const sentMarker = `${OTP_NOTIFY_SENT_PREFIX}${requestId}`;
  await runMutation('apps-otp-notify-ack', async tx => {
    await lockOrder(tx, orderId);
    const existing = await tx.adminAudit.findFirst({
      where: { orderId, action: sentMarker },
      select: { id: true },
    });
    if (!existing) {
      await tx.adminAudit.create({
        data: { orderId, sessionId: 'customer-otp', action: sentMarker },
        select: { id: true },
      });
    }
  });
}

export type OtpReplyOutcome =
  | 'DELIVERED'
  | 'ALREADY_DELIVERED'
  | 'REQUEST_NOT_FOUND'
  | 'ORDER_INELIGIBLE'
  | 'REQUEST_EXPIRED'
  | 'REQUEST_SUPERSEDED'
  | 'DUPLICATE_UPDATE';

export interface OtpReplyInput {
  requestId: number;
  code: string;
  /** Audit actor: admin session id or "telegram:<userId>". */
  sessionId: string;
  /** Optional cross-check from transport (Telegram); compared case-insensitively. */
  invoice?: string;
  /** Telegram update_id for persistent, atomic dedupe. */
  telegramUpdateId?: number;
  /** Restrict to a specific order (admin web route id). */
  orderId?: number;
  /** Runs under the order lock before any write (admin session revalidation). */
  beforeWrite?: (tx: Prisma.TransactionClient) => Promise<void>;
  now?: () => number;
  runMutation?: MutationRunner;
}

export interface OtpReplyResult {
  outcome: OtpReplyOutcome;
  invoice: string | null;
  orderId: number | null;
  requestId: number;
  state: AppsOtpState | null;
}

const REJECTED: ReadonlySet<OtpReplyOutcome> = new Set([
  'REQUEST_NOT_FOUND',
  'ORDER_INELIGIBLE',
  'REQUEST_EXPIRED',
  'REQUEST_SUPERSEDED',
]);

export const isRejectedOtpReply = (outcome: OtpReplyOutcome) => REJECTED.has(outcome);

/** Single reply rule for admin web and Telegram: lock order, revalidate, bind code to an active request id. */
export async function replyAppsOtp(input: OtpReplyInput): Promise<OtpReplyResult> {
  const code = validateOtpCode(input.code);
  if (!code || !Number.isSafeInteger(input.requestId) || input.requestId <= 0) {
    throw new InputError();
  }
  const now = input.now ?? (() => Date.now());
  const runMutation = input.runMutation ?? adminMutation;
  const updateId = input.telegramUpdateId === undefined ? null : BigInt(input.telegramUpdateId);

  try {
    return await runMutation('apps-otp-reply', async tx => {
      const result = (
        outcome: OtpReplyOutcome,
        order: LockedOtpOrder | null,
        state: AppsOtpState | null = null,
      ): OtpReplyResult => ({
        outcome,
        invoice: order?.invoice ?? null,
        orderId: order?.id ?? null,
        requestId: input.requestId,
        state,
      });

      const receipt = async (r: OtpReplyResult) => {
        if (updateId !== null) {
          await tx.telegramUpdateReceipt.create({
            data: { updateId, orderId: r.orderId, requestId: r.requestId, outcome: r.outcome },
          });
        }
        return r;
      };

      // Request audits are immutable; this plain read only locates the order to lock.
      const request = await tx.adminAudit.findFirst({
        where: { id: input.requestId, action: OTP_REQUEST_ACTION },
        select: { id: true, orderId: true, createdAt: true },
      });

      if (!request || (input.orderId !== undefined && request.orderId !== input.orderId)) {
        if (updateId !== null && (await tx.telegramUpdateReceipt.findUnique({ where: { updateId } }))) {
          return result('DUPLICATE_UPDATE', null);
        }
        return receipt(result('REQUEST_NOT_FOUND', null));
      }

      const order = await lockOrder(tx, request.orderId);

      // Same update always maps to the same order, so this check is serialized by the lock.
      if (updateId !== null) {
        const prior = await tx.telegramUpdateReceipt.findUnique({ where: { updateId } });
        if (prior) return result('DUPLICATE_UPDATE', order);
      }

      await input.beforeWrite?.(tx);

      if (input.invoice !== undefined && (!order || order.invoice.toLowerCase() !== input.invoice.toLowerCase())) {
        return receipt(result('REQUEST_NOT_FOUND', null));
      }

      if (!otpEligible(order)) {
        return receipt(result('ORDER_INELIGIBLE', order));
      }

      const latest = await latestOtpAudit(tx, order.id);

      // If this exact requestId was already answered and remains the latest OTP audit, return idempotently.
      if (
        latest &&
        latest.action !== OTP_REQUEST_ACTION &&
        parseOtpReplyAction(latest.action)?.requestId === input.requestId
      ) {
        return receipt(result('ALREADY_DELIVERED', order, resolveAppsOtpState([latest], false, now())));
      }

      if (!latest || latest.id !== input.requestId) {
        return receipt(result('REQUEST_SUPERSEDED', order));
      }

      if (now() >= latest.createdAt.getTime() + OTP_TTL_MS) {
        return receipt(result('REQUEST_EXPIRED', order));
      }

      const audit = await tx.adminAudit.create({
        data: {
          orderId: order.id,
          sessionId: input.sessionId.slice(0, 191),
          action: encodeOtpReplyAction(code, input.requestId),
        },
        select: { id: true, action: true, createdAt: true },
      });

      return receipt(result('DELIVERED', order, resolveAppsOtpState([audit], false, audit.createdAt.getTime())));
    });
  } catch (error) {
    const codeErr = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
    if (updateId !== null && codeErr === 'P2002') {
      return { outcome: 'DUPLICATE_UPDATE', invoice: null, orderId: null, requestId: input.requestId, state: null };
    }
    throw error;
  }
}
