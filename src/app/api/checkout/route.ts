import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { InputError, readJson, positiveInt, privateHeaders, logFailure } from '@/lib/http';
import { clientKey, consumeRateLimit } from '@/lib/rateLimit';
import { gatewayBase, gatewayHeaders, extractQr } from '@/lib/midtrans';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { productId, customerEmail } = await readJson(req, 4096);
    if (!positiveInt(productId) || typeof customerEmail !== 'string' || customerEmail.length > 150 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail.trim())) throw new InputError();
    const email = customerEmail.trim().toLowerCase();
    const headers = gatewayHeaders();
    if (!(await consumeRateLimit('checkout-source', clientKey(req), 10, 15 * 60_000)) ||
        !(await consumeRateLimit('checkout-email', email, 5, 60 * 60_000))) {
      return NextResponse.json({ errorCode: 'RATE_LIMIT_EXCEEDED' }, { status: 429 });
    }
    const order = await prisma.$transaction(async tx => {
      const stock = await tx.accountStock.findFirst({
        where: { productId, status: 'READY', order: null },
        select: { id: true, product: { select: { price: true } } }, orderBy: { id: 'asc' },
      });
      if (!stock) throw new Error('STOCK_EMPTY');
      const locked = await tx.accountStock.updateMany({ where: { id: stock.id, status: 'READY' }, data: { status: 'LOCKED' } });
      if (locked.count !== 1) throw new Error('RACE_CONDITION');
      return tx.order.create({ data: {
        invoice: `INV-${crypto.randomUUID()}`, productId, accountStockId: stock.id,
        customerEmail: email, totalAmount: stock.product.price, status: 'PENDING',
        paymentMethod: 'QRIS', expiresAt: new Date(Date.now() + 24 * 60 * 60_000),
      } });
    });
    let qr: string | null = null;
    try {
      const response = await fetch(`${gatewayBase()}/v2/charge`, {
        method: 'POST', headers, signal: AbortSignal.timeout(15_000), redirect: 'error',
        body: JSON.stringify({
          transaction_details: { order_id: order.invoice, gross_amount: order.totalAmount },
          payment_type: 'qris', qris: { acquirer: 'gopay' }, customer_details: { email },
        }),
      });
      const data = await response.json();
      if (!response.ok || data?.status_code !== '201' || data.order_id !== order.invoice ||
          Number(data.gross_amount) !== order.totalAmount || data.currency !== 'IDR') throw new Error('CHARGE_UNCONFIRMED');
      qr = extractQr(data);
      if (!qr) throw new Error('QR_UNAVAILABLE');
      await prisma.order.updateMany({ where: { id: order.id, status: 'PENDING' }, data: { qrisUrl: qr } });
    } catch (error) {
      logFailure('Charge requires reconciliation', error);
      // Keep the reservation and return its access token, so a timeout never
      // strands the buyer or encourages a second charge for a new invoice.
    }
    return NextResponse.json({ success: true, data: {
      invoice: order.invoice, accessToken: order.accessToken, qrisUrl: qr,
    } }, { status: qr ? 200 : 202, headers: privateHeaders });
  } catch (error) {
    if (error instanceof InputError) return NextResponse.json({ errorCode: 'INVALID_INPUT' }, { status: error.status });
    if (error instanceof Error && ['STOCK_EMPTY', 'RACE_CONDITION'].includes(error.message)) {
      return NextResponse.json({ errorCode: error.message }, { status: error.message === 'STOCK_EMPTY' ? 400 : 409 });
    }
    logFailure('Checkout failed', error);
    return NextResponse.json({ errorCode: 'SYSTEM_ERROR' }, { status: 500 });
  }
}
