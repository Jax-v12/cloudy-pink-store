import { createCheckout } from './checkout';
import { claimLoginAttempt, rejectLoginClaim, type AttemptCommit } from './checkoutAttempt';
import { CommerceError } from './commerce';
import { InputError } from './http';
import type { Region } from './regionalPricing';

export async function confirmLoginAttempt(sessionId: string, flowId: string, version: number, body: Record<string, unknown>, region: Region | null, reconfirm = false) {
  let context: AttemptCommit | null = null;
  try {
    const claimed = await claimLoginAttempt(sessionId, flowId, version, body, reconfirm);
    if (claimed.order) return { order: claimed.order, created: false };
    context = { sessionId, flowId, version: claimed.version };
    return await createCheckout(body, claimed.checkoutKey, region, context);
  } catch (error) {
    if (error instanceof CommerceError || error instanceof InputError) {
      if (context) {
        try { await rejectLoginClaim(context); }
        catch { throw new CommerceError('CHECKOUT_UNKNOWN', 503); }
      }
      throw error;
    }
    // Includes connection loss during claim or final commit: neither is a proven failure.
    throw new CommerceError('CHECKOUT_UNKNOWN', 503);
  }
}
