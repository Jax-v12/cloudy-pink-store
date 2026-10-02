import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdminAuth } from '@/lib/auth';
import { addStocks } from '@/lib/stock';
import { InputError, readJson, logFailure, pagination, pageResult, privateHeaders } from '@/lib/http';

export async function POST(req: Request) {
  try {
    if (!(await verifyAdminAuth(req))) return NextResponse.json({ success: false }, { status: 401 });
    const result = await addStocks(await readJson(req), false);
    return NextResponse.json({ success: true, data: result }, { headers: privateHeaders });
  } catch (error) {
    if (error instanceof InputError) return NextResponse.json({ success: false, errorCode: 'INVALID_INPUT' }, { status: error.status });
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return NextResponse.json({ success: false, errorCode: 'DUPLICATE_STOCK' }, { status: 409 });
    }
    logFailure('Stock insertion failed', error);
    return NextResponse.json({ success: false, errorCode: 'SYSTEM_ERROR' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    if (!(await verifyAdminAuth(req))) return NextResponse.json({ success: false }, { status: 401 });
    const { limit, cursor } = pagination(req);
    const rows = await prisma.accountStock.findMany({
      take: limit + 1, ...(cursor ? { where: { id: { lt: cursor } } } : {}),
      select: { id: true, productId: true, profileName: true, status: true, createdAt: true,
        product: { select: { name: true, price: true, category: true } } },
      orderBy: { id: 'desc' },
    });
    return NextResponse.json({ success: true, ...pageResult(rows, limit) }, { headers: privateHeaders });
  } catch (error) {
    if (error instanceof InputError) return NextResponse.json({ success: false, errorCode: 'INVALID_INPUT' }, { status: error.status });
    logFailure('Stock listing failed', error);
    return NextResponse.json({ success: false, errorCode: 'SYSTEM_ERROR' }, { status: 500 });
  }
}
