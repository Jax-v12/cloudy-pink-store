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
  return <main
    className="relative min-h-screen bg-cover bg-center bg-fixed bg-no-repeat overflow-x-clip text-neutral-800 animate-in fade-in duration-500"
    style={{ backgroundImage: "url('/bg-anya.jpg')" }}
  >
    <div className="fixed inset-0 bg-pink-950/40 backdrop-blur-[2px] pointer-events-none z-0"></div>
    <div className={`relative z-10 mx-auto px-4 pb-16 sm:px-6 pt-6 ${wide ? 'max-w-7xl' : 'max-w-6xl'}`}>
      <header className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          {pathname !== '/' ? (
           <Link href="/" className="text-white font-bold hover:text-pink-200 transition-colors drop-shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-300">
              &larr; {c.home}
            </Link>
          ) : <div></div>}
          <nav className="order-3 flex w-full gap-2 overflow-x-auto rounded-2xl bg-white/90 backdrop-blur-md p-1.5 text-sm font-bold sm:order-none sm:w-auto shadow-md border-2 border-pink-200" aria-label={c.home}>
            {links.map(([href, label]) => {
              const current = pathname === href || pathname.startsWith(href + '/');
              return <Link key={href} href={href} aria-current={current ? 'page' : undefined}
                className={`whitespace-nowrap rounded-xl px-4 py-2 transition-all active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-500 ${current ? 'bg-pink-500 text-white shadow-sm' : 'text-neutral-600 hover:bg-pink-100 hover:text-pink-700'}`}>{label}</Link>;
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
              className="inline-flex items-center gap-1.5 rounded-2xl border-2 border-pink-300 bg-white/95 backdrop-blur-sm px-3 py-1.5 text-xs font-bold shadow-md text-pink-700 hover:bg-pink-100 hover:text-pink-800 transition-all active:scale-95 cursor-pointer focus-visible:outline-2 focus-visible:outline-pink-500"
              title={t.recentOrdersBtn}
            >
              <span aria-hidden="true">📋</span>
              <span className="hidden sm:inline">{t.recentOrdersBtn}</span>
              {recentOrders.length > 0 && (
                <span className="bg-pink-500 text-white rounded-full px-1.5 py-0.2 text-[10px] font-black leading-tight">
                  {recentOrders.length}
                </span>
              )}
            </button>
            <div role="group" aria-label={c.language} className="inline-flex rounded-2xl border-2 border-pink-300 bg-white/95 backdrop-blur-sm p-1 text-xs font-bold shadow-md">
              {(['ID', 'EN', 'MY'] as const).map(l => <button key={l} type="button" aria-pressed={language === l} onClick={() => setLanguage(l)}
                className={`rounded-xl px-3 py-1.5 transition-all active:scale-95 cursor-pointer ${language === l ? 'bg-pink-500 text-white shadow-sm' : 'text-neutral-600 hover:text-pink-600'}`}>{l}</button>)}
            </div>
          </div>
        </div>

        {/* Banner Toko (Hanya di Homepage) */}
        {pathname === '/' && (
          <div className="w-full flex justify-center mt-4 mb-4 sm:mb-8">
            <div className="rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl shadow-pink-900/30 border-3 sm:border-4 border-pink-300 max-w-xl bg-white/50 w-full transition-transform hover:scale-[1.02] duration-300">
              <img
                src="/banner-logo.png"
                alt="Cloudy Pink Store Banner"
                className="w-full h-auto object-contain"
              />
            </div>
          </div>
        )}
      </header>
      {children}
      {!pathname.startsWith('/admin') && <footer className="mt-8 rounded-2xl border border-pink-200 bg-white px-5 py-5">
        <ServiceHelpLinks />
      </footer>}
    </div>

    {/* Tombol Hubungi Kami (Kecuali Admin) */}
    {!pathname.startsWith('/admin') && (
      <a href={`https://wa.me/6287867395872?text=${encodeURIComponent(t.whatsappMessage)}`} target="_blank" rel="noopener noreferrer" className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-full shadow-lg shadow-emerald-500/30 hover:scale-105 transition duration-200 border-2 border-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400">
        <svg className="w-4 h-4 sm:w-5 sm:h-5 fill-current" viewBox="0 0 24 24">
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
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-pink-950/60 backdrop-blur-sm animate-in fade-in duration-150"
        onClick={closeRecentModal}
      >
        <div
          ref={dialogRef}
          className="bg-white rounded-3xl border-4 border-pink-300 p-6 max-w-md w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-150"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b-2 border-pink-100 pb-3">
            <h3 id="recent-orders-heading" className="text-base font-black text-pink-800 flex items-center gap-2">
              <span aria-hidden="true">📋</span> {t.recentOrdersTitle}
            </h3>
            <button
              ref={closeBtnRef}
              type="button"
              onClick={closeRecentModal}
              className="text-neutral-500 hover:text-pink-600 font-bold text-lg p-1.5 rounded-xl transition cursor-pointer focus-visible:outline-2 focus-visible:outline-pink-500"
              aria-label={t.recentOrdersClose}
            >
              ✕
            </button>
          </div>

          {recentOrders.length === 0 ? (
            <p className="text-center text-xs text-neutral-500 py-6">{t.recentOrdersEmpty}</p>
          ) : (
            <>
              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {recentOrders.map(item => (
                  <Link
                    key={item.invoice}
                    href={`/order/${encodeURIComponent(item.invoice)}`}
                    onClick={closeRecentModal}
                    className="flex items-center justify-between p-3 rounded-2xl border-2 border-pink-100 hover:border-pink-300 hover:bg-pink-50/60 transition group cursor-pointer focus-visible:outline-2 focus-visible:outline-pink-500"
                  >
                    <div className="pr-2 min-w-0">
                      <p className="text-xs font-mono font-black text-neutral-800 group-hover:text-pink-700 truncate">
                        {item.invoice}
                      </p>
                      <p className="text-[10px] text-neutral-500 truncate">
                        {t.recentOrdersVisitedAt} {new Date(item.visitedAt).toLocaleString()}
                      </p>
                    </div>
                    <span className="text-[11px] text-pink-700 font-bold group-hover:underline shrink-0">
                      {t.recentOrdersView} &rarr;
                    </span>
                  </Link>
                ))}
              </div>
              <div className="pt-2 border-t border-pink-100 space-y-2">
                <p className="text-[11px] text-neutral-500 leading-relaxed">{t.recentOrdersNotice}</p>
                <button
                  type="button"
                  onClick={() => {
                    clearRecentOrders();
                    setRecentOrders([]);
                  }}
                  className="w-full py-2 px-3 rounded-xl border border-pink-200 text-xs font-bold text-pink-700 hover:bg-pink-50 transition cursor-pointer focus-visible:outline-2 focus-visible:outline-pink-500"
                >
                  {t.recentOrdersClearBtn}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    )}
  </main>;
}
