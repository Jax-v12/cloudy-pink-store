import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { adminAccess } from '@/lib/adminAccess';
import { apiError } from '@/lib/apiError';
import { addStocks } from '@/lib/stock';
import { readJson, pagination, pageResult, privateHeaders } from '@/lib/http';

export async function POST(req: Request) {
  try {
    await adminAccess(req, true);
    const result = await addStocks(await readJson(req), false);
    return NextResponse.json({ success: true, data: result }, { headers: privateHeaders });
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return NextResponse.json({ success: false, errorCode: 'DUPLICATE_STOCK' }, { status: 409, headers: privateHeaders });
    }
    return apiError(error);
  }
}

export async function GET(req: Request) {
  try {
    await adminAccess(req);
    const { limit, cursor } = pagination(req);
    const rows = await prisma.accountStock.findMany({
      take: limit + 1, ...(cursor ? { where: { id: { lt: cursor } } } : {}),
      select: { id: true, productId: true, profileName: true, status: true, createdAt: true,
        product: { select: { name: true, price: true, category: true } } },
      orderBy: { id: 'desc' },
    });
    return NextResponse.json({ success: true, ...pageResult(rows, limit) }, { headers: privateHeaders });
  } catch (error) {
    return apiError(error);
  }
}
