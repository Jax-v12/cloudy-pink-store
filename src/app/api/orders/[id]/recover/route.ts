import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ success: false, message: 'Invalid JSON format' }, { status: 400 });
    }
    const { email } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ success: false, message: 'Email tidak valid.' }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { invoice: id },
    });

    if (!order) {
      return NextResponse.json({ success: false, message: 'Pesanan tidak ditemukan.' }, { status: 404 });
    }

    if (order.customerEmail.toLowerCase() !== email.toLowerCase().trim()) {
      return NextResponse.json({ success: false, message: 'Email tidak sesuai dengan data pesanan.' }, { status: 401 });
    }

    return NextResponse.json({
      success: true,
      token: order.accessToken,
    });
  } catch (error: unknown) {
    console.error('Recover order error:', error);
    return NextResponse.json({ success: false, message: 'Gagal memulihkan akses pesanan.' }, { status: 500 });
  }
}
