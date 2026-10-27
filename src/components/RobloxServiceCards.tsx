'use client';
import { useState } from 'react';
import { formatMoney, REGION_CURRENCY, type Region, type RegionalPrice } from '@/lib/regionalPricing';
import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';
import { type RobloxMethodKey } from '@/lib/roblox';

type Product = { id: number; slug: string; name: string; checkoutEnabled: boolean; variants: { regionalPrices?: RegionalPrice[]; method: string | null; price: number | null; units: number }[] };
function ServiceArt({ method }: { method: RobloxMethodKey }) {
  return <svg viewBox="0 0 160 150" aria-hidden="true" className="h-12 w-12 shrink-0 text-pink-300 sm:h-20 sm:w-20">
    <circle cx="85" cy="80" r="60" fill="#fff1f5" /><circle cx="133" cy="24" r="8" fill="#fbcfe0" />
    {method === 'GAMEPASS' ? <g transform="rotate(-12 80 75)"><rect x="34" y="39" width="95" height="69" rx="15" fill="#fce7ef" stroke="currentColor" strokeWidth="3" /><path d="M59 40v68" stroke="currentColor" strokeWidth="3" strokeDasharray="5 5" /><path d="m96 55 17 17-17 17-17-17z" fill="#fb718f" /><circle cx="96" cy="72" r="6" fill="white" /></g>
      : method === 'LOGIN' ? <g><path d="M58 63V49a23 23 0 0 1 46 0v14" fill="none" stroke="#f9a8c5" strokeWidth="12" /><rect x="43" y="62" width="75" height="60" rx="17" fill="#fce7ef" stroke="currentColor" strokeWidth="3" /><circle cx="80" cy="85" r="8" fill="#fb718f" /><path d="M80 88v12" stroke="#fb718f" strokeWidth="7" strokeLinecap="round" /></g>
      : <g><rect x="40" y="65" width="85" height="56" rx="9" fill="#fce7ef" stroke="currentColor" strokeWidth="3" /><rect x="35" y="50" width="95" height="22" rx="7" fill="#f9a8c5" /><path d="M82 50v71M82 50c-35-3-29-39-11-24 8 7 11 24 11 24s4-18 12-24c17-14 25 21-12 24" fill="none" stroke="#fb718f" strokeWidth="7" /></g>}
    <path d="M20 110v14m-7-7h14M134 104v12m-6-6h12" stroke="#f9a8c5" strokeWidth="3" strokeLinecap="round" />
  </svg>;
}
export default function RobloxServiceCards({ products, region }: { products: Product[]; region: Region | null }) {
  const { t, language } = useLanguage(); const f = t.robloxFlow;
  const comparison = t.serviceHelp.comparison;
  const [selection, setSelection] = useState<Partial<Record<RobloxMethodKey, number>>>({});
  const tag = { GAMEPASS: f.passTag, LOGIN: f.loginTag, GIFT_USERNAME: f.giftTag };
  return <section aria-labelledby="method-comparison-title">
    <div className="mb-3 sm:mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 rounded-2xl border border-pink-200 bg-white/95 px-4 py-2.5 sm:px-5 sm:py-3.5">
      <h2 id="method-comparison-title" className="text-base sm:text-xl font-black text-pink-900">{comparison.title}</h2>
      <p className="text-xs sm:text-sm leading-relaxed text-slate-700">{comparison.intro}</p>
    </div>
    <div className="grid gap-3.5 sm:gap-5 lg:grid-cols-3">{(['GAMEPASS', 'LOGIN', 'GIFT_USERNAME'] as const).map(method => {
      const eligible = products.filter(p => p.variants.some(v => v.method === method));
      const product = eligible.find(p => p.id === selection[method]) ?? eligible[0];
      const rate = region ? product?.variants.filter(v => v.method === method).sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity))[0] : undefined;
      const amount = rate?.price ?? null;
      const price = amount === null || !region ? t.regional.unavailable : formatMoney(amount, REGION_CURRENCY[region], language);
      const ready = Boolean(product && region && amount !== null && product.checkoutEnabled);
      return <article key={method} className="group flex flex-col overflow-hidden rounded-3xl border-2 border-pink-200 bg-white/95 backdrop-blur-md shadow-lg shadow-pink-900/10 transition hover:-translate-y-0.5 hover:border-pink-300 hover:shadow-xl hover:shadow-pink-900/20">
        <div className="relative flex items-center justify-between gap-3 bg-gradient-to-br from-pink-50/50 via-rose-50/30 to-transparent px-4 pt-3.5 pb-1.5 sm:px-5 sm:pt-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-block rounded-xl bg-white px-2.5 py-0.5 text-[11px] font-black uppercase tracking-widest text-pink-600 shadow-sm border border-pink-100">{t.roblox[method]}</span>
              <span className="text-xs font-bold text-slate-600">· {tag[method]}</span>
            </div>
            <h3 className="mt-1.5 text-lg font-black leading-tight text-pink-800 sm:text-2xl">{f[method]}</h3>
          </div>
          <div className="-mr-2 shrink-0 transition group-hover:scale-105"><ServiceArt method={method} /></div>
        </div>
        <div className="flex flex-1 flex-col px-4 pb-4 pt-1 sm:px-5 sm:pb-5">
          <div className="space-y-2">
            {eligible.length > 1 && <label className="block text-xs font-semibold text-slate-600">{t.commerce.product}<select className="mt-1 w-full rounded-xl border border-pink-200 bg-white p-2 text-sm" value={product?.id} onChange={e => setSelection(old => ({ ...old, [method]: Number(e.target.value) }))}>{eligible.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}
            {rate && <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-pink-50/80 px-3.5 py-2.5">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-pink-600">{t.commerce.startingFrom}</p>
                <p className="text-base sm:text-lg font-black text-slate-800">{price} <span className="text-xs sm:text-sm font-semibold text-slate-600">/ {rate.units} Robux</span></p>
              </div>
              {ready && product && <Link href={`/roblox/${product.slug}?method=${method}`} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-pink-500 to-rose-400 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-pink-200 transition hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-600"><span>{f.buy}</span><span aria-hidden="true" className="transition group-hover:translate-x-0.5">→</span></Link>}
            </div>}
            {(!ready || !product) && <p className="rounded-xl border border-dashed border-pink-200 px-3.5 py-2 text-xs sm:text-sm text-slate-600">{!region ? t.regional.locationUnavailable : !product || amount === null ? t.regional.unavailable : product.checkoutEnabled ? t.regional.paymentUnavailable : t.commerce.unavailable}</p>}
          </div>
          <details className="mt-2.5 rounded-2xl border border-pink-100 bg-pink-50/30 px-3.5 py-2 text-xs sm:text-sm text-slate-700">
            <summary className="cursor-pointer font-bold text-pink-900 focus-visible:outline-2 focus-visible:outline-pink-800">{comparison.detailsSummary}</summary>
            <dl className="mt-2.5 space-y-2.5 leading-relaxed">
              {(['requirements', 'process', 'timing'] as const).map(field => <div key={field}>
                <dt className="font-bold text-slate-900">{comparison[field]}</dt>
                <dd className="mt-0.5">{comparison[method][field]}</dd>
              </div>)}
            </dl>
          </details>
        </div>
      </article>;
    })}</div>
    <p className="mt-4 rounded-2xl border border-pink-200 bg-white/95 px-4 py-3 sm:p-4 text-xs sm:text-sm leading-relaxed text-slate-700">{comparison.notice}</p>
  </section>;
}
