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
    { href: '/games', title: c.GAME, description: c.gameDescription, badge: c.trustServerPrice, art: '/store/anya-games.jpg' },
  ];
  const steps = [
    { title: c.step1Title, desc: c.step1Desc },
    { title: c.step2Title, desc: c.step2Desc },
    { title: c.step3Title, desc: c.step3Desc },
  ];
  return (
    <StoreShell>
      <section className="grid items-center gap-6 py-5 sm:py-9 lg:grid-cols-2 lg:gap-10">
        <div>
          <p className="mb-3 text-sm font-bold text-pink-700">{c.brand}</p>
          <h1 className="max-w-xl text-3xl font-extrabold leading-tight tracking-tight text-[#251D2C] sm:text-5xl">{c.portalTitle}</h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-[#756C7D] sm:text-base">{c.portalSubtitle}</p>
          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-[#756C7D]">
            {[c.trustSecure, c.trustServerPrice, c.trustInvoice].map(label => <span key={label}>{label}</span>)}
          </div>
        </div>
        <Image src="/banner-logo.png" alt={c.brand} width={1774} height={887} sizes="(max-width: 1023px) 100vw, 550px" className="h-auto w-full rounded-3xl border border-pink-100" loading="eager" />
      </section>

      <section className="mt-3 grid gap-4 md:grid-cols-3">
        {categories.map(item => (
          <Link key={item.href} href={item.href} className="group flex min-w-0 flex-col justify-between rounded-3xl border border-[#F1E4ED] bg-white p-5 transition-colors hover:border-pink-400 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-pink-600 sm:p-6">
            <div>
              <div className="mb-4 flex items-center gap-4">
                <div className="relative h-18 w-18 shrink-0 overflow-hidden rounded-2xl border border-[#F1E4ED] bg-white">
                  <Image src={item.art} alt="" fill sizes="72px" className="object-cover" style={item.href === '/apps' ? { objectPosition: 'center 55%' } : undefined} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs leading-relaxed text-[#756C7D]">{item.badge}</p>
                  <h2 className="mt-1 text-xl font-extrabold text-[#251D2C]">{item.title}</h2>
                </div>
              </div>
              <p className="text-sm leading-relaxed text-[#756C7D]">{item.description}</p>
            </div>
            <span className="mt-5 text-sm font-bold text-pink-700">{c.exploreCta} <span aria-hidden="true">→</span></span>
          </Link>
        ))}
      </section>

      <form className="mt-6 grid items-center gap-4 rounded-3xl border border-[#F1E4ED] bg-white p-5 sm:p-7 lg:grid-cols-2" onSubmit={event => {
        event.preventDefault();
        if (invoice.trim()) router.push('/order/' + encodeURIComponent(invoice.trim()));
      }}>
        <div>
          <label htmlFor="invoice" className="text-xl font-extrabold text-[#251D2C]">{t.trackTitle}</label>
          <p className="mt-1 text-sm text-[#756C7D]">{t.trackSubtitle}</p>
        </div>
        <div className="flex gap-2">
          <input id="invoice" className="min-w-0 flex-1 rounded-xl border border-[#F1E4ED] bg-white px-4 py-3 text-sm text-[#251D2C] outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-100" value={invoice} onChange={event => setInvoice(event.target.value)} placeholder={t.trackPlaceholder} required />
          <button type="submit" className="rounded-xl bg-pink-600 px-5 py-3 text-sm font-bold text-white hover:bg-pink-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-600">{t.trackButton}</button>
        </div>
      </form>

      <section aria-labelledby="how-it-works-heading" className="mt-9 sm:mt-12">
        <h2 id="how-it-works-heading" className="text-2xl font-extrabold text-[#251D2C]">{c.howItWorksTitle}</h2>
        <p className="mt-2 text-sm text-[#756C7D]">{c.howItWorksSubtitle}</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          {steps.map((step, index) => (
            <div key={step.title} className="rounded-2xl border border-[#F1E4ED] bg-white p-5">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-pink-600 text-sm font-bold text-white">{index + 1}</span>
              <h3 className="mt-4 text-base font-bold text-[#251D2C]">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#756C7D]">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </StoreShell>
  );
}
