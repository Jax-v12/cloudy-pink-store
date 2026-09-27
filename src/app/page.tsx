/* eslint-disable @next/next/no-img-element */
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';

interface Product {
  id: number;
  name: string;
  slug: string;
  price: number;
  stockAvailable: number;
}

export default function HomePage() {
  const router = useRouter();
  const { language, setLanguage, t } = useLanguage();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [customerEmail, setCustomerEmail] = useState('');
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [searchInvoice, setSearchInvoice] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    let ignore = false;

    async function loadProducts() {
      try {
        const res = await fetch('/api/products', {
          headers: {
            'ngrok-skip-browser-warning': 'true',
          },
        });
        const result = await res.json();

        if (!ignore) {
          if (result.success && Array.isArray(result.data)) {
            setProducts(result.data);
          } else if (Array.isArray(result)) {
            setProducts(result);
          }
        }
      } catch (err: unknown) {
        if (!ignore) {
          console.error('Gagal memuat produk:', err);
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    loadProducts();

    return () => {
      ignore = true;
    };
  }, []);

  const formatRupiah = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || !customerEmail) return;

    setCheckoutLoading(true);
    setErrorMessage('');

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: selectedProduct.id,
          customerEmail,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.errorCode || 'SYSTEM_ERROR');
      }

      if (!json.data?.invoice || !json.data?.accessToken || !json.data?.qrisUrl) {
        throw new Error('SYSTEM_ERROR');
      }

      localStorage.setItem(`token_${json.data.invoice}`, json.data.accessToken);
      router.push(`/order/${json.data.invoice}`);
    } catch (err: unknown) {
      if (err instanceof Error) {
        switch (err.message) {
          case 'INCOMPLETE_DATA': setErrorMessage(t.errIncompleteData); break;
          case 'STOCK_EMPTY': setErrorMessage(t.errStockEmpty); break;
          case 'RACE_CONDITION': setErrorMessage(t.errRaceCondition); break;
          case 'GATEWAY_ERROR': setErrorMessage(t.errGateway); break;
          case 'SYSTEM_ERROR': setErrorMessage(t.errSystem); break;
          default: setErrorMessage(err.message); break;
        }
      } else {
        setErrorMessage(t.errSystem);
      }
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleSearchOrder = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanInvoice = searchInvoice.trim();
    if (!cleanInvoice) return;
    router.push(`/order/${cleanInvoice}`);
  };

  return (
    <main
      className="min-h-screen p-3 sm:p-6 md:p-10 font-sans relative bg-fixed bg-cover bg-center pb-24 md:pb-12"
      style={{ backgroundImage: "url('/bg-anya.jpg')" }}
    >
      <div className="fixed inset-0 bg-pink-950/40 backdrop-blur-[2px] pointer-events-none"></div>

      <div className="relative z-10 max-w-5xl mx-auto">
        {/* Switch Bahasa: ID | MY | EN */}
        <div className="flex justify-end mb-3 sm:mb-4">
          <div className="inline-flex bg-white/95 backdrop-blur-sm p-1 rounded-2xl border-2 border-pink-300 shadow-md">
            <button
              onClick={() => setLanguage('ID')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer ${
                language === 'ID'
                  ? 'bg-pink-500 text-white shadow-sm'
                  : 'text-neutral-600 hover:text-pink-600'
              }`}
            >
              ID
            </button>
            <button
              onClick={() => setLanguage('MY')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer ${
                language === 'MY'
                  ? 'bg-pink-500 text-white shadow-sm'
                  : 'text-neutral-600 hover:text-pink-600'
              }`}
            >
              MY
            </button>
            <button
              onClick={() => setLanguage('EN')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer ${
                language === 'EN'
                  ? 'bg-pink-500 text-white shadow-sm'
                  : 'text-neutral-600 hover:text-pink-600'
              }`}
            >
              EN
            </button>
          </div>
        </div>

        {/* Banner Toko */}
        <div className="w-full flex justify-center mb-4 sm:mb-6">
          <div className="rounded-2xl sm:rounded-3xl overflow-hidden shadow-xl border-3 sm:border-4 border-pink-300 max-w-xl bg-white/50">
            <img
              src="/banner-logo.png"
              alt="Cloudy Pink Store Banner"
              className="w-full h-auto object-contain"
            />
          </div>
        </div>

        {/* Lacak Pesanan */}
        <div className="bg-white/95 backdrop-blur-md rounded-2xl p-3.5 sm:p-5 shadow-lg border-2 border-pink-200 mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div>
              <h2 className="text-xs sm:text-sm font-bold text-pink-700">{t.trackTitle}</h2>
              <p className="text-[10px] sm:text-[11px] text-neutral-500">{t.trackSubtitle}</p>
            </div>
            <form onSubmit={handleSearchOrder} className="flex items-center gap-2">
              <input
                type="text"
                placeholder={t.trackPlaceholder}
                value={searchInvoice}
                onChange={(e) => setSearchInvoice(e.target.value)}
                className="bg-pink-50/70 border border-pink-200 rounded-xl px-3 py-2 text-xs sm:text-sm text-neutral-800 placeholder-neutral-400 focus:outline-none focus:border-pink-500 w-full sm:w-56"
              />
              <button
                type="submit"
                className="bg-pink-500 hover:bg-pink-600 text-white font-bold px-3.5 py-2 rounded-xl text-xs transition active:scale-95 whitespace-nowrap cursor-pointer shadow-sm"
              >
                {t.trackButton}
              </button>
            </form>
          </div>
        </div>

        {/* Katalog 3 Grid */}
        <div className="bg-pink-50/90 backdrop-blur-md rounded-2xl sm:rounded-3xl p-3.5 sm:p-6 md:p-8 shadow-xl border-2 sm:border-4 border-pink-200">
          <div className="flex items-center justify-between mb-4 sm:mb-6 pb-3 sm:pb-4 border-b-2 border-pink-200">
            <div>
              <h2 className="text-base sm:text-2xl font-black text-pink-700 tracking-wide">
                {t.catalogTitle}
              </h2>
              <p className="text-[10px] sm:text-xs text-pink-500 font-medium mb-3 sm:mb-0">{t.catalogSubtitle}</p>
            </div>
            <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3">
              <input
                type="text"
                placeholder={t.searchPlaceholder || 'Cari produk...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-white/70 border-2 border-pink-200 rounded-xl px-3 py-2 text-xs text-neutral-800 placeholder-neutral-400 focus:outline-none focus:border-pink-500 w-full sm:w-64 transition"
              />
              <span className="px-2 sm:px-3 py-0.5 sm:py-1 bg-pink-200 text-pink-800 text-[9px] sm:text-xs font-bold rounded-full whitespace-nowrap">
                {t.badge}
              </span>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12 text-pink-600 font-semibold animate-pulse text-xs sm:text-sm">
              {t.loadingCatalog}
            </div>
          ) : (
            (() => {
              const filteredProducts = products.filter(p => 
                p.name.toLowerCase().includes(searchQuery.toLowerCase())
              );
              
              if (filteredProducts.length === 0) {
                return (
                  <div className="text-center py-12 text-neutral-500 text-xs sm:text-sm">
                    {searchQuery ? (t.searchEmpty || 'Produk tidak ditemukan.') : t.emptyCatalog}
                  </div>
                );
              }

              return (
                <div className="grid grid-cols-3 gap-2.5 sm:gap-4 md:gap-6">
                  {filteredProducts.map((product) => {
                const isReady = product.stockAvailable > 0;
                return (
                  <div
                    key={product.id}
                    className="bg-white rounded-xl sm:rounded-2xl p-2.5 sm:p-5 border sm:border-2 border-pink-100 shadow-md hover:shadow-pink-200 transition flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 mb-1.5 sm:mb-2">
                        <span
                          className={`text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-md sm:rounded-full text-center ${
                            isReady
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-rose-100 text-rose-600'
                          }`}
                        >
                          {isReady ? `${t.stockRemaining} ${product.stockAvailable}` : t.stockOut}
                        </span>
                        <span className="text-[9px] sm:text-[11px] text-pink-400 font-bold hidden sm:inline">
                          {t.guarantee}
                        </span>
                      </div>

                      <h3 className="font-bold text-neutral-800 text-xs sm:text-base line-clamp-2 mb-1 sm:mb-2">
                        {product.name}
                      </h3>
                      <p className="text-xs sm:text-lg md:text-xl font-black text-pink-600 mb-2 sm:mb-4">
                        {formatRupiah(product.price)}
                      </p>
                    </div>

                    <button
                      disabled={!isReady}
                      onClick={() => {
                        setSelectedProduct(product);
                        setErrorMessage('');
                      }}
                      className={`w-full py-1.5 sm:py-2.5 rounded-lg sm:rounded-xl font-bold text-[11px] sm:text-sm shadow-sm transition active:scale-95 ${
                        isReady
                          ? 'bg-pink-500 hover:bg-pink-600 text-white shadow-pink-300 cursor-pointer'
                          : 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
                      }`}
                    >
                      {isReady ? t.btnBuy : t.btnSoldOut}
                    </button>
                  </div>
                );
              })}
            </div>
              );
            })()
          )}
        </div>
      </div>

      {/* Modal Checkout */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 max-w-sm w-full shadow-2xl border-t-4 sm:border-4 border-pink-300 relative animate-in slide-in-from-bottom sm:zoom-in duration-200">
            <div className="w-12 h-1.5 bg-neutral-300 rounded-full mx-auto mb-3 sm:hidden"></div>

            <button
              onClick={() => setSelectedProduct(null)}
              className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-700 font-bold text-lg cursor-pointer p-1"
            >
              ✕
            </button>

            <h3 className="text-base sm:text-lg font-black text-pink-700 mb-3">{t.modalTitle}</h3>

            <div className="bg-pink-50 p-3 rounded-2xl border border-pink-100 mb-3.5 text-xs">
              <p className="text-neutral-500">{t.modalItem}</p>
              <p className="font-bold text-neutral-800 text-sm">{selectedProduct.name}</p>
              <p className="mt-1.5 text-neutral-500">{t.modalTotal}</p>
              <p className="font-black text-pink-600 text-base">
                {formatRupiah(selectedProduct.price)}
              </p>
            </div>

            <form onSubmit={handleCheckout}>
              <div className="mb-4">
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  {t.modalEmailLabel}
                </label>
                <input
                  type="email"
                  required
                  placeholder={t.modalEmailPlaceholder}
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  className="w-full bg-neutral-50 border-2 border-pink-200 rounded-xl px-3 py-2.5 text-base sm:text-sm text-neutral-800 focus:outline-none focus:border-pink-500"
                />
              </div>

              {errorMessage && (
                <div className="mb-3 text-xs text-rose-600 bg-rose-50 p-2 rounded-lg border border-rose-200 font-medium">
                  {errorMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={checkoutLoading}
                className="w-full py-3 bg-pink-500 hover:bg-pink-600 text-white font-black rounded-xl text-sm shadow-md shadow-pink-300 transition active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {checkoutLoading ? t.btnProcessing : t.btnPayNow}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Floating WA */}
      <a
        href={`https://wa.me/6287867395872?text=${encodeURIComponent(t.whatsappMessage)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-full shadow-lg shadow-emerald-500/30 hover:scale-105 transition duration-200 border-2 border-white"
      >
        <svg className="w-4 h-4 sm:w-5 sm:h-5 fill-current" viewBox="0 0 24 24">
          <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
        </svg>
        <span className="text-[11px] sm:text-xs font-bold tracking-wide">{t.contactAdmin}</span>
      </a>

      {/* Footer */}
      <footer className="mt-12 w-full max-w-6xl mx-auto pb-6 px-4">
        <div className="bg-white/60 backdrop-blur-md rounded-3xl p-6 sm:p-8 border border-pink-100 shadow-sm flex flex-col items-center justify-center text-center">
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 mb-4">
            <Link href="#" className="text-xs sm:text-sm font-semibold text-pink-600 hover:text-pink-800 transition">
              {t.footerFAQ || 'FAQ'}
            </Link>
            <span className="text-pink-200 hidden sm:inline">•</span>
            <Link href="#" className="text-xs sm:text-sm font-semibold text-pink-600 hover:text-pink-800 transition">
              {t.footerTerms || 'Terms & Conditions'}
            </Link>
          </div>
          <p className="text-xs text-neutral-500 font-medium mb-2">
            {t.footerCopyright || 'Copyright © 2026 Cloudy Pink Store'}
          </p>
          <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-neutral-400 font-medium bg-pink-50/50 px-3 py-1.5 rounded-full border border-pink-100">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 sm:h-4 sm:w-4 text-emerald-500" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
            <span>{t.footerSecuredBy || 'Secured Payment by Midtrans'}</span>
          </div>
        </div>
      </footer>
    </main>
  );
}