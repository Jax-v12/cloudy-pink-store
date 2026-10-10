'use client';
import { useLanguage } from '@/context/LanguageContext';
import { REGION_CURRENCY, type Region } from '@/lib/regionalPricing';

export default function DetectedLocation({ region, loading = false }: { region: Region | null; loading?: boolean }) {
  const { t } = useLanguage();
  const tone = loading ? 'border-pink-100 bg-white/80 text-neutral-600' : region ? 'border-emerald-100 bg-white/90 text-neutral-700' : 'border-amber-200 bg-amber-50 text-amber-900';
  return <div className={`mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-2xl border px-4 py-3 text-sm shadow-sm ${tone}`} role="status">
    <p className="flex items-center gap-2.5">
      <span aria-hidden="true" className={`h-2.5 w-2.5 shrink-0 rounded-full ${loading ? 'animate-pulse bg-pink-300' : region ? 'bg-emerald-400' : 'bg-amber-400'}`} />
      {loading ? t.regional.detecting : region ? <span>{t.regional.detected}: <strong className="font-semibold">{t.regional[region]}</strong> · {REGION_CURRENCY[region]}</span> : t.regional.locationUnavailable}
    </p>
    <a href="https://wa.me/6287867395872" target="_blank" rel="noopener noreferrer" className="font-semibold text-pink-700 underline-offset-4 hover:underline">{t.regional.locationHelp} ↗</a>
  </div>;
}
