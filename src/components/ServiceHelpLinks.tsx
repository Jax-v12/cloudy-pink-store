'use client';

import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';

export default function ServiceHelpLinks() {
  const { t } = useLanguage();
  return <div className="flex flex-wrap justify-center gap-x-6 gap-y-3 text-sm font-semibold text-pink-800">
    <Link href="/help" className="rounded underline decoration-pink-300 underline-offset-4 hover:text-pink-950 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-pink-800">{t.serviceHelp.faq}</Link>
    <Link href="/help#terms" className="rounded underline decoration-pink-300 underline-offset-4 hover:text-pink-950 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-pink-800">{t.serviceHelp.terms}</Link>
  </div>;
}
