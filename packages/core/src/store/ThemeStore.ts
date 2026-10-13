import { types } from 'mobx-state-tree';

export const ThemeStore = types
  .model('ThemeStore', {
    isDarkMode: types.optional(types.boolean, false),
  })
  .actions((self) => ({
    toggleTheme() {
      self.isDarkMode = !self.isDarkMode;
    },
    setDarkMode(val: boolean) {
      self.isDarkMode = val;
    },
  }));
