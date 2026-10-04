// Isomorphic Roblox domain rules shared by the storefront, checkout and admin.
// Keep this file free of server-only imports so client components can use it.

export const ROBLOX_METHODS = ['GAMEPASS', 'GIFT_USERNAME', 'LOGIN'] as const;
export type RobloxMethodKey = (typeof ROBLOX_METHODS)[number];

/** Roblox keeps 30% of every Gamepass sale; the creator receives 70%. */
export const ROBLOX_CREATOR_SHARE_PERCENT = 70;
/** Approximate Roblox hold period; actual release is controlled by Roblox. */
export const ROBLOX_PENDING_DAYS = 5;
/** Highest package size accepted for Gamepass so the computed price fits an INT column. */
export const ROBLOX_MAX_QUANTITY = 1_000_000;
export const ROBLOX_MAX_GAMEPASS_UNITS = ROBLOX_MAX_QUANTITY;

export const ROBLOX_USERNAME_PATTERN = /^[A-Za-z0-9_]{3,20}$/;

/**
 * Gamepass price the buyer must set so they net `robux` after Roblox's 30% fee:
 * ceil(robux / 0.7). Integer arithmetic avoids floating point drift
 * (e.g. 100 Robux -> 143, 70 Robux -> 100).
 */
export function robloxGamepassPrice(robux: number): number {
  if (!Number.isInteger(robux) || robux <= 0) throw new RangeError('ROBUX_AMOUNT_INVALID');
  return Math.ceil((robux * 100) / ROBLOX_CREATOR_SHARE_PERCENT);
}

/** Robux withheld by Roblox when the Gamepass sells at the computed price. */
export function robloxMarketplaceFee(robux: number): number {
  return robloxGamepassPrice(robux) - robux;
}

export function isRobloxMethod(value: unknown): value is RobloxMethodKey {
  return typeof value === 'string' && (ROBLOX_METHODS as readonly string[]).includes(value);
}

/** Replace `{name}` placeholders in a translated template. */
export function fillTemplate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
}

/** Creator Hub page where the owner manages passes for an experience (universe). */
export function robloxPassDashboardUrl(universeId: number | string): string {
  return `https://create.roblox.com/dashboard/creations/experiences/${encodeURIComponent(String(universeId))}/monetization/passes`;
}

export function robloxProfileUrl(userId: number | string): string {
  return `https://www.roblox.com/users/${encodeURIComponent(String(userId))}/profile`;
}
