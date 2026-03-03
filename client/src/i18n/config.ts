import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translation files
import ptTranslations from './locales/pt.json';
import enTranslations from './locales/en.json';
import esTranslations from './locales/es.json';
import frTranslations from './locales/fr.json';
import itTranslations from './locales/it.json';
import deTranslations from './locales/de.json';
import zhTranslations from './locales/zh.json';
import gnTranslations from './locales/gn.json';

// Supported languages configuration
export const supportedLanguages = {
  pt: { name: 'Português', flag: '🇧🇷', nativeName: 'Português' },
  en: { name: 'English', flag: '🇺🇸', nativeName: 'English' },
  es: { name: 'Español', flag: '🇪🇸', nativeName: 'Español' },
  fr: { name: 'Français', flag: '🇫🇷', nativeName: 'Français' },
  it: { name: 'Italiano', flag: '🇮🇹', nativeName: 'Italiano' },
  de: { name: 'Deutsch', flag: '🇩🇪', nativeName: 'Deutsch' },
  zh: { name: '中文', flag: '🇨🇳', nativeName: '中文' },
  gn: { name: 'Guaraní', flag: '🇵🇾', nativeName: 'Avañe\'ẽ' },
};

const resources = {
  pt: { translation: ptTranslations },
  en: { translation: enTranslations },
  es: { translation: esTranslations },
  fr: { translation: frTranslations },
  it: { translation: itTranslations },
  de: { translation: deTranslations },
  zh: { translation: zhTranslations },
  gn: { translation: gnTranslations },
};

const langMap: Record<string, string> = {
  pt: 'pt-BR', en: 'en', es: 'es', fr: 'fr', it: 'it', de: 'de', zh: 'zh', gn: 'gn',
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    supportedLngs: ['pt', 'en', 'es', 'fr', 'it', 'de', 'zh', 'gn'],
    load: 'languageOnly',
    fallbackLng: 'pt',
    debug: false,
    
    interpolation: {
      escapeValue: false,
    },
    
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: 'telemed-language',
    },
    
    cleanCode: true,
    nonExplicitSupportedLngs: false,
    
    react: {
      useSuspense: false,
    },
  });

i18n.on('languageChanged', (lng: string) => {
  const htmlLang = langMap[lng] || lng;
  document.documentElement.lang = htmlLang;
  document.documentElement.setAttribute('translate', 'no');
});

if (i18n.language) {
  const htmlLang = langMap[i18n.language] || i18n.language;
  document.documentElement.lang = htmlLang;
}

export default i18n;