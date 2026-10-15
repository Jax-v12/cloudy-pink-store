import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sameOrigin } from '@/lib/csrf';
import { CHECKOUT_COOKIE, CHECKOUT_SESSION_TTL_MS, checkoutSessionAccess } from '@/lib/checkoutSession';
import { attemptTransaction, validFlowId } from '@/lib/checkoutAttempt';
import { attemptError, onlyFields } from '@/lib/checkoutAttemptHttp';
import { CommerceError } from '@/lib/commerce';
import { InputError, privateHeaders, readJson } from '@/lib/http';
import { clientKey, consumeRateLimit } from '@/lib/rateLimit';

export async function POST(req: Request) {
  try {
    if (!sameOrigin(req)) throw new CommerceError('CSRF_REJECTED', 403);
    const body = await readJson(req, 256); onlyFields(body, ['locator']);
    if (!validFlowId(body.locator)) throw new InputError();
    const locator = body.locator.toLowerCase();
    if (!await consumeRateLimit('checkout-bootstrap-source', clientKey(req), 60, 60_000) ||
        !await consumeRateLimit('checkout-bootstrap-locator', locator, 30, 60_000)) throw new CommerceError('RATE_LIMIT_EXCEEDED', 429);
    // Invalid/duplicate/expired cookies must not trigger replacement issuance.
    const hasCookie = (req.headers.get('cookie') ?? '').split(';').some(value => value.trim().startsWith(`${CHECKOUT_COOKIE}=`));
    if (hasCookie) {
      const session = await checkoutSessionAccess(req, true);
      if (session.id.toLowerCase() !== locator) throw new CommerceError('CHECKOUT_LOCATOR_CONFLICT', 403);
      return NextResponse.json({ success: true, data: { outcome: 'READY' } }, { headers: privateHeaders });
    }
    const credential = crypto.randomBytes(32).toString('base64url');
    const expiresAt = await prisma.$transaction(async tx => {
      const [clock] = await tx.$queryRaw<{ now: Date }[]>`SELECT CURRENT_TIMESTAMP(3) AS now`;
      const expiresAt = new Date(clock.now.getTime() + CHECKOUT_SESSION_TTL_MS);
      // INSERT + primary-key constraint elects the sole cookie writer. Never
      // look up a public UUID and return/reconstruct an existing credential.
      await tx.checkoutSession.create({ data: { id: locator, tokenHash: crypto.createHash('sha256').update(credential).digest('hex'), createdAt: clock.now, expiresAt } });
      return expiresAt;
    }, attemptTransaction);
    const response = NextResponse.json({ success: true, data: { outcome: 'COOKIE_ISSUED' } }, { status: 201, headers: privateHeaders });
    // This is the only Set-Cookie path, after a known successful commit.
    response.cookies.set(CHECKOUT_COOKIE, credential, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', expires: expiresAt });
    return response;
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return NextResponse.json({ success: false, errorCode: 'CHECKOUT_BOOTSTRAP_PENDING' }, { status: 409, headers: privateHeaders });
    }
    // Uncertain insert commit emits no credential; retries keep the same UUID.
    return attemptError(error);
  }
}
