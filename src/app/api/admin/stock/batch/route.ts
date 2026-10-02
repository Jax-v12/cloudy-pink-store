import { NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/auth';
import { addStocks } from '@/lib/stock';
import { InputError, readJson, logFailure, privateHeaders } from '@/lib/http';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    if (!(await verifyAdminAuth(req))) return NextResponse.json({ success: false }, { status: 401 });
    const result = await addStocks(await readJson(req, 1_048_576), true);
    return NextResponse.json({ success: true, data: result }, { headers: privateHeaders });
  } catch (error) {
    if (error instanceof InputError) return NextResponse.json({ success: false, errorCode: 'INVALID_INPUT' }, { status: error.status });
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return NextResponse.json({ success: false, errorCode: 'PRODUCT_CONFLICT' }, { status: 409 });
    }
    logFailure('Batch stock insertion failed', error);
    return NextResponse.json({ success: false, errorCode: 'SYSTEM_ERROR' }, { status: 500 });
  }
}
