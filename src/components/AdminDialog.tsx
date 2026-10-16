'use client';
import { useEffect, useRef, type ReactNode } from 'react';

export default function AdminDialog({ title, busy, onClose, children }: { title: string; busy: boolean; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const previousFocus = document.activeElement;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);
  return <dialog ref={ref} aria-label={title} onKeyDown={event => {
    if (event.key !== 'Tab') return;
    const dialog = event.currentTarget;
    const controls = [...dialog.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled):not([type="hidden"]), select:not(:disabled), textarea:not(:disabled), [tabindex]')]
      .filter(element => element.tabIndex >= 0 && element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden' && !element.closest('[inert]'));
    const first = controls[0], last = controls.at(-1);
    if (!first) { event.preventDefault(); dialog.focus(); }
    else if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog)) { event.preventDefault(); first.focus(); }
  }} onCancel={event => { event.preventDefault(); if (!busy) onClose(); }} className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl border border-pink-200 bg-white p-6 shadow-xl backdrop:bg-black/40">
    <h3 className="mb-4 text-xl font-bold text-pink-800">{title}</h3>
    {children}
  </dialog>;
}
