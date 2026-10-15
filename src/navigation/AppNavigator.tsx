import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { observer } from 'mobx-react-lite';
import { useStores } from '@app/core';
import AuthStackNavigator from './AuthStackNavigator';
import DrawerNavigator from './DrawerNavigator';
import { NavigationLightTheme, NavigationDarkTheme } from '@app/ui';
import { navigationRef } from './navigationRef';

/**
 * Route names here must match the navigator NavigationContainer actually renders.
 * Auth and Drawer are swapped in below rather than nested under a shared parent,
 * so both trees' routes sit side by side at the top level — only one is ever
 * mounted, and the unmounted one's paths simply never match.
 */
const linking = {
  prefixes: ['com.ibos.hms://'],
  config: {
    screens: {
      // Unauthenticated screen (AuthStackNavigator)
      Login: 'login',

      // Authenticated screens (DrawerNavigator)
      MainTabs: {
        path: 'main',
        screens: {
          HomeTab: 'home',
          ActivityTab: 'activity',
          ProfileTab: 'me',
        },
      },
      Settings: 'settings',
      Notifications: 'notifications',
    },
  },
};

export const AppNavigator = observer(() => {
  const { authStore, themeStore } = useStores();

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={themeStore.isDarkMode ? NavigationDarkTheme : NavigationLightTheme}
      linking={linking}
    >
      {authStore.isAuthenticated ? <DrawerNavigator /> : <AuthStackNavigator />}
    </NavigationContainer>
  );
});
export default AppNavigator;
