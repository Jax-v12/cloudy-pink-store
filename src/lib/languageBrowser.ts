'use client';
import type { Language } from './translations';

let temporaryLanguage: Language | null = null;

export function getBrowserLanguage(): Language {
  if (typeof window === 'undefined') return 'ID';
  if (temporaryLanguage) return temporaryLanguage;
  try {
    const saved = window.localStorage.getItem('store_lang');
    return saved === 'EN' || saved === 'MY' ? saved : 'ID';
  } catch { return 'ID'; }
}

export function setBrowserLanguage(language: Language) {
  temporaryLanguage = language;
  try { window.localStorage.setItem('store_lang', language); temporaryLanguage = null; }
  catch { /* Keep this tab's preference when browser storage is unavailable. */ }
  window.dispatchEvent(new Event('language-change'));
}

export function subscribeLanguage(callback: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== 'store_lang') return;
    temporaryLanguage = null;
    callback();
  };
  window.addEventListener('storage', onStorage);
  window.addEventListener('language-change', callback);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener('language-change', callback);
  };
}
