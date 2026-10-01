import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import { sendTelegramNotification } from '@/lib/telegram';

export const dynamic = 'force-dynamic';

interface MidtransNotificationBody {
  order_id?: string;
  status_code?: string;
  gross_amount?: string;
  signature_key?: string;
  transaction_status?: string;
  fraud_status?: string;
}

export async function POST(req: Request) {
  try {
    let body: MidtransNotificationBody;
    try {
      body = (await req.json()) as MidtransNotificationBody;
    } catch {
      return NextResponse.json({ message: 'Invalid JSON format' }, { status: 400 });
    }
    const { order_id, status_code, gross_amount, signature_key } = body;

    if (!order_id || !status_code || !gross_amount || !signature_key) {
      return NextResponse.json({ message: 'Payload tidak lengkap' }, { status: 400 });
    }

    const serverKey = process.env.MIDTRANS_SERVER_KEY;
    if (!serverKey) return NextResponse.json({ message: 'Server config error' }, { status: 500 });

    // 1. Validasi Hash SHA-512
    const inputString = `${order_id}${status_code}${gross_amount}${serverKey}`;
    const calculatedSignature = crypto.createHash('sha512').update(inputString).digest('hex');

    if (calculatedSignature !== signature_key) {
      return NextResponse.json({ message: 'Invalid signature key' }, { status: 403 });
    }

    // 2. Ambil Order
    const order = await prisma.order.findUnique({
      where: { invoice: order_id },
      include: { product: true, accountStock: true },
    });

    if (!order) return NextResponse.json({ message: 'Order tidak ditemukan' }, { status: 404 });

    // 3. Verifikasi Status dan Nominal melalui API Midtrans (menghindari trust pada webhook input)
    const midtransUrl = process.env.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION === 'true'
      ? `https://api.midtrans.com/v2/${order_id}/status`
      : `https://api.sandbox.midtrans.com/v2/${order_id}/status`;

    const authString = Buffer.from(`${serverKey}:`).toString('base64');
    const statusRes = await fetch(midtransUrl, {
      headers: { 'Authorization': `Basic ${authString}` }
    });
    
    if (!statusRes.ok) {
      return NextResponse.json({ message: 'Failed to verify transaction status' }, { status: 400 });
    }
    
    const confirmed = await statusRes.json();
    
    if (confirmed.status_code !== '200' && confirmed.status_code !== '201' && confirmed.status_code !== '202') {
      return NextResponse.json({ message: 'Transaction not valid on gateway' }, { status: 400 });
    }

    const amount = Number(confirmed.gross_amount);
    if (!Number.isFinite(amount) || amount !== order.totalAmount) {
      console.error(`Peringatan Manipulasi Nominal: Diharapkan ${order.totalAmount}, Diterima ${amount}`);
      return NextResponse.json({ message: 'Amount mismatch' }, { status: 400 });
    }

    const isPaymentSuccess = confirmed.status_code === '200' &&
      (confirmed.transaction_status === 'capture' || confirmed.transaction_status === 'settlement') &&
      (!confirmed.fraud_status || confirmed.fraud_status === 'accept');

    const isPaymentFailedOrExpired =
      confirmed.transaction_status === 'deny' || confirmed.transaction_status === 'expire' || confirmed.transaction_status === 'cancel';

    // 4. Update Atomik & Transisi Status Monotonic (High Severity Fix)
    if (isPaymentSuccess) {
      try {
        await prisma.$transaction(async (tx) => {
          const updatedOrder = await tx.order.updateMany({
            where: { id: order.id, status: 'PENDING' },
            data: { status: 'PAID' },
          });

          if (updatedOrder.count === 0) {
            throw new Error('STATUS_NOT_PENDING');
          }

          if (order.accountStockId) {
            const updatedStock = await tx.accountStock.updateMany({
              where: { id: order.accountStockId, status: 'LOCKED' },
              data: { status: 'SOLD' },
            });

            if (updatedStock.count !== 1) {
              throw new Error('STOCK_STATE_CONFLICT');
            }
          }
        });

        // Kirim notifikasi Telegram jika transaksi atomik berhasil
        const formattedTotal = new Intl.NumberFormat('id-ID', {
          style: 'currency', currency: 'IDR', minimumFractionDigits: 0,
        }).format(order.totalAmount);

        const telegramMsg = `
🌸 <b>PESANAN BARU LUNAS! (PAID)</b> 🌸

🧾 <b>Invoice:</b> <code>${order.invoice}</code>
📦 <b>Produk:</b> ${order.product?.name || 'Akun Premium'}
💰 <b>Total Bayar:</b> <b>${formattedTotal}</b>
💳 <b>Metode:</b> ${order.paymentMethod || 'Midtrans'}

🔒 <i>Detail kredensial disembunyikan. Status database di-update atomik ke SOLD.</i>
`.trim();

        await sendTelegramNotification(telegramMsg);

      } catch (error: unknown) {
        if (error instanceof Error && error.message === 'STATUS_NOT_PENDING') {
          console.log(`[Idempotent] Order ${order.invoice} sudah diproses sebelumnya.`);
          return NextResponse.json({ message: 'Already processed' }, { status: 200 });
        }
        throw error; 
      }

    } else if (isPaymentFailedOrExpired) {
      try {
        await prisma.$transaction(async (tx) => {
          // Hanya izinkan PENDING -> EXPIRED/CANCELLED
          const targetStatus = confirmed.transaction_status === 'cancel' ? 'CANCELLED' : 'EXPIRED';
          const expired = await tx.order.updateMany({
            where: { id: order.id, status: 'PENDING', accountStockId: order.accountStockId },
            data: { status: targetStatus, accountStockId: null },
          });
          
          if (expired.count > 0 && order.accountStockId) {
            const released = await tx.accountStock.updateMany({
              where: { id: order.accountStockId, status: 'LOCKED' },
              data: { status: 'READY' },
            });
            if (released.count !== 1) throw new Error('STOCK_STATE_CONFLICT');
          }
        });
      } catch (error) {
        console.error('Gagal update order expired:', error);
      }
    }

    return NextResponse.json({ message: 'Processed successfully' }, { status: 200 });
  } catch (error: unknown) {
    console.error('Webhook error:', error);
    return NextResponse.json({ message: 'Internal Error' }, { status: 500 });
  }
}