'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';
import StoreShell from '@/components/StoreShell';
import { GAME_TOPUP_PURCHASES_ENABLED } from '@/lib/storeAvailability';

export default function HomePage() {
  const { t } = useLanguage();
  const c = t.commerce;
  const [invoice, setInvoice] = useState('');
  const router = useRouter();
  const categories = [
    { href: '/roblox', title: c.ROBLOX, description: c.robloxDescription, badge: 'Gamepass · Username · Login', art: '/store/stickers/stiker_01.webp' },
    { href: '/apps', title: c.APPS, description: c.appsDescription, badge: t.badge, art: '/store/stickers/stiker_18.webp' },
    { href: '/games', title: c.GAME, description: c.gameDescription, badge: c.gameHeroEyebrow, art: '/store/stickers/stiker_02.webp' },
  ].filter(item => GAME_TOPUP_PURCHASES_ENABLED || item.href !== '/games');
  const steps = [
    { title: c.step1Title, desc: c.step1Desc },
    { title: c.step2Title, desc: c.step2Desc },
    { title: c.step3Title, desc: c.step3Desc },
  ];
  return (
    <StoreShell>
      <section className="py-1 sm:py-2">
        <h1 className="sr-only">{c.portalTitle}</h1>
        <div className="drop-shadow-[0_10px_24px_rgba(157,23,77,0.10)]">
          <Image
            src="/store/hero-banner.webp"
            alt={c.brand}
            width={3044}
            height={964}
            quality={95}
            sizes="(max-width: 639px) calc(100vw - 2rem), (max-width: 1152px) calc(100vw - 3rem), 1104px"
            className="block h-auto w-full"
            loading="eager"
            fetchPriority="high"
          />
        </div>
      </section>

      <section className={`mt-3 grid gap-4 ${GAME_TOPUP_PURCHASES_ENABLED ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
        {categories.map(item => (
          <Link key={item.href} href={item.href} className="group flex min-w-0 flex-col justify-between rounded-3xl border border-[#F1E4ED] bg-white p-4 transition-all duration-200 ease-out sm:hover:border-pink-400 sm:hover:shadow-[var(--shadow-soft)] motion-safe:sm:hover:-translate-y-0.5 motion-safe:active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-pink-600 sm:p-6">
            <div>
              <div className="mb-3 flex items-center gap-3 sm:mb-4 sm:gap-4">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-[#F1E4ED] bg-[#FFF9FC] p-1 sm:h-18 sm:w-18">
                  <Image src={item.art} alt="" fill sizes="72px" className="object-contain motion-safe:transition-transform motion-safe:duration-200 ease-out motion-safe:sm:group-hover:scale-110 motion-safe:sm:group-hover:-rotate-3" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs leading-relaxed text-[var(--text-secondary)]">{item.badge}</p>
                  <h2 className="mt-1 text-xl font-extrabold text-[#251D2C]">{item.title}</h2>
                </div>
              </div>
              <p className="text-sm leading-relaxed text-[var(--text-secondary)]">{item.description}</p>
            </div>
            <span className="mt-3 text-sm font-bold text-pink-700 sm:mt-5">{c.exploreCta} <span aria-hidden="true" className="inline-block motion-safe:transition-transform motion-safe:duration-200 ease-out motion-safe:sm:group-hover:translate-x-0.5">→</span></span>
          </Link>
        ))}
      </section>

      <form className="mt-6 grid items-center gap-4 rounded-full border border-[#F1E4ED] bg-white px-9 py-6 sm:px-8 sm:py-5 lg:grid-cols-2" onSubmit={event => {
        event.preventDefault();
        if (invoice.trim()) router.push('/order/' + encodeURIComponent(invoice.trim()));
      }}>
        <div>
          <label htmlFor="invoice" className="block text-xl font-extrabold text-[#251D2C]">{t.trackTitle}</label>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">{t.trackSubtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            id="invoice"
            name="invoice"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            enterKeyHint="search"
            className="min-h-12 min-w-0 flex-1 rounded-full border border-[var(--input-border)] bg-[#FFF9FC] px-5 py-2.5 text-base sm:text-sm text-[#251D2C] focus:border-pink-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-600"
            value={invoice}
            onChange={event => setInvoice(event.target.value)}
            placeholder={t.trackPlaceholder}
            required
          />
          <button type="submit" className="min-h-12 shrink-0 cursor-pointer rounded-full bg-pink-600 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-pink-700 motion-safe:active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-600">{t.trackButton}</button>
        </div>
      </form>

      <section aria-labelledby="how-it-works-heading" className="mt-9 sm:mt-12">
        <h2 id="how-it-works-heading" className="text-2xl font-extrabold text-[#251D2C]">{c.howItWorksTitle}</h2>
        <ol className="mt-5 grid gap-4 sm:grid-cols-3">
          {steps.map((step, index) => (
            <li key={step.title} className="rounded-3xl border border-[#F1E4ED] bg-white p-5 sm:p-6">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-pink-600 text-sm font-bold text-white">{index + 1}</span>
              <h3 className="mt-4 text-base font-bold text-[#251D2C]">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">{step.desc}</p>
            </li>
          ))}
        </ol>
      </section>
    </StoreShell>
  );
}
