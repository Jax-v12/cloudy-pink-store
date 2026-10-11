import { NextResponse } from 'next/server';
import { runFulfillment } from '@/lib/fulfillmentWorker';
import { verifyCronAuth } from '@/lib/auth';
import { apiError } from '@/lib/apiError';
import { privateHeaders } from '@/lib/http';

export const dynamic = 'force-dynamic';
export async function GET(req: Request) {
  if (!verifyCronAuth(req)) return NextResponse.json({ success: false }, { status: 401, headers: privateHeaders });
  try { return NextResponse.json({ success: true, ...await runFulfillment() }, { headers: privateHeaders }); }
  catch (e) { return apiError(e); }
}
