import { NextResponse } from 'next/server';
import { adminAccess, passwordMatches } from '@/lib/adminAccess';
import { prisma } from '@/lib/prisma';
import { CommerceError } from '@/lib/commerce';
import { apiError } from '@/lib/apiError';
import { readJson, privateHeaders } from '@/lib/http';
import { consumeRateLimit } from '@/lib/rateLimit';

export async function POST(req: Request) {
  try {
    const session = await adminAccess(req, true);
    if (!await consumeRateLimit('reauth', session.id, 5, 900_000)) throw new CommerceError('RATE_LIMIT_EXCEEDED', 429);
    if (!passwordMatches((await readJson(req, 4096)).password)) throw new CommerceError('INVALID_CREDENTIALS', 401);
    await prisma.adminSession.update({ where: { id: session.id }, data: { reauthenticatedAt: new Date() } });
    return NextResponse.json({ success: true }, { headers: privateHeaders });
  } catch (e) { return apiError(e); }
}
