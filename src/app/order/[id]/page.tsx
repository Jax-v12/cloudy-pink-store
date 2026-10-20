/* eslint-disable @next/next/no-img-element */
'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import RobloxInstructions from '@/components/RobloxInstructions';
import OrderProgress from '@/components/OrderProgress';
import AppsOrderPanel, { type AppsOrder } from '@/components/AppsOrderPanel';
import { APPS_DELIVERY_TTL_MS } from '@/lib/appsProduct';
import { formatMoney, type Currency, type Region } from '@/lib/regionalPricing';
import RegionalPaymentSummary from '@/components/RegionalPaymentSummary';
import { orderNotice, formatQrCountdown, showFulfillmentDetails } from '@/lib/orderNotice';
import { qrisDownloadFilename, qrisExtensionForBlobMime, qrisExtensionForDataUrl } from '@/lib/qrisDownload';
import { buildAppsOtpWhatsappUrl, type AppsOtpState } from '@/lib/appsOtp';
import { saveRecentOrder } from '@/lib/recentOrders';
import { useLanguage } from '@/context/LanguageContext';

interface OrderDetail extends AppsOrder {
  invoice: string;
  type: 'APPS' | 'GAME' | 'ROBLOX';
  fulfillmentStatus: 'NOT_READY' | 'QUEUED' | 'PROCESSING' | 'WAITING_CUSTOMER' | 'COMPLETED' | 'REQUIRES_REVIEW';
  refundStatus: 'NONE' | 'REQUIRED' | 'COMPLETED';
  variantName: string | null;
  units: number;
  robloxDetail: { method: 'GAMEPASS' | 'GIFT_USERNAME' | 'LOGIN'; username: string; gamepassPrice: number | null } | null;
  gameDetail: { userId: string; zoneId: string | null } | null;
  totalAmount: number;
  currency: Currency; pricingRegion: Region; productSubtotal: number; paymentFee: number; discount: number;
  status: 'PENDING' | 'PAID' | 'EXPIRED' | 'CANCELLED';
  paymentMethod: string;
  qrisUrl: string | null;
  qrisCode: string | null;
  expiresAt: string;
  createdAt?: string;
  paidAt?: string | null;
  product: {
    name: string;
  };
  account: {
    emailAccount: string;
    passwordAccount: string;
    profileName: string | null;
    pin: string | null;
    additionalInfo: string | null;
  } | null;
  otp?: AppsOtpState | null;
  isAuthorized: boolean;
}

