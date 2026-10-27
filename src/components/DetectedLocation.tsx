'use client';
import { useLanguage } from '@/context/LanguageContext';
import { REGION_CURRENCY, type Region } from '@/lib/regionalPricing';

export default function DetectedLocation({ region, loading = false }: { region: Region | null; loading?: boolean }) {
  const { t } = useLanguage();
  const tone = loading
    ? 'border-[#F1E4ED] bg-white text-[#756C7D]'
    : region
      ? 'border-emerald-200/80 bg-emerald-50/40 text-[#251D2C]'
      : 'border-amber-200 bg-amber-50/90 text-amber-950';
  return (
    <div
      className={`mb-3 sm:mb-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 rounded-2xl border px-3.5 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm shadow-xs ${tone}`}
      role="status"
    >
      <p className="flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className={`h-2.5 w-2.5 shrink-0 rounded-full ${
            loading ? 'animate-pulse bg-pink-400' : region ? 'bg-emerald-500 ring-4 ring-emerald-500/15' : 'bg-amber-500 ring-4 ring-amber-500/15'
          }`}
        />
        {loading ? (
          t.regional.detecting
        ) : region ? (
          <span>
            {t.regional.detected}: <strong className="font-bold text-[#251D2C]">{t.regional[region]}</strong> ·{' '}
            <span className="inline-flex items-center rounded-md bg-white px-1.5 py-0.5 text-[11px] font-bold text-pink-700 border border-[#F1E4ED]">
              {REGION_CURRENCY[region]}
            </span>
          </span>
        ) : (
          t.regional.locationUnavailable
        )}
      </p>
      <a
        href="https://wa.me/6287867395872"
        target="_blank"
        rel="noopener noreferrer"
        className="font-semibold text-pink-700 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-pink-600 rounded"
      >
        {t.regional.locationHelp} ↗
      </a>
    </div>
  );
}
