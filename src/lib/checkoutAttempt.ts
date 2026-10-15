import crypto from 'node:crypto';
import type { CheckoutAttempt, Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { checkoutEnabled, checkoutInput, CommerceError, requestDigest } from './commerce';
import { InputError, positiveInt } from './http';
import { CHECKOUT_SESSION_TTL_MS } from './checkoutSession';

export const ATTEMPT_TTL_MS = 30 * 60_000;
export const ATTEMPT_LEASE_MS = 60_000;
export const attemptTransaction = { isolationLevel: 'ReadCommitted', maxWait: 5000, timeout: 10000 } as const;
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export function validFlowId(value: unknown): value is string { return typeof value === 'string' && uuid.test(value); }
export type AttemptCommit = { sessionId: string; flowId: string; version: number };

export async function lockCheckoutSession(tx: Prisma.TransactionClient, sessionId: string) {
  await tx.$queryRaw`SELECT id FROM \`CheckoutSession\` WHERE id = ${sessionId} FOR UPDATE`;
  // Use DB time after waiting for locks, not a pre-wait application timestamp.
  const [clock] = await tx.$queryRaw<{ now: Date }[]>`SELECT CURRENT_TIMESTAMP(3) AS now`;
  const session = await tx.checkoutSession.findUnique({ where: { id: sessionId } });
  if (!session || session.revokedAt || session.expiresAt <= clock.now || session.createdAt.getTime() + CHECKOUT_SESSION_TTL_MS <= clock.now.getTime()) throw new CommerceError('CHECKOUT_SESSION_REQUIRED', 401);
  return clock.now;
}

async function lockAttempt(tx: Prisma.TransactionClient, sessionId: string, flowId: string) {
  if (!validFlowId(flowId)) throw new InputError();
  await tx.$queryRaw`SELECT id FROM \`CheckoutAttempt\` WHERE sessionId = ${sessionId} AND flowId = ${flowId} FOR UPDATE`;
  const attempt = await tx.checkoutAttempt.findUnique({ where: { sessionId_flowId: { sessionId, flowId } } });
  if (!attempt) throw new CommerceError('ATTEMPT_NOT_FOUND', 404);
  return attempt;
}

// Only locked recovery may establish NOT_COMMITTED. A stale PROCESSING lease is still UNKNOWN.
export function attemptDto(attempt: CheckoutAttempt, invoice?: string) {
  return { flowId: attempt.flowId, productId: attempt.productId, variantId: attempt.variantId, version: attempt.version,
    selectionLocked: attempt.requestHash !== null,
    outcome: attempt.state === 'READY' ? 'NOT_COMMITTED' : attempt.state === 'PROCESSING' ? 'UNKNOWN' : attempt.state,
    expiresAt: attempt.expiresAt, ...(invoice ? { invoice } : {}) };
}

async function recoverLocked(tx: Prisma.TransactionClient, row: CheckoutAttempt, now: Date) {
  const order = await tx.order.findUnique({ where: { checkoutKey: row.checkoutKey } });
  if (order) {
    if (row.orderId !== order.id || row.state !== 'COMMITTED') throw new CommerceError('ATTEMPT_INCONSISTENT', 503);
    return { attempt: row, order };
  }
  if (row.state === 'COMMITTED' || row.orderId !== null) throw new CommerceError('ATTEMPT_INCONSISTENT', 503);
  const leaseActive = row.state === 'PROCESSING' && row.leaseUntil && row.leaseUntil > now;
  // If finalization already holds the Session lock, we wait for it before this lookup.
  // Otherwise incrementing version permanently fences that request before declaring absence.
  if (!leaseActive && (row.state === 'PROCESSING' || (row.state === 'READY' && row.expiresAt <= now))) {
    row = await tx.checkoutAttempt.update({ where: { id: row.id }, data: {
      version: row.version + 1, state: row.expiresAt <= now ? 'EXPIRED' : 'READY', leaseUntil: null,
    } });
  }
  return { attempt: row, order: null };
}

export async function recoverLoginAttempt(sessionId: string, flowId: string) {
  return prisma.$transaction(async tx => {
    const now = await lockCheckoutSession(tx, sessionId);
    const result = await recoverLocked(tx, await lockAttempt(tx, sessionId, flowId), now);
    return attemptDto(result.attempt, result.order?.invoice);
  }, attemptTransaction);
}

export async function openLoginAttempt(sessionId: string, input: { flowId: string; productId: number; variantId: number; previousFlowId?: string }) {
  if (!validFlowId(input.flowId) || !positiveInt(input.productId) || !positiveInt(input.variantId) ||
      (input.previousFlowId !== undefined && !validFlowId(input.previousFlowId))) throw new InputError();
  return prisma.$transaction(async tx => {
    const now = await lockCheckoutSession(tx, sessionId);
    const existing = await tx.checkoutAttempt.findUnique({ where: { sessionId_flowId: { sessionId, flowId: input.flowId } } });
    if (existing) {
      if (existing.productId !== input.productId) throw new CommerceError('ATTEMPT_CONFLICT');
      const result = await recoverLocked(tx, await lockAttempt(tx, sessionId, existing.flowId), now);
      if (result.attempt.state === 'READY' && result.attempt.variantId !== input.variantId) {
        if (result.attempt.requestHash) throw new CommerceError('ATTEMPT_CONFLICT');
        await tx.$queryRaw`SELECT id FROM \`Product\` WHERE id = ${input.productId} FOR UPDATE`;
        const variant = await tx.productVariant.findFirst({ where: { id: input.variantId, productId: input.productId, active: true, method: 'LOGIN', product: { type: 'ROBLOX', active: true } } });
        if (!variant || !checkoutEnabled('ROBLOX')) throw new CommerceError('PRODUCT_UNAVAILABLE');
        result.attempt = await tx.checkoutAttempt.update({ where: { id: existing.id }, data: { variantId: input.variantId, version: result.attempt.version + 1 } });
      }
      return attemptDto(result.attempt, result.order?.invoice);
    }
    const orderBy = [{ createdAt: 'desc' as const }, { id: 'desc' as const }];
    const prior = await tx.checkoutAttempt.findFirst({ where: { sessionId, productId: input.productId, state: { in: ['READY', 'PROCESSING'] } }, orderBy })
      ?? await tx.checkoutAttempt.findFirst({ where: { sessionId, productId: input.productId }, orderBy });
    if (prior) {
      const result = await recoverLocked(tx, await lockAttempt(tx, sessionId, prior.flowId), now);
      // A stale tab cannot start a second purchase, even after the first commits.
      // New identity requires an explicit action naming the latest resolved purchase.
      if (result.attempt.state === 'READY' || result.attempt.state === 'PROCESSING' || input.previousFlowId !== prior.flowId) {
        return attemptDto(result.attempt, result.order?.invoice);
      }
    }
    await tx.$queryRaw`SELECT id FROM \`Product\` WHERE id = ${input.productId} FOR UPDATE`;
    const variant = await tx.productVariant.findFirst({ where: { id: input.variantId, productId: input.productId, active: true, method: 'LOGIN', product: { type: 'ROBLOX', active: true } } });
    if (!variant || !checkoutEnabled('ROBLOX')) throw new CommerceError('PRODUCT_UNAVAILABLE');
    const row = await tx.checkoutAttempt.create({ data: { sessionId, flowId: input.flowId, productId: input.productId,
      variantId: input.variantId, checkoutKey: crypto.randomUUID(), expiresAt: new Date(now.getTime() + ATTEMPT_TTL_MS),
      // Preserve purchase order even when two creations share the same millisecond.
      createdAt: new Date(Math.max(now.getTime(), (prior?.createdAt.getTime() ?? 0) + 1)) } });
    return attemptDto(row);
  }, attemptTransaction);
}

export async function claimLoginAttempt(sessionId: string, flowId: string, expectedVersion: number, body: Record<string, unknown>, reconfirm = false) {
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 0) throw new InputError();
  return prisma.$transaction(async tx => {
    const now = await lockCheckoutSession(tx, sessionId);
    const row = await lockAttempt(tx, sessionId, flowId);
    // Resolve committed identity before parsing a replacement quote or private draft.
    if (row.state === 'COMMITTED') {
      const result = await recoverLocked(tx, row, now);
      return { attempt: row, order: result.order, checkoutKey: row.checkoutKey, version: row.version };
    }
    if (row.state === 'EXPIRED' || row.expiresAt <= now) throw new CommerceError('ATTEMPT_EXPIRED');
    if (row.state === 'CANCELLED') throw new CommerceError('ATTEMPT_CANCELLED');
    if (row.state === 'PROCESSING') throw new CommerceError('CHECKOUT_UNKNOWN', 503);
    if (row.version !== expectedVersion) throw new CommerceError('ATTEMPT_FENCED');
    const input = checkoutInput(body);
    if (input.productId !== row.productId || input.variantId !== row.variantId) throw new CommerceError('ATTEMPT_CONFLICT');
    const hash = requestDigest(input);
    if (row.requestHash && row.requestHash !== hash && !reconfirm) throw new CommerceError('RECONFIRM_REQUIRED');
    const claimed = await tx.checkoutAttempt.update({ where: { id: row.id }, data: { state: 'PROCESSING', version: row.version + 1,
      requestHash: hash, leaseUntil: new Date(Math.min(now.getTime() + ATTEMPT_LEASE_MS, row.expiresAt.getTime())) } });
    return { attempt: claimed, order: null, checkoutKey: claimed.checkoutKey, version: claimed.version };
  }, attemptTransaction);
}

