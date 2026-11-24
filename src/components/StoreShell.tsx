'use client';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';
import { useCallback, useEffect, useRef, useState } from 'react';
import { clearRecentOrders, getRecentOrders, type RecentOrderItem } from '@/lib/recentOrders';
import ServiceHelpLinks from './ServiceHelpLinks';
import { supportContactUrl } from '@/lib/supportContact';
import { GAME_TOPUP_PURCHASES_ENABLED } from '@/lib/storeAvailability';

export default function StoreShell({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  const { t, language, setLanguage } = useLanguage();
  const c = t.commerce;
  const pathname = usePathname() ?? '';
  // Initialize as empty array so SSR and initial client hydration render identical markup.
  const [recentOrders, setRecentOrders] = useState<RecentOrderItem[]>([]);
  const [showRecentModal, setShowRecentModal] = useState(false);
  const triggerBtnRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
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
    if (dialogRef.current?.open) {
      dialogRef.current.close();
    }
    setShowRecentModal(false);
    triggerBtnRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!showRecentModal) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) {
      dialog.showModal();
    }
    closeBtnRef.current?.focus();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, [showRecentModal]);

  const links = ([['/apps', c.APPS], ['/games', c.GAME], ['/roblox', c.ROBLOX]] as const)
    .filter(([href]) => GAME_TOPUP_PURCHASES_ENABLED || href !== '/games');

  const showBackgroundDoodles = !pathname.startsWith('/admin');

  return (
    <div className="store-bg-canvas relative flex min-h-dvh flex-col text-[#251D2C] overflow-x-clip">
      {showBackgroundDoodles && (
        <div aria-hidden="true" className="store-bg-doodles pointer-events-none absolute inset-0 z-0 overflow-hidden">
          <div className="store-bg-doodles-left" />
          <div className="store-bg-doodles-right" />
        </div>
      )}
      <a
        href="#main-content"
        className="visually-hidden fixed left-3 top-3 z-50 rounded-xl bg-pink-700 px-4 py-2.5 text-sm font-bold text-white shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-950"
      >
        {t.skipToContent}
      </a>

      <header className="sticky top-0 z-30 border-b border-[#F1E4ED] bg-[#FEEDF6]/95 backdrop-blur-md">
        <div className={`mx-auto px-4 sm:px-6 py-2.5 sm:py-3 ${wide ? 'max-w-7xl' : 'max-w-6xl'}`}>
          <div className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-4">
            <div className={`flex items-center gap-2.5 min-w-0 ${wide ? '-ml-1.5 sm:-ml-3' : '-ml-1.5 sm:-ml-3 lg:-ml-4 xl:-ml-10 2xl:-ml-16'}`}>
              <Link
                href="/"
                className="group inline-flex items-center gap-2.5 rounded-xl py-1 pr-2 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-600"
              >
                <Image src="/store/logo-transparent.png" alt={c.brand} width={180} height={60} sizes="(max-width: 639px) 128px, 180px" className="h-auto w-32 sm:w-45" />
              </Link>
              {pathname !== '/' && (
                <Link
                  href="/"
                  className="hidden sm:inline-flex items-center gap-1 rounded-lg border border-[#F1E4ED] bg-white/90 px-2.5 py-1 text-xs font-semibold text-[var(--text-secondary)] hover:border-pink-300 hover:text-pink-700 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-600"
                >
                  &larr; {c.home}
                </Link>
              )}
            </div>

            <nav
              className="order-3 flex w-full items-center justify-center gap-1.5 overflow-x-auto rounded-xl border border-[#F1E4ED] bg-white/90 p-1 text-xs sm:text-sm font-bold lg:order-none lg:w-auto"
              aria-label={c.home}
            >
              {pathname !== '/' && (
                <Link
                  href="/"
                  className="sm:hidden inline-flex min-h-9 items-center whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[var(--text-secondary)] hover:bg-pink-50 hover:text-pink-700 transition-colors focus-visible:outline-2 focus-visible:outline-pink-600"
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
                    className={`inline-flex min-h-9 sm:min-h-0 items-center whitespace-nowrap rounded-lg px-3.5 py-1.5 transition-all motion-safe:active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-600 ${
                      current
                        ? 'bg-pink-600 text-white '
                        : 'text-[var(--text-secondary)] hover:bg-pink-50/80 hover:text-[#251D2C]'
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
                className="inline-flex min-h-11 sm:min-h-0 items-center gap-1.5 rounded-xl border border-[#F1E4ED] bg-white px-3 py-1.5 text-xs font-bold text-[#251D2C] hover:border-pink-300 hover:bg-pink-50/60 hover:text-pink-700 transition-all motion-safe:active:scale-95 cursor-pointer focus-visible:outline-2 focus-visible:outline-pink-600"
                aria-label={t.recentOrdersBtn}
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
                className="inline-flex rounded-xl border border-[#F1E4ED] bg-white/90 p-0.5 text-xs font-bold"
              >
                {(['ID', 'EN', 'MY'] as const).map(l => (
                  <button
                    key={l}
                    type="button"
                    aria-pressed={language === l}
                    onClick={() => setLanguage(l)}
                    className={`min-h-10 sm:min-h-0 rounded-lg px-2.5 py-1 transition-all motion-safe:active:scale-95 cursor-pointer focus-visible:outline-2 focus-visible:outline-pink-600 ${
                      language === l
                        ? 'bg-pink-600 text-white '
                        : 'text-[var(--text-secondary)] hover:text-[#251D2C]'
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

      <main
        id="main-content"
        tabIndex={-1}
        className={`relative z-10 mx-auto w-full flex-1 px-4 pb-10 sm:px-6 sm:pb-12 pt-3 sm:pt-5 focus:outline-none ${wide ? 'max-w-7xl' : 'max-w-6xl'}`}
      >
        <div className="mb-3 sm:mb-5 flex items-center gap-2.5 rounded-2xl border border-[#F1E4ED] bg-white/90 px-3.5 py-2 sm:px-4 sm:py-2.5">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-pink-50 text-pink-600" aria-hidden="true">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </span>
          <p className="text-xs sm:text-sm font-semibold text-[#251D2C]">{t.regional.indonesiaOnly}</p>
        </div>

        {children}
      </main>

      {!pathname.startsWith('/admin') && (
        <footer className={`relative z-10 mx-auto w-full px-4 pb-10 sm:px-6 sm:pb-12 ${wide ? 'max-w-7xl' : 'max-w-6xl'}`}>
          <div className="rounded-3xl border border-[#F1E4ED] bg-white px-5 py-7 sm:px-8 sm:py-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#F1E4ED] pb-5">
              <div>
                <p className="text-base font-extrabold text-[#251D2C]">{c.brand}</p>
                <Image
                  src="/store/logo-transparent.png"
                  alt=""
                  width={765}
                  height={225}
                  sizes="(max-width: 639px) 128px, 144px"
                  className="mt-2 h-auto w-32 sm:w-36 rounded-lg"
                />
                <p className="mt-2 text-xs sm:text-sm text-[var(--text-secondary)]">{t.footerSecuredBy}</p>
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
            <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-[var(--text-secondary)]">
              <p>{t.footerCopyright}</p>
              <p className="font-medium text-pink-800">{c.secureCheckoutNote}</p>
            </div>
          </div>

          {/* Tombol Hubungi Kami (Kecuali Admin) */}
          <div className="mt-5 flex justify-end">
            <a
              href={supportContactUrl(
                pathname.startsWith('/roblox')
                  ? t.whatsappRobloxMessage
                  : pathname.startsWith('/apps')
                    ? t.whatsappMessage
                    : t.whatsappGeneralMessage
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-white bg-emerald-700 px-4 py-2.5 text-white hover:bg-emerald-800 motion-safe:active:scale-95 transition duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
              </svg>
              <span className="text-[11px] sm:text-xs font-bold tracking-wide">{t.contactAdmin}</span>
            </a>
          </div>
        </footer>
      )}

      {/* Modal Riwayat Pesanan Saya (Native Top-Layer Dialog) */}
      {showRecentModal && (
        <dialog
          ref={dialogRef}
          aria-labelledby="recent-orders-heading"
          {...({ closedby: 'any' } as Record<string, string>)}
          onKeyDown={event => {
            if (event.key !== 'Tab') return;
            const dialog = event.currentTarget;
            const controls = [
              ...dialog.querySelectorAll<HTMLElement>(
                'button:not(:disabled), a[href], input:not(:disabled):not([type="hidden"]), select:not(:disabled), textarea:not(:disabled), [tabindex]'
              ),
            ].filter(
              element =>
                element.tabIndex >= 0 &&
                element.getClientRects().length > 0 &&
                getComputedStyle(element).visibility !== 'hidden' &&
                !element.closest('[inert]')
            );
            const first = controls[0];
            const last = controls.at(-1);
            if (!first) {
              event.preventDefault();
              dialog.focus();
            } else if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
              event.preventDefault();
              last?.focus();
            } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog)) {
              event.preventDefault();
              first.focus();
            }
          }}
          onCancel={event => {
            event.preventDefault();
            closeRecentModal();
          }}
          onClick={event => {
            if (event.target === event.currentTarget) {
              closeRecentModal();
            }
          }}
          className="store-dialog m-auto w-[calc(100%-2rem)] max-w-md rounded-3xl border border-[#F1E4ED] bg-white p-6 text-[#251D2C] shadow-[var(--shadow-elevated)] backdrop:bg-[#251D2C]/50 backdrop:backdrop-blur-xs"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-[#F1E4ED] pb-3.5">
              <h2 id="recent-orders-heading" className="text-base font-extrabold text-[#251D2C] flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-pink-50 text-pink-600" aria-hidden="true">📋</span>
                {t.recentOrdersTitle}
              </h2>
              <button
                ref={closeBtnRef}
                type="button"
                onClick={closeRecentModal}
                className="min-h-11 min-w-11 inline-flex items-center justify-center text-[var(--text-secondary)] hover:text-pink-600 hover:bg-pink-50 font-bold text-base p-1.5 rounded-xl transition cursor-pointer focus-visible:outline-2 focus-visible:outline-pink-600"
                aria-label={t.recentOrdersClose}
              >
                <span aria-hidden="true">✕</span>
              </button>
            </div>

            {recentOrders.length === 0 ? (
              <p className="text-center text-xs sm:text-sm text-[var(--text-secondary)] py-8">{t.recentOrdersEmpty}</p>
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
                        <p className="text-[11px] text-[var(--text-secondary)] truncate mt-0.5">
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
                  <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">{t.recentOrdersNotice}</p>
                  <button
                    type="button"
                    onClick={() => {
                      clearRecentOrders();
                      setRecentOrders([]);
                    }}
                    className="w-full min-h-11 py-2.5 px-3 rounded-xl border border-[#F1E4ED] text-xs font-bold text-pink-700 hover:bg-pink-50 transition cursor-pointer focus-visible:outline-2 focus-visible:outline-pink-600"
                  >
                    {t.recentOrdersClearBtn}
                  </button>
                </div>
              </>
            )}
          </div>
        </dialog>
      )}
    </div>
  );
}
