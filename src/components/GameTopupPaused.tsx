'use client';

import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';
import StoreShell from './StoreShell';

export default function GameTopupPaused() {
  const { t } = useLanguage();
  const c = t.commerce;
  return (
    <StoreShell>
      <section aria-labelledby="game-paused-title" className="mx-auto max-w-2xl rounded-3xl border border-[#F1E4ED] bg-white p-6 sm:p-8">
        <p className="text-sm font-bold text-pink-700">{c.GAME}</p>
        <h1 id="game-paused-title" className="mt-2 text-2xl font-extrabold text-[#251D2C] sm:text-3xl">{c.gamePausedTitle}</h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)] sm:text-base">{c.gamePausedDescription}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/apps" className="rounded-xl bg-pink-600 px-5 py-3 text-sm font-bold text-white hover:bg-pink-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-pink-600">{c.APPS}</Link>
          <Link href="/roblox" className="rounded-xl border border-pink-200 bg-pink-50 px-5 py-3 text-sm font-bold text-pink-700 hover:border-pink-400 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-pink-600">{c.ROBLOX}</Link>
        </div>
      </section>
    </StoreShell>
  );
}
