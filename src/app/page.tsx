'use client';
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
    {
      href: '/roblox',
      title: c.ROBLOX,
      description: c.robloxDescription,
      badge: 'Gamepass · Username · Login',
      accent: 'from-pink-500 to-rose-500',
      iconBg: 'bg-pink-50 text-pink-600 border-pink-200',
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      ),
    },
    {
      href: '/apps',
      title: c.APPS,
      description: c.appsDescription,
      badge: t.badge,
      accent: 'from-purple-500 to-pink-500',
      iconBg: 'bg-purple-50 text-purple-600 border-purple-200',
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      href: '/games',
      title: c.GAME,
      description: c.gameDescription,
      badge: c.trustServerPrice,
      accent: 'from-rose-500 to-amber-500',
      iconBg: 'bg-rose-50 text-rose-600 border-rose-200',
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
  ] as const;

  const steps = [
    { title: c.step1Title, desc: c.step1Desc },
    { title: c.step2Title, desc: c.step2Desc },
    { title: c.step3Title, desc: c.step3Desc },
  ];

  return (
    <StoreShell>
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl border border-[#F1E4ED] bg-white p-5 sm:p-8 lg:p-10 shadow-[0_16px_40px_-14px_rgba(236,72,153,0.12)]">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-gradient-to-br from-pink-100/70 to-purple-100/50 blur-3xl" aria-hidden="true" />
        <div className="relative grid gap-6 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-7 space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-pink-200 bg-pink-50/80 px-3.5 py-1 text-xs font-extrabold tracking-wide text-pink-700">
              <span className="h-2 w-2 rounded-full bg-pink-500" aria-hidden="true" />
              {c.brand}
            </div>
            <h1 className="text-2xl sm:text-4xl lg:text-[2.65rem] font-extrabold tracking-tight text-[#251D2C] leading-[1.15]">
              {c.portalTitle}
            </h1>
            <p className="max-w-xl text-sm sm:text-base font-medium leading-relaxed text-[#756C7D]">
              {c.portalSubtitle}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {[c.trustSecure, c.trustServerPrice, c.trustInvoice].map(pill => (
                <span
                  key={pill}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#F1E4ED] bg-[#FFF9FC] px-3 py-1 text-xs font-semibold text-[#251D2C]"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-pink-500" aria-hidden="true" />
                  {pill}
                </span>
              ))}
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="mx-auto max-w-sm lg:max-w-none overflow-hidden rounded-2xl border border-pink-200/80 bg-gradient-to-br from-pink-50 via-white to-purple-50 p-2 shadow-md shadow-pink-900/5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/banner-logo.png"
                alt="Cloudy Pink Store Banner"
                className="w-full h-auto rounded-xl object-contain"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Service Categories */}
      <section className="mt-5 sm:mt-7 grid gap-4 md:grid-cols-3">
        {categories.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-[#F1E4ED] bg-white p-5 sm:p-6 shadow-[0_8px_24px_-8px_rgba(157,23,77,0.07)] transition-all duration-200 hover:-translate-y-1 hover:border-pink-300 hover:shadow-[0_18px_36px_-12px_rgba(236,72,153,0.18)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-600"
          >
            <div>
              <div className="flex items-start justify-between gap-3">
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${item.iconBg} transition-transform duration-200 group-hover:scale-105`}>
                  {item.icon}
                </div>
                <span className="rounded-full border border-[#F1E4ED] bg-[#FFF9FC] px-2.5 py-1 text-[11px] font-bold text-[#756C7D]">
                  {item.badge}
                </span>
              </div>
              <h2 className="mt-4 text-xl sm:text-2xl font-extrabold tracking-tight text-[#251D2C] group-hover:text-pink-600 transition-colors">
                {item.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-[#756C7D]">
                {item.description}
              </p>
            </div>

            <div className="mt-5 flex items-center justify-between border-t border-[#F1E4ED] pt-3.5 text-xs font-extrabold text-pink-600 group-hover:text-pink-700">
              <span>{c.exploreCta}</span>
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-pink-50 text-pink-600 transition-all duration-200 group-hover:translate-x-0.5 group-hover:bg-pink-600 group-hover:text-white">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </span>
            </div>
          </Link>
        ))}
      </section>

      {/* Invoice Tracking Lookup + How It Works Grid */}
      <div className="mt-6 sm:mt-8 grid gap-5 lg:grid-cols-12 lg:items-stretch">
        <form
          className="lg:col-span-5 flex flex-col justify-between rounded-3xl border border-[#F1E4ED] bg-white p-5 sm:p-7 shadow-[0_8px_24px_-8px_rgba(157,23,77,0.07)]"
          onSubmit={e => {
            e.preventDefault();
            if (invoice.trim()) router.push('/order/' + encodeURIComponent(invoice.trim()));
          }}
        >
          <div>
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-pink-50 text-pink-600 border border-pink-100 mb-3">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <label className="block font-extrabold text-lg sm:text-xl text-[#251D2C]" htmlFor="invoice">
              {t.trackTitle}
            </label>
            <p className="mt-1 text-xs sm:text-sm text-[#756C7D]">{t.trackSubtitle}</p>
          </div>

          <div className="mt-4 flex flex-col sm:flex-row gap-2.5">
            <input
              id="invoice"
              className="min-w-0 flex-1 rounded-2xl border border-[#F1E4ED] bg-[#FFF9FC] px-4 py-3 text-sm font-semibold text-[#251D2C] placeholder:text-[#756C7D]/70 focus:border-pink-500 focus:bg-white focus:ring-4 focus:ring-pink-500/10 outline-none transition-all"
              value={invoice}
              onChange={e => setInvoice(e.target.value)}
              placeholder={t.trackPlaceholder}
              required
            />
            <button
              type="submit"
              className="rounded-2xl bg-pink-600 hover:bg-pink-700 text-white px-6 py-3 text-sm font-extrabold shadow-sm shadow-pink-600/20 active:scale-[0.98] transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-600"
            >
              {t.trackButton}
            </button>
          </div>
        </form>

        <section
          aria-labelledby="how-it-works-heading"
          className="lg:col-span-7 rounded-3xl border border-[#F1E4ED] bg-white p-5 sm:p-7 shadow-[0_8px_24px_-8px_rgba(157,23,77,0.07)]"
        >
          <div className="mb-4">
            <h2 id="how-it-works-heading" className="text-lg sm:text-xl font-extrabold text-[#251D2C]">
              {c.howItWorksTitle}
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-[#756C7D]">{c.howItWorksSubtitle}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {steps.map((step, idx) => (
              <div
                key={step.title}
                className="rounded-2xl border border-[#F1E4ED] bg-[#FFF9FC] p-4 flex flex-col justify-between"
              >
                <div>
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-pink-600 text-xs font-extrabold text-white">
                    {idx + 1}
                  </span>
                  <h3 className="mt-2.5 text-sm font-extrabold text-[#251D2C]">{step.title}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-[#756C7D]">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </StoreShell>
  );
}
