'use client';
import { useEffect, useRef, type ReactNode } from 'react';

export default function AdminDialog({ title, busy, onClose, children }: { title: string; busy: boolean; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return <dialog ref={ref} aria-label={title} onCancel={event => { event.preventDefault(); if (!busy) onClose(); }} className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl border border-pink-200 bg-white p-6 shadow-xl backdrop:bg-black/40">
    <h3 className="mb-4 text-xl font-bold text-pink-800">{title}</h3>
    {children}
  </dialog>;
}
