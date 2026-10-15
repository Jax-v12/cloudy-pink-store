import type { Order, Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { paymentAdapter } from './paymentProvider';
import { logFailure } from './http';
import { applyPaymentStatus } from './payments';
import { CommerceError } from './commerce';

const RETRY_WINDOW_MS = 4 * 60_000; // Midtrans retains idempotency keys for five minutes.
const DISPATCH_LEASE_MS = 20_000; // Longer than the adapter's 15-second request timeout.
function object(value: Prisma.JsonValue | undefined): Prisma.JsonObject | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

async function saveCharge(order: Order, payment: { reference: string; qr: string }) {
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM \`Order\` WHERE id = ${order.id} FOR UPDATE`;
    const current = await tx.order.findUniqueOrThrow({ where: { id: order.id } });
    if (current.paymentReference && current.paymentReference !== payment.reference) throw new Error('PAYMENT_REFERENCE_MISMATCH');
    await tx.order.update({ where: { id: order.id }, data: { paymentReference: payment.reference, ...(current.status === 'PENDING' ? { qrisUrl: payment.qr } : {}) } });
    return current.status === 'PENDING' ? payment.qr : null;
  });
}

// Call only after invoice ownership/Origin checks. A 404 is not proof that an
// earlier POST failed: repeat only with the original key, inside its lifetime.
export async function recoverCheckoutPayment(order: Order): Promise<string | null> {
  if (order.status !== 'PENDING') return null;
  const adapter = paymentAdapter(order);
  const status = await adapter.status(order);
  if (status) {
    await applyPaymentStatus(order.id, status);
    return status.state === 'pending' ? (status.qr ?? order.qrisUrl ?? null) : null;
  }
  const dispatch = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM \`Order\` WHERE id=${order.id} FOR UPDATE`;
    const current = await tx.order.findUniqueOrThrow({ where: { id: order.id } });
    const [clock] = await tx.$queryRaw<{ now: Date }[]>`SELECT CURRENT_TIMESTAMP(3) AS now`;
    if (current.status !== 'PENDING' || current.expiresAt <= clock.now || current.paymentReference || current.qrisUrl) return null;
    const attempt = await tx.checkoutAttempt.findUnique({ where: { orderId: current.id } });
    const snapshot = object(attempt?.quoteSnapshot);
    const recovery = object(snapshot?.paymentRecovery);
    // Historical orders were dispatched without this protocol: status-only.
    if (!attempt || attempt.state !== 'COMMITTED' || !snapshot || recovery?.version !== 1) return null;
    const now = clock.now.getTime();
    const first = recovery.firstDispatchAt === undefined ? now : recovery.firstDispatchAt;
    const last = recovery.lastDispatchAt;
    if (typeof first !== 'number' || !Number.isSafeInteger(first) || first > now || now - first >= RETRY_WINDOW_MS ||
        (last !== undefined && (typeof last !== 'number' || !Number.isSafeInteger(last) || last < first || last > now))) {
      throw new CommerceError('PAYMENT_REQUIRES_REVIEW', 503);
    }
    if (typeof last === 'number' && now - last < DISPATCH_LEASE_MS) return null;
    await tx.checkoutAttempt.update({ where: { id: attempt.id }, data: {
      quoteSnapshot: { ...snapshot, paymentRecovery: { version: 1, firstDispatchAt: first, lastDispatchAt: now } },
    } });
    return { order: current, notAfter: Date.now() + RETRY_WINDOW_MS - (now - first) };
  });
  if (!dispatch) return null;
  // No provider call holds a transaction/row lock. No automatic HTTP retry.
  const payment = await adapter.create(dispatch.order, dispatch.order.customerEmail, dispatch.notAfter);
  return saveCharge(dispatch.order, payment);
}

// Only the original creator may initialize legacy payments. Login dispatch uses
// its durable recovery protocol so a process crash cannot reset the retry window.
export async function initializeCheckoutPayment(order: Order, email: string): Promise<string | null> {
  try {
    const attempt = await prisma.checkoutAttempt.findUnique({ where: { orderId: order.id } });
    if (object(object(attempt?.quoteSnapshot)?.paymentRecovery)?.version === 1) return await recoverCheckoutPayment(order);
    return await saveCharge(order, await paymentAdapter(order).create(order, email));
  } catch (error) {
    logFailure('Charge requires reconciliation', error);
    return null;
  }
}
