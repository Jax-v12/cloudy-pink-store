import { prisma } from '@/lib/prisma';

export async function releaseExpiredOrders(): Promise<number> {
  const now = new Date();

  const expiredOrders = await prisma.order.findMany({
    where: {
      status: 'PENDING',
      expiresAt: { lt: now },
      accountStockId: { not: null },
    },
    select: {
      id: true,
      accountStockId: true,
    },
    take: 100,
  });

  if (expiredOrders.length === 0) {
    return 0;
  }

  let releasedCount = 0;

  for (const order of expiredOrders) {
    try {
      await prisma.$transaction(async (tx) => {
        const expired = await tx.order.updateMany({
          where: { 
            id: order.id, 
            status: 'PENDING', 
            expiresAt: { lt: now }, 
            accountStockId: order.accountStockId 
          },
          data: { status: 'EXPIRED', accountStockId: null },
        });

        if (expired.count === 0 || order.accountStockId === null) return;

        const released = await tx.accountStock.updateMany({
          where: { id: order.accountStockId, status: 'LOCKED' },
          data: { status: 'READY' },
        });
        
        if (released.count !== 1) throw new Error('STOCK_STATE_CONFLICT');
        
        releasedCount++;
      });
    } catch (e) {
      console.error(`Failed to release order ${order.id}:`, e);
    }
  }

  return releasedCount;
}