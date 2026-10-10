'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';
import StoreShell from '@/components/StoreShell';
export default function HomePage() {
  const { t } = useLanguage(); const c = t.commerce; const [invoice, setInvoice] = useState(''); const router = useRouter();
  return <StoreShell>
    <section className="py-4 sm:py-8 max-w-3xl animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white/80 backdrop-blur-md rounded-[2rem] p-6 sm:p-10 border-2 border-pink-100 shadow-xl shadow-pink-900/10">
        <h1 className="text-3xl sm:text-5xl font-black text-pink-800 leading-tight drop-shadow-sm">{c.portalTitle}</h1>
        <p className="mt-4 sm:mt-5 text-base sm:text-lg font-medium text-pink-950">{c.portalSubtitle}</p>
      </div>
    </section>

    <section className="grid md:grid-cols-3 gap-5 mt-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
      {([{ href: '/apps', title: c.APPS, description: c.appsDescription }, { href: '/games', title: c.GAME, description: c.gameDescription }, { href: '/roblox', title: c.ROBLOX, description: c.robloxDescription }]).map(item => (
        <Link key={item.href} href={item.href} className="group bg-white/95 backdrop-blur-md p-7 border-2 border-pink-200 rounded-[2rem] shadow-lg shadow-pink-900/10 hover:shadow-2xl hover:shadow-pink-400/20 hover:border-pink-300 hover:-translate-y-1 hover:scale-[1.02] transition-all duration-300 cursor-pointer flex flex-col">
          <div className="flex-1">
            <h2 className="text-2xl text-pink-700 font-black group-hover:text-pink-600 transition-colors drop-shadow-sm">{item.title}</h2>
            <p className="mt-3 font-medium text-neutral-600">{item.description}</p>
          </div>
          <div className="mt-6 flex justify-end">
            <div className="w-10 h-10 rounded-full bg-pink-100 flex items-center justify-center text-pink-600 group-hover:bg-pink-500 group-hover:text-white transition-colors duration-300 shadow-sm">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
            </div>
          </div>
        </Link>
      ))}
    </section>

    <form className="my-12 bg-white/95 backdrop-blur-md p-6 sm:p-8 rounded-[2rem] border-2 border-pink-200 shadow-xl shadow-pink-900/10 max-w-3xl animate-in fade-in slide-in-from-bottom-10 duration-1000" onSubmit={e => { e.preventDefault(); if (invoice.trim()) router.push('/order/' + encodeURIComponent(invoice.trim())); }}>
      <label className="font-black text-lg text-pink-800 mb-4 flex items-center gap-2" htmlFor="invoice">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        {t.trackTitle}
      </label>
      <div className="flex flex-col sm:flex-row gap-3">
        <input id="invoice" className="border-2 border-pink-200 rounded-2xl p-4 min-w-0 flex-1 font-medium bg-white focus:border-pink-500 focus:ring-4 focus:ring-pink-50 outline-none transition-all shadow-sm" value={invoice} onChange={e => setInvoice(e.target.value)} placeholder={t.trackPlaceholder} required />
        <button className="bg-gradient-to-r from-pink-500 to-rose-400 text-white rounded-2xl px-8 py-4 font-bold shadow-md shadow-pink-200 hover:scale-[1.02] active:scale-95 transition-all duration-200">{t.trackButton}</button>
      </div>
    </form>
  </StoreShell>;
}
