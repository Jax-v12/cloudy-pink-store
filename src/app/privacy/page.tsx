'use client';
import { useLanguage } from '@/context/LanguageContext';
import StoreShell from '@/components/StoreShell';
export default function Page() {
  const { t } = useLanguage();
  return <StoreShell><section className="rounded-3xl border-2 border-pink-200 bg-white p-6 sm:p-8"><h1 className="text-2xl font-bold text-pink-900">{t.apps.privacyTitle}</h1>{[t.apps.privacyBody, t.apps.privacyReminders, t.apps.privacyMetrics].map(text => <p key={text} className="mt-4 text-sm leading-7 text-slate-800">{text}</p>)}</section></StoreShell>;
}
