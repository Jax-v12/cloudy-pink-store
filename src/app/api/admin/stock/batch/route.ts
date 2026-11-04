import { NextResponse } from 'next/server';
import { adminAccess } from '@/lib/adminAccess';
import { apiError } from '@/lib/apiError';
import { addStocks } from '@/lib/stock';
import { readJson, privateHeaders } from '@/lib/http';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    await adminAccess(req, true);
    const result = await addStocks(await readJson(req, 1_048_576), true);
    return NextResponse.json({ success: true, data: result }, { headers: privateHeaders });
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return NextResponse.json({ success: false, errorCode: 'PRODUCT_CONFLICT' }, { status: 409, headers: privateHeaders });
    }
    return apiError(error);
  }
}
