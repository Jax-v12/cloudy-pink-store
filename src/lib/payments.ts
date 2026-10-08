import { prisma } from '@/lib/prisma';
import { sendTelegramNotification } from '@/lib/telegram';
import type { VerifiedPayment } from '@/lib/paymentProvider';

export async function applyPaymentStatus(id: number, status: VerifiedPayment | null, expiresBefore?: Date) {
  const state = status?.state ?? 'failed';
  const result = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM \`Order\` WHERE id = ${id} FOR UPDATE`;
    const order = await tx.order.findUnique({ where: { id } });
    if (!order) throw new Error('ORDER_NOT_FOUND');
    if (status && (order.paymentProvider !== status.provider || order.pricingRegion !== status.region || status.invoice !== order.invoice || status.amount !== order.totalAmount || status.currency !== order.currency ||
        !status.reference || (order.paymentReference && order.paymentReference !== status.reference))) throw new Error('PAYMENT_MISMATCH');
    if (status && !order.paymentReference) await tx.order.update({ where: { id }, data: { paymentReference: status.reference } });
    if (state === 'pending') return { action: 'unchanged' as const, order };
    if (order.status === 'PAID') return { action: 'unchanged' as const, order };
    if (order.status !== 'PENDING') {
      // A paid notification for a released reservation requires reconciliation.
      if (state === 'paid') {
        await tx.order.update({ where: { id }, data: { status: 'PAID', fulfillmentStatus: 'REQUIRES_REVIEW', refundStatus: 'REQUIRED' } });
        return { action: 'review' as const, order };
      }
      return { action: 'unchanged' as const, order };
    }
    if (expiresBefore && order.expiresAt >= expiresBefore) return { action: 'unchanged' as const, order };
    if (!status && !expiresBefore) throw new Error('UNCONFIRMED_EXPIRY');
    if (state === 'paid' && order.type === 'APPS' && order.accountStockId === null) throw new Error('MISSING_RESERVED_STOCK');
    const target = state === 'paid' ? 'PAID' : status?.cancelled ? 'CANCELLED' : 'EXPIRED';
    const updated = await tx.order.updateMany({
      where: { id, status: 'PENDING', accountStockId: order.accountStockId, ...(expiresBefore ? { expiresAt: { lt: expiresBefore } } : {}) },
      data: { status: target, fulfillmentStatus: state === 'paid' ? (order.type === 'APPS' ? 'COMPLETED' : 'QUEUED') : 'NOT_READY', ...(state === 'failed' ? { accountStockId: null } : {}) },
    });
    if (!updated.count) {
      // A concurrent expiry may have released the reservation after our read.
      // Retry in a fresh transaction instead of acknowledging a lost settlement.
      if (state === 'paid') throw new Error('PAYMENT_TRANSITION_CONFLICT');
      return { action: 'unchanged' as const, order };
    }
    if (order.type === 'APPS' && order.accountStockId !== null) {
      const stock = await tx.accountStock.updateMany({
        where: { id: order.accountStockId, status: 'LOCKED' },
        data: { status: state === 'paid' ? 'SOLD' : 'READY' },
      });
      if (stock.count !== 1) throw new Error('STOCK_STATE_CONFLICT');
    }
    if (state === 'paid' && order.type !== 'APPS') {
      await tx.fulfillmentJob.upsert({ where: { orderId: id }, create: { orderId: id }, update: {} });
    }
    if (state === 'failed') await tx.orderSecret.deleteMany({ where: { orderId: id } });
    return { action: state === 'paid' ? 'paid' as const : 'released' as const, order };
  });
  if (result.action === 'paid') {
    // Only fixed labels and non-sensitive invoice/amount/status metadata.
    await sendTelegramNotification(`Invoice: ${result.order.invoice}\nTotal: ${result.order.totalAmount}\nStatus: PAID`);
  }
  return result.action;
}
