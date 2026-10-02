import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { decryptData, decryptLegacyField } from '@/lib/crypto';
import { logFailure, privateHeaders } from '@/lib/http';
import QRCode from 'qrcode';
import { isGatewayQrUrl } from '@/lib/midtrans';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const token = req.headers.get('x-order-token');
    if (!token || token.length > 128 || id.length > 191) {
      return NextResponse.json({ success: false, errorCode: 'ORDER_NOT_FOUND' }, { status: 404, headers: privateHeaders });
    }
    // Authorize in the query, before reading the associated credentials.
    const order = await prisma.order.findFirst({
      where: { invoice: id, accessToken: token },
      include: { product: { select: { name: true } }, accountStock: true },
    });
    if (!order) return NextResponse.json({ success: false, errorCode: 'ORDER_NOT_FOUND' }, { status: 404, headers: privateHeaders });
    const stock = order.status === 'PAID' ? order.accountStock : null;
    const account = stock ? {
      emailAccount: decryptLegacyField(stock.emailAccount),
      passwordAccount: decryptData(stock.passwordAccount),
      profileName: stock.profileName,
      pin: stock.pin ? decryptLegacyField(stock.pin) : null,
      additionalInfo: stock.additionalInfo ? decryptLegacyField(stock.additionalInfo) : null,
    } : null;
    const qrisCode = order.status === 'PENDING' && order.qrisUrl?.startsWith('000201') && order.qrisUrl.length <= 3000 ? order.qrisUrl : null;
    const qrisUrl = order.status !== 'PENDING' ? null : qrisCode
      ? await QRCode.toDataURL(qrisCode, { width: 500, errorCorrectionLevel: 'L' })
      : order.qrisUrl && isGatewayQrUrl(order.qrisUrl) ? order.qrisUrl : null;
    return NextResponse.json({ success: true, data: {
      invoice: order.invoice, totalAmount: order.totalAmount, status: order.status,
      paymentMethod: order.paymentMethod, qrisUrl, qrisCode,
      expiresAt: order.expiresAt, product: order.product, account, isAuthorized: true,
    } }, { headers: privateHeaders });
  } catch (error) {
    logFailure('Order retrieval failed', error);
    return NextResponse.json({ success: false, errorCode: 'SYSTEM_ERROR' }, { status: 500, headers: privateHeaders });
  }
}
