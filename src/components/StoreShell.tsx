'use client';
import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';

export default function StoreShell({ children }: { children: React.ReactNode }) {
  const { t, language, setLanguage } = useLanguage();
  const c = t.commerce;
  return <main className="min-h-screen bg-pink-50 text-neutral-800 p-4 sm:p-8">
    <div className="max-w-5xl mx-auto">
      <header className="flex flex-wrap items-center justify-between gap-4 py-4 mb-8 border-b border-pink-200">
        <Link href="/" className="text-xl font-black text-pink-700">{c.brand}</Link>
        <nav className="flex gap-4 text-sm font-semibold" aria-label={c.home}>
          <Link href="/apps">{c.APPS}</Link><Link href="/games">{c.GAME}</Link><Link href="/roblox">{c.ROBLOX}</Link>
        </nav>
        <select aria-label={c.language} value={language} onChange={e => setLanguage(e.target.value as typeof language)} className="rounded-lg bg-white p-2 border border-pink-200">
          {(['ID', 'EN', 'MY'] as const).map(l => <option key={l} value={l}>{l}</option>)}
        </select>
      </header>
      {children}
    </div>
  </main>;
}
