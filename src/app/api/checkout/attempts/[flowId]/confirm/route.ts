import { NextResponse } from 'next/server';
import { confirmLoginAttempt } from '@/lib/loginAttemptCheckout';
import { attemptAccess, attemptError, onlyFields } from '@/lib/checkoutAttemptHttp';
import { InputError, privateHeaders, readJson } from '@/lib/http';
import { resolveRequestRegion } from '@/lib/requestRegion';
import { initializeCheckoutPayment } from '@/lib/checkoutPayment';
import { consumeRateLimit } from '@/lib/rateLimit';
import { CommerceError } from '@/lib/commerce';

export async function POST(req: Request, { params }: { params: Promise<{ flowId: string }> }) {
  try {
    const session = await attemptAccess(req, 'confirm');
    const body = await readJson(req, 12_288);
    onlyFields(body, ['version', 'checkout', 'reconfirm']);
    if (typeof body.version !== 'number' || !Number.isSafeInteger(body.version) || body.version < 0 ||
        !body.checkout || typeof body.checkout !== 'object' || Array.isArray(body.checkout) ||
        (body.reconfirm !== undefined && typeof body.reconfirm !== 'boolean')) throw new InputError();
    const { flowId } = await params;
    const checkout = body.checkout as Record<string, unknown>;
    // Preserve the existing email abuse limit for full confirmations. A committed
    // recovery can omit the private draft and uses only session/flow ownership.
    if (typeof checkout.customerEmail === 'string' && checkout.customerEmail.length <= 150 &&
        !await consumeRateLimit('checkout-email', checkout.customerEmail.trim().toLowerCase(), 5, 3_600_000)) throw new CommerceError('RATE_LIMIT_EXCEEDED', 429);
    const { order, created } = await confirmLoginAttempt(session.id, flowId, body.version, checkout, resolveRequestRegion(req).region, body.reconfirm === true);
    const qr = created ? await initializeCheckoutPayment(order, order.customerEmail) : order.qrisUrl;
    // No accessToken, contact, quoteToken or checkoutKey crosses this boundary.
    return NextResponse.json({ success: true, data: { flowId, outcome: 'COMMITTED', invoice: order.invoice } }, { status: qr ? 200 : 202, headers: privateHeaders });
  } catch (error) { return attemptError(error); }
}
