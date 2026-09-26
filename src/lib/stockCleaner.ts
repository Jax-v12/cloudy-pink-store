import { prisma } from '@/lib/prisma';

export async function releaseExpiredOrders(): Promise<number> {
  const now = new Date();

  // Cari semua order PENDING yang sudah melewati batas expiresAt
  const expiredOrders = await prisma.order.findMany({
    where: {
      status: 'PENDING',
      expiresAt: { lt: now },
    },
    include: {
      accountStock: true,
    },
  });

  if (expiredOrders.length === 0) {
    return 0;
  }

  for (const order of expiredOrders) {
    await prisma.$transaction(async (tx) => {
      // Ubah status order menjadi EXPIRED
      await tx.order.update({
        where: { id: order.id },
        data: { status: 'EXPIRED' },
      });

      // Kembalikan stok akun ke READY jika sebelumnya ter-LOCKED
      if (order.accountStockId) {
        await tx.accountStock.update({
          where: { id: order.accountStockId },
          data: { status: 'READY' },
        });
      }
    });
  }

  return expiredOrders.length;
}