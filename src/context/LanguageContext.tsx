'use client';

import React, { createContext, useContext, useEffect, useSyncExternalStore } from 'react';
import { Language, translations } from '@/lib/translations';
import { getBrowserLanguage, setBrowserLanguage, subscribeLanguage } from '@/lib/languageBrowser';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: typeof translations['ID'];
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

function getServerSnapshot(): Language {
  return 'ID';
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const language = useSyncExternalStore(subscribeLanguage, getBrowserLanguage, getServerSnapshot);
  useEffect(() => { document.documentElement.lang = { ID: 'id', EN: 'en', MY: 'ms' }[language]; }, [language]);

  const t = translations[language];

  return (
    <LanguageContext.Provider value={{ language, setLanguage: setBrowserLanguage, t }}>
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
