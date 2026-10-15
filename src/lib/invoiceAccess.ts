import type { Prisma } from '@prisma/client';
import { checkoutCookieHash, CHECKOUT_SESSION_TTL_MS } from './checkoutSession';
import { sameOrigin } from './csrf';
import { CommerceError } from './commerce';

// Query-level authorization precedes reading any associated account/contacts.
// Explicit legacy headers always select the legacy path, including invalid ones.
export async function invoiceAccessWhere(req: Request, invoice: string, mutation = false): Promise<Prisma.OrderWhereInput | null> {
  if (!invoice || invoice.length > 191) return null;
  if (req.headers.has('x-order-token')) {
    const token = req.headers.get('x-order-token');
    return token && token.length <= 128 ? { invoice, accessToken: token } : null;
  }
  const tokenHash = checkoutCookieHash(req);
  if (!tokenHash) return null;
  if (mutation && !sameOrigin(req)) throw new CommerceError('CSRF_REJECTED', 403);
  return { invoice, type: 'ROBLOX', robloxDetail: { is: { method: 'LOGIN' } }, checkoutAttempt: { is: {
    state: 'COMMITTED', session: { is: { tokenHash, revokedAt: null, expiresAt: { gt: new Date() },
      createdAt: { gt: new Date(Date.now() - CHECKOUT_SESSION_TTL_MS) } } },
  } } };
}
