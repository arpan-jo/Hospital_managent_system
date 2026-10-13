import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '../assets/locales/en.json';
import bn from '../assets/locales/bn.json';

// Language is restored from the persisted MobX snapshot in store/index.tsx
// via i18next.changeLanguage() after the store is hydrated.
i18next
  .use(initReactI18next)
  .init({
    compatibilityJSON: 'v3', // prevents Intl.PluralRules usage, which is unreliable in Hermes
    resources: {
      en: { translation: en },
      bn: { translation: bn },
    },
    lng: 'en',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18next;
