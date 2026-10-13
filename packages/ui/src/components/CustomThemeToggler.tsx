import React from 'react';
import { IconButton } from 'react-native-paper';
import { observer } from 'mobx-react-lite';
import { useStores } from '@app/core';

export const CustomThemeToggler: React.FC = observer(() => {
  const { themeStore } = useStores();

  return (
    <IconButton
      icon={themeStore.isDarkMode ? 'weather-sunny' : 'weather-night'}
      onPress={() => themeStore.toggleTheme()}
    />
  );
});
