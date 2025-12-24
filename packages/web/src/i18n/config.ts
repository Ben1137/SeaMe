import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import he from './locales/he.json';
import de from './locales/de.json';
import fr from './locales/fr.json';
import ru from './locales/ru.json';
import it from './locales/it.json';
import es from './locales/es.json';

// Get initial language from localStorage or default to English
const getInitialLanguage = (): string => {
  if (typeof window !== 'undefined') {
    const savedLang = localStorage.getItem('seayou-language');
    if (savedLang && ['en', 'he', 'de', 'fr', 'ru', 'it', 'es'].includes(savedLang)) {
      return savedLang;
    }
  }
  return 'en';
};

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      he: { translation: he },
      de: { translation: de },
      fr: { translation: fr },
      ru: { translation: ru },
      it: { translation: it },
      es: { translation: es }
    },
    lng: getInitialLanguage(),
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false // React already escapes values
    },
    react: {
      useSuspense: false
    }
  });

export default i18n;
