import { prisma } from '@/lib/prisma';
import { paymentAdapter } from '@/lib/paymentProvider';
import { applyPaymentStatus } from '@/lib/payments';
import { logFailure } from '@/lib/http';
import type { Prisma } from '@prisma/client';

// Keep tombstones for the full session lifetime: deleting them earlier would
// allow stale tabs to reopen an expired flow or lose still-valid invoice access.
// Order-linked/committed rows remain permanent legacy-replay authorization markers.
export async function cleanupCheckoutSessions() {
  const now = new Date();
  const expiredUnusedAttempt = (clock: Date): Prisma.CheckoutAttemptWhereInput => ({
    expiresAt: { lte: clock }, state: { not: 'COMMITTED' }, orderId: null,
    OR: [{ leaseUntil: null }, { leaseUntil: { lte: clock } }],
  });
  const candidates = await prisma.checkoutSession.findMany({
    where: { expiresAt: { lte: now }, OR: [{ attempts: { none: {} } }, { attempts: { some: expiredUnusedAttempt(now) } }] },
    select: { id: true }, orderBy: { expiresAt: 'asc' }, take: 20,
  });
  const total = { sessions: 0, attempts: 0 };
  for (const candidate of candidates) {
    const removed = await prisma.$transaction(async tx => {
      // Match confirmation's Session -> Attempt order; expiry is rechecked after waiting.
      await tx.$queryRaw`SELECT id FROM \`CheckoutSession\` WHERE id = ${candidate.id} FOR UPDATE`;
      const [clock] = await tx.$queryRaw<{ now: Date }[]>`SELECT CURRENT_TIMESTAMP(3) AS now`;
      const eligible = await tx.checkoutSession.findUnique({ where: { id: candidate.id } });
      if (!eligible || eligible.expiresAt > clock.now) return { sessions: 0, attempts: 0 };
      const batch = await tx.checkoutAttempt.findMany({ where: { sessionId: candidate.id, ...expiredUnusedAttempt(clock.now) }, select: { id: true }, orderBy: { id: 'asc' }, take: 100 });
      const attempts = await tx.checkoutAttempt.deleteMany({ where: { id: { in: batch.map(row => row.id) } } });
      const sessions = await tx.checkoutSession.deleteMany({ where: { id: candidate.id, expiresAt: { lte: clock.now }, attempts: { none: {} } } });
      return { sessions: sessions.count, attempts: attempts.count };
    }, { isolationLevel: 'ReadCommitted' });
    total.sessions += removed.sessions; total.attempts += removed.attempts;
  }
  return total;
}

export async function purgeUnpaidLoginContacts() {
  const rows = await prisma.robloxOrderDetail.findMany({ where: {
    method: 'LOGIN', whatsappE164: { not: null }, order: { status: { in: ['EXPIRED', 'CANCELLED'] } },
  }, select: { orderId: true }, orderBy: { orderId: 'asc' }, take: 100 });
  for (const row of rows) await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM \`Order\` WHERE id = ${row.orderId} FOR UPDATE`;
    await tx.robloxOrderDetail.updateMany({ where: { orderId: row.orderId, method: 'LOGIN', whatsappE164: { not: null },
      order: { status: { in: ['EXPIRED', 'CANCELLED'] } } }, data: { whatsappE164: null } });
  });
}

export async function releaseExpiredOrders(): Promise<number> {
  const now = new Date();
  const orders = await prisma.order.findMany({
    where: { status: 'PENDING', expiresAt: { lt: now } },
    select: { id: true, invoice: true, totalAmount: true, currency: true, pricingRegion: true, paymentProvider: true, paymentMethod: true },
    orderBy: { expiresAt: 'asc' }, take: 20,
  });
  let released = 0;
  let failed = false;
  // Bounded concurrency keeps the cron request bounded without flooding the gateway.
  for (let offset = 0; offset < orders.length; offset += 5) {
    const results = await Promise.allSettled(orders.slice(offset, offset + 5).map(async order => {
      const status = await paymentAdapter(order).status(order);
      return applyPaymentStatus(order.id, status, now);
    }));
    for (const result of results) {
      if (result.status === 'fulfilled') {
        if (result.value === 'released') released++;
      } else {
        failed = true;
        logFailure('Expired payment reconciliation failed', result.reason);
      }
    }
  }
  await prisma.rateLimit.deleteMany({ where: { expiresAt: { lt: now } } });
  await prisma.adminSession.deleteMany({ where: { expiresAt: { lt: now } } });
  await cleanupCheckoutSessions();
  await purgeUnpaidLoginContacts();
  if (failed) throw new Error('CLEANUP_REQUIRES_RETRY');
  return released;
}
