import { PrismaClient } from '@prisma/client';
import { pathToFileURL } from 'node:url';

/** Recovery-only cleanup: the restored application must remain offline. */
export async function purgeRestoredLoginSecrets(db) {
  let purged = 0;
  // Bound each transaction while draining large restored retention backlogs.
  for (;;) {
    const count = await db.$transaction(async tx => {
      const rows = await tx.$queryRaw`SELECT s.orderId FROM \`OrderSecret\` s JOIN \`Order\` o ON o.id=s.orderId WHERE s.expiresAt<=UTC_TIMESTAMP(3) OR o.createdAt<=DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 72 HOUR) OR o.status IN ('EXPIRED','CANCELLED') OR o.fulfillmentStatus='COMPLETED' OR o.refundStatus='COMPLETED' ORDER BY s.orderId LIMIT 100 FOR UPDATE`;
      for (const { orderId } of rows) {
        await tx.orderSecret.deleteMany({ where: { orderId } });
        await tx.order.updateMany({ where: { id: orderId, status: 'PAID', refundStatus: 'NONE', fulfillmentStatus: { in: ['QUEUED','PROCESSING','WAITING_CUSTOMER'] } }, data: { fulfillmentStatus: 'REQUIRES_REVIEW' } });
        await tx.adminAudit.create({ data: { orderId, sessionId: 'system-restore', action: 'login-access-restore-purge' } });
      }
      return rows.length;
    });
    purged += count;
    if (count < 100) return purged;
  }
}

/** Restored reminder state may predate a send: require consent again before dispatch. */
export async function purgeRestoredAppsSecrets(db) {
  let deliveries = 0, contacts = 0;
  for (;;) {
    const rows = await db.$queryRaw`SELECT s.orderId FROM AppsService s JOIN \`Order\` o ON o.id=s.orderId WHERE s.reminderPhone IS NOT NULL OR s.reminderOptIn=1 OR (s.deliveryCiphertext IS NOT NULL AND (s.deliveredAt IS NULL OR s.deliveredAt<=DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 72 HOUR) OR o.status<>'PAID' OR o.refundStatus<>'NONE' OR o.archivedAt IS NOT NULL OR o.removedFromAdminAt IS NOT NULL)) ORDER BY s.orderId LIMIT 100`;
    for (const { orderId } of rows) await db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM \`Order\` WHERE id=${orderId} FOR UPDATE`;
      const contact = await tx.appsService.updateMany({ where: { orderId, OR: [{ reminderPhone: { not: null } }, { reminderOptIn: true }] }, data: { reminderPhone: null, reminderOptIn: false, reminderVerifiedAt: null } });
      const delivery = await tx.$executeRaw`UPDATE AppsService s JOIN \`Order\` o ON o.id=s.orderId SET s.deliveryCiphertext=NULL WHERE s.orderId=${orderId} AND s.deliveryCiphertext IS NOT NULL AND (s.deliveredAt IS NULL OR s.deliveredAt<=DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 72 HOUR) OR o.status<>'PAID' OR o.refundStatus<>'NONE' OR o.archivedAt IS NOT NULL OR o.removedFromAdminAt IS NOT NULL)`;
      if (contact.count || delivery) await tx.adminAudit.create({ data: { orderId, sessionId: 'system-restore', action: 'apps-access-restore-purge' } });
      contacts += contact.count; deliveries += Number(delivery);
    });
    if (rows.length < 100) return { deliveries, contacts };
  }
}

export function restoreTarget(env) {
  let url;
  try { url = new URL(env.RESTORE_DATABASE_URL); } catch { throw new Error('RESTORE_TARGET_REJECTED'); }
  if (env.RESTORE_APPLICATION_DISABLED !== 'true' || env.NODE_ENV === 'production' || url.protocol !== 'mysql:' ||
      !['127.0.0.1','localhost'].includes(url.hostname) || !/^\/cloudy_test_[a-z0-9_]+$/.test(url.pathname) ||
      url.search || url.hash) throw new Error('RESTORE_TARGET_REJECTED');
  return url.href;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let db;
  try {
    db = new PrismaClient({ datasourceUrl: restoreTarget(process.env), log: [] });
    const purged = await purgeRestoredLoginSecrets(db);
    const apps = await purgeRestoredAppsSecrets(db);
    console.log(JSON.stringify({ restorePurge: 'PASS', purged, apps }));
  } catch { console.error('RESTORE_PURGE_FAILED'); process.exitCode = 1; }
  finally { await db?.$disconnect(); }
}
