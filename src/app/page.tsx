'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';
import StoreShell from '@/components/StoreShell';
export default function HomePage() {
  const { t } = useLanguage(); const c = t.commerce; const [invoice, setInvoice] = useState(''); const router = useRouter();
  return <StoreShell>
    <section className="py-10 sm:py-16 max-w-3xl"><h1 className="text-4xl sm:text-5xl font-black text-pink-800 leading-tight">{c.portalTitle}</h1><p className="mt-5 text-lg text-neutral-600">{c.portalSubtitle}</p></section>
    <section className="grid md:grid-cols-3 gap-5">
      {([{ href: '/apps', title: c.APPS, description: c.appsDescription }, { href: '/games', title: c.GAME, description: c.gameDescription }, { href: '/roblox', title: c.ROBLOX, description: c.robloxDescription }]).map(item => <Link key={item.href} href={item.href} className="bg-white p-7 border border-pink-200 rounded-3xl hover:shadow-xl transition"><h2 className="text-2xl text-pink-700 font-bold">{item.title}</h2><p className="mt-4 text-neutral-600">{item.description}</p></Link>)}
    </section>
    <form className="my-12 bg-white p-6 rounded-2xl border border-pink-200" onSubmit={e => { e.preventDefault(); if (invoice.trim()) router.push('/order/' + encodeURIComponent(invoice.trim())); }}>
      <label className="font-bold block mb-3" htmlFor="invoice">{t.trackTitle}</label><div className="flex gap-3"><input id="invoice" className="border border-pink-200 rounded-xl p-3 min-w-0 flex-1" value={invoice} onChange={e => setInvoice(e.target.value)} placeholder={t.trackPlaceholder} required /><button className="bg-pink-600 text-white rounded-xl px-5">{t.trackButton}</button></div>
    </form>
  </StoreShell>;
}
