import { prisma } from '@/lib/prisma';
import { getGatewayStatus } from '@/lib/midtrans';
import { applyPaymentStatus } from '@/lib/payments';
import { logFailure } from '@/lib/http';

export async function releaseExpiredOrders(): Promise<number> {
  const now = new Date();
  const orders = await prisma.order.findMany({
    where: { status: 'PENDING', expiresAt: { lt: now } },
    select: { id: true, invoice: true, totalAmount: true },
    orderBy: { expiresAt: 'asc' }, take: 20,
  });
  let released = 0;
  let failed = false;
  // Bounded concurrency keeps the cron request bounded without flooding the gateway.
  for (let offset = 0; offset < orders.length; offset += 5) {
    const results = await Promise.allSettled(orders.slice(offset, offset + 5).map(async order => {
      const status = await getGatewayStatus(order.invoice, order.totalAmount);
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
  if (failed) throw new Error('CLEANUP_REQUIRES_RETRY');
  return released;
}
