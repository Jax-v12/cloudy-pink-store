import type { Order, FulfillmentJob } from '@prisma/client';
import { adminMutation, requireCurrentSession } from './adminMutation';
import { CommerceError } from './commerce';

type ArchiveCandidate = Pick<Order, 'type' | 'status' | 'fulfillmentStatus' | 'refundStatus' | 'archivedAt'> & {
  job: Pick<FulfillmentJob, 'completedAt' | 'leaseToken' | 'leaseUntil'> | null;
  secret: { orderId: number } | null;
  accountStock: { status: string } | null;
};

export function archiveEligibility(order: ArchiveCandidate, now = new Date()) {
  const reasonCodes: string[] = [];
  if (!['ROBLOX', 'GAME'].includes(order.type)) reasonCodes.push('ORDER_TYPE_UNSUPPORTED');
  if (order.status !== 'PAID' || order.fulfillmentStatus !== 'COMPLETED') reasonCodes.push('ORDER_NOT_FINAL');
  if (order.refundStatus !== 'NONE') reasonCodes.push('ORDER_HAS_REFUND');
  if (!order.job?.completedAt) reasonCodes.push('JOB_NOT_COMPLETE');
  if (order.job?.leaseToken || (order.job?.leaseUntil && order.job.leaseUntil > now)) reasonCodes.push('JOB_BUSY');
  if (order.secret || order.accountStock?.status === 'LOCKED') reasonCodes.push('ORDER_HAS_OBLIGATIONS');
  return { canArchive: !order.archivedAt && reasonCodes.length === 0, archiveReasonCodes: reasonCodes };
}

export async function setOrderArchived(id: number, sessionId: string, archived: boolean) {
  return adminMutation('order-archive', async tx => {
    await tx.$queryRaw`SELECT id FROM \`Order\` WHERE id = ${id} FOR UPDATE`;
    await requireCurrentSession(tx, sessionId);
    const order = await tx.order.findUnique({ where: { id }, include: {
      job: { select: { completedAt: true, leaseToken: true, leaseUntil: true } },
      secret: { select: { orderId: true } }, accountStock: { select: { status: true } },
    } });
    if (!order) throw new CommerceError('ORDER_NOT_FOUND', 404);
    if (!['ROBLOX', 'GAME'].includes(order.type)) throw new CommerceError('ORDER_TYPE_UNSUPPORTED', 403);
    if (order.removedFromAdminAt) throw new CommerceError('ORDER_REMOVED');
    if (Boolean(order.archivedAt) === archived) return { id, archivedAt: order.archivedAt, changed: false };
    if (archived) {
      const eligibility = archiveEligibility(order);
      if (!eligibility.canArchive) throw new CommerceError(eligibility.archiveReasonCodes[0]);
    }
    const archivedAt = archived ? new Date() : null;
    await tx.order.update({ where: { id }, data: { archivedAt } });
    await tx.adminAudit.create({ data: { orderId: id, sessionId, action: archived ? 'archive' : 'restore' } });
    return { id, archivedAt, changed: true };
  });
}

type RemoveCandidate = ArchiveCandidate & Pick<Order, 'removedFromAdminAt'>;

export function removeEligibility(order: RemoveCandidate, now = new Date()) {
  const reasonCodes = archiveEligibility(order, now).archiveReasonCodes;
  if (!order.archivedAt) reasonCodes.push('ORDER_NOT_ARCHIVED');
  return { canRemove: !order.removedFromAdminAt && reasonCodes.length === 0, removeReasonCodes: reasonCodes };
}

export async function setOrderRemovedFromAdmin(id: number, sessionId: string, removed: boolean, confirmationInvoice?: string) {
  return adminMutation('order-remove', async tx => {
    await tx.$queryRaw`SELECT id FROM \`Order\` WHERE id = ${id} FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM \`FulfillmentJob\` WHERE orderId = ${id} FOR UPDATE`;
    // Locks may have waited: recheck expiry and the five-minute reauth window here.
    await requireCurrentSession(tx, sessionId, removed);
    const order = await tx.order.findUnique({ where: { id }, include: {
      job: { select: { completedAt: true, leaseToken: true, leaseUntil: true } },
      secret: { select: { orderId: true } }, accountStock: { select: { status: true } },
    } });
    if (!order) throw new CommerceError('ORDER_NOT_FOUND', 404);
    if (!['ROBLOX', 'GAME'].includes(order.type)) throw new CommerceError('ORDER_TYPE_UNSUPPORTED', 403);
    if (removed && confirmationInvoice !== order.invoice) throw new CommerceError('INVOICE_CONFIRMATION_MISMATCH', 400);
    if ((removed || order.removedFromAdminAt) && !order.archivedAt) throw new CommerceError('ORDER_NOT_ARCHIVED');
    if (Boolean(order.removedFromAdminAt) === removed) return { id, archivedAt: order.archivedAt, removedFromAdminAt: order.removedFromAdminAt, changed: false };
    if (removed) {
      const eligibility = removeEligibility(order);
      if (!eligibility.canRemove) throw new CommerceError(eligibility.removeReasonCodes[0]);
    }
    const removedFromAdminAt = removed ? new Date() : null;
    await tx.order.update({ where: { id }, data: { removedFromAdminAt } });
    await tx.adminAudit.create({ data: { orderId: id, sessionId, action: removed ? 'remove' : 'restore_removed' } });
    return { id, archivedAt: order.archivedAt, removedFromAdminAt, changed: true };
  });
}