export default function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { language, setLanguage, t } = useLanguage();

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copiedAccount, setCopiedAccount] = useState(false);
  const [copiedOtp, setCopiedOtp] = useState(false);
  const [requestingOtp, setRequestingOtp] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const [appsRevision, setAppsRevision] = useState(0);
  const appsDeliveredAt = order?.appsService?.deliveredAt;
  const hasAppsDelivery = Boolean(order?.appsService?.delivery);
  useEffect(() => {
    if (!hasAppsDelivery || !appsDeliveredAt) return;
    const deadline = Date.parse(appsDeliveredAt) + APPS_DELIVERY_TTL_MS;
    const timer = setTimeout(() => setOrder(current => current?.appsService?.deliveredAt === appsDeliveredAt
      ? { ...current, appsService: { ...current.appsService, delivery: null } } : current), Number.isFinite(deadline) ? Math.max(0, deadline - Date.now()) : 0);
    return () => clearTimeout(timer);
  }, [appsDeliveredAt, hasAppsDelivery]);

  const orderStatus = order?.status ?? null;
  const orderExpiresAt = order?.expiresAt ?? null;

  useEffect(() => {
    if (!orderStatus) return;
    if (orderStatus === 'PENDING' && orderExpiresAt) {
      const interval = setInterval(() => setNow(Date.now()), 1000);
      return () => clearInterval(interval);
    }
    if (orderStatus === 'PAID') {
      const syncNow = () => setNow(Date.now());
      const onVisibilityChange = () => {
        if (document.visibilityState === 'visible') syncNow();
      };
      const interval = setInterval(syncNow, 30_000);
      window.addEventListener('focus', syncNow);
      document.addEventListener('visibilitychange', onVisibilityChange);
      return () => {
        clearInterval(interval);
        window.removeEventListener('focus', syncNow);
        document.removeEventListener('visibilitychange', onVisibilityChange);
      };
    }
  }, [orderStatus, orderExpiresAt]);
  
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();
    async function loadOrder() {
      let poll = true;
      try {
        const token = localStorage.getItem(`token_${id}`);
        const headers: HeadersInit = token ? { 'x-order-token': token } : {};
        const response = await fetch(`/api/orders/${encodeURIComponent(id)}`, {
          headers, signal: controller.signal,
        });
        const json = await response.json();
        if (!response.ok || !json.success) {
          if (response.status === 404) poll = false;
          throw new Error(response.status === 404 ? 'ORDER_NOT_FOUND' : 'SYSTEM_ERROR');
        }
        if (cancelled) return;
        if (json.data.status === 'PENDING') {
          void fetch(`/api/orders/${encodeURIComponent(id)}/payment`, { method: 'POST', headers, signal: controller.signal }).catch(() => {});
        }
        setOrder(json.data);
        saveRecentOrder({ invoice: json.data.invoice });
        setError('');
        poll = json.data.status === 'PENDING' ||
          (json.data.status === 'PAID' && json.data.fulfillmentStatus !== 'COMPLETED' && json.data.refundStatus !== 'COMPLETED') ||
          json.data.otp?.status === 'REQUESTED';
      } catch (error) {
        if (!cancelled) setError(error instanceof Error && error.message === 'ORDER_NOT_FOUND' ? 'ORDER_NOT_FOUND' : 'SYSTEM_ERROR');
      } finally {
        if (!cancelled) {
          setLoading(false);
          if (poll) timer = setTimeout(loadOrder, 4000);
        }
      }
    }
    void loadOrder();
    return () => { cancelled = true; controller.abort(); clearTimeout(timer); };
  }, [id, order?.otp?.status, appsRevision]);

  const formatRupiah = (amount: number) => formatMoney(amount, order?.currency ?? 'IDR', language);

  const handleCopyAccount = () => {
    if (!order?.account) return;
    const text = `Email: ${order.account.emailAccount}\nPassword: ${order.account.passwordAccount}${
      order.account.profileName ? `\nProfile: ${order.account.profileName}` : ''
    }${order.account.pin ? `\nPIN: ${order.account.pin}` : ''}${
      order.account.additionalInfo ? `\nInfo: ${order.account.additionalInfo}` : ''
    }`;
    navigator.clipboard.writeText(text);
    setCopiedAccount(true);
    setTimeout(() => setCopiedAccount(false), 2000);
  };

  const handleRequestOtp = async () => {
    if (!order || requestingOtp) return;
    setRequestingOtp(true);
    setOtpError('');
    try {
      const token = localStorage.getItem(`token_${id}`);
      const res = await fetch(`/api/orders/${encodeURIComponent(order.invoice)}/otp`, {
        method: 'POST',
        headers: token ? { 'x-order-token': token } : {},
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.errorCode === 'RATE_LIMIT_EXCEEDED' ? t.rateLimited : t.errSystem);
      }
      setOrder(prev => prev ? { ...prev, otp: json.data } : prev);
    } catch (err) {
      setOtpError(err instanceof Error ? err.message : t.errSystem);
    } finally {
      setRequestingOtp(false);
    }
  };

  const handleCopyOtp = () => {
    if (!order?.otp?.code) return;
    navigator.clipboard.writeText(order.otp.code);
    setCopiedOtp(true);
    setTimeout(() => setCopiedOtp(false), 2000);
  };

  const downloadQrisImage = async () => {
    if (!order?.qrisUrl || downloading) return;
    setDownloadError('');
    try {
      if (order.qrisUrl.startsWith('data:')) {
        const dataExt = qrisExtensionForDataUrl(order.qrisUrl);
        if (!dataExt) throw new Error('DOWNLOAD_FAILED');
        const link = document.createElement('a');
        link.href = order.qrisUrl;
        link.download = qrisDownloadFilename(order.invoice, dataExt);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
      }

      setDownloading(true);
      const token = localStorage.getItem(`token_${id}`);

      const response = await fetch(`/api/orders/${encodeURIComponent(order.invoice)}/qris/download`, {
        headers: token ? { 'x-order-token': token } : {},
      });

      if (!response.ok) {
        throw new Error('DOWNLOAD_FAILED');
      }

      const blob = await response.blob();
      const blobExt = qrisExtensionForBlobMime(blob.type);
      if (!blobExt) throw new Error('DOWNLOAD_FAILED');
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = qrisDownloadFilename(order.invoice, blobExt);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      setDownloadError(t.downloadFailed);
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-pink-50">
        <div className="text-pink-600 font-bold animate-pulse">{t.loadingOrder}</div>
      </main>
    );
  }

  if (error || !order) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-pink-50">
        <div className="bg-white p-6 rounded-3xl border-2 border-pink-200 text-center max-w-md shadow-lg">
          <p className="text-rose-600 font-bold mb-4">{error === 'ORDER_NOT_FOUND' ? t.orderAccessUnavailable : t.errSystem}</p>
          <Link
            href="/"
            className="px-4 py-2 bg-pink-500 text-white font-bold rounded-xl text-xs hover:bg-pink-600"
          >
            {t.btnBackHome}
          </Link>
        </div>
      </main>
    );
  }

  const notice = orderNotice(order);
  const nowUtc = new Date(now);
  const wibHours = (nowUtc.getUTCHours() + 7) % 24;
  const isOperational = wibHours >= 8 && wibHours < 21;

  const paidAtMs = order.paidAt ? Date.parse(order.paidAt) : NaN;
  const hasValidPaidAt = Number.isFinite(paidAtMs);
  const warrantyExpiryMs = hasValidPaidAt ? paidAtMs + 25 * 24 * 60 * 60 * 1000 : NaN;
  const isWarrantyActive = hasValidPaidAt && now < warrantyExpiryMs;
  const warrantyDaysRemaining = isWarrantyActive
    ? Math.max(1, Math.ceil((warrantyExpiryMs - now) / (24 * 60 * 60 * 1000)))
    : 0;

  const otpExpiresAtMs = order.otp?.expiresAt ? Date.parse(order.otp.expiresAt) : NaN;
  const effectiveOtp =
    order.otp && (!Number.isFinite(otpExpiresAtMs) || now < otpExpiresAtMs)
      ? order.otp
      : null;

  return (
    <main
      className="min-h-screen p-4 md:p-10 font-sans relative bg-fixed bg-cover bg-center"
      style={{ backgroundImage: "url('/bg-anya.jpg')" }}
    >
      <div className="fixed inset-0 bg-pink-950/40 backdrop-blur-[2px] pointer-events-none"></div>

      <div className="relative z-10 max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-4">
          <Link
            href="/"
            className="text-xs font-bold text-white bg-pink-700/80 hover:bg-pink-700 px-3 py-1.5 rounded-xl backdrop-blur-sm transition"
          >
            ← {t.btnBackHome}
          </Link>

          {/* Switch Bahasa: ID | MY | EN */}
          <div className="inline-flex bg-white/90 backdrop-blur-sm p-1 rounded-2xl border-2 border-pink-300 shadow-md">
            <button
              onClick={() => setLanguage('ID')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                language === 'ID'
                  ? 'bg-pink-500 text-white shadow-sm'
                  : 'text-neutral-600 hover:text-pink-600'
              }`}
            >
              ID
            </button>
            <button
              onClick={() => setLanguage('MY')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                language === 'MY'
                  ? 'bg-pink-500 text-white shadow-sm'
                  : 'text-neutral-600 hover:text-pink-600'
              }`}
            >
              MY
            </button>
            <button
              onClick={() => setLanguage('EN')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                language === 'EN'
                  ? 'bg-pink-500 text-white shadow-sm'
                  : 'text-neutral-600 hover:text-pink-600'
              }`}
            >
              EN
            </button>
          </div>
        </div>

        <div className="bg-white/95 text-slate-700 backdrop-blur-md rounded-3xl p-6 md:p-8 shadow-2xl border-4 border-pink-300">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b-2 border-pink-100 gap-2 mb-6">
            <div>
              <h1 className="text-xl font-black text-pink-700">{t.orderTitle}</h1>
              <p className="text-xs text-neutral-500">{order.type === 'APPS' ? order.appsSnapshot?.fulfillmentMode === 'ACTIVATION' ? t.apps.ACTIVATION : t.orderSubtitle : order.type === 'GAME' ? t.commerce.gameDescription : t.commerce.robloxDescription}</p>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-xs font-black tracking-wider uppercase self-start sm:self-auto ${
                order.status === 'PAID'
                  ? 'bg-emerald-100 text-emerald-700'
                  : order.status === 'PENDING'
                  ? 'bg-amber-100 text-amber-700 animate-pulse'
                  : order.status === 'CANCELLED'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-neutral-200 text-neutral-600'
              }`}
            >
              {order.status === 'PAID'
                ? t.statusPaid
                : order.status === 'PENDING'
                ? t.statusWaiting
                : order.status === 'CANCELLED'
                ? t.statusCancelled
                : t.statusExpired}
            </span>
          </div>

          <div className="bg-pink-50/70 p-4 rounded-2xl border border-pink-100 space-y-2 mb-6 text-xs">
            <div className="flex flex-col gap-1 sm:flex-row sm:gap-4">
              <span className="text-neutral-500">{t.invoiceLabel}</span>
              <span className="min-w-0 break-all sm:text-right font-mono font-bold text-neutral-800">{order.invoice}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">{t.productLabel}</span>
              <span className="font-bold text-neutral-800">{order.product.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">{t.paymentMethodLabel}</span>
              <span className="font-bold text-neutral-800">{order.paymentMethod}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-pink-200 text-sm">
              <span className="font-bold text-neutral-700">{t.totalPayLabel}</span>
              <span className="font-black text-pink-600">{formatRupiah(order.totalAmount)}</span>
            </div>
            {order.type === 'ROBLOX' && <RegionalPaymentSummary region={order.pricingRegion} quote={order} />}
          </div>

          <OrderProgress order={order} />
          {order.type === 'APPS' && <AppsOrderPanel order={order} now={now} refresh={() => setAppsRevision(n => n + 1)} />}

          {showFulfillmentDetails(order) && (
            <section className="bg-white text-slate-700 border border-pink-200 rounded-2xl p-5 mb-6 space-y-2 break-words" aria-live="polite">
              <p>{t.commerce.fulfillment}: <strong>{t.commerce[order.fulfillmentStatus]}</strong></p>
              {order.variantName && <p>{t.commerce.package}: {order.variantName} · {t.commerce.units}: {order.units}</p>}
              {order.robloxDetail && <p>{t.commerce.method}: {t.commerce[order.robloxDetail.method]} · {t.commerce.username}: {order.robloxDetail.username}</p>}
              {order.robloxDetail && order.status !== 'EXPIRED' && order.status !== 'CANCELLED' && order.refundStatus === 'NONE' && order.fulfillmentStatus !== 'COMPLETED' && <RobloxInstructions method={order.robloxDetail.method} gamepassPrice={order.robloxDetail.gamepassPrice} />}
              {order.robloxDetail?.method === 'GAMEPASS' && order.status === 'PAID' && order.fulfillmentStatus === 'COMPLETED' && order.refundStatus === 'NONE' && <p className="text-sm text-slate-600">{t.roblox.pendingNotice}</p>}
              {order.gameDetail && <p>{t.commerce.userId}: {order.gameDetail.userId} · {t.commerce.zoneId}: {order.gameDetail.zoneId}</p>}
              {order.refundStatus !== 'NONE' && <p>{t.commerce.refund}: {t.commerce[order.refundStatus]}</p>}
              {order.type !== 'APPS' && order.fulfillmentStatus === 'WAITING_CUSTOMER' && <p>{t.commerce.waitingHelp}</p>}
            </section>
          )}

          {/* PENDING QRIS */}
          {order.status === 'PENDING' && (
            order.qrisUrl ? (
              <div className="text-center space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-neutral-800">{t.scanNoticeTitle}</h3>
                  <p className="text-xs text-neutral-500 max-w-md mx-auto mt-1">
                    {t.scanNoticeSubtitle}
                  </p>
                  {formatQrCountdown(order.expiresAt, now) && (
                    <div className="mt-2">
                      <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-amber-50 border border-amber-300 text-amber-950 text-xs font-bold">
                        ⏱️ {t.qrActiveTimer}: <span className="font-mono text-pink-700">{formatQrCountdown(order.expiresAt, now)}</span>
                      </span>
                    </div>
                  )}
                </div>

                <div className="inline-block p-4 bg-white rounded-3xl border-4 border-pink-200 shadow-lg">
                  <img
                    src={order.qrisUrl}
                    alt="QRIS Barcode"
                    className="w-56 h-56 mx-auto rounded-xl"
                  />
                </div>

                <div className="flex justify-center max-w-xs mx-auto">
                  <button
                    disabled={downloading}
                    onClick={downloadQrisImage}
                    className="w-full py-2.5 px-4 bg-pink-500 hover:bg-pink-600 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-sm transition active:scale-95 cursor-pointer disabled:cursor-not-allowed"
                  >
                    {downloading ? t.btnProcessing : t.btnDownloadQris}
                  </button>
                </div>

                {downloadError && (
                  <p className="text-xs text-rose-500 font-semibold mt-1 max-w-sm mx-auto">{downloadError}</p>
                )}

                <p className="text-xs text-neutral-500 italic mt-2">{t.autoCheckNotice}</p>
              </div>
            ) : (
              <div className="text-center p-6 bg-sky-50 border border-sky-200 rounded-3xl space-y-2 mb-6" role="status">
                <p className="text-xs font-bold text-sky-800 uppercase tracking-wide">{t.statusWaiting}</p>
                <p className="text-xs text-sky-950 leading-relaxed max-w-md mx-auto">{t.paymentNeedsHelp}</p>
              </div>
            )
          )}

          {/* PAID: Akun Diserahkan */}
          {order.type === 'APPS' && order.status === 'PAID' && order.account && (
            <div className="space-y-4">
              <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-4">
                <h3 className="text-sm font-bold text-emerald-800 mb-1">{t.accountReadyTitle}</h3>
                <p className="text-[11px] text-emerald-600 mb-3">{t.accountReadySubtitle}</p>

                <div className="bg-white rounded-xl p-3 border border-emerald-100 space-y-2 text-xs font-mono">
                  <div>
                    <span className="text-neutral-400 block text-[10px]">{t.fieldEmail}</span>
                    <span className="font-bold text-neutral-800">{order.account.emailAccount}</span>
                  </div>
                  <div>
                    <span className="text-neutral-400 block text-[10px]">{t.fieldPassword}</span>
                    <span className="font-bold text-neutral-800">{order.account.passwordAccount}</span>
                  </div>
                  {order.account.profileName && (
                    <div>
                      <span className="text-neutral-400 block text-[10px]">{t.fieldProfile}</span>
                      <span className="font-bold text-neutral-800">{order.account.profileName}</span>
                    </div>
                  )}
                  {order.account.pin && (
                    <div>
                      <span className="text-neutral-400 block text-[10px]">PIN:</span>
                      <span className="font-bold text-neutral-800">{order.account.pin}</span>
                    </div>
                  )}
                  {order.account.additionalInfo && (
                    <div>
                      <span className="text-neutral-400 block text-[10px]">Info:</span>
                      <span className="font-bold text-neutral-800">{order.account.additionalInfo}</span>
                    </div>
                  )}
                </div>

                <button
                  onClick={handleCopyAccount}
                  className="mt-3 w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-sm transition active:scale-95 cursor-pointer"
                >
                  {copiedAccount ? t.accountCopied : t.btnCopyAccount}
                </button>
              </div>

              <div className="bg-pink-50/90 border-2 border-pink-200 rounded-2xl p-4 space-y-3" aria-live="polite">
                <div>
                  <h4 className="text-xs font-black text-pink-800">{t.otpHelpTitle}</h4>
                  <p className="text-[11px] text-neutral-600 mt-0.5 leading-relaxed">{t.otpHelpSubtitle}</p>
                  <div className="flex items-center gap-1.5 pt-1 text-[10px] font-bold">
                    <span className={isOperational ? 'text-emerald-700' : 'text-amber-700'}>
                      {isOperational ? t.adminOnlineStatus : t.adminOfflineStatus}
                    </span>
                  </div>
                </div>

                {effectiveOtp?.status === 'DELIVERED' && effectiveOtp.code && (
                  <div className="bg-white border-2 border-emerald-300 rounded-xl p-3 flex items-center justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-bold text-emerald-700 block">{t.otpDeliveredLabel}</span>
                      <span className="text-base font-mono font-black tracking-widest text-neutral-900">{effectiveOtp.code}</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyOtp}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition active:scale-95 cursor-pointer"
                    >
                      {copiedOtp ? t.copiedNotice : t.btnCopyOtp}
                    </button>
                  </div>
                )}

                {effectiveOtp?.status === 'REQUESTED' && (
                  <div className="bg-amber-50 border border-amber-300 text-amber-950 rounded-xl p-3 text-xs font-medium animate-pulse">
                    ⏳ {t.otpWaitingNotice}
                  </div>
                )}

                {otpError && (
                  <p role="alert" className="text-xs font-bold text-rose-600">{otpError}</p>
                )}

                <div className="grid sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={requestingOtp}
                    onClick={handleRequestOtp}
                    className="w-full py-2.5 px-3 bg-pink-500 hover:bg-pink-600 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-sm transition active:scale-95 cursor-pointer disabled:cursor-not-allowed"
                  >
                    {requestingOtp
                      ? t.btnProcessing
                      : effectiveOtp?.status === 'REQUESTED'
                      ? t.btnRetryOtpNotification
                      : effectiveOtp?.status === 'DELIVERED'
                      ? t.btnRequestOtpAgain
                      : t.btnRequestOtp}
                  </button>
                  <a
                    href={buildAppsOtpWhatsappUrl('6287867395872', order.invoice, order.product.name, order.account.profileName, t.otpWhatsappTemplate)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-sm transition active:scale-95 text-center flex items-center justify-center"
                  >
                    💬 {t.btnOtpWhatsapp}
                  </a>
                </div>
              </div>

              {/* Garansi 25 Hari berdasarkan paidAt */}
              {!order.appsSnapshot && (hasValidPaidAt ? (
                isWarrantyActive ? (
                  <div className="bg-emerald-50/90 border-2 border-emerald-300 rounded-2xl p-4 flex items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm" aria-hidden="true">🛡️</span>
                        <h4 className="text-xs font-black text-emerald-800">{t.warrantyBadgeTitle}</h4>
                      </div>
                      <p className="text-[11px] text-emerald-700 mt-0.5">
                        {t.warrantyDaysRemaining.replace('{days}', String(warrantyDaysRemaining))}
                      </p>
                    </div>
                    <span className="bg-emerald-600 text-white font-black text-[11px] px-2.5 py-1 rounded-xl shrink-0">
                      {t.warrantyDurationLabel}
                    </span>
                  </div>
                ) : (
                  <div className="bg-neutral-100 border-2 border-neutral-300 rounded-2xl p-4 flex items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm" aria-hidden="true">🛡️</span>
                        <h4 className="text-xs font-black text-neutral-700">{t.warrantyExpiredTitle}</h4>
                      </div>
                      <p className="text-[11px] text-neutral-600 mt-0.5">
                        {t.warrantyExpiredBody}
                      </p>
                    </div>
                    <span className="bg-neutral-500 text-white font-black text-[11px] px-2.5 py-1 rounded-xl shrink-0">
                      {t.warrantyExpiredBadge}
                    </span>
                  </div>
                )
              ) : (
                <div className="bg-sky-50/90 border-2 border-sky-200 rounded-2xl p-4">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm" aria-hidden="true">🛡️</span>
                    <h4 className="text-xs font-black text-sky-900">{t.warrantyInfoTitle}</h4>
                  </div>
                  <p className="text-[11px] text-sky-800 mt-0.5">
                    {t.warrantyInfoBody}
                  </p>
                </div>
              ))}
              {/* FAQ / Panduan Login Accordion */}
              <div className="bg-white/90 border-2 border-pink-200 rounded-2xl p-4 space-y-3">
                <h4 className="text-xs font-black text-pink-800 flex items-center gap-1.5">
                  <span>💡</span> {t.faqTitle}
                </h4>
                <div className="space-y-2 text-xs">
                  <details className="group border border-pink-100 rounded-xl p-2.5 bg-pink-50/40 cursor-pointer">
                    <summary className="font-bold text-neutral-800 group-open:text-pink-700 list-none flex justify-between items-center select-none">
                      <span>📺 {t.faqTvTitle}</span>
                      <span className="text-neutral-400 group-open:rotate-180 transition-transform">▾</span>
                    </summary>
                    <p className="mt-2 text-[11px] text-neutral-600 leading-relaxed border-t border-pink-100/60 pt-2">
                      {t.faqTvBody}
                    </p>
                  </details>

                  <details className="group border border-pink-100 rounded-xl p-2.5 bg-pink-50/40 cursor-pointer">
                    <summary className="font-bold text-neutral-800 group-open:text-pink-700 list-none flex justify-between items-center select-none">
                      <span>🏠 {t.faqHouseholdTitle}</span>
                      <span className="text-neutral-400 group-open:rotate-180 transition-transform">▾</span>
                    </summary>
                    <p className="mt-2 text-[11px] text-neutral-600 leading-relaxed border-t border-pink-100/60 pt-2">
                      {t.faqHouseholdBody}
                    </p>
                  </details>

                  <details className="group border border-pink-100 rounded-xl p-2.5 bg-pink-50/40 cursor-pointer">
                    <summary className="font-bold text-neutral-800 group-open:text-pink-700 list-none flex justify-between items-center select-none">
                      <span>🔒 {t.faqRulesTitle}</span>
                      <span className="text-neutral-400 group-open:rotate-180 transition-transform">▾</span>
                    </summary>
                    <p className="mt-2 text-[11px] text-neutral-600 leading-relaxed border-t border-pink-100/60 pt-2">
                      {t.faqRulesBody}
                    </p>
                  </details>
                </div>
              </div>
            </div>
          )}

          {notice && notice !== 'paymentPending' && <p role="status" className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm leading-relaxed text-sky-950">{t.invoiceStatus[notice]}</p>}

          {/* EXPIRED atau CANCELLED */}
          {(order.status === 'EXPIRED' || order.status === 'CANCELLED') && (
            <div className="text-center py-6">
              <p className="text-xs text-rose-600 font-bold mb-3">{order.status === 'EXPIRED' ? t.expiredNotice : t.orderCancelled}</p>
              <Link
                href="/"
                className="px-4 py-2 bg-pink-500 text-white font-bold rounded-xl text-xs hover:bg-pink-600 inline-block"
              >
                {t.btnBackHome}
              </Link>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
