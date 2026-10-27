'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';
import { useCallback, useEffect, useRef, useState } from 'react';
import { clearRecentOrders, getRecentOrders, type RecentOrderItem } from '@/lib/recentOrders';
import ServiceHelpLinks from './ServiceHelpLinks';

export default function StoreShell({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  const { t, language, setLanguage } = useLanguage();
  const c = t.commerce;
  const pathname = usePathname() ?? '';
  // Initialize as empty array so SSR and initial client hydration render identical markup.
  const [recentOrders, setRecentOrders] = useState<RecentOrderItem[]>([]);
  const [showRecentModal, setShowRecentModal] = useState(false);
  const triggerBtnRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const sync = () => setRecentOrders(getRecentOrders());
    const frame = window.requestAnimationFrame(sync);
    window.addEventListener('storage', sync);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('storage', sync);
    };
  }, [pathname]);

  const closeRecentModal = useCallback(() => {
    setShowRecentModal(false);
    triggerBtnRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!showRecentModal) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusFrame = window.requestAnimationFrame(() => {
      closeBtnRef.current?.focus();
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeRecentModal();
        return;
      }
      if (event.key !== 'Tab') return;
      const container = dialogRef.current;
      if (!container) return;
      const focusables = [
        ...container.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href], input:not(:disabled), [tabindex]:not([tabindex="-1"])',
        ),
      ].filter(el => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden');

      if (focusables.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (event.shiftKey) {
        if (active === first || !container.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last || !container.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [showRecentModal, closeRecentModal]);

  const links = [['/apps', c.APPS], ['/games', c.GAME], ['/roblox', c.ROBLOX]] as const;

  return (
    <main className="relative min-h-screen bg-[#FFF9FC] text-[#251D2C] overflow-x-clip">
      {/* Subtle atmospheric Soft Pink background with delicate Anya texture */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-[0.055] mix-blend-multiply"
          style={{ backgroundImage: "url('/bg-anya.jpg')" }}
        />
        <div className="absolute -top-32 -left-32 h-[28rem] w-[28rem] rounded-full bg-pink-200/45 blur-3xl" />
        <div className="absolute top-1/4 -right-32 h-[26rem] w-[26rem] rounded-full bg-purple-200/35 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-[24rem] w-[24rem] rounded-full bg-rose-100/50 blur-3xl" />
      </div>

      {/* Sticky Modern Navbar */}
      <header className="sticky top-0 z-30 border-b border-[#F1E4ED] bg-white/85 backdrop-blur-xl shadow-[0_2px_20px_-8px_rgba(157,23,77,0.08)]">
        <div className={`mx-auto px-4 sm:px-6 py-2.5 sm:py-3 ${wide ? 'max-w-7xl' : 'max-w-6xl'}`}>
          <div className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-4">
            <div className="flex items-center gap-2.5 min-w-0">
              <Link
                href="/"
                className="group inline-flex items-center gap-2.5 rounded-xl py-1 pr-2 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-600"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-pink-200 bg-gradient-to-br from-pink-500 to-rose-500 text-sm font-black text-white shadow-sm shadow-pink-500/20 group-hover:scale-105 transition-transform">
                  CP
                </span>
                <span className="truncate text-sm sm:text-base font-extrabold tracking-tight text-[#251D2C] group-hover:text-pink-600 transition-colors">
                  {c.brand}
                </span>
              </Link>
              {pathname !== '/' && (
                <Link
                  href="/"
                  className="hidden sm:inline-flex items-center gap-1 rounded-lg border border-[#F1E4ED] bg-[#FFF9FC] px-2.5 py-1 text-xs font-semibold text-[#756C7D] hover:border-pink-300 hover:text-pink-700 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-600"
                >
                  &larr; {c.home}
                </Link>
              )}
            </div>

            <nav
              className="order-3 flex w-full items-center gap-1.5 overflow-x-auto rounded-xl border border-[#F1E4ED] bg-[#FFF9FC] p-1 text-xs sm:text-sm font-bold lg:order-none lg:w-auto"
              aria-label={c.home}
            >
              {pathname !== '/' && (
                <Link
                  href="/"
                  className="sm:hidden whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[#756C7D] hover:bg-pink-50 hover:text-pink-700 transition-colors focus-visible:outline-2 focus-visible:outline-pink-600"
                >
                  &larr; {c.home}
                </Link>
              )}
              {links.map(([href, label]) => {
                const current = pathname === href || pathname.startsWith(href + '/');
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-current={current ? 'page' : undefined}
                    className={`whitespace-nowrap rounded-lg px-3.5 py-1.5 transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-600 ${
                      current
                        ? 'bg-pink-600 text-white shadow-sm shadow-pink-600/25'
                        : 'text-[#756C7D] hover:bg-pink-50/80 hover:text-[#251D2C]'
                    }`}
                  >
                    {label}
                  </Link>
                );
              })}
            </nav>

            <div className="flex items-center gap-2">
              <button
                ref={triggerBtnRef}
                type="button"
                aria-haspopup="dialog"
                aria-expanded={showRecentModal}
                onClick={() => {
                  setRecentOrders(getRecentOrders());
                  setShowRecentModal(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#F1E4ED] bg-white px-3 py-1.5 text-xs font-bold text-[#251D2C] shadow-xs hover:border-pink-300 hover:bg-pink-50/60 hover:text-pink-700 transition-all active:scale-95 cursor-pointer focus-visible:outline-2 focus-visible:outline-pink-600"
                title={t.recentOrdersBtn}
              >
                <svg className="h-3.5 w-3.5 text-pink-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <span className="hidden sm:inline">{t.recentOrdersBtn}</span>
                {recentOrders.length > 0 && (
                  <span className="rounded-full bg-pink-600 px-1.5 py-0.5 text-[10px] font-extrabold leading-none text-white">
                    {recentOrders.length}
                  </span>
                )}
              </button>

              <div
                role="group"
                aria-label={c.language}
                className="inline-flex rounded-xl border border-[#F1E4ED] bg-[#FFF9FC] p-0.5 text-xs font-bold"
              >
                {(['ID', 'EN', 'MY'] as const).map(l => (
                  <button
                    key={l}
                    type="button"
                    aria-pressed={language === l}
                    onClick={() => setLanguage(l)}
                    className={`rounded-lg px-2.5 py-1 transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-pink-600 ${
                      language === l
                        ? 'bg-pink-600 text-white shadow-xs'
                        : 'text-[#756C7D] hover:text-[#251D2C]'
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className={`relative z-10 mx-auto px-4 pb-16 sm:px-6 pt-3 sm:pt-5 ${wide ? 'max-w-7xl' : 'max-w-6xl'}`}>
        <div className="mb-3 sm:mb-5 flex items-center gap-2.5 rounded-2xl border border-[#F1E4ED] bg-white/90 px-3.5 py-2 sm:px-4 sm:py-2.5 shadow-xs">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-pink-50 text-pink-600" aria-hidden="true">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </span>
          <p className="text-xs sm:text-sm font-semibold text-[#251D2C]">{t.regional.indonesiaOnly}</p>
        </div>

        {children}

        {!pathname.startsWith('/admin') && (
          <footer className="mt-12 rounded-3xl border border-[#F1E4ED] bg-white px-5 py-7 sm:px-8 sm:py-8 shadow-[0_10px_30px_-12px_rgba(157,23,77,0.06)]">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#F1E4ED] pb-5">
              <div>
                <p className="text-base font-extrabold text-[#251D2C]">{c.brand}</p>
                <p className="mt-1 text-xs sm:text-sm text-[#756C7D]">{t.footerSecuredBy}</p>
              </div>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                <ServiceHelpLinks />
                <Link
                  href="/privacy"
                  className="rounded text-sm font-semibold text-pink-700 underline decoration-pink-300 underline-offset-4 hover:text-pink-950 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-pink-800"
                >
                  {t.apps.privacy}
                </Link>
              </div>
            </div>
            <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-[#756C7D]">
              <p>{t.footerCopyright}</p>
              <p className="font-medium text-pink-800">{c.secureCheckoutNote}</p>
            </div>
          </footer>
        )}
      </div>

      {/* Tombol Hubungi Kami (Kecuali Admin) */}
      {!pathname.startsWith('/admin') && (
        <a
          href={`https://wa.me/6287867395872?text=${encodeURIComponent(
            pathname.startsWith('/roblox')
              ? t.whatsappRobloxMessage
              : pathname.startsWith('/apps')
                ? t.whatsappMessage
                : t.whatsappGeneralMessage
          )}`}
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 flex items-center gap-2 rounded-full border-2 border-white bg-emerald-600 px-3.5 py-2.5 sm:px-4 sm:py-3 text-white shadow-lg shadow-emerald-600/25 hover:bg-emerald-700 hover:scale-105 transition duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
        >
          <svg className="w-4 h-4 sm:w-5 sm:h-5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
          </svg>
          <span className="text-[11px] sm:text-xs font-bold tracking-wide">{t.contactAdmin}</span>
        </a>
      )}

      {/* Modal Riwayat Pesanan Saya */}
      {showRecentModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="recent-orders-heading"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#251D2C]/50 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={closeRecentModal}
        >
          <div
            ref={dialogRef}
            className="bg-white rounded-3xl border border-[#F1E4ED] p-6 max-w-md w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-150"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#F1E4ED] pb-3.5">
              <h3 id="recent-orders-heading" className="text-base font-extrabold text-[#251D2C] flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-pink-50 text-pink-600" aria-hidden="true">📋</span>
                {t.recentOrdersTitle}
              </h3>
              <button
                ref={closeBtnRef}
                type="button"
                onClick={closeRecentModal}
                className="text-[#756C7D] hover:text-pink-600 hover:bg-pink-50 font-bold text-base p-1.5 rounded-xl transition cursor-pointer focus-visible:outline-2 focus-visible:outline-pink-600"
                aria-label={t.recentOrdersClose}
              >
                ✕
              </button>
            </div>

            {recentOrders.length === 0 ? (
              <p className="text-center text-xs sm:text-sm text-[#756C7D] py-8">{t.recentOrdersEmpty}</p>
            ) : (
              <>
                <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                  {recentOrders.map(item => (
                    <Link
                      key={item.invoice}
                      href={`/order/${encodeURIComponent(item.invoice)}`}
                      onClick={closeRecentModal}
                      className="flex items-center justify-between p-3.5 rounded-2xl border border-[#F1E4ED] bg-[#FFF9FC] hover:border-pink-300 hover:bg-pink-50/60 transition group cursor-pointer focus-visible:outline-2 focus-visible:outline-pink-600"
                    >
                      <div className="pr-2 min-w-0">
                        <p className="text-xs font-mono font-bold text-[#251D2C] group-hover:text-pink-700 truncate">
                          {item.invoice}
                        </p>
                        <p className="text-[11px] text-[#756C7D] truncate mt-0.5">
                          {t.recentOrdersVisitedAt} {new Date(item.visitedAt).toLocaleString()}
                        </p>
                      </div>
                      <span className="text-xs text-pink-700 font-bold group-hover:underline shrink-0">
                        {t.recentOrdersView} &rarr;
                      </span>
                    </Link>
                  ))}
                </div>
                <div className="pt-3 border-t border-[#F1E4ED] space-y-2.5">
                  <p className="text-[11px] text-[#756C7D] leading-relaxed">{t.recentOrdersNotice}</p>
                  <button
                    type="button"
                    onClick={() => {
                      clearRecentOrders();
                      setRecentOrders([]);
                    }}
                    className="w-full py-2.5 px-3 rounded-xl border border-[#F1E4ED] text-xs font-bold text-pink-700 hover:bg-pink-50 transition cursor-pointer focus-visible:outline-2 focus-visible:outline-pink-600"
                  >
                    {t.recentOrdersClearBtn}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
