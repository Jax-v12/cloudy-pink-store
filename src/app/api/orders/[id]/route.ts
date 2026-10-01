import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { decryptData } from '@/lib/crypto';

function safeDecrypt(encryptedText: string): string {
  try {
    const parts = encryptedText.split(':');
    // IV is 16 bytes (32 hex chars), authTag is 16 bytes (32 hex chars)
    if (parts.length !== 3 || parts[0].length !== 32 || parts[1].length !== 32) {
      return encryptedText; // Fallback for old plaintext
    }
    return decryptData(encryptedText);
  } catch (err: unknown) {
    console.error('Gagal mendekripsi data:', err);
    return '[Data tidak dapat didekripsi]';
  }
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const url = new URL(req.url);
    const token = req.headers.get('x-order-token') || url.searchParams.get('token');

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
        { success: false, errorCode: 'ORDER_NOT_FOUND', message: 'Pesanan tidak ditemukan.' },
        { status: 404 }
      );
    }

    const isAuthorized = Boolean(token && token === order.accessToken);

    let accountData = null;

    if (order.status === 'PAID' && order.accountStock && isAuthorized) {
      accountData = {
        emailAccount: safeDecrypt(order.accountStock.emailAccount),
        passwordAccount: safeDecrypt(order.accountStock.passwordAccount),
        profileName: order.accountStock.profileName,
        pin: order.accountStock.pin ? safeDecrypt(order.accountStock.pin) : null,
        additionalInfo: order.accountStock.additionalInfo ? safeDecrypt(order.accountStock.additionalInfo) : null,
      };
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
    }, {
      headers: {
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error: unknown) {
    console.error('Fetch order error:', error);
    return NextResponse.json(
      { success: false, message: 'Terjadi kesalahan sistem saat mengambil data pesanan.' },
      { status: 500 }
    );
  }
}