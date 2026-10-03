import { NextResponse } from 'next/server';
import { apiError } from '@/lib/apiError';
import { CommerceError } from '@/lib/commerce';
import { clientKey, consumeRateLimit } from '@/lib/rateLimit';

export const lookupHeaders = { 'Cache-Control': 'private, max-age=30' };

/** Shared throttle for the public Roblox lookup proxies (protects our egress and Roblox's limits). */
export async function guardLookup(req: Request) {
  if (!(await consumeRateLimit('roblox-lookup', clientKey(req), 60, 5 * 60_000))) throw new CommerceError('RATE_LIMIT_EXCEEDED', 429);
}

export function lookupUnavailable() {
  return NextResponse.json({ success: false, errorCode: 'LOOKUP_UNAVAILABLE' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
}

export { apiError };
