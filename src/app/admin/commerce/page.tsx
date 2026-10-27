'use client';
import { useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import StoreShell from '@/components/StoreShell';
import { useLanguage } from '@/context/LanguageContext';

const FulfillmentAdmin = dynamic(() => import('@/components/FulfillmentAdmin'));
const TopupAdmin = dynamic(() => import('@/components/TopupAdmin'));

export default function Page() {
  const { t } = useLanguage();
  const c = t.commerce;
  const [tab, setTab] = useState('fulfillment');

  return (
    <StoreShell wide>
      <div className="rounded-3xl border border-[#F1E4ED] bg-white p-5 sm:p-8 shadow-[0_14px_36px_-12px_rgba(157,23,77,0.08)]">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-[#F1E4ED] pb-5">
          <div className="flex items-center gap-3">
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 rounded-xl border border-[#F1E4ED] bg-[#FFF9FC] px-3.5 py-2 text-xs sm:text-sm font-bold text-[#251D2C] hover:border-pink-300 hover:bg-pink-50 hover:text-pink-700 transition"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              {c.back}
            </Link>
            <span className="rounded-full border border-pink-200 bg-pink-50 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-pink-700">
              Roblox & Game Ops
            </span>
          </div>

          <div className="flex flex-wrap gap-2 rounded-2xl border border-[#F1E4ED] bg-[#FFF9FC] p-1">
            <button
              className={`rounded-xl px-4 py-2 text-xs sm:text-sm font-extrabold transition-all cursor-pointer ${
                tab === 'fulfillment'
                  ? 'bg-pink-600 text-white shadow-xs'
                  : 'text-[#756C7D] hover:text-[#251D2C]'
              }`}
              aria-pressed={tab === 'fulfillment'}
              onClick={() => setTab('fulfillment')}
            >
              {c.fulfillmentAdmin}
            </button>
            <button
              className={`rounded-xl px-4 py-2 text-xs sm:text-sm font-extrabold transition-all cursor-pointer ${
                tab === 'catalog'
                  ? 'bg-pink-600 text-white shadow-xs'
                  : 'text-[#756C7D] hover:text-[#251D2C]'
              }`}
              aria-pressed={tab === 'catalog'}
              onClick={() => setTab('catalog')}
            >
              {c.catalogAdmin}
            </button>
          </div>
        </div>

        {tab === 'fulfillment' ? <FulfillmentAdmin /> : <TopupAdmin />}
      </div>
    </StoreShell>
  );
}
