'use client';
import { useLanguage } from '@/context/LanguageContext';
import { REGION_CURRENCY, type Region } from '@/lib/regionalPricing';

export default function DetectedLocation({ region, loading = false }: { region: Region | null; loading?: boolean }) {
  const { t } = useLanguage();
  return <div className="mb-6 max-w-3xl rounded-2xl border border-pink-200 bg-white p-4 text-sm" role="status">
    <p>{loading ? t.regional.detecting : region ? `${t.regional.detected}: ${t.regional[region]} · ${REGION_CURRENCY[region]}` : t.regional.locationUnavailable}</p>
    <a href="https://wa.me/6287867395872" target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-pink-700 underline">{t.regional.locationHelp}</a>
  </div>;
}
