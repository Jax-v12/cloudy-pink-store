'use client';

import React, { createContext, useContext, useCallback, useSyncExternalStore } from 'react';
import { Language, translations } from '@/lib/translations';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: typeof translations['ID'];
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

function subscribe(callback: () => void) {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('storage', callback);
  window.addEventListener('language-change', callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener('language-change', callback);
  };
}

function getSnapshot(): Language {
  if (typeof window === 'undefined') return 'ID';
  const saved = localStorage.getItem('store_lang');
  if (saved === 'EN' || saved === 'MY') return saved;
  return 'ID';
}

function getServerSnapshot(): Language {
  return 'ID';
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const language = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setLanguage = useCallback((lang: Language) => {
    localStorage.setItem('store_lang', lang);
    window.dispatchEvent(new Event('language-change'));
  }, []);

  const t = translations[language];

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}