import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { productId, customerEmail, paymentMethod } = body;

    if (!productId || !customerEmail) {
      return NextResponse.json({ errorCode: 'INCOMPLETE_DATA', message: 'Data tidak lengkap' }, { status: 400 });
    }

    const serverKey = process.env.MIDTRANS_SERVER_KEY;
    if (!serverKey) {
      console.error('MIDTRANS_SERVER_KEY tidak ditemukan di .env');
      return NextResponse.json({ message: 'Server config error' }, { status: 500 });
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
          status: 'READY' // Syarat ketat agar kebal dari request yang masuk bersamaan
        },
        data: { status: 'LOCKED' },
      });

      if (lockedStock.count === 0) {
        throw new Error('RACE_CONDITION'); // Berarti baru saja diambil orang sedetik lalu
      }

      // Buat Invoice unik
      const invoice = `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      // Buat pesanan baru
      // Buat pesanan baru
      const newOrder = await tx.order.create({
        data: {
          invoice,
          productId,
          accountStockId: availableStock.id,
          customerEmail,
          totalAmount: availableStock.product.price,
          status: 'PENDING',
          paymentMethod: paymentMethod || 'Midtrans',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // <--- TAMBAHIN BARIS INI (Set kedaluwarsa 24 Jam dari sekarang)
        },
      });

      return { order: newOrder, stock: availableStock };
    });

    const { order, stock } = transactionResult;

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
            email: customerEmail,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.qr_string) {
        throw new Error(data.error_messages?.join(', ') || 'Gagal mendapat QRIS');
      }

      await prisma.order.updateMany({
        where: { id: order.id, status: 'PENDING' },
        data: { qrisUrl: data.qr_string },
      });

      // SUKSES! Kembalikan token ke frontend
      return NextResponse.json({
        success: true,
        data: {
          qrisUrl: data.qr_string,
          invoice: order.invoice,
          accessToken: order.accessToken,
        },
      }, { status: 200 });

    } catch (midtransError: unknown) {
      // 🚨 ROLLBACK KOMPENSASI: Jika API Midtrans Error/Timeout
      console.error('Koneksi Midtrans Gagal, melakukan rollback stok...', midtransError);

      await prisma.$transaction(async (tx) => {
        // 1. Batalkan pesanan secara kondisional (Pencegahan bentrok dengan webhook telat)
        await tx.order.updateMany({
          where: { id: order.id, status: 'PENDING' },
          data: { status: 'CANCELLED' }, // Status CANCELLED menandakan kegagalan sistem
        });
        
        // 2. Kembalikan stok menjadi READY agar bisa dibeli orang lain
        await tx.accountStock.updateMany({
          where: { id: stock.id, status: 'LOCKED' },
          data: { status: 'READY' },
        });
      });

      return NextResponse.json({ 
        errorCode: 'GATEWAY_ERROR', message: 'Payment gateway sedang gangguan. Stok akun telah kami kembalikan, silakan coba lagi.' 
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