import React, { useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { observer } from 'mobx-react-lite';
import { cancelAllAlarms, useStores } from '@app/core';
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
          DashboardTab: 'dashboard',
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
  const isAuthenticated = Boolean(authStore?.isAuthenticated);

  // A session that ends — Logout, or an expired one signed out by the API
  // client — takes its alarms with it. Only on that change, not at a launch
  // that starts signed out.
  const wasAuthenticated = useRef(isAuthenticated);
  useEffect(() => {
    if (wasAuthenticated.current && !isAuthenticated) {
      cancelAllAlarms();
    }
    wasAuthenticated.current = isAuthenticated;
  }, [isAuthenticated]);

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
