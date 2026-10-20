import { NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/auth';
import { privateHeaders } from '@/lib/http';
import { apiError } from '@/lib/apiError';
import { runAppsReminders } from '@/lib/appsReminders';
export const dynamic = 'force-dynamic';
export async function GET(req: Request) {
  if (!verifyCronAuth(req)) return NextResponse.json({ success: false }, { status: 401, headers: privateHeaders });
  try { const result = await runAppsReminders(); return NextResponse.json({ success: result.review === 0, ...result }, { status: result.review ? 503 : 200, headers: privateHeaders }); }
  catch (e) { return apiError(e); }
}
