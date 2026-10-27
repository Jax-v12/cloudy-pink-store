'use client';
import { useLanguage } from '@/context/LanguageContext';
import StoreShell from '@/components/StoreShell';

export default function Page() {
  const { t } = useLanguage();
  return (
    <StoreShell>
      <section className="mx-auto max-w-3xl rounded-3xl border border-[#F1E4ED] bg-white p-6 shadow-[0_12px_32px_-12px_rgba(157,23,77,0.08)] sm:p-8">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#251D2C]">{t.apps.privacyTitle}</h1>
        <div className="mt-5 space-y-4">
          {[t.apps.privacyBody, t.apps.privacyReminders, t.apps.privacyMetrics].map(text => (
            <p
              key={text}
              className="rounded-2xl border border-[#F1E4ED] bg-[#FFF9FC] p-4 sm:p-5 text-sm leading-7 text-[#251D2C]"
            >
              {text}
            </p>
          ))}
        </div>
      </section>
    </StoreShell>
  );
}
