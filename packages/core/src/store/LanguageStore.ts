import { types } from 'mobx-state-tree';
import i18next from '../utils/i18n';

export const LanguageStore = types
  .model('LanguageStore', {
    language: types.optional(types.enumeration(['en', 'bn']), 'en'),
  })
  .actions((self) => ({
    setLanguage(lang: 'en' | 'bn') {
      self.language = lang;
      if (i18next.language !== lang) {
        i18next.changeLanguage(lang);
      }
    },
  }));
