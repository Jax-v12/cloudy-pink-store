import { CommerceError } from './commerce';
import { findRobloxUser, gamepassIdFromUrl, robloxGamepass } from './robloxApi';
import type { RobloxMethodKey } from './roblox';

type RobloxDetails = { method: RobloxMethodKey; username: string; gamepassUrl: string | null; gamepassPrice: number | null };
export type RobloxVerification = {
  method: RobloxMethodKey; gamepassPrice: number | null;
  username: string; robloxUserId: string | null; displayName: string | null;
  gamepassId: string | null; gamepassVerifiedAt: Date | null;
};

/**
 * Confirms the recipient against Roblox before an order is reserved.
 * Definitive negative answers (unknown user, wrong owner, not for sale, wrong price) block checkout.
 * If Roblox is unreachable the order proceeds unverified and the admin checks manually.
 * Runs outside the database transaction so slow upstream calls never hold row locks.
 */
export async function verifyRobloxDetails(details: RobloxDetails): Promise<RobloxVerification> {
  const passId = details.method === 'GAMEPASS' && details.gamepassUrl ? gamepassIdFromUrl(details.gamepassUrl) : null;
  if (details.method === 'GAMEPASS' && !passId) throw new CommerceError('GAMEPASS_NOT_FOUND', 400);
  const [user, pass] = await Promise.all([findRobloxUser(details.username), passId ? robloxGamepass(passId) : null]);
  if (!user.ok && user.reason === 'NOT_FOUND') throw new CommerceError('ROBLOX_USER_NOT_FOUND', 400);
  let gamepassVerifiedAt: Date | null = null;
  if (pass) {
    if (!pass.ok && pass.reason === 'NOT_FOUND') throw new CommerceError('GAMEPASS_NOT_FOUND', 400);
    if (pass.ok) {
      // Group-owned passes pay the group, not the buyer.
      if (pass.value.creatorType !== 'User' || (user.ok && pass.value.creatorId !== user.value.id)) throw new CommerceError('GAMEPASS_OWNER_MISMATCH', 400);
      if (!pass.value.isForSale) throw new CommerceError('GAMEPASS_NOT_FOR_SALE', 400);
      if (pass.value.price !== details.gamepassPrice) throw new CommerceError('GAMEPASS_PRICE_MISMATCH', 400);
      if (user.ok) gamepassVerifiedAt = new Date();
    }
  }
  return {
    method: details.method, gamepassPrice: details.gamepassPrice,
    username: user.ok ? user.value.name : details.username,
    robloxUserId: user.ok ? String(user.value.id) : null,
    displayName: user.ok ? user.value.displayName : null,
    gamepassId: passId ? String(passId) : null, gamepassVerifiedAt,
  };
}
