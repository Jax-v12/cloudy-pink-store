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
  return <StoreShell>
    <Link href="/admin" className="text-pink-700 underline">{c.back}</Link>
    <div className="flex gap-3 my-6"><button className="bg-white rounded-xl border border-pink-200 p-3" aria-pressed={tab === 'fulfillment'} onClick={() => setTab('fulfillment')}>{c.fulfillmentAdmin}</button><button className="bg-white rounded-xl border border-pink-200 p-3" aria-pressed={tab === 'catalog'} onClick={() => setTab('catalog')}>{c.catalogAdmin}</button></div>
    {tab === 'fulfillment' ? <FulfillmentAdmin /> : <TopupAdmin />}
  </StoreShell>;
}
