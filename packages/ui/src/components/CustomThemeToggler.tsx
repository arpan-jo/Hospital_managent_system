import React from 'react';
import { IconButton } from 'react-native-paper';
import { observer } from 'mobx-react-lite';
import { useStores } from '@app/core';

interface CustomThemeTogglerProps {
  /** For a toggler on a coloured header, where the default tint would be lost. */
  iconColor?: string;
}

export const CustomThemeToggler: React.FC<CustomThemeTogglerProps> = observer(
  ({ iconColor }) => {
    const { themeStore } = useStores();

    return (
      <IconButton
        icon={themeStore.isDarkMode ? 'weather-sunny' : 'weather-night'}
        iconColor={iconColor}
        onPress={() => themeStore.toggleTheme()}
      />
    );
  },
);
