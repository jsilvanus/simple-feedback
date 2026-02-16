import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import fi from './locales/fi.json';
import sv from './locales/sv.json';

// Get saved language or default to Finnish
const savedLanguage = localStorage.getItem('language') || 'fi';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      fi: { translation: fi },
      sv: { translation: sv },
    },
    lng: savedLanguage,
    fallbackLng: 'fi',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
