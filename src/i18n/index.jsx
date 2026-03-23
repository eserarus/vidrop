import { createContext, useContext, useMemo } from 'react';
import translations from './translations';

const I18nContext = createContext();

function detectLanguage() {
  const browserLang = navigator.language || navigator.userLanguage || 'en';
  // Check if browser language starts with 'tr' (covers tr, tr-TR, etc.)
  return browserLang.toLowerCase().startsWith('tr') ? 'tr' : 'en';
}

export function I18nProvider({ children }) {
  const lang = useMemo(() => detectLanguage(), []);
  const t = useMemo(() => translations[lang], [lang]);

  return (
    <I18nContext.Provider value={{ t, lang }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}
