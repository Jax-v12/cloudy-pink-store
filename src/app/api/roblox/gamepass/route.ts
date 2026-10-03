import { NextResponse } from 'next/server';
import { InputError } from '@/lib/http';
import { robloxGamepass, robloxUniversePasses } from '@/lib/robloxApi';
import { apiError, guardLookup, lookupHeaders, lookupUnavailable } from '@/lib/robloxLookup';

export const dynamic = 'force-dynamic';

const numericId = (value: string | null) => {
  if (!value || !/^\d{1,19}$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

// GET /api/roblox/gamepass?id=<passId>                      -> one pass (owner, price, Item for Sale)
// GET /api/roblox/gamepass?universeId=<id>&userId=<id>      -> passes the user created in that experience
export async function GET(req: Request) {
  try {
    const params = new URL(req.url).searchParams;
    const passId = numericId(params.get('id'));
    const universeId = numericId(params.get('universeId'));
    const userId = numericId(params.get('userId'));
    if (!passId && !(universeId && userId)) throw new InputError();
    await guardLookup(req);
    if (passId) {
      const pass = await robloxGamepass(passId);
      if (!pass.ok) {
        return pass.reason === 'NOT_FOUND'
          ? NextResponse.json({ success: false, errorCode: 'GAMEPASS_NOT_FOUND' }, { status: 404, headers: lookupHeaders })
          : lookupUnavailable();
      }
      return NextResponse.json({ success: true, data: pass.value }, { headers: { 'Cache-Control': 'no-store' } });
    }
    const passes = await robloxUniversePasses(universeId!, userId!);
    if (!passes) return lookupUnavailable();
    // Never cache: buyers edit prices and toggle "Item for Sale" while this panel is open.
    return NextResponse.json({ success: true, data: passes }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return apiError(error); }
}
