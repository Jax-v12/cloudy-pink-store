import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { decryptData } from '@/lib/crypto';

function safeDecrypt(encryptedText: string): string {
  try {
    return decryptData(encryptedText);
  } catch (err: unknown) {
    console.error('Gagal mendekripsi data (kemungkinan data stok lama):', err);
    return '[Data stok lama tidak kompatibel]';
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
          passwordAccount: safeDecrypt(order.accountStock.passwordAccount),
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