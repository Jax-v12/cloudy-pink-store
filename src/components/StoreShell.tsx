'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';

export default function StoreShell({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  const { t, language, setLanguage } = useLanguage();
  const c = t.commerce;
  const pathname = usePathname() ?? '';
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
            <Link href="/" className="text-white font-bold hover:text-pink-200 transition-colors drop-shadow-md">
              &larr; {c.home}
            </Link>
          ) : <div></div>}
          <nav className="order-3 flex w-full gap-2 overflow-x-auto rounded-2xl bg-white/90 backdrop-blur-md p-1.5 text-sm font-bold sm:order-none sm:w-auto shadow-md border-2 border-pink-200" aria-label={c.home}>
            {links.map(([href, label]) => {
              const current = pathname === href || pathname.startsWith(href + '/');
              return <Link key={href} href={href} aria-current={current ? 'page' : undefined}
                className={`whitespace-nowrap rounded-xl px-4 py-2 transition-all active:scale-95 ${current ? 'bg-pink-500 text-white shadow-sm' : 'text-neutral-600 hover:bg-pink-100 hover:text-pink-700'}`}>{label}</Link>;
            })}
          </nav>
          <div role="group" aria-label={c.language} className="inline-flex rounded-2xl border-2 border-pink-300 bg-white/95 backdrop-blur-sm p-1 text-xs font-bold shadow-md">
            {(['ID', 'EN', 'MY'] as const).map(l => <button key={l} type="button" aria-pressed={language === l} onClick={() => setLanguage(l)}
              className={`rounded-xl px-3 py-1.5 transition-all active:scale-95 ${language === l ? 'bg-pink-500 text-white shadow-sm' : 'text-neutral-600 hover:text-pink-600'}`}>{l}</button>)}
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
    </div>

    {/* Tombol Hubungi Kami (Kecuali Admin) */}
    {!pathname.startsWith('/admin') && (
      <a href={`https://wa.me/6287867395872?text=${encodeURIComponent(t.whatsappMessage)}`} target="_blank" rel="noopener noreferrer" className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-full shadow-lg shadow-emerald-500/30 hover:scale-105 transition duration-200 border-2 border-white">
        <svg className="w-4 h-4 sm:w-5 sm:h-5 fill-current" viewBox="0 0 24 24">
          <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
        </svg>
        <span className="text-[11px] sm:text-xs font-bold tracking-wide">Hubungi Kami</span>
      </a>
    )}
  </main>;
}
