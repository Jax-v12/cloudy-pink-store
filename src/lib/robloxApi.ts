import { ROBLOX_USERNAME_PATTERN } from './roblox';

// Server-only client for Roblox's public, unauthenticated web APIs.
// Never forward customer credentials here: these endpoints only need public identifiers.

export type RobloxLookup<T> = { ok: true; value: T } | { ok: false; reason: 'NOT_FOUND' | 'UNAVAILABLE' };
export type RobloxUser = { id: number; name: string; displayName: string };
export type RobloxGame = { universeId: number; placeId: number | null; name: string };
export type RobloxPass = { id: number; name: string; price: number | null; isForSale: boolean; creatorId: number | null; creatorType: string | null };

const TIMEOUT_MS = 5_000;
const unavailable = { ok: false, reason: 'UNAVAILABLE' } as const;
const notFound = { ok: false, reason: 'NOT_FOUND' } as const;

const safeId = (value: unknown): number | null =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : null;
const safeText = (value: unknown, max = 100): string | null =>
  typeof value === 'string' && value.length > 0 ? value.slice(0, max) : null;

async function getJson(url: string, init?: RequestInit): Promise<{ status: number; body: unknown } | null> {
  try {
    const response = await fetch(url, {
      ...init, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { Accept: 'application/json', ...(init?.body ? { 'Content-Type': 'application/json' } : {}) },
    });
    if (response.status === 404 || response.status === 400) return { status: response.status, body: null };
    if (!response.ok) return null;
    return { status: response.status, body: await response.json() };
  } catch {
    return null;
  }
}

export async function findRobloxUser(username: string): Promise<RobloxLookup<RobloxUser>> {
  if (!ROBLOX_USERNAME_PATTERN.test(username)) return notFound;
  const result = await getJson('https://users.roblox.com/v1/usernames/users', {
    method: 'POST', body: JSON.stringify({ usernames: [username], excludeBannedUsers: true }),
  });
  if (!result) return unavailable;
  const rows = (result.body as { data?: unknown } | null)?.data;
  if (!Array.isArray(rows)) return result.status === 400 ? notFound : unavailable;
  const row = rows[0] as Record<string, unknown> | undefined;
  const id = safeId(row?.id); const name = safeText(row?.name, 20);
  if (!id || !name || name.toLowerCase() !== username.toLowerCase()) return notFound;
  return { ok: true, value: { id, name, displayName: safeText(row?.displayName, 64) ?? name } };
}

export async function robloxAvatarUrl(userId: number): Promise<string | null> {
  const result = await getJson(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`);
  const row = ((result?.body as { data?: unknown } | null)?.data as Record<string, unknown>[] | undefined)?.[0];
  const raw = safeText(row?.imageUrl, 500);
  if (!raw || row?.state !== 'Completed') return null;
  try {
    const url = new URL(raw);
    // Only hand Roblox's CDN to the browser; never reflect arbitrary upstream URLs.
    return url.protocol === 'https:' && url.hostname.endsWith('.rbxcdn.com') ? url.toString() : null;
  } catch {
    return null;
  }
}

export async function robloxPublicGames(userId: number): Promise<RobloxGame[] | null> {
  const result = await getJson(`https://games.roblox.com/v2/users/${userId}/games?accessFilter=Public&limit=10&sortOrder=Desc`);
  const rows = (result?.body as { data?: unknown } | null)?.data;
  if (!Array.isArray(rows)) return null;
  return rows.flatMap((row: Record<string, unknown>) => {
    const universeId = safeId(row.id); const name = safeText(row.name);
    if (!universeId || !name) return [];
    return [{ universeId, name, placeId: safeId((row.rootPlace as Record<string, unknown> | undefined)?.id) }];
  });
}

/** Passes in an experience that the given user personally created (Robux go to that user). */
export async function robloxUniversePasses(universeId: number, userId: number): Promise<RobloxPass[] | null> {
  const result = await getJson(`https://apis.roblox.com/game-passes/v1/universes/${universeId}/game-passes?passView=Full&pageSize=50`);
  const rows = (result?.body as { gamePasses?: unknown } | null)?.gamePasses;
  if (!Array.isArray(rows)) return null;
  return rows.flatMap((row: Record<string, unknown>) => {
    const id = safeId(row.id); const name = safeText(row.displayName) ?? safeText(row.name);
    const creator = row.creator as Record<string, unknown> | undefined;
    const creatorId = safeId(creator?.creatorId);
    if (!id || !name || creator?.creatorType !== 'User' || creatorId !== userId) return [];
    return [{ id, name, price: safeId(row.price), isForSale: row.isForSale === true, creatorId, creatorType: 'User' }];
  });
}

export async function robloxGamepass(passId: number): Promise<RobloxLookup<RobloxPass>> {
  const result = await getJson(`https://apis.roblox.com/game-passes/v1/game-passes/${passId}/product-info`);
  if (!result) return unavailable;
  const row = result.body as Record<string, unknown> | null;
  if (!row || row.ProductType !== 'Game Pass') return notFound;
  const creator = row.Creator as Record<string, unknown> | undefined;
  return { ok: true, value: {
    id: passId, name: safeText(row.Name) ?? String(passId), price: safeId(row.PriceInRobux), isForSale: row.IsForSale === true,
    creatorId: safeId(creator?.CreatorTargetId) ?? safeId(creator?.Id), creatorType: safeText(creator?.CreatorType, 20),
  } };
}

/** Extract the numeric pass ID from a validated https://www.roblox.com/game-pass/<id>/... URL. */
export function gamepassIdFromUrl(url: string): number | null {
  const match = /^\/game-pass\/(\d{1,19})(?:\/|$)/.exec(new URL(url).pathname);
  const id = match ? Number(match[1]) : NaN;
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}
