import crypto from 'node:crypto';
import { prisma } from './prisma';
import { getGameProvider, type ProviderResult } from './gameProvider';

export async function purgeExpiredSecrets() {
  const rows = await prisma.orderSecret.findMany({ where: { expiresAt: { lte: new Date() } }, select: { orderId: true }, take: 100, orderBy: { expiresAt: 'asc' } });
  for (const row of rows) await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM \`Order\` WHERE id = ${row.orderId} FOR UPDATE`;
    const removed = await tx.orderSecret.deleteMany({ where: { orderId: row.orderId, expiresAt: { lte: new Date() } } });
    if (removed.count) await tx.order.updateMany({ where: { id: row.orderId, fulfillmentStatus: { not: 'COMPLETED' } }, data: { fulfillmentStatus: 'REQUIRES_REVIEW' } });
  });
  return rows.length;
}

export async function runFulfillment() {
  const purged = await purgeExpiredSecrets();
  const now = new Date();
  const jobs = await prisma.fulfillmentJob.findMany({ where: {
    completedAt: null, nextRunAt: { lte: now }, OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }],
    order: { type: 'GAME', status: 'PAID', refundStatus: 'NONE', fulfillmentStatus: { in: ['QUEUED', 'PROCESSING'] } },
  }, orderBy: { nextRunAt: 'asc' }, take: 10 });
  let processed = 0;
  for (const candidate of jobs) {
    const token = crypto.randomUUID();
    const claimed = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM \`Order\` WHERE id = ${candidate.orderId} FOR UPDATE`;
      const job = await tx.fulfillmentJob.findUnique({ where: { id: candidate.id }, include: { order: { include: { gameDetail: true } } } });
      if (!job || job.completedAt || job.nextRunAt > new Date() || (job.leaseUntil && job.leaseUntil > new Date()) || job.order.refundStatus !== 'NONE' || job.order.status !== 'PAID' || !['QUEUED', 'PROCESSING'].includes(job.order.fulfillmentStatus)) return null;
      await tx.fulfillmentJob.update({ where: { id: job.id }, data: { leaseToken: token, leaseUntil: new Date(Date.now() + 60_000), attemptedAt: job.attemptedAt || new Date() } });
      await tx.order.update({ where: { id: job.orderId }, data: { fulfillmentStatus: 'PROCESSING' } });
      return job;
    });
    if (!claimed) continue;
    // Marking attemptedAt BEFORE the network request trades automatic retries for
    // safety: after a crash, status must be reconciled; send is never blindly replayed.
    let result: ProviderResult = { outcome: 'unknown' };
    const operation = claimed.attemptedAt ? 'status' : 'send';
    try {
      const detail = claimed.order.gameDetail;
      if (!detail) throw new Error('MISSING_GAME_DETAIL');
      const provider = getGameProvider(detail.provider);
      try {
        result = operation === 'status' ? await provider.status(claimed.reference) : await provider.send({ reference: claimed.reference, sku: detail.providerSku, userId: detail.userId, zoneId: detail.zoneId });
      } catch { result = await provider.status(claimed.reference); }
    } catch { /* Unknown means manual review; never resend. */ }
    await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM \`Order\` WHERE id = ${claimed.orderId} FOR UPDATE`;
      const released = await tx.fulfillmentJob.updateMany({ where: { id: claimed.id, leaseToken: token, completedAt: null, order: { status: 'PAID', refundStatus: 'NONE', fulfillmentStatus: 'PROCESSING' } }, data: {
        leaseToken: null, leaseUntil: null, nextRunAt: new Date(Date.now() + 60_000),
        completedAt: result.outcome === 'succeeded' ? new Date() : null,
      } });
      if (!released.count) return;
      await tx.providerAttempt.create({ data: { jobId: claimed.id, operation, outcome: result.outcome } });
      await tx.order.update({ where: { id: claimed.orderId }, data: {
        fulfillmentStatus: result.outcome === 'succeeded' ? 'COMPLETED' : result.outcome === 'pending' ? 'PROCESSING' : 'REQUIRES_REVIEW',
      } });
    });
    processed++;
  }
  await prisma.workerHeartbeat.upsert({ where: { name: 'fulfillment' }, create: { name: 'fulfillment', succeededAt: new Date() }, update: { succeededAt: new Date() } });
  return { processed, purged };
}
