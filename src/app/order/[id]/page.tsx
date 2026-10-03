/* eslint-disable @next/next/no-img-element */
'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';

interface OrderDetail {
  invoice: string;
  type: 'APPS' | 'GAME' | 'ROBLOX';
  fulfillmentStatus: 'NOT_READY' | 'QUEUED' | 'PROCESSING' | 'WAITING_CUSTOMER' | 'COMPLETED' | 'REQUIRES_REVIEW';
  refundStatus: 'NONE' | 'REQUIRED' | 'COMPLETED';
  variantName: string | null;
  units: number;
  robloxDetail: { method: 'GAMEPASS' | 'GIFT_USERNAME' | 'LOGIN'; username: string; gamepassPrice: number | null } | null;
  gameDetail: { userId: string; zoneId: string | null } | null;
  totalAmount: number;
  status: 'PENDING' | 'PAID' | 'EXPIRED' | 'CANCELLED';
  paymentMethod: string;
  qrisUrl: string | null;
  qrisCode: string | null;
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
  isAuthorized: boolean;
}

export default function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { language, setLanguage, t } = useLanguage();

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copiedAccount, setCopiedAccount] = useState(false);
  const [copiedString, setCopiedString] = useState(false);
  
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();
    async function loadOrder() {
      let poll = true;
      try {
        const token = localStorage.getItem(`token_${id}`);
        if (!token) { poll = false; throw new Error('ORDER_NOT_FOUND'); }
        const response = await fetch(`/api/orders/${encodeURIComponent(id)}`, {
          headers: { 'x-order-token': token }, signal: controller.signal,
        });
        const json = await response.json();
        if (!response.ok || !json.success) {
          if (response.status === 404) poll = false;
          throw new Error(response.status === 404 ? 'ORDER_NOT_FOUND' : 'SYSTEM_ERROR');
        }
        if (cancelled) return;
        if (json.data.status === 'PENDING') {
          void fetch(`/api/orders/${encodeURIComponent(id)}/payment`, { method: 'POST', headers: { 'x-order-token': token }, signal: controller.signal }).catch(() => {});
        }
        setOrder(json.data);
        setError('');
        poll = json.data.status === 'PENDING' || (json.data.status === 'PAID' && json.data.fulfillmentStatus !== 'COMPLETED' && json.data.refundStatus !== 'COMPLETED');
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
  }, [id]);

  const formatRupiah = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

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

  const handleCopyString = () => {
    if (!order?.qrisCode) return;
    navigator.clipboard.writeText(order.qrisCode);
    setCopiedString(true);
    setTimeout(() => setCopiedString(false), 2000);
  };

  const downloadQrisImage = async () => {
    if (!order?.qrisUrl) return;
    try {
      const response = await fetch(order.qrisUrl);
      if (!response.ok) throw new Error('QR_DOWNLOAD_FAILED');
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `QRIS-${order.invoice}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err: unknown) {
      console.error('Failed downloading QRIS image:', err);
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

  return (
    <main
      className="min-h-screen p-4 md:p-10 font-sans relative bg-fixed bg-cover bg-center"
      style={{ backgroundImage: "url('/bg-anya.jpg')" }}
    >
      <div className="fixed inset-0 bg-pink-950/40 backdrop-blur-[2px] pointer-events-none"></div>

      <div className="relative z-10 max-w-2xl mx-auto">
        <section className="bg-white rounded-2xl p-5 mb-4 space-y-2" aria-live="polite">
          <p>{t.commerce.fulfillment}: <strong>{t.commerce[order.fulfillmentStatus]}</strong></p>
          {order.variantName && <p>{t.commerce.package}: {order.variantName} · {t.commerce.units}: {order.units}</p>}
          {order.robloxDetail && <p>{t.commerce.method}: {t.commerce[order.robloxDetail.method]} · {t.commerce.username}: {order.robloxDetail.username}</p>}
          {order.gameDetail && <p>{t.commerce.userId}: {order.gameDetail.userId} · {t.commerce.zoneId}: {order.gameDetail.zoneId}</p>}
          {order.refundStatus !== 'NONE' && <p>{t.commerce.refund}: {t.commerce[order.refundStatus]}</p>}
          {order.fulfillmentStatus === 'WAITING_CUSTOMER' && <p>{t.commerce.waitingHelp}</p>}
        </section>
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

        <div className="bg-white/95 backdrop-blur-md rounded-3xl p-6 md:p-8 shadow-2xl border-4 border-pink-300">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b-2 border-pink-100 gap-2 mb-6">
            <div>
              <h1 className="text-xl font-black text-pink-700">{t.orderTitle}</h1>
              <p className="text-xs text-neutral-500">{order.type === 'APPS' ? t.orderSubtitle : order.type === 'GAME' ? t.commerce.gameDescription : t.commerce.robloxDescription}</p>
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
            <div className="flex justify-between">
              <span className="text-neutral-500">{t.invoiceLabel}</span>
              <span className="font-mono font-bold text-neutral-800">{order.invoice}</span>
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
          </div>

          {/* PENDING QRIS */}
          {order.status === 'PENDING' && order.qrisUrl && (
            <div className="text-center space-y-4">
              <div>
                <h3 className="text-sm font-bold text-neutral-800">{t.scanNoticeTitle}</h3>
                <p className="text-[11px] text-neutral-500 max-w-md mx-auto mt-1">
                  {t.scanNoticeSubtitle}
                </p>
              </div>

              <div className="inline-block p-4 bg-white rounded-3xl border-4 border-pink-200 shadow-lg">
                <img
                  src={order.qrisUrl}
                  alt="QRIS Barcode"
                  className="w-56 h-56 mx-auto rounded-xl"
                />
              </div>

              <div className="flex flex-col sm:flex-row justify-center gap-2 max-w-sm mx-auto">
                <button
                  onClick={downloadQrisImage}
                  className="flex-1 py-2 px-3 bg-pink-500 hover:bg-pink-600 text-white font-bold rounded-xl text-xs shadow-sm transition active:scale-95 cursor-pointer"
                >
                  {t.btnDownloadQris}
                </button>
                <button
                  disabled={!order.qrisCode}
                  onClick={handleCopyString}
                  className="flex-1 py-2 px-3 bg-white border border-pink-300 text-pink-600 font-bold rounded-xl text-xs hover:bg-pink-50 transition active:scale-95 cursor-pointer"
                >
                  {copiedString ? t.copiedNotice : t.btnCopyCode}
                </button>
              </div>

              <p className="text-[11px] text-neutral-400 italic mt-2">{t.autoCheckNotice}</p>
            </div>
          )}

          {/* PAID: Akun Diserahkan */}
          {order.status === 'PAID' && order.account && (
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
            </div>
          )}

          {((order.status === 'PENDING' && !order.qrisUrl) || (order.status === 'PAID' && !order.account)) && (
            <p className="text-sm text-blue-800 text-center">{t.paymentNeedsHelp}</p>
          )}

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
