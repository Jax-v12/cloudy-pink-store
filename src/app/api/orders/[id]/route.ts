import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

function decrypt(text: string): string {
  try {
    const rawKey = process.env.ENCRYPTION_KEY || '';
    
    // Samakan pembersihnya dengan yang ada di admin/stock
    const keyHex = rawKey.replace(/[^a-fA-F0-9]/g, '').slice(0, 64);
    
    if (keyHex.length !== 64) {
      throw new Error('Key tidak valid.');
    }
    
    const key = Buffer.from(keyHex, 'hex');
    const textParts = text.split(':');
    if (textParts.length < 2) return text;
    
    const iv = Buffer.from(textParts.shift() || '', 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return decrypted.toString('utf-8');
  } catch (err: unknown) {
    console.error('Gagal mendekripsi data:', err);
    return '***[Gagal dekripsi]***';
  }
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const url = new URL(req.url);
    const token = url.searchParams.get('token');

    const order = await prisma.order.findUnique({
      where: { invoice: id },
      include: {
        product: {
          select: {
            name: true,
            price: true,
          },
        },
        accountStock: true,
      },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, message: 'Pesanan tidak ditemukan.' },
        { status: 404 }
      );
    }

    let accountData = null;
    const isAuthorized = Boolean(token && token === order.accessToken);

    if (order.status === 'PAID' && order.accountStock) {
      if (isAuthorized) {
        accountData = {
          emailAccount: order.accountStock.emailAccount,
          passwordAccount: decrypt(order.accountStock.passwordAccount),
          profileName: order.accountStock.profileName,
          pin: order.accountStock.pin,
          additionalInfo: order.accountStock.additionalInfo,
        };
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        invoice: order.invoice,
        customerEmail: order.customerEmail,
        totalAmount: order.totalAmount,
        status: order.status,
        paymentMethod: order.paymentMethod,
        qrisUrl: order.qrisUrl,
        expiresAt: order.expiresAt,
        product: {
          name: order.product.name,
        },
        account: accountData,
        isAuthorized,
      },
    });
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : 'Terjadi kesalahan sistem saat mengambil data pesanan.';
    console.error('Fetch order error:', errMessage);
    return NextResponse.json(
      { success: false, message: errMessage },
      { status: 500 }
    );
  }
}