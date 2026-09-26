import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

interface MidtransNotificationBody {
  order_id?: string;
  status_code?: string;
  gross_amount?: string;
  signature_key?: string;
  transaction_status?: string;
  fraud_status?: string;
}

// Helper Telegram
async function sendTelegramNotification(message: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim().replace(/^["']|["']$/g, '');
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID?.trim().replace(/^["']|["']$/g, '');

  if (!token || !chatId) return;

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' }),
    });
  } catch (error) {
    console.error('[Telegram] Error:', error);
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as MidtransNotificationBody;
    const { order_id, status_code, gross_amount, signature_key, transaction_status, fraud_status } = body;

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

    // 3. Validasi Nominal Ketat (Medium Severity Fix)
    const receivedAmount = Math.round(Number(gross_amount));
    if (receivedAmount !== order.totalAmount) {
      console.error(`Peringatan Manipulasi Nominal: Diharapkan ${order.totalAmount}, Diterima ${receivedAmount}`);
      return NextResponse.json({ message: 'Amount mismatch' }, { status: 400 });
    }

    const isPaymentSuccess =
      (transaction_status === 'capture' && fraud_status === 'accept') ||
      transaction_status === 'settlement';

    const isPaymentFailedOrExpired =
      transaction_status === 'deny' || transaction_status === 'expire' || transaction_status === 'cancel';

    // 4. Update Atomik & Transisi Status Monotonic (High Severity Fix)
    if (isPaymentSuccess) {
      try {
        await prisma.$transaction(async (tx) => {
          // Hanya izinkan PENDING -> PAID
          const updatedOrder = await tx.order.updateMany({
            where: { id: order.id, status: 'PENDING' },
            data: { status: 'PAID' },
          });

          if (updatedOrder.count === 0) {
            throw new Error('STATUS_NOT_PENDING');
          }

          if (order.accountStockId) {
            // Hanya izinkan LOCKED -> SOLD
            const updatedStock = await tx.accountStock.updateMany({
              where: { id: order.accountStockId, status: 'LOCKED' },
              data: { status: 'SOLD' },
            });
            
            if (updatedStock.count === 0) {
              throw new Error('STOCK_NOT_LOCKED');
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
        if (error instanceof Error && (error.message === 'STATUS_NOT_PENDING' || error.message === 'STOCK_NOT_LOCKED')) {
          console.log(`[Idempotent] Order ${order.invoice} sudah diproses sebelumnya.`);
          return NextResponse.json({ message: 'Already processed' }, { status: 200 });
        }
        throw error; 
      }

    } else if (isPaymentFailedOrExpired) {
      try {
        await prisma.$transaction(async (tx) => {
          // Hanya izinkan PENDING -> EXPIRED
          const updatedOrder = await tx.order.updateMany({
            where: { id: order.id, status: 'PENDING' },
            data: { status: 'EXPIRED' },
          });

          if (updatedOrder.count > 0 && order.accountStockId) {
            // Hanya kembalikan stok jika stok masih LOCKED
            await tx.accountStock.updateMany({
              where: { id: order.accountStockId, status: 'LOCKED' },
              data: { status: 'READY' },
            });
          }
        });
      } catch (error) {
        console.error('Gagal rollback order expired:', error);
      }
    }

    return NextResponse.json({ message: 'Processed successfully' }, { status: 200 });
  } catch (error: unknown) {
    console.error('Webhook error:', error);
    return NextResponse.json({ message: 'Internal Error' }, { status: 500 });
  }
}