import { prisma } from './prisma';
import { CommerceError } from './commerce';

export async function manualAction(orderId: number, sessionId: string, action: string, evidence?: string) {
  return prisma.$transaction(async tx => {
    // Serialize admin actions and legacy retention cleanup on the same order row.
    await tx.$queryRaw`SELECT id FROM \`Order\` WHERE id = ${orderId} FOR UPDATE`;
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { job: true, robloxDetail: true } });
    if (!order) throw new CommerceError('ORDER_NOT_FOUND', 404);
    const audit = () => tx.adminAudit.create({ data: { orderId, sessionId, action } });
    if (action === 'refund-required' || action === 'refund-completed') {
      if (order.refundStatus === 'COMPLETED') throw new CommerceError('INVALID_TRANSITION');
      if (order.type === 'GAME' && order.fulfillmentStatus === 'PROCESSING') throw new CommerceError('JOB_BUSY');
      if (order.status !== 'PAID' && order.refundStatus !== 'REQUIRED') throw new CommerceError('INVALID_TRANSITION');
      if (order.fulfillmentStatus === 'COMPLETED' || (action === 'refund-completed' && (order.refundStatus !== 'REQUIRED' || !evidence))) throw new CommerceError('INVALID_TRANSITION');
      if (order.job?.leaseUntil && order.job.leaseUntil > new Date()) throw new CommerceError('JOB_BUSY');
      await tx.order.update({ where: { id: orderId }, data: {
        refundStatus: action === 'refund-required' ? 'REQUIRED' : 'COMPLETED',
        refundReference: action === 'refund-completed' ? evidence : undefined,
        fulfillmentStatus: 'REQUIRES_REVIEW',
      } });
      await tx.fulfillmentJob.updateMany({ where: { orderId }, data: { leaseToken: null, leaseUntil: null } });
      if (action === 'refund-completed') {
        await tx.orderSecret.deleteMany({ where: { orderId } });
        await tx.fulfillmentJob.updateMany({ where: { orderId }, data: { completedAt: new Date() } });
      }
      await audit(); return;
    }
    if (action === 'resolve-game') {
      if (order.type !== 'GAME' || order.status !== 'PAID' || order.refundStatus !== 'NONE' || order.fulfillmentStatus !== 'REQUIRES_REVIEW' || !order.job || order.job.completedAt || !evidence) throw new CommerceError('INVALID_TRANSITION');
      await tx.order.update({ where: { id: orderId }, data: { fulfillmentStatus: 'COMPLETED' } });
      await tx.fulfillmentJob.update({ where: { orderId }, data: { completedAt: new Date(), evidence, leaseToken: null, leaseUntil: null } });
      await audit(); return;
    }
    if (order.status !== 'PAID' || order.refundStatus !== 'NONE' || order.type !== 'ROBLOX' || !order.job || order.job.completedAt) throw new CommerceError('INVALID_TRANSITION');
    if (action === 'claim') {
      if (!['QUEUED', 'PROCESSING', 'WAITING_CUSTOMER', 'REQUIRES_REVIEW'].includes(order.fulfillmentStatus)) throw new CommerceError('INVALID_TRANSITION');
      const owner = order.job.ownerSessionId && await tx.adminSession.findUnique({ where: { id: order.job.ownerSessionId } });
      if (owner && owner.expiresAt > new Date() && owner.id !== sessionId) throw new CommerceError('JOB_BUSY');
      await tx.fulfillmentJob.update({ where: { orderId }, data: { ownerSessionId: sessionId } });
      if (order.fulfillmentStatus === 'QUEUED') await tx.order.update({ where: { id: orderId }, data: { fulfillmentStatus: 'PROCESSING' } });
    } else {
      if (order.job.ownerSessionId !== sessionId) throw new CommerceError('JOB_NOT_OWNED', 403);
      const target = { waiting: 'WAITING_CUSTOMER', resume: 'PROCESSING', review: 'REQUIRES_REVIEW', complete: 'COMPLETED' }[action] as 'WAITING_CUSTOMER' | 'PROCESSING' | 'REQUIRES_REVIEW' | 'COMPLETED' | undefined;
      const from: Record<string, string[]> = { waiting: ['PROCESSING'], resume: ['WAITING_CUSTOMER', 'REQUIRES_REVIEW'], review: ['PROCESSING', 'WAITING_CUSTOMER'], complete: ['PROCESSING', 'WAITING_CUSTOMER'] };
      if (!target || !from[action]?.includes(order.fulfillmentStatus) || (action === 'complete' && !evidence?.trim())) throw new CommerceError('INVALID_TRANSITION');
      if (action === 'complete' && order.fulfillmentStatus !== 'PROCESSING' && order.fulfillmentStatus !== 'WAITING_CUSTOMER') throw new CommerceError('INVALID_TRANSITION');
      await tx.order.update({ where: { id: orderId }, data: { fulfillmentStatus: target } });
      if (action === 'complete') {
        await tx.fulfillmentJob.update({ where: { orderId }, data: { completedAt: new Date(), evidence } });
        await tx.orderSecret.deleteMany({ where: { orderId } });
      }
    }
    await audit();
  });
}
