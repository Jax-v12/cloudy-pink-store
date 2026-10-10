'use client';
import { useState } from 'react';
import { regionalAmount, formatMoney, REGION_CURRENCY, type Region, type RegionalPrice } from '@/lib/regionalPricing';
import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';
import { type RobloxMethodKey } from '@/lib/roblox';

type Product = { id: number; slug: string; name: string; checkoutEnabled: boolean; variants: { regionalPrices?: RegionalPrice[]; method: string | null; price: number; units: number }[] };
function ServiceArt({ method }: { method: RobloxMethodKey }) {
  return <svg viewBox="0 0 160 150" aria-hidden="true" className="h-28 w-28 shrink-0 text-pink-300">
    <circle cx="85" cy="80" r="60" fill="#fff1f5" /><circle cx="133" cy="24" r="8" fill="#fbcfe0" />
    {method === 'GAMEPASS' ? <g transform="rotate(-12 80 75)"><rect x="34" y="39" width="95" height="69" rx="15" fill="#fce7ef" stroke="currentColor" strokeWidth="3" /><path d="M59 40v68" stroke="currentColor" strokeWidth="3" strokeDasharray="5 5" /><path d="m96 55 17 17-17 17-17-17z" fill="#fb718f" /><circle cx="96" cy="72" r="6" fill="white" /></g>
      : method === 'LOGIN' ? <g><path d="M58 63V49a23 23 0 0 1 46 0v14" fill="none" stroke="#f9a8c5" strokeWidth="12" /><rect x="43" y="62" width="75" height="60" rx="17" fill="#fce7ef" stroke="currentColor" strokeWidth="3" /><circle cx="80" cy="85" r="8" fill="#fb718f" /><path d="M80 88v12" stroke="#fb718f" strokeWidth="7" strokeLinecap="round" /></g>
      : <g><rect x="40" y="65" width="85" height="56" rx="9" fill="#fce7ef" stroke="currentColor" strokeWidth="3" /><rect x="35" y="50" width="95" height="22" rx="7" fill="#f9a8c5" /><path d="M82 50v71M82 50c-35-3-29-39-11-24 8 7 11 24 11 24s4-18 12-24c17-14 25 21-12 24" fill="none" stroke="#fb718f" strokeWidth="7" /></g>}
    <path d="M20 110v14m-7-7h14M134 104v12m-6-6h12" stroke="#f9a8c5" strokeWidth="3" strokeLinecap="round" />
  </svg>;
}
export default function RobloxServiceCards({ products, region }: { products: Product[]; region: Region | null }) {
  const { t, language } = useLanguage(); const f = t.robloxFlow;
  const [selection, setSelection] = useState<Partial<Record<RobloxMethodKey, number>>>({});
  const features = { GAMEPASS: [f.noPassword, f.taxIncluded, f.pending], LOGIN: [t.robloxOps.noCredentials, f.verification, f.manual], GIFT_USERNAME: [f.gift, f.eligibility, f.accepted] };
  const tag = { GAMEPASS: f.passTag, LOGIN: f.loginTag, GIFT_USERNAME: f.giftTag };
  return <div className="grid gap-5 md:grid-cols-3">{(['GAMEPASS', 'LOGIN', 'GIFT_USERNAME'] as const).map(method => {
    const eligible = products.filter(p => p.variants.some(v => v.method === method));
    const product = eligible.find(p => p.id === selection[method]) ?? eligible[0];
    const rate = region ? product?.variants.filter(v => v.method === method).sort((a, b) => (regionalAmount(a, region) ?? Infinity) - (regionalAmount(b, region) ?? Infinity))[0] : undefined;
    const amount = rate && region ? regionalAmount(rate, region) : null;
    const price = amount === null || !region ? t.regional.unavailable : formatMoney(amount, REGION_CURRENCY[region], language);
    const ready = Boolean(product && region && amount !== null && product.checkoutEnabled);
    return <article key={method} className="group flex flex-col overflow-hidden rounded-3xl border-2 border-pink-200 bg-white/95 backdrop-blur-md shadow-lg shadow-pink-900/10 transition hover:-translate-y-1 hover:border-pink-300 hover:shadow-xl hover:shadow-pink-900/20">
      <div className="relative flex items-center justify-between gap-3 bg-gradient-to-br from-pink-50/50 via-rose-50/30 to-transparent px-6 pt-6 pb-2">
        <div className="min-w-0 self-start">
          <span className="inline-block rounded-xl bg-white px-3 py-1 text-xs font-black uppercase tracking-widest text-pink-500 shadow-sm border border-pink-100">{t.roblox[method]}</span>
          <h2 className="mt-4 text-2xl font-black leading-tight text-pink-600">{f[method]}</h2>
          <p className="mt-1 font-bold text-slate-700">{tag[method]}</p>
        </div>
        <div className="-mr-3 transition group-hover:scale-105"><ServiceArt method={method} /></div>
      </div>
      <div className="flex flex-1 flex-col p-6 pt-3">
        <ul className="space-y-2.5 text-sm text-slate-600">{features[method].map(line => <li key={line} className="flex items-start gap-2.5"><span aria-hidden="true" className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-xs font-bold text-emerald-600">✓</span>{line}</li>)}</ul>
        <div className="mt-auto space-y-3 pt-6">
          {eligible.length > 1 && <label className="block text-xs font-semibold text-slate-500">{t.commerce.product}<select className="mt-1 w-full rounded-xl border border-pink-200 bg-white p-2.5 text-sm" value={product?.id} onChange={e => setSelection(old => ({ ...old, [method]: Number(e.target.value) }))}>{eligible.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}
          {rate && <div className="rounded-2xl bg-pink-50/70 px-4 py-3"><p className="text-xs font-semibold uppercase tracking-wide text-pink-500">{t.commerce.startingFrom}</p><p className="mt-0.5 text-lg font-black text-slate-800">{price} <span className="text-sm font-semibold text-slate-500">/ {rate.units} Robux</span></p></div>}
          {ready && product ? <Link href={`/roblox/${product.slug}?method=${method}`} className="flex items-center justify-between rounded-2xl bg-gradient-to-r from-pink-500 to-rose-400 px-5 py-3.5 font-bold text-white shadow-md shadow-pink-200 transition hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-600"><span>{f.buy}</span><span aria-hidden="true" className="transition group-hover:translate-x-0.5">→</span></Link>
            : <p className="rounded-2xl border border-dashed border-pink-200 px-4 py-3 text-sm text-slate-500">{!region ? t.regional.locationUnavailable : !product || amount === null ? t.regional.unavailable : product.checkoutEnabled ? t.regional.paymentUnavailable : t.commerce.unavailable}</p>}
        </div>
      </div>
    </article>;
  })}</div>;
}
