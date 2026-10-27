'use client';
import { useId, useRef } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { fillTemplate } from '@/lib/roblox';

export default function RobloxGamepassGuide({ price }: { price: number }) {
  const { t } = useLanguage();
  const r = t.roblox;
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const steps = [
    { title: r.step1, body: r.step1Body, icon: '▦' },
    { title: r.step2, body: r.step2Body, icon: '＋' },
    { title: r.step3, body: fillTemplate(r.step3Body, { price }), icon: '✓' },
    { title: r.step4, body: r.step4Body, icon: '↗' },
  ];
  return (
    <>
      <button
        type="button"
        className="text-sm text-pink-700 underline decoration-pink-300 underline-offset-4 font-bold hover:text-pink-900 cursor-pointer"
        onClick={() => dialog.current?.showModal()}
      >
        {r.guide}
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-3xl border border-[#F1E4ED] p-6 sm:p-7 bg-white text-[#251D2C] shadow-2xl backdrop:bg-[#251D2C]/50 backdrop:backdrop-blur-xs"
      >
        <div className="flex justify-between items-start gap-4 border-b border-[#F1E4ED] pb-4">
          <h2 id={titleId} className="text-xl sm:text-2xl font-extrabold text-[#251D2C]">
            {r.guideTitle}
          </h2>
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            aria-label={r.close}
            className="rounded-xl border border-[#F1E4ED] px-3 py-1.5 text-sm font-bold text-[#756C7D] hover:bg-pink-50 hover:text-pink-700 transition cursor-pointer"
          >
            ×
          </button>
        </div>
        <p className="mt-3 text-sm text-[#756C7D] leading-relaxed">{r.guideIntro}</p>
        <ol className="my-5 space-y-3.5">
          {steps.map((step, i) => (
            <li key={step.title} className="flex gap-4 rounded-2xl border border-[#F1E4ED] bg-[#FFF9FC] p-4">
              <div
                aria-hidden="true"
                className="shrink-0 flex h-11 w-11 items-center justify-center rounded-xl bg-pink-100 text-pink-700 text-xl font-bold"
              >
                {step.icon}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-extrabold text-[#251D2C]">
                  {i + 1}. {step.title}
                </h3>
                <p className="text-sm text-[#756C7D] mt-1 leading-relaxed">{step.body}</p>
                {i === 2 && (
                  <div className="mt-3 p-3.5 rounded-xl bg-white border border-[#F1E4ED] text-sm space-y-2.5" aria-hidden="true">
                    <div className="flex justify-between items-center gap-2">
                      <span className="font-semibold text-[#251D2C]">{r.forSale}</span>
                      <span className="rounded-full bg-emerald-100 text-emerald-800 px-3 py-0.5 text-xs font-bold">
                        ✓ {r.enabled}
                      </span>
                    </div>
                    <div className="p-2.5 border border-[#F1E4ED] rounded-xl bg-[#FFF9FC] font-mono font-bold text-pink-700">
                      {price} Robux
                    </div>
                    <span className="inline-block rounded-lg bg-pink-600 text-white px-3 py-1 text-xs font-bold">
                      {r.saveChanges}
                    </span>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap gap-4 text-sm font-semibold">
          <a href="https://create.roblox.com/dashboard/creations" target="_blank" rel="noopener noreferrer" className="text-pink-700 underline">
            {r.creatorHub}
          </a>
          <a
            href="https://create.roblox.com/docs/production/monetization/passes"
            target="_blank"
            rel="noopener noreferrer"
            className="text-pink-700 underline"
          >
            {r.officialGuide}
          </a>
        </div>
        <button
          type="button"
          onClick={() => dialog.current?.close()}
          className="mt-5 w-full rounded-xl bg-pink-600 hover:bg-pink-700 p-3 text-white font-extrabold transition cursor-pointer"
        >
          {r.close}
        </button>
      </dialog>
    </>
  );
}
