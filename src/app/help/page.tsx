'use client';

import Link from 'next/link';
import StoreShell from '@/components/StoreShell';
import { useLanguage } from '@/context/LanguageContext';

export default function HelpPage() {
  const { t } = useLanguage();
  const copy = t.serviceHelp;
  return (
    <StoreShell>
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="rounded-3xl border border-[#F1E4ED] bg-white p-6 shadow-[0_12px_32px_-12px_rgba(157,23,77,0.08)] sm:p-8">
          <h1 className="text-2xl font-extrabold tracking-tight text-[#251D2C] sm:text-4xl">{copy.title}</h1>
          <p className="mt-3 text-sm sm:text-base leading-relaxed text-[#756C7D]">{copy.intro}</p>
          <a
            href="#terms"
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-pink-200 bg-pink-50/70 px-3.5 py-2 text-xs sm:text-sm font-bold text-pink-700 hover:bg-pink-100/80 transition focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-pink-800"
          >
            {copy.terms} &darr;
          </a>
        </header>

        <section
          aria-labelledby="faq-title"
          className="rounded-3xl border border-[#F1E4ED] bg-white p-6 shadow-[0_12px_32px_-12px_rgba(157,23,77,0.08)] sm:p-8"
        >
          <h2 id="faq-title" className="mb-5 text-xl sm:text-2xl font-extrabold text-[#251D2C]">
            {copy.faq}
          </h2>
          <div className="divide-y divide-[#F1E4ED]">
            {copy.questions.map(item => (
              <details key={item.id} id={item.id} className="group scroll-mt-20 py-4 open:pb-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-lg text-sm sm:text-base font-bold leading-relaxed text-[#251D2C] hover:text-pink-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-pink-800">
                  <span>{item.question}</span>
                  <span
                    aria-hidden="true"
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#F1E4ED] bg-[#FFF9FC] text-xs text-pink-600 transition-transform duration-200 group-open:rotate-180 group-open:bg-pink-600 group-open:text-white"
                  >
                    ▾
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-7 text-[#756C7D] pr-4">{item.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section
          id="terms"
          aria-labelledby="terms-title"
          className="scroll-mt-20 rounded-3xl border border-[#F1E4ED] bg-white p-6 shadow-[0_12px_32px_-12px_rgba(157,23,77,0.08)] sm:p-8"
        >
          <h2 id="terms-title" className="text-xl sm:text-2xl font-extrabold text-[#251D2C]">
            {copy.terms}
          </h2>
          <p className="mt-3 text-sm leading-7 text-[#756C7D]">{copy.termsIntro}</p>
          <ul className="mt-5 grid gap-4">
            {copy.conditions.map(item => (
              <li key={item.title} className="rounded-2xl border border-[#F1E4ED] bg-[#FFF9FC] p-4 sm:p-5">
                <h3 className="font-extrabold text-[#251D2C]">{item.title}</h3>
                <p className="mt-1.5 text-sm leading-7 text-[#756C7D]">{item.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-3xl border border-pink-200 bg-gradient-to-br from-pink-50/90 via-white to-purple-50/60 p-6 shadow-[0_12px_32px_-12px_rgba(157,23,77,0.08)] sm:p-8">
          <h2 className="text-lg sm:text-xl font-extrabold text-[#251D2C]">{copy.supportTitle}</h2>
          <p className="mt-2.5 text-sm leading-7 text-[#756C7D]">{copy.supportBody}</p>
          <Link
            href="/"
            className="mt-5 inline-flex items-center gap-2 rounded-xl border border-[#F1E4ED] bg-white px-4 py-2.5 text-sm font-bold text-pink-700 shadow-xs hover:border-pink-300 hover:bg-pink-50 transition focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-pink-600"
          >
            &larr; {copy.back}
          </Link>
        </section>
      </div>
    </StoreShell>
  );
}