// Called before Product -> Order locks in the canonical checkout transaction.
export async function prepareAttemptCommit(tx: Prisma.TransactionClient, context: AttemptCommit, key: string, hash: string, productId: number, variantId?: number) {
  const now = await lockCheckoutSession(tx, context.sessionId);
  const row = await lockAttempt(tx, context.sessionId, context.flowId);
  if (row.state !== 'PROCESSING' || row.version !== context.version || !row.leaseUntil || row.leaseUntil <= now || row.expiresAt <= now) throw new CommerceError('ATTEMPT_FENCED');
  if (row.checkoutKey !== key || row.requestHash !== hash || row.productId !== productId || row.variantId !== variantId) throw new CommerceError('ATTEMPT_CONFLICT');
  return row;
}

// Only a known validation rejection may release a live lease early. The barrier
// still checks the Order identity and increments the fence before allowing retry.
export async function rejectLoginClaim(context: AttemptCommit) {
  return prisma.$transaction(async tx => {
    const now = await lockCheckoutSession(tx, context.sessionId);
    const row = await lockAttempt(tx, context.sessionId, context.flowId);
    if (row.state !== 'PROCESSING' || row.version !== context.version) return;
    const order = await tx.order.findUnique({ where: { checkoutKey: row.checkoutKey } });
    if (order) throw new CommerceError('ATTEMPT_INCONSISTENT', 503);
    await tx.checkoutAttempt.update({ where: { id: row.id }, data: {
      state: row.expiresAt <= now ? 'EXPIRED' : 'READY', version: row.version + 1, leaseUntil: null,
    } });
  }, attemptTransaction);
}
