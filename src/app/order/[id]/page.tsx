/* eslint-disable @next/next/no-img-element */
'use client';

import { useEffect, useRef, useState, use } from 'react';
import Link from 'next/link';
import Image from 'next/image';
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
import { hasPendingInvoiceAccess, persistInvoiceAccess, readInvoiceAccess } from '@/lib/invoiceBrowser';

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
  currency: Currency;
  pricingRegion: Region;
  productSubtotal: number;
  paymentFee: number;
  discount: number;
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
  const [copyError, setCopyError] = useState<'account' | 'otp' | null>(null);
  const copyRequest = useRef(0);
  const [requestingOtp, setRequestingOtp] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const [appsRevision, setAppsRevision] = useState(0);
  const [, refreshInvoiceAccess] = useState(0);
  const accessPending = hasPendingInvoiceAccess(id);
  useEffect(() => {
    if (!accessPending) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [accessPending]);
  const appsDeliveredAt = order?.appsService?.deliveredAt;
  const hasAppsDelivery = Boolean(order?.appsService?.delivery);
  useEffect(() => () => { copyRequest.current++; }, [id]);
  useEffect(() => {
    if (!copiedAccount && !copiedOtp) return;
    const timer = setTimeout(() => {
      setCopiedAccount(false);
      setCopiedOtp(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, [copiedAccount, copiedOtp]);
  useEffect(() => {
    if (!hasAppsDelivery || !appsDeliveredAt) return;
    const deadline = Date.parse(appsDeliveredAt) + APPS_DELIVERY_TTL_MS;
    const timer = setTimeout(
      () =>
        setOrder(current =>
          current?.appsService?.deliveredAt === appsDeliveredAt
            ? { ...current, appsService: { ...current.appsService, delivery: null } }
            : current
        ),
      Number.isFinite(deadline) ? Math.max(0, deadline - Date.now()) : 0
    );
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
        const token = readInvoiceAccess(id);
        const headers: HeadersInit = token ? { 'x-order-token': token } : {};
        const response = await fetch(`/api/orders/${encodeURIComponent(id)}`, {
          headers,
          signal: controller.signal,
        });
        const json = await response.json();
        if (!response.ok || !json.success) {
          if (response.status === 404) poll = false;
          throw new Error(response.status === 404 ? 'ORDER_NOT_FOUND' : 'SYSTEM_ERROR');
        }
        if (cancelled) return;
        if (json.data.status === 'PENDING') {
          void fetch(`/api/orders/${encodeURIComponent(id)}/payment`, {
            method: 'POST',
            headers,
            signal: controller.signal,
          }).catch(() => {});
        }
        setOrder(json.data);
        saveRecentOrder({ invoice: json.data.invoice });
        setError('');
        poll =
          json.data.status === 'PENDING' ||
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
    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timer);
    };
  }, [id, order?.otp?.status, appsRevision]);

  const formatRupiah = (amount: number) => formatMoney(amount, order?.currency ?? 'IDR', language);

  async function copyText(text: string, kind: 'account' | 'otp') {
    const request = ++copyRequest.current;
    const setCopied = kind === 'account' ? setCopiedAccount : setCopiedOtp;
    setCopied(false);
    setCopyError(null);
    try {
      await navigator.clipboard.writeText(text);
      if (request === copyRequest.current) setCopied(true);
    } catch {
      if (request === copyRequest.current) setCopyError(kind);
    }
  }

  const handleCopyAccount = () => {
    if (!order?.account) return;
    const text = `Email: ${order.account.emailAccount}\nPassword: ${order.account.passwordAccount}${
      order.account.profileName ? `\nProfile: ${order.account.profileName}` : ''
    }${order.account.pin ? `\nPIN: ${order.account.pin}` : ''}${
      order.account.additionalInfo ? `\nInfo: ${order.account.additionalInfo}` : ''
    }`;
    void copyText(text, 'account');
  };

  const handleRequestOtp = async () => {
    if (!order || requestingOtp) return;
    setRequestingOtp(true);
    setOtpError('');
    try {
      const token = readInvoiceAccess(id);
      const res = await fetch(`/api/orders/${encodeURIComponent(order.invoice)}/otp`, {
        method: 'POST',
        headers: token ? { 'x-order-token': token } : {},
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.errorCode === 'RATE_LIMIT_EXCEEDED' ? t.rateLimited : t.errSystem);
      }
      setOrder(prev => (prev ? { ...prev, otp: json.data } : prev));
    } catch (err) {
      setOtpError(err instanceof Error ? err.message : t.errSystem);
    } finally {
      setRequestingOtp(false);
    }
  };

  const handleCopyOtp = () => {
    if (!order?.otp?.code) return;
    void copyText(order.otp.code, 'otp');
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
      const token = readInvoiceAccess(id);

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

  const accessNotice = accessPending && <section role="alert" className="mb-4 w-full max-w-2xl rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
    <p>{t.invoiceAccessUnsaved}</p>
    <button type="button" className="mt-3 min-h-11 rounded-xl border border-amber-700 bg-white px-4 py-2 font-bold focus-visible:outline-2 focus-visible:outline-amber-900" onClick={() => {
      persistInvoiceAccess(id);
      refreshInvoiceAccess(value => value + 1);
    }}>{t.saveInvoiceAccess}</button>
  </section>;

  if (loading) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-[#FFF9FC] p-4">
        {accessNotice}
        <div className="rounded-2xl border border-[#F1E4ED] bg-white px-6 py-4 text-sm font-extrabold text-pink-600 shadow-xs animate-pulse">
          {t.loadingOrder}
        </div>
      </main>
    );
  }

  if (error || !order) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-[#FFF9FC]">
        {accessNotice}
        <div className="bg-white p-7 rounded-3xl border border-[#F1E4ED] text-center max-w-md shadow-[0_14px_36px_-12px_rgba(157,23,77,0.1)]">
          <p className="text-rose-700 font-bold text-sm sm:text-base mb-5">
            {error === 'ORDER_NOT_FOUND' ? t.orderAccessUnavailable : t.errSystem}
          </p>
          <Link
            href="/"
            className="inline-block px-5 py-2.5 bg-pink-600 text-white font-extrabold rounded-xl text-xs sm:text-sm hover:bg-pink-700 transition"
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
  const warrantyDaysRemaining = isWarrantyActive ? Math.max(1, Math.ceil((warrantyExpiryMs - now) / (24 * 60 * 60 * 1000))) : 0;

  const otpExpiresAtMs = order.otp?.expiresAt ? Date.parse(order.otp.expiresAt) : NaN;
  const effectiveOtp = order.otp && (!Number.isFinite(otpExpiresAtMs) || now < otpExpiresAtMs) ? order.otp : null;

  return (
    <main className="relative min-h-screen bg-[#FFF9FC] p-4 sm:p-8 md:p-10 font-sans text-[#251D2C] overflow-x-clip">
      <div className="relative z-10 max-w-2xl mx-auto">
        {accessNotice}
        <Link href="/" className="mb-5 inline-block rounded-lg focus-visible:outline-2 focus-visible:outline-pink-600">
          <Image src="/store/logo.png" alt={t.commerce.brand} width={156} height={52} className="h-auto w-39" />
        </Link>
        <div className="flex justify-between items-center mb-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[#251D2C] bg-white border border-[#F1E4ED] hover:border-pink-300 hover:bg-pink-50 px-3.5 py-2 rounded-xl shadow-2xs transition"
          >
            ← {t.btnBackHome}
          </Link>

          {/* Switch Bahasa: ID | MY | EN */}
          <div className="inline-flex bg-white p-1 rounded-xl border border-[#F1E4ED] shadow-2xs">
            <button
              onClick={() => setLanguage('ID')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                language === 'ID' ? 'bg-pink-600 text-white shadow-2xs' : 'text-[var(--text-secondary)] hover:text-[#251D2C]'
              }`}
            >
              ID
            </button>
            <button
              onClick={() => setLanguage('MY')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                language === 'MY' ? 'bg-pink-600 text-white shadow-2xs' : 'text-[var(--text-secondary)] hover:text-[#251D2C]'
              }`}
            >
              MY
            </button>
            <button
              onClick={() => setLanguage('EN')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                language === 'EN' ? 'bg-pink-600 text-white shadow-2xs' : 'text-[var(--text-secondary)] hover:text-[#251D2C]'
              }`}
            >
              EN
            </button>
          </div>
        </div>

        <div className="bg-white text-[#251D2C] rounded-3xl p-5 sm:p-8 border border-[#F1E4ED]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#F1E4ED] gap-2.5 mb-6">
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#251D2C]">{t.orderTitle}</h1>
              <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-0.5">
                {order.type === 'APPS'
                  ? order.appsSnapshot?.fulfillmentMode === 'ACTIVATION'
                    ? t.apps.ACTIVATION
                    : t.orderSubtitle
                  : order.type === 'GAME'
                    ? t.commerce.gameDescription
                    : t.commerce.robloxDescription}
              </p>
            </div>
            <span
              className={`px-3.5 py-1.5 rounded-full text-xs font-extrabold tracking-wider uppercase self-start sm:self-auto border ${
                order.status === 'PAID'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : order.status === 'PENDING'
                    ? 'border-amber-200 bg-amber-50 text-amber-800 animate-pulse'
                    : order.status === 'CANCELLED'
                      ? 'border-rose-200 bg-rose-50 text-rose-700'
                      : 'border-neutral-200 bg-neutral-100 text-neutral-600'
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

          {order.status !== 'PENDING' && <OrderProgress order={order} />}

          <div className="space-y-2.5 mb-6 text-sm">
            <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:gap-4">
              <span className="text-[var(--text-secondary)] font-medium">{t.invoiceLabel}</span>
              <span className="min-w-0 break-all sm:text-right font-mono font-bold text-[#251D2C]">{order.invoice}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-[var(--text-secondary)] font-medium">{t.productLabel}</span>
              <span className="font-bold text-[#251D2C] text-right">{order.product.name}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-[var(--text-secondary)] font-medium">{t.paymentMethodLabel}</span>
              <span className="font-bold text-[#251D2C]">{order.paymentMethod}</span>
            </div>
            {order.type !== 'ROBLOX' && <div className="flex justify-between items-baseline pt-3 border-t border-[#F1E4ED] text-sm sm:text-base">
              <span className="font-bold text-[#251D2C]">{t.totalPayLabel}</span>
              <span className="text-lg sm:text-xl font-extrabold text-pink-600">{formatRupiah(order.totalAmount)}</span>
            </div>}
            {order.type === 'ROBLOX' && <RegionalPaymentSummary region={order.pricingRegion} quote={order} />}
          </div>

          {/* PENDING QRIS */}
          {order.status === 'PENDING' &&
            (order.qrisUrl ? (
              <div className="mb-6 border-y border-[#F1E4ED] py-5 text-center space-y-4">
                <div>
                  <h2 className="text-sm sm:text-base font-extrabold text-[#251D2C]">{t.scanNoticeTitle}</h2>
                  <p className="text-sm text-[var(--text-secondary)] max-w-md mx-auto mt-1">{t.scanNoticeSubtitle}</p>
                  {formatQrCountdown(order.expiresAt, now) && (
                    <div className="mt-2.5">
                      <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-amber-50 border border-amber-300 text-amber-950 text-xs font-bold">
                        ⏱️ {t.qrActiveTimer}:{' '}
                        <span className="font-mono text-pink-700">{formatQrCountdown(order.expiresAt, now)}</span>
                      </span>
                    </div>
                  )}
                </div>

                <div className="inline-block max-w-full bg-white p-3">
                  <img src={order.qrisUrl} alt="QRIS Barcode" width={224} height={224} className="w-56 max-w-full h-auto aspect-square object-contain mx-auto" />
                </div>

                <div className="flex justify-center max-w-xs mx-auto">
                  <button
                    disabled={downloading}
                    onClick={downloadQrisImage}
                    className="w-full py-2.5 px-4 bg-pink-600 hover:bg-pink-700 disabled:opacity-50 text-white font-extrabold rounded-xl text-xs sm:text-sm shadow-xs transition active:scale-95 cursor-pointer disabled:cursor-not-allowed"
                  >
                    {downloading ? t.btnProcessing : t.btnDownloadQris}
                  </button>
                </div>

                {downloadError && <p className="text-xs text-rose-600 font-semibold mt-1 max-w-sm mx-auto">{downloadError}</p>}

                <p className="text-sm text-[var(--text-secondary)] mt-2">{t.autoCheckNotice}</p>
              </div>
            ) : (
              <div className="text-center p-6 bg-[#FFF9FC] border border-[#F1E4ED] rounded-2xl space-y-2 mb-6" role="status">
                <p className="text-xs font-extrabold text-[#251D2C] uppercase tracking-wide">{t.statusWaiting}</p>
                <p className="text-xs text-[#251D2C] leading-relaxed max-w-md mx-auto">{t.paymentNeedsHelp}</p>
              </div>
            ))}

          {order.status === 'PENDING' && <OrderProgress order={order} />}
          {order.type === 'APPS' && <AppsOrderPanel order={order} now={now} refresh={() => setAppsRevision(n => n + 1)} />}

          {showFulfillmentDetails(order) && (
            <section
              className="bg-white text-[#251D2C] border border-[#F1E4ED] rounded-2xl p-5 mb-6 space-y-2 break-words text-sm"
              aria-live="polite"
            >
              <p>
                {t.commerce.fulfillment}: <strong className="font-extrabold">{t.commerce[order.fulfillmentStatus]}</strong>
              </p>
              {order.variantName && (
                <p>
                  {t.commerce.package}: {order.variantName} · {t.commerce.units}: {order.units}
                </p>
              )}
              {order.robloxDetail && (
                <p>
                  {t.commerce.method}: {t.commerce[order.robloxDetail.method]} · {t.commerce.username}: {order.robloxDetail.username}
                </p>
              )}
              {order.robloxDetail &&
                order.status !== 'EXPIRED' &&
                order.status !== 'CANCELLED' &&
                order.refundStatus === 'NONE' &&
                order.fulfillmentStatus !== 'COMPLETED' && (
                  <RobloxInstructions method={order.robloxDetail.method} gamepassPrice={order.robloxDetail.gamepassPrice} />
                )}
              {order.robloxDetail?.method === 'GAMEPASS' &&
                order.status === 'PAID' &&
                order.fulfillmentStatus === 'COMPLETED' &&
                order.refundStatus === 'NONE' && <p className="text-sm text-[var(--text-secondary)]">{t.roblox.pendingNotice}</p>}
              {order.gameDetail && (
                <p>
                  {t.commerce.userId}: {order.gameDetail.userId} · {t.commerce.zoneId}: {order.gameDetail.zoneId}
                </p>
              )}
              {order.refundStatus !== 'NONE' && (
                <p>
                  {t.commerce.refund}: {t.commerce[order.refundStatus]}
                </p>
              )}
              {order.type !== 'APPS' && order.fulfillmentStatus === 'WAITING_CUSTOMER' && <p>{t.commerce.waitingHelp}</p>}
            </section>
          )}

          {/* PAID: Akun Diserahkan */}
          {order.type === 'APPS' && order.status === 'PAID' && order.account && (
            <div className="space-y-4">
              <div className="bg-emerald-50/80 border border-emerald-200 rounded-2xl p-4 sm:p-5">
                <h3 className="text-sm sm:text-base font-extrabold text-emerald-900 mb-1">{t.accountReadyTitle}</h3>
                <p className="text-xs text-emerald-700 mb-3.5">{t.accountReadySubtitle}</p>

                <div className="break-all bg-white rounded-xl p-3.5 border border-emerald-200 space-y-2.5 text-xs font-mono">
                  <div>
                    <span className="text-[var(--text-secondary)] block text-[10px] font-sans font-semibold">{t.fieldEmail}</span>
                    <span className="font-bold text-[#251D2C]">{order.account.emailAccount}</span>
                  </div>
                  <div>
                    <span className="text-[var(--text-secondary)] block text-[10px] font-sans font-semibold">{t.fieldPassword}</span>
                    <span className="font-bold text-[#251D2C]">{order.account.passwordAccount}</span>
                  </div>
                  {order.account.profileName && (
                    <div>
                      <span className="text-[var(--text-secondary)] block text-[10px] font-sans font-semibold">{t.fieldProfile}</span>
                      <span className="font-bold text-[#251D2C]">{order.account.profileName}</span>
                    </div>
                  )}
                  {order.account.pin && (
                    <div>
                      <span className="text-[var(--text-secondary)] block text-[10px] font-sans font-semibold">PIN:</span>
                      <span className="font-bold text-[#251D2C]">{order.account.pin}</span>
                    </div>
                  )}
                  {order.account.additionalInfo && (
                    <div>
                      <span className="text-[var(--text-secondary)] block text-[10px] font-sans font-semibold">Info:</span>
                      <span className="font-bold text-[#251D2C]">{order.account.additionalInfo}</span>
                    </div>
                  )}
                </div>

                <button
                  onClick={handleCopyAccount}
                  className="mt-3.5 w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-xs sm:text-sm shadow-xs transition active:scale-95 cursor-pointer"
                >
                  {copiedAccount ? t.accountCopied : t.btnCopyAccount}
                </button>
                {copyError === 'account' && <p role="alert" className="mt-2 text-xs font-bold text-rose-700">{t.copyFailed}</p>}
              </div>

              <div className="bg-[#FFF9FC] border border-[#F1E4ED] rounded-2xl p-4 sm:p-5 space-y-3" aria-live="polite">
                <div>
                  <h4 className="text-xs sm:text-sm font-extrabold text-[#251D2C]">{t.otpHelpTitle}</h4>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5 leading-relaxed">{t.otpHelpSubtitle}</p>
                  <div className="flex items-center gap-1.5 pt-1.5 text-[11px] font-bold">
                    <span className={isOperational ? 'text-emerald-700' : 'text-amber-700'}>
                      {isOperational ? t.adminOnlineStatus : t.adminOfflineStatus}
                    </span>
                  </div>
                </div>

                {effectiveOtp?.status === 'DELIVERED' && effectiveOtp.code && (
                  <div className="bg-white border border-emerald-300 rounded-xl p-3.5 flex items-center justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-bold text-emerald-700 block">{t.otpDeliveredLabel}</span>
                      <span className="text-base font-mono font-extrabold tracking-widest text-[#251D2C]">{effectiveOtp.code}</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyOtp}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition active:scale-95 cursor-pointer"
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
                  <p role="alert" className="text-xs font-bold text-rose-600">
                    {otpError}
                  </p>
                )}
                {copyError === 'otp' && <p role="alert" className="text-xs font-bold text-rose-700">{t.copyFailed}</p>}

                <div className="grid sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    disabled={requestingOtp}
                    onClick={handleRequestOtp}
                    className="w-full py-2.5 px-3 bg-pink-600 hover:bg-pink-700 disabled:opacity-50 text-white font-extrabold rounded-xl text-xs shadow-xs transition active:scale-95 cursor-pointer disabled:cursor-not-allowed"
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
                    href={buildAppsOtpWhatsappUrl(
                      '6287867395872',
                      order.invoice,
                      order.product.name,
                      order.account.profileName,
                      t.otpWhatsappTemplate
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-xs shadow-xs transition active:scale-95 text-center flex items-center justify-center"
                  >
                    💬 {t.btnOtpWhatsapp}
                  </a>
                </div>
              </div>

              {/* Garansi 25 Hari berdasarkan paidAt */}
              {!order.appsSnapshot &&
                (hasValidPaidAt ? (
                  isWarrantyActive ? (
                    <div className="bg-emerald-50/90 border border-emerald-300 rounded-2xl p-4 flex items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm" aria-hidden="true">
                            🛡️
                          </span>
                          <h4 className="text-xs font-extrabold text-emerald-900">{t.warrantyBadgeTitle}</h4>
                        </div>
                        <p className="text-[11px] text-emerald-700 mt-0.5">
                          {t.warrantyDaysRemaining.replace('{days}', String(warrantyDaysRemaining))}
                        </p>
                      </div>
                      <span className="bg-emerald-600 text-white font-extrabold text-[11px] px-2.5 py-1 rounded-xl shrink-0">
                        {t.warrantyDurationLabel}
                      </span>
                    </div>
                  ) : (
                    <div className="bg-neutral-100 border border-neutral-300 rounded-2xl p-4 flex items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm" aria-hidden="true">
                            🛡️
                          </span>
                          <h4 className="text-xs font-extrabold text-neutral-700">{t.warrantyExpiredTitle}</h4>
                        </div>
                        <p className="text-[11px] text-neutral-600 mt-0.5">{t.warrantyExpiredBody}</p>
                      </div>
                      <span className="bg-neutral-500 text-white font-extrabold text-[11px] px-2.5 py-1 rounded-xl shrink-0">
                        {t.warrantyExpiredBadge}
                      </span>
                    </div>
                  )
                ) : (
                  <div className="bg-[#FFF9FC]/90 border border-[#F1E4ED] rounded-2xl p-4">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm" aria-hidden="true">
                        🛡️
                      </span>
                      <h4 className="text-xs font-extrabold text-sky-900">{t.warrantyInfoTitle}</h4>
                    </div>
                    <p className="text-[11px] text-[#251D2C] mt-0.5">{t.warrantyInfoBody}</p>
                  </div>
                ))}

              {/* FAQ / Panduan Login Accordion */}
              <div className="bg-white border border-[#F1E4ED] rounded-2xl p-4 space-y-3">
                <h4 className="text-xs font-extrabold text-[#251D2C] flex items-center gap-1.5">
                  <span>💡</span> {t.faqTitle}
                </h4>
                <div className="space-y-2 text-xs">
                  <details className="group border border-[#F1E4ED] rounded-xl p-2.5 bg-[#FFF9FC] cursor-pointer">
                    <summary className="font-bold text-[#251D2C] group-open:text-pink-700 list-none flex justify-between items-center select-none">
                      <span>📺 {t.faqTvTitle}</span>
                      <span className="text-[var(--text-secondary)] group-open:rotate-180 transition-transform">▾</span>
                    </summary>
                    <p className="mt-2 text-[11px] text-[var(--text-secondary)] leading-relaxed border-t border-[#F1E4ED] pt-2">
                      {t.faqTvBody}
                    </p>
                  </details>

                  <details className="group border border-[#F1E4ED] rounded-xl p-2.5 bg-[#FFF9FC] cursor-pointer">
                    <summary className="font-bold text-[#251D2C] group-open:text-pink-700 list-none flex justify-between items-center select-none">
                      <span>🏠 {t.faqHouseholdTitle}</span>
                      <span className="text-[var(--text-secondary)] group-open:rotate-180 transition-transform">▾</span>
                    </summary>
                    <p className="mt-2 text-[11px] text-[var(--text-secondary)] leading-relaxed border-t border-[#F1E4ED] pt-2">
                      {t.faqHouseholdBody}
                    </p>
                  </details>

                  <details className="group border border-[#F1E4ED] rounded-xl p-2.5 bg-[#FFF9FC] cursor-pointer">
                    <summary className="font-bold text-[#251D2C] group-open:text-pink-700 list-none flex justify-between items-center select-none">
                      <span>🔒 {t.faqRulesTitle}</span>
                      <span className="text-[var(--text-secondary)] group-open:rotate-180 transition-transform">▾</span>
                    </summary>
                    <p className="mt-2 text-[11px] text-[var(--text-secondary)] leading-relaxed border-t border-[#F1E4ED] pt-2">
                      {t.faqRulesBody}
                    </p>
                  </details>
                </div>
              </div>
            </div>
          )}

          {notice && notice !== 'paymentPending' && (
            <p role="status" className="rounded-2xl border border-[#F1E4ED] bg-[#FFF9FC] p-4 text-sm leading-relaxed text-[#251D2C]">
              {t.invoiceStatus[notice]}
            </p>
          )}

          {/* EXPIRED atau CANCELLED */}
          {(order.status === 'EXPIRED' || order.status === 'CANCELLED') && (
            <div className="text-center py-6">
              <p className="text-xs sm:text-sm text-rose-700 font-bold mb-3">
                {order.status === 'EXPIRED' ? t.expiredNotice : t.orderCancelled}
              </p>
              <Link
                href="/"
                className="px-5 py-2.5 bg-pink-600 text-white font-extrabold rounded-xl text-xs sm:text-sm hover:bg-pink-700 inline-block transition"
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
