import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { decryptData, decryptLegacyField } from '@/lib/crypto';
import { logFailure, privateHeaders } from '@/lib/http';
import QRCode from 'qrcode';
import { isValidOrderQrUrl } from '@/lib/midtrans';
import { invoiceAccessWhere } from '@/lib/invoiceAccess';
import { OTP_REPLY_PREFIX, OTP_REQUEST_ACTION, resolveAppsOtpState } from '@/lib/appsOtp';
import { parseAppsConfig, appsWarranty, appsDeliveryVisible } from '@/lib/appsProduct';
import { whatsappReady } from '@/lib/appsReminders';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const where = await invoiceAccessWhere(req, id);
    if (!where) {
      return NextResponse.json({ success: false, errorCode: 'ORDER_NOT_FOUND' }, { status: 404, headers: privateHeaders });
    }
    // Authorize in the query, before reading the associated credentials.
    const order = await prisma.order.findFirst({
      where,
      include: {
        product: { select: { name: true } },
        accountStock: true,
        appsService: true,
        appsSupport: true,
        robloxDetail: { select: { method: true, username: true, gamepassPrice: true } },
        gameDetail: { select: { userId: true, zoneId: true } },
        audits: {
          where: { OR: [{ action: OTP_REQUEST_ACTION }, { action: { startsWith: OTP_REPLY_PREFIX } }] },
          orderBy: { id: 'desc' },
          take: 5,
          select: { id: true, action: true, createdAt: true },
        },
      },
    });
    if (!order) return NextResponse.json({ success: false, errorCode: 'ORDER_NOT_FOUND' }, { status: 404, headers: privateHeaders });
    const appsSnapshot = order.type === 'APPS' ? parseAppsConfig(order.appsSnapshot) : null;
    const appsService = order.appsService;
    const appsDelivery = order.status === 'PAID' && order.refundStatus === 'NONE' && appsService?.deliveryCiphertext && appsDeliveryVisible(appsService.deliveredAt)
      ? decryptData(appsService.deliveryCiphertext) : null;
    const stock = order.status === 'PAID' ? order.accountStock : null;
    const account = stock ? {
      emailAccount: decryptLegacyField(stock.emailAccount),
      passwordAccount: decryptData(stock.passwordAccount),
      profileName: stock.profileName,
      pin: stock.pin ? decryptLegacyField(stock.pin) : null,
      additionalInfo: stock.additionalInfo ? decryptLegacyField(stock.additionalInfo) : null,
    } : null;
    const otp = order.type === 'APPS' && order.status === 'PAID' && order.refundStatus === 'NONE' && stock
      ? resolveAppsOtpState(order.audits, true)
      : null;
    const qrisCode = order.status === 'PENDING' && order.qrisUrl?.startsWith('000201') && order.qrisUrl.length <= 3000 ? order.qrisUrl : null;
    // Remote QR display uses the same environment-pinned policy as the
    // download proxy: a sandbox QR stays hidden once the store runs in
    // production mode (and vice versa) so display never promises a download
    // that the proxy would reject with INVALID_QR_URL.
    const qrisUrl = order.status !== 'PENDING' ? null : qrisCode
      ? await QRCode.toDataURL(qrisCode, { width: 500, errorCorrectionLevel: 'L' })
      : order.qrisUrl && isValidOrderQrUrl(order.qrisUrl) ? order.qrisUrl : null;
    return NextResponse.json({ success: true, data: {
      invoice: order.invoice, totalAmount: order.totalAmount, status: order.status,
      type: order.type, currency: order.currency, pricingRegion: order.pricingRegion, productSubtotal: order.productSubtotal ?? order.totalAmount, paymentFee: order.paymentFee, discount: order.discount, fulfillmentStatus: order.fulfillmentStatus, refundStatus: order.refundStatus,
      variantName: order.variantName, units: order.units, robloxDetail: order.robloxDetail, gameDetail: order.gameDetail,
      ...(order.type === 'APPS' ? { appsSnapshot, appsWarranty: appsWarranty(appsSnapshot, order.paidAt, appsService?.activeFrom ?? null),
        appsSupport: order.appsSupport ? { reason: order.appsSupport.reason, status: order.appsSupport.status, updatedAt: order.appsSupport.updatedAt } : null,
        appsService: appsService ? { deliveredAt: appsService.deliveredAt, acknowledgedAt: appsService.acknowledgedAt, activeFrom: appsService.activeFrom, activeUntil: appsService.activeUntil, delivery: appsDelivery,
          reminderOptIn: appsService.reminderOptIn, reminderVerified: !!appsService.reminderVerifiedAt, remindersAvailable: whatsappReady() } : null } : {}),
      paymentMethod: order.paymentMethod, qrisUrl, qrisCode,
      expiresAt: order.expiresAt, createdAt: order.createdAt.toISOString(), paidAt: order.paidAt ? order.paidAt.toISOString() : null, product: { name: order.productName || order.product.name }, account, otp, isAuthorized: true,
    } }, { headers: privateHeaders });
  } catch (error) {
    logFailure('Order retrieval failed', error);
    return NextResponse.json({ success: false, errorCode: 'SYSTEM_ERROR' }, { status: 500, headers: privateHeaders });
  }
}
