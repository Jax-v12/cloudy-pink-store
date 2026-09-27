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
      // Ubah status order menjadi EXPIRED (hanya jika masih PENDING)
      const updatedOrder = await tx.order.updateMany({
        where: { id: order.id, status: 'PENDING' },
        data: { status: 'EXPIRED' },
      });

      // Kembalikan stok akun ke READY (hanya jika order berhasil diupdate dan stok masih LOCKED)
      if (updatedOrder.count > 0 && order.accountStockId) {
        await tx.accountStock.updateMany({
          where: { id: order.accountStockId, status: 'LOCKED' },
          data: { status: 'READY' },
        });
      }
    });
  }

  return expiredOrders.length;
}