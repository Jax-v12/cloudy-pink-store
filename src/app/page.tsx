'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';
import StoreShell from '@/components/StoreShell';

export default function HomePage() {
  const { t } = useLanguage();
  const c = t.commerce;
  const [invoice, setInvoice] = useState('');
  const router = useRouter();
  const categories = [
    { href: '/roblox', title: c.ROBLOX, description: c.robloxDescription, badge: 'Gamepass · Username · Login', art: '/store/anya-roblox.jpg' },
    { href: '/apps', title: c.APPS, description: c.appsDescription, badge: t.badge, art: '/store/anya-apps.jpg' },
    { href: '/games', title: c.GAME, description: c.gameDescription, badge: c.gameHeroEyebrow, art: '/store/anya-games.jpg' },
  ];
  const steps = [
    { title: c.step1Title, desc: c.step1Desc },
    { title: c.step2Title, desc: c.step2Desc },
    { title: c.step3Title, desc: c.step3Desc },
  ];
  return (
    <StoreShell>
      <section className="grid items-center gap-4 py-2 sm:gap-6 sm:py-9 lg:grid-cols-2 lg:gap-10">
        <div>
          <p className="mb-2 text-sm font-bold text-pink-700">{c.brand}</p>
          <h1 className="max-w-xl text-3xl font-extrabold leading-tight tracking-tight text-[#251D2C] sm:text-5xl">{c.portalTitle}</h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-[var(--text-secondary)] sm:text-base">{c.portalSubtitle}</p>
        </div>
        <Image src="/banner-logo.png" alt={c.brand} width={1774} height={887} sizes="(max-width: 639px) 256px, (max-width: 1023px) 100vw, 550px" className="mx-auto h-auto w-64 max-w-full rounded-2xl border border-pink-100 sm:w-full sm:rounded-3xl" loading="eager" />
      </section>

      <section className="mt-3 grid gap-4 md:grid-cols-3">
        {categories.map(item => (
          <Link key={item.href} href={item.href} className="group flex min-w-0 flex-col justify-between rounded-3xl border border-[#F1E4ED] bg-white p-4 transition-colors hover:border-pink-400 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-pink-600 sm:p-6">
            <div>
              <div className="mb-3 flex items-center gap-3 sm:mb-4 sm:gap-4">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-[#F1E4ED] bg-white sm:h-18 sm:w-18">
                  <Image src={item.art} alt="" fill sizes="72px" className="object-cover" style={item.href === '/apps' ? { objectPosition: 'center 55%' } : undefined} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs leading-relaxed text-[var(--text-secondary)]">{item.badge}</p>
                  <h2 className="mt-1 text-xl font-extrabold text-[#251D2C]">{item.title}</h2>
                </div>
              </div>
              <p className="text-sm leading-relaxed text-[var(--text-secondary)]">{item.description}</p>
            </div>
            <span className="mt-3 text-sm font-bold text-pink-700 sm:mt-5">{c.exploreCta} <span aria-hidden="true">→</span></span>
          </Link>
        ))}
      </section>

      <form className="mt-6 grid items-center gap-4 rounded-3xl border border-[#F1E4ED] bg-white p-5 sm:p-7 lg:grid-cols-2" onSubmit={event => {
        event.preventDefault();
        if (invoice.trim()) router.push('/order/' + encodeURIComponent(invoice.trim()));
      }}>
        <div>
          <label htmlFor="invoice" className="text-xl font-extrabold text-[#251D2C]">{t.trackTitle}</label>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">{t.trackSubtitle}</p>
        </div>
        <div className="flex gap-2">
          <input id="invoice" className="min-w-0 flex-1 rounded-xl border border-[#F1E4ED] bg-white px-4 py-3 text-sm text-[#251D2C] outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-100" value={invoice} onChange={event => setInvoice(event.target.value)} placeholder={t.trackPlaceholder} required />
          <button type="submit" className="rounded-xl bg-pink-600 px-5 py-3 text-sm font-bold text-white hover:bg-pink-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-600">{t.trackButton}</button>
        </div>
      </form>

      <section aria-labelledby="how-it-works-heading" className="mt-9 sm:mt-12">
        <h2 id="how-it-works-heading" className="text-2xl font-extrabold text-[#251D2C]">{c.howItWorksTitle}</h2>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">{c.howItWorksSubtitle}</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          {steps.map((step, index) => (
            <div key={step.title} className="border-t border-[#F1E4ED] py-4 sm:py-5">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-pink-600 text-sm font-bold text-white">{index + 1}</span>
              <h3 className="mt-4 text-base font-bold text-[#251D2C]">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </StoreShell>
  );
}
