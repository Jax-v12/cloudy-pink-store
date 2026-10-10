'use client';
import { useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import StoreShell from '@/components/StoreShell';
import { useLanguage } from '@/context/LanguageContext';
const FulfillmentAdmin = dynamic(() => import('@/components/FulfillmentAdmin'));
const TopupAdmin = dynamic(() => import('@/components/TopupAdmin'));
export default function Page() {
  const { t } = useLanguage(); const c = t.commerce;
  const [tab, setTab] = useState('fulfillment');
  return <StoreShell wide>
    <div className="bg-white/95 backdrop-blur-md rounded-[2.5rem] p-6 sm:p-10 shadow-2xl border-4 border-pink-200">
      <div className="mb-8">
        <Link href="/admin" className="inline-flex items-center gap-2 text-sm font-bold text-pink-600 hover:text-pink-700 transition">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          {c.back}
        </Link>
      </div>
      <div className="flex flex-wrap gap-3 mb-8">
        <button className={`rounded-xl px-5 py-3 font-bold transition-all active:scale-95 border-2 shadow-sm ${tab === 'fulfillment' ? 'bg-pink-500 text-white border-pink-500' : 'bg-white border-pink-200 text-neutral-600 hover:border-pink-300 hover:text-pink-600'}`} aria-pressed={tab === 'fulfillment'} onClick={() => setTab('fulfillment')}>{c.fulfillmentAdmin}</button>
        <button className={`rounded-xl px-5 py-3 font-bold transition-all active:scale-95 border-2 shadow-sm ${tab === 'catalog' ? 'bg-pink-500 text-white border-pink-500' : 'bg-white border-pink-200 text-neutral-600 hover:border-pink-300 hover:text-pink-600'}`} aria-pressed={tab === 'catalog'} onClick={() => setTab('catalog')}>{c.catalogAdmin}</button>
      </div>
      {tab === 'fulfillment' ? <FulfillmentAdmin /> : <TopupAdmin />}
    </div>
  </StoreShell>;
}
