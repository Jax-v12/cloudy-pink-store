import { NextResponse } from 'next/server';
import { InputError } from '@/lib/http';
import { ROBLOX_USERNAME_PATTERN } from '@/lib/roblox';
import { findRobloxUser, robloxAvatarUrl, robloxPublicGames } from '@/lib/robloxApi';
import { apiError, guardLookup, lookupHeaders, lookupUnavailable } from '@/lib/robloxLookup';

export const dynamic = 'force-dynamic';

// GET /api/roblox/user?username=<name>[&games=1]
// Validates a Roblox username and returns only public profile data (no credentials involved).
export async function GET(req: Request) {
  try {
    const params = new URL(req.url).searchParams;
    const username = params.get('username')?.trim() ?? '';
    if (!ROBLOX_USERNAME_PATTERN.test(username)) throw new InputError();
    await guardLookup(req);
    const user = await findRobloxUser(username);
    if (!user.ok) {
      return user.reason === 'NOT_FOUND'
        ? NextResponse.json({ success: false, errorCode: 'ROBLOX_USER_NOT_FOUND' }, { status: 404, headers: lookupHeaders })
        : lookupUnavailable();
    }
    const [avatarUrl, games] = await Promise.all([
      robloxAvatarUrl(user.value.id),
      params.get('games') === '1' ? robloxPublicGames(user.value.id) : Promise.resolve(null),
    ]);
    return NextResponse.json({ success: true, data: { ...user.value, avatarUrl, games } }, { headers: lookupHeaders });
  } catch (error) { return apiError(error); }
}
