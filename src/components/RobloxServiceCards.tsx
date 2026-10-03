'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';
import { type RobloxMethodKey } from '@/lib/roblox';

type Product = { id: number; slug: string; name: string; checkoutEnabled: boolean; variants: { method: string | null; price: number; units: number }[] };
function ServiceArt({ method }: { method: RobloxMethodKey }) {
  return <svg viewBox="0 0 160 150" aria-hidden="true" className="h-32 w-36 shrink-0 text-pink-300">
    <circle cx="85" cy="80" r="60" fill="#fff1f5" /><circle cx="133" cy="24" r="8" fill="#fbcfe0" />
    {method === 'GAMEPASS' ? <g transform="rotate(-12 80 75)"><rect x="34" y="39" width="95" height="69" rx="15" fill="#fce7ef" stroke="currentColor" strokeWidth="3" /><path d="M59 40v68" stroke="currentColor" strokeWidth="3" strokeDasharray="5 5" /><path d="m96 55 17 17-17 17-17-17z" fill="#fb718f" /><circle cx="96" cy="72" r="6" fill="white" /></g>
      : method === 'LOGIN' ? <g><path d="M58 63V49a23 23 0 0 1 46 0v14" fill="none" stroke="#f9a8c5" strokeWidth="12" /><rect x="43" y="62" width="75" height="60" rx="17" fill="#fce7ef" stroke="currentColor" strokeWidth="3" /><circle cx="80" cy="85" r="8" fill="#fb718f" /><path d="M80 88v12" stroke="#fb718f" strokeWidth="7" strokeLinecap="round" /></g>
      : <g><rect x="40" y="65" width="85" height="56" rx="9" fill="#fce7ef" stroke="currentColor" strokeWidth="3" /><rect x="35" y="50" width="95" height="22" rx="7" fill="#f9a8c5" /><path d="M82 50v71M82 50c-35-3-29-39-11-24 8 7 11 24 11 24s4-18 12-24c17-14 25 21-12 24" fill="none" stroke="#fb718f" strokeWidth="7" /></g>}
    <path d="M20 110v14m-7-7h14M134 104v12m-6-6h12" stroke="#f9a8c5" strokeWidth="3" strokeLinecap="round" />
  </svg>;
}
export default function RobloxServiceCards({ products }: { products: Product[] }) {
  const { t, language } = useLanguage(); const f = t.robloxFlow;
  const [selection, setSelection] = useState<Partial<Record<RobloxMethodKey, number>>>({});
  const features = { GAMEPASS: [f.noPassword, f.taxIncluded, f.pending], LOGIN: [f.encrypted, f.restricted, f.verification], GIFT_USERNAME: [f.gift, f.eligibility, f.accepted] };
  const tag = { GAMEPASS: f.passTag, LOGIN: f.loginTag, GIFT_USERNAME: f.giftTag };
  return <div className="grid gap-5 md:grid-cols-3">{(['GAMEPASS', 'LOGIN', 'GIFT_USERNAME'] as const).map(method => {
    const eligible = products.filter(p => p.variants.some(v => v.method === method));
    const product = eligible.find(p => p.id === selection[method]) ?? eligible[0];
    const rate = product?.variants.filter(v => v.method === method).sort((a, b) => a.price - b.price)[0];
    const price = rate && new Intl.NumberFormat(language === 'ID' ? 'id-ID' : language === 'MY' ? 'ms-MY' : 'en-US', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(rate.price);
    return <article key={method} className="flex flex-col rounded-3xl border-2 border-pink-100 bg-white p-5 shadow-sm transition hover:border-pink-300 hover:shadow-md">
      <span className="self-start rounded-full bg-pink-50 px-3 py-1 text-[10px] font-extrabold uppercase tracking-wide text-pink-500">{t.roblox[method]}</span>
      <h2 className="mt-5 text-2xl font-black leading-tight text-pink-400">{f[method]}</h2><p className="mt-1 text-lg font-extrabold text-slate-800">{tag[method]}</p>
      <div className="my-2 self-center"><ServiceArt method={method} /></div>
      <ul className="space-y-3 text-sm text-slate-600">{features[method].map(line => <li key={line} className="flex items-start gap-2"><span aria-hidden="true" className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-pink-50 text-pink-400">✓</span>{line}</li>)}</ul>
      <div className="mt-auto pt-6">
        {eligible.length > 1 && <label className="mb-3 block text-xs text-slate-500">{t.commerce.product}<select className="mt-1 w-full rounded-xl border border-pink-200 p-2 text-sm" value={product?.id} onChange={e => setSelection(old => ({ ...old, [method]: Number(e.target.value) }))}>{eligible.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}
        {rate && <p className="mb-3 text-sm font-semibold text-pink-700">{price} / {rate.units} Robux</p>}
        {product ? <><Link href={`/roblox/${product.slug}?method=${method}`} className="flex items-center justify-between rounded-xl bg-rose-400 px-4 py-3.5 text-center font-bold text-white hover:bg-rose-500"><span className="flex-1">{f.buy}</span><span aria-hidden="true">→</span></Link>{!product.checkoutEnabled && <p className="text-xs text-slate-500 mt-2">{t.commerce.unavailable}</p>}</> : <p className="rounded-xl bg-pink-50 px-4 py-3 text-sm text-slate-500">{t.roblox.noPackages}</p>}
      </div>
    </article>;
  })}</div>;
}
