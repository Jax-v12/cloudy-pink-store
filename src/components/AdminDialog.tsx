'use client';
import { useEffect, useRef, type ReactNode } from 'react';

export default function AdminDialog({
  title,
  busy,
  onClose,
  children,
  width = 'normal',
}: {
  title: string;
  busy: boolean;
  onClose: () => void;
  children: ReactNode;
  width?: 'normal' | 'wide';
}) {
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
  return (
    <dialog
      ref={ref}
      aria-label={title}
      onKeyDown={event => {
        if (event.key !== 'Tab') return;
        const dialog = event.currentTarget;
        const controls = [
          ...dialog.querySelectorAll<HTMLElement>(
            'button:not(:disabled), a[href], input:not(:disabled):not([type="hidden"]), select:not(:disabled), textarea:not(:disabled), [tabindex]'
          ),
        ].filter(
          element =>
            element.tabIndex >= 0 &&
            element.getClientRects().length > 0 &&
            getComputedStyle(element).visibility !== 'hidden' &&
            !element.closest('[inert]')
        );
        const first = controls[0],
          last = controls.at(-1);
        if (!first) {
          event.preventDefault();
          dialog.focus();
        } else if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog)) {
          event.preventDefault();
          first.focus();
        }
      }}
      onCancel={event => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      className={`m-auto w-[calc(100%-2rem)] ${width === 'wide' ? 'max-w-3xl max-h-[90dvh] overflow-y-auto' : 'max-w-lg'} rounded-3xl border border-[#F1E4ED] bg-white p-6 sm:p-7 text-[#251D2C] shadow-2xl backdrop:bg-[#251D2C]/50 backdrop:backdrop-blur-xs`}
    >
      <h3 className="mb-4 border-b border-[#F1E4ED] pb-3 text-lg sm:text-xl font-extrabold text-[#251D2C]">{title}</h3>
      {children}
    </dialog>
  );
}
