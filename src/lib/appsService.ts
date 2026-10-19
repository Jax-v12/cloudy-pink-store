import { prisma } from './prisma';
import { CommerceError } from './commerce';
import { InputError, textField } from './http';
import { APPS_DELIVERY_TTL_MS, appsWarranty, parseAppsConfig } from './appsProduct';
import { encryptData } from './crypto';
import { requireCurrentSession } from './adminMutation';

export type AppsAction = { action: string; sessionId?: string; reason?: unknown; evidence?: unknown; delivery?: unknown; supportStatus?: unknown };

// Callers must establish invoice ownership or admin authorization before entering.
export async function appsOrderAction(orderId: number, input: AppsAction) {
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM \`Order\` WHERE id = ${orderId} FOR UPDATE`;
    if (input.sessionId) await requireCurrentSession(tx, input.sessionId, true);
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { appsService: true, appsSupport: true, job: true } });
    if (!order || order.type !== 'APPS' || order.status !== 'PAID' || order.refundStatus !== 'NONE' || order.archivedAt || order.removedFromAdminAt) throw new CommerceError('ORDER_NOT_AVAILABLE');
    const config = parseAppsConfig(order.appsSnapshot);
    const audit = (action: string) => tx.adminAudit.create({ data: { orderId, sessionId: input.sessionId || 'invoice-owner', action } });
    if (input.action === 'support') {
      if (!['NO_ACCESS', 'STOPPED_WORKING', 'DELIVERY_HELP'].includes(String(input.reason))) throw new InputError();
      if (input.reason !== 'DELIVERY_HELP' && !appsWarranty(config, order.paidAt, order.appsService?.activeFrom ?? null).active) throw new CommerceError('WARRANTY_UNAVAILABLE');
      if (order.appsSupport && ['OPEN', 'IN_PROGRESS'].includes(order.appsSupport.status)) return;
      await tx.appsSupport.upsert({ where: { orderId }, create: { orderId, reason: String(input.reason), status: 'OPEN' }, update: { reason: String(input.reason), status: 'OPEN' } });
      await audit(`apps-support-opened-${input.reason}`); return;
    }
    if (input.action === 'support-status') {
      if (!input.sessionId || !order.appsSupport) throw new CommerceError('INVALID_TRANSITION');
      const target = String(input.supportStatus);
      const transitions: Record<string, string[]> = { OPEN: ['IN_PROGRESS', 'REJECTED'], IN_PROGRESS: ['RESOLVED', 'REJECTED'], RESOLVED: [], REJECTED: [] };
      if (!transitions[order.appsSupport.status]?.includes(target)) throw new CommerceError('INVALID_TRANSITION');
      await tx.appsSupport.upsert({ where: { orderId }, create: { orderId, reason: order.appsSupport.reason, status: target }, update: { status: target } });
      await audit(`apps-support-${target.toLowerCase()}`); return;
    }
    if (config?.fulfillmentMode !== 'ACTIVATION' || !order.appsService || !order.job || order.job.completedAt) throw new CommerceError('INVALID_TRANSITION');
    if (input.action === 'acknowledge') {
      if (order.fulfillmentStatus !== 'WAITING_CUSTOMER' || !order.appsService.deliveredAt) throw new CommerceError('INVALID_TRANSITION');
      if (!order.appsService.acknowledgedAt) {
        await tx.appsService.update({ where: { orderId }, data: { acknowledgedAt: new Date() } });
        await audit('apps-customer-acknowledged');
      }
      return; // Receipt acknowledgment is not evidence that the service is active.
    }
    if (!input.sessionId) throw new CommerceError('UNAUTHORIZED', 401);
    if (input.action === 'contact') {
      if (order.job.ownerSessionId !== input.sessionId) throw new CommerceError('JOB_NOT_OWNED', 403);
      await audit('apps-contact-viewed');
      return { recipientEmail: order.customerEmail, displayUntil: new Date(Date.now() + 60000).toISOString() };
    }
    if (input.action === 'claim') {
      if (!['QUEUED', 'PROCESSING', 'WAITING_CUSTOMER', 'REQUIRES_REVIEW'].includes(order.fulfillmentStatus)) throw new CommerceError('INVALID_TRANSITION');
      const owner = order.job.ownerSessionId ? await tx.adminSession.findUnique({ where: { id: order.job.ownerSessionId } }) : null;
      if (owner && owner.expiresAt > new Date() && owner.id !== input.sessionId) throw new CommerceError('JOB_BUSY');
      await tx.fulfillmentJob.update({ where: { orderId }, data: { ownerSessionId: input.sessionId } });
      if (order.fulfillmentStatus === 'QUEUED') await tx.order.update({ where: { id: orderId }, data: { fulfillmentStatus: 'PROCESSING' } });
    } else {
      if (order.job.ownerSessionId !== input.sessionId) throw new CommerceError('JOB_NOT_OWNED', 403);
      if (input.action === 'deliver') {
        if (!['PROCESSING', 'WAITING_CUSTOMER'].includes(order.fulfillmentStatus)) throw new CommerceError('INVALID_TRANSITION');
        const delivery = textField(input.delivery, 2000)!;
        if (config.activationMethod === 'LINK') {
          let url: URL; try { url = new URL(delivery); } catch { throw new InputError(); }
          if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hostname === 'localhost' || /^[\d.]+$/.test(url.hostname) || url.hostname.startsWith('[')) throw new InputError();
        }
        await tx.appsService.update({ where: { orderId }, data: { deliveryCiphertext: encryptData(delivery), deliveredAt: new Date(), acknowledgedAt: null } });
        await tx.order.update({ where: { id: orderId }, data: { fulfillmentStatus: 'WAITING_CUSTOMER' } });
      } else if (input.action === 'complete') {
        if (!['PROCESSING', 'WAITING_CUSTOMER'].includes(order.fulfillmentStatus) || !order.appsService.deliveredAt) throw new CommerceError('INVALID_TRANSITION');
        const evidence = textField(input.evidence, 191)!;
        if (!/^[A-Za-z0-9:_-]{1,191}$/.test(evidence)) throw new InputError();
        let activeFrom = new Date();
        if (order.appsService.renewalOfOrderId) {
          await tx.$queryRaw`SELECT id FROM \`Order\` WHERE id = ${order.appsService.renewalOfOrderId} FOR UPDATE`;
          const prior = await tx.appsService.findUnique({ where: { orderId: order.appsService.renewalOfOrderId } });
          if (!prior?.activeUntil) throw new CommerceError('INVALID_TRANSITION');
          activeFrom = new Date(Math.max(activeFrom.getTime(), prior.activeUntil.getTime()));
        }
        await tx.appsService.update({ where: { orderId }, data: { activationConfirmedAt: new Date(), activeFrom, activeUntil: new Date(activeFrom.getTime() + config.durationDays * 86400_000) } });
        await tx.order.update({ where: { id: orderId }, data: { fulfillmentStatus: 'COMPLETED' } });
        await tx.fulfillmentJob.update({ where: { orderId }, data: { completedAt: new Date(), evidence } });
      } else throw new InputError();
    }
    await audit(`apps-${input.action}`);
  });
}

export async function purgeAppsDeliveries() {
  const expired = { deliveryCiphertext: { not: null }, OR: [{ deliveredAt: { lte: new Date(Date.now() - APPS_DELIVERY_TTL_MS) } }, { order: { refundStatus: { not: 'NONE' as const } } }] };
  const rows = await prisma.appsService.findMany({ where: expired, orderBy: { orderId: 'asc' }, select: { orderId: true }, take: 100 });
  let purged = 0;
  for (const row of rows) purged += await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM \`Order\` WHERE id = ${row.orderId} FOR UPDATE`;
    const result = await tx.appsService.updateMany({ where: { orderId: row.orderId, ...expired }, data: { deliveryCiphertext: null } });
    if (result.count) await tx.adminAudit.create({ data: { orderId: row.orderId, sessionId: 'system-cleanup', action: 'apps-delivery-expired' } });
    return result.count;
  });
  return purged;
}
