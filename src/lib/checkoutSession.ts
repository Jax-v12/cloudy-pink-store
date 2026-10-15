import crypto from 'node:crypto';
import { prisma } from './prisma';
import { CommerceError } from './commerce';
import { sameOrigin } from './csrf';

export const CHECKOUT_COOKIE = '__Host-cloudy_checkout';
export const CHECKOUT_SESSION_TTL_MS = 30 * 86_400_000;

// These readers never set/renew a cookie or authenticate a public locator.
export function checkoutCookieHash(req: Request): string | null {
  const entries = (req.headers.get('cookie') ?? '').split(';').map(value => value.trim())
    .filter(value => value.startsWith(`${CHECKOUT_COOKIE}=`));
  if (entries.length !== 1) return null;
  const token = entries[0].slice(CHECKOUT_COOKIE.length + 1);
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function checkoutSessionAccess(req: Request, mutation = false) {
  const hash = checkoutCookieHash(req);
  if (!hash) throw new CommerceError('CHECKOUT_SESSION_REQUIRED', 401);
  if (mutation && !sameOrigin(req)) throw new CommerceError('CSRF_REJECTED', 403);
  const session = await prisma.checkoutSession.findUnique({ where: { tokenHash: hash } });
  const now = Date.now();
  if (!session || session.revokedAt || session.expiresAt.getTime() <= now || session.createdAt.getTime() + CHECKOUT_SESSION_TTL_MS <= now) throw new CommerceError('CHECKOUT_SESSION_REQUIRED', 401);
  return session;
}
