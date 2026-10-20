'use client';

import Link from 'next/link';
import StoreShell from '@/components/StoreShell';
import { useLanguage } from '@/context/LanguageContext';

export default function HelpPage() {
  const { t } = useLanguage();
  const copy = t.serviceHelp;
  return <StoreShell>
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="rounded-3xl border-2 border-pink-200 bg-white p-6 shadow-lg sm:p-8">
        <h1 className="text-3xl font-black text-pink-900 sm:text-4xl">{copy.title}</h1>
        <p className="mt-3 leading-relaxed text-slate-700">{copy.intro}</p>
        <a href="#terms" className="mt-4 inline-block rounded font-semibold text-pink-800 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4">{copy.terms}</a>
      </header>
      <section aria-labelledby="faq-title" className="rounded-3xl border-2 border-pink-200 bg-white p-6 sm:p-8">
        <h2 id="faq-title" className="mb-5 text-2xl font-bold text-pink-900">{copy.faq}</h2>
        <div className="divide-y divide-pink-100">
          {copy.questions.map(item => <details key={item.id} id={item.id} className="group scroll-mt-6 py-4 open:pb-5">
            <summary className="cursor-pointer rounded text-base font-bold leading-relaxed text-slate-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-pink-800">{item.question}</summary>
            <p className="mt-3 text-sm leading-7 text-slate-700">{item.answer}</p>
          </details>)}
        </div>
      </section>
      <section id="terms" aria-labelledby="terms-title" className="scroll-mt-6 rounded-3xl border-2 border-pink-200 bg-white p-6 sm:p-8">
        <h2 id="terms-title" className="text-2xl font-bold text-pink-900">{copy.terms}</h2>
        <p className="mt-3 text-sm leading-7 text-slate-700">{copy.termsIntro}</p>
        <ul className="mt-5 space-y-5">
          {copy.conditions.map(item => <li key={item.title}>
            <h3 className="font-bold text-slate-800">{item.title}</h3>
            <p className="mt-1 text-sm leading-7 text-slate-700">{item.body}</p>
          </li>)}
        </ul>
      </section>
      <section className="rounded-3xl border-2 border-pink-200 bg-pink-50 p-6 sm:p-8">
        <h2 className="text-xl font-bold text-pink-900">{copy.supportTitle}</h2>
        <p className="mt-3 text-sm leading-7 text-slate-800">{copy.supportBody}</p>
        <Link href="/" className="mt-5 inline-block rounded-xl border-2 border-pink-300 bg-white px-4 py-3 font-bold text-pink-900 focus-visible:outline-2 focus-visible:outline-offset-4">{copy.back}</Link>
      </section>
    </div>
  </StoreShell>;
}
