import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ errorCode: 'INVALID_JSON', message: 'Format JSON tidak valid' }, { status: 400 });
    }
    
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ errorCode: 'INVALID_BODY', message: 'Body request tidak valid' }, { status: 400 });
    }

    const { productId, customerEmail, paymentMethod } = body;

    if (!productId || typeof productId !== 'number' || !Number.isInteger(productId) || productId <= 0) {
      return NextResponse.json({ errorCode: 'INVALID_PRODUCT_ID', message: 'ID Produk tidak valid' }, { status: 400 });
    }
    
    if (!customerEmail || typeof customerEmail !== 'string' || !customerEmail.trim() || customerEmail.length > 150) {
      return NextResponse.json({ errorCode: 'INVALID_EMAIL', message: 'Email tidak valid' }, { status: 400 });
    }
    
    const cleanEmail = customerEmail.trim();

    const serverKey = process.env.MIDTRANS_SERVER_KEY;
    if (!serverKey) {
      console.error('MIDTRANS_SERVER_KEY tidak ditemukan di .env');
      return NextResponse.json({ message: 'Server config error' }, { status: 500 });
    }

    // =====================================================================
    // 0. FASE RATE LIMITING (Mencegah Spam Checkout)
    // =====================================================================
    const rateLimitId = `checkout_${cleanEmail}`;
    const now = new Date();
    
    let rateLimit = await prisma.rateLimit.findUnique({ where: { id: rateLimitId } });
    if (!rateLimit || rateLimit.expiresAt < now) {
      rateLimit = await prisma.rateLimit.upsert({
        where: { id: rateLimitId },
        update: { points: 1, expiresAt: new Date(now.getTime() + 60 * 60 * 1000) }, // 1 jam
        create: { id: rateLimitId, points: 1, expiresAt: new Date(now.getTime() + 60 * 60 * 1000) },
      });
    } else {
      if (rateLimit.points >= 5) {
        return NextResponse.json({ errorCode: 'RATE_LIMIT_EXCEEDED', message: 'Terlalu banyak percobaan checkout. Coba lagi nanti.' }, { status: 429 });
      }
      await prisma.rateLimit.update({
        where: { id: rateLimitId },
        data: { points: rateLimit.points + 1 },
      });
    }

    // =====================================================================
    // 1. FASE DATABASE: ATOMIC LOCKING (Anti Race Condition / Rebutan Stok)
    // =====================================================================
    const transactionResult = await prisma.$transaction(async (tx) => {
      // Cari satu stok yang masih READY
      const availableStock = await tx.accountStock.findFirst({
        where: { productId, status: 'READY' },
        include: { product: true },
      });

      if (!availableStock) {
        throw new Error('STOCK_EMPTY');
      }

      // Kunci stok secara AMAN (Hanya berhasil jika statusnya MASIH READY di milidetik ini)
      const lockedStock = await tx.accountStock.updateMany({
        where: { 
          id: availableStock.id, 
          status: 'READY' 
        },
        data: { status: 'LOCKED' },
      });

      if (lockedStock.count === 0) {
        throw new Error('RACE_CONDITION'); // Berarti baru saja diambil orang sedetik lalu
      }

      const invoice = `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      // Buat pesanan baru
      const newOrder = await tx.order.create({
        data: {
          invoice,
          productId,
          accountStockId: availableStock.id,
          customerEmail: cleanEmail,
          totalAmount: availableStock.product.price,
          status: 'PENDING',
          paymentMethod: paymentMethod || 'Midtrans',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Kedaluwarsa 24 Jam
        },
      });

      return { order: newOrder, stock: availableStock };
    });

    const { order } = transactionResult;

    // =====================================================================
    // 2. FASE MIDTRANS: REQUEST & AUTOMATIC ROLLBACK (Cegah Orphan Lock)
    // =====================================================================
    try {
      const authString = Buffer.from(`${serverKey}:`).toString('base64');
      const midtransUrl = process.env.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION === 'true'
        ? 'https://api.midtrans.com/v2/charge'
        : 'https://api.sandbox.midtrans.com/v2/charge';

      const response = await fetch(midtransUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${authString}`,
        },
        body: JSON.stringify({
          transaction_details: {
            order_id: order.invoice,
            gross_amount: order.totalAmount,
          },
          payment_type: 'qris',
          qris: {
            acquirer: 'gopay',
          },
          customer_details: {
            email: cleanEmail,
          },
        }),
      });

      const data = await response.json();

      const qrImageUrl = data.actions?.find(
        (action: { name: string; url: string }) => action.name === 'generate-qr-code'
      )?.url;

      if (!response.ok || data.status_code !== '201' || (!data.qr_string && !qrImageUrl)) {
        throw new Error(data.error_messages?.join(', ') || 'Gagal mendapat QRIS dari gateway');
      }

      const qrisData = qrImageUrl || data.qr_string;

      await prisma.order.updateMany({
        where: { id: order.id, status: 'PENDING' },
        data: { qrisUrl: qrisData },
      });

      // SUKSES! Kembalikan token ke frontend
      return NextResponse.json({
        success: true,
        data: {
          qrisUrl: qrisData,
          invoice: order.invoice,
          accessToken: order.accessToken,
        },
      }, { status: 200 });

    } catch (midtransError: unknown) {
      // 🚨 Jangan rollback ke CANCELLED agar rekonsiliasi via webhook masih bisa berjalan jika network timeout
      console.error('Koneksi Midtrans Gagal/Timeout, membiarkan PENDING...', midtransError);

      return NextResponse.json({ 
        errorCode: 'GATEWAY_ERROR', message: 'Payment gateway sedang gangguan. Silakan coba lagi nanti.' 
      }, { status: 500 });
    }

  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.message === 'STOCK_EMPTY') {
        return NextResponse.json({ errorCode: 'STOCK_EMPTY', message: 'Maaf, stok sudah habis.' }, { status: 400 });
      }
      if (error.message === 'RACE_CONDITION') {
        return NextResponse.json({ errorCode: 'RACE_CONDITION', message: 'Stok sedang diproses pembeli lain, coba lagi dalam beberapa detik.' }, { status: 409 });
      }
    }
    console.error('Checkout error:', error);
    return NextResponse.json({ errorCode: 'SYSTEM_ERROR', message: 'Terjadi kesalahan sistem' }, { status: 500 });
  }
}