import { prisma } from './prisma';
import { decryptData } from './crypto';
import { CommerceError } from './commerce';
import { LOGIN_ACCESS_TTL_MS, normalizeLoginBackupCodes, validLoginPassword } from './loginCredentials';

/** Never include this result in list, invoice, provider or notification DTOs. */
export async function revealLoginAccess(orderId: number, sessionId: string) {
  const access = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM \`Order\` WHERE id = ${orderId} FOR UPDATE`;
    const now = new Date();
    const session = await tx.adminSession.findUnique({ where: { id: sessionId } });
    if (!session || session.expiresAt <= now) throw new CommerceError('UNAUTHORIZED', 401);
    if (!session.reauthenticatedAt || session.reauthenticatedAt > now || now.getTime() - session.reauthenticatedAt.getTime() >= 300_000) throw new CommerceError('REAUTH_REQUIRED', 403);
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { robloxDetail: true, job: true, secret: true } });
    if (!order || order.type !== 'ROBLOX' || order.robloxDetail?.method !== 'LOGIN' || order.status !== 'PAID' || order.refundStatus !== 'NONE' ||
        order.archivedAt || order.removedFromAdminAt || !['PROCESSING', 'WAITING_CUSTOMER'].includes(order.fulfillmentStatus) ||
        !order.job || order.job.completedAt || order.job.ownerSessionId !== sessionId || !order.secret) throw new CommerceError('LOGIN_ACCESS_UNAVAILABLE', 404);
    const audit = (action: string) => tx.adminAudit.create({ data: { orderId, sessionId, action } });
    const expiresAt = new Date(Math.min(order.secret.expiresAt.getTime(), order.createdAt.getTime() + LOGIN_ACCESS_TTL_MS));
    if (expiresAt <= now) {
      // The order lock protects deletion even when the stored expiry drifts past the absolute lifetime.
      await tx.orderSecret.deleteMany({ where: { orderId } });
      await tx.order.update({ where: { id: orderId }, data: { fulfillmentStatus: 'REQUIRES_REVIEW' } });
      await audit('login-access-expired');
      return null;
    }
    // Allow JSON-escaped Unicode at the input limits while bounding stored-payload reads.
    if (order.secret.ciphertext.length > 32_768) throw new Error('LOGIN_SECRET_INVALID');
    const raw: unknown = JSON.parse(decryptData(order.secret.ciphertext));
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('LOGIN_SECRET_INVALID');
    const value = raw as Record<string, unknown>;
    const codes = normalizeLoginBackupCodes(value.backupCodes);
    if (value.version !== 1 || value.invoice !== order.invoice || value.username !== order.robloxDetail.username || !validLoginPassword(value.password) || !codes ||
        Object.keys(value).some(key => !['version', 'invoice', 'username', 'password', 'backupCodes'].includes(key))) throw new Error('LOGIN_SECRET_INVALID');
    await audit('login-access-reveal');
    return { username: order.robloxDetail.username, password: value.password, backupCodes: codes,
      displayUntil: new Date(Math.min(now.getTime() + 60_000, expiresAt.getTime(), session.expiresAt.getTime(), session.reauthenticatedAt.getTime() + 300_000)).toISOString() };
  });
  if (!access) throw new CommerceError('LOGIN_ACCESS_UNAVAILABLE', 404);
  return access;
}
