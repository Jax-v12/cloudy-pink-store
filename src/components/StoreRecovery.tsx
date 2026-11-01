'use client';

import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';
import StoreShell from './StoreShell';

export default function StoreRecovery({ retry }: { retry?: () => void }) {
  const { t } = useLanguage();
  const copy = t.storeRecovery;
  return (
    <StoreShell>
      <section aria-labelledby="store-recovery-title" className="mx-auto max-w-2xl rounded-3xl border border-[#F1E4ED] bg-white p-6 sm:p-8">
        {!retry && <p className="mb-3 text-sm font-bold text-pink-700">404</p>}
        <h1 id="store-recovery-title" className="text-2xl font-extrabold tracking-tight text-[#251D2C] sm:text-3xl">
          {retry ? copy.errorTitle : copy.notFoundTitle}
        </h1>
        <p className="mt-4 text-sm leading-7 text-[var(--text-secondary)]">{retry ? copy.errorBody : copy.notFoundBody}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          {retry && (
            <button type="button" onClick={retry} className="min-h-11 rounded-xl bg-pink-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-pink-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-pink-700">
              {copy.retry}
            </button>
          )}
          <Link href="/" className="inline-flex min-h-11 items-center rounded-xl border border-pink-200 px-4 py-2.5 text-sm font-bold text-pink-700 hover:bg-pink-50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-pink-700">
            {t.commerce.home}
          </Link>
          <Link href="/help" className="inline-flex min-h-11 items-center rounded-xl border border-pink-200 px-4 py-2.5 text-sm font-bold text-pink-700 hover:bg-pink-50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-pink-700">
            {t.serviceHelp.title}
          </Link>
        </div>
      </section>
    </StoreShell>
  );
}
