import { NextResponse } from 'next/server';
import { checkoutSessionAccess } from './checkoutSession';
import { clientKey, consumeRateLimit } from './rateLimit';
import { CommerceError } from './commerce';
import { InputError, logFailure, privateHeaders } from './http';
import { apiError } from './apiError';

export async function attemptAccess(req: Request, operation: 'open' | 'confirm' | 'recover') {
  const session = await checkoutSessionAccess(req, true);
  const polling = operation === 'recover';
  if (!await consumeRateLimit(`attempt-${operation}-source`, clientKey(req), polling ? 60 : 10, polling ? 60_000 : 900_000) ||
      !await consumeRateLimit(`attempt-${operation}-session`, session.id, polling ? 30 : 10, polling ? 60_000 : 900_000)) throw new CommerceError('RATE_LIMIT_EXCEEDED', 429);
  return session;
}

export function attemptError(error: unknown) {
  if (error instanceof CommerceError || error instanceof InputError) return apiError(error);
  logFailure('Checkout attempt unavailable', error);
  // Query/transaction failures do not prove absence of an Order.
  return NextResponse.json({ success: false, errorCode: 'CHECKOUT_UNKNOWN' }, { status: 503, headers: privateHeaders });
}

export function onlyFields(body: Record<string, unknown>, allowed: string[]) {
  if (Object.keys(body).some(key => !allowed.includes(key))) throw new InputError();
}
