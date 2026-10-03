import { NextResponse } from 'next/server';
import { runFulfillment } from '@/lib/fulfillmentWorker';
import { apiError } from '@/lib/apiError';
import { privateHeaders } from '@/lib/http';

export const dynamic = 'force-dynamic';
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET || req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ success: false }, { status: 401, headers: privateHeaders });
  try { return NextResponse.json({ success: true, ...await runFulfillment() }, { headers: privateHeaders }); }
  catch (e) { return apiError(e); }
}
