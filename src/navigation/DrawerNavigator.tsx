import React from 'react';
import {
  createDrawerNavigator,
  DrawerContentComponentProps,
  DrawerContentScrollView,
  DrawerItem,
} from '@react-navigation/drawer';
import TabNavigator, { TabParamList } from './TabNavigator';
import SettingsScreen from '../screens/common/settings/SettingsScreen';
import PatientFollowUpIndex from '../screens/patient/followUps/PatientFollowUpIndex';
import PatientReportIndex from '../screens/patient/reports/PatientReportIndex';
import { View, StyleSheet } from 'react-native';
import { Text, Button, useTheme, Divider } from 'react-native-paper';
import { observer } from 'mobx-react-lite';
import { NavigatorScreenParams, getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { useStores, getFileUrl } from '@app/core';
import { useTranslation } from 'react-i18next';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { CustomAvatar, fontFamilies } from '@app/ui';

export type DrawerParamList = {
  MainTabs: NavigatorScreenParams<TabParamList> | undefined;
  Settings: undefined;
  FollowUps: undefined;
  Reports: undefined;
};

type MenuItem = {
  name: keyof DrawerParamList;
  labelKey: string;
  icon: string;
  tab?: keyof TabParamList;
};

const MENU_ITEMS: MenuItem[] = [
  {
    name: 'MainTabs',
    labelKey: 'drawer.findDoctors',
    icon: 'account-search-outline',
    tab: 'HomeTab',
  },

  {
    name: 'MainTabs',
    labelKey: 'drawer.appointments',
    icon: 'calendar-check-outline',
    tab: 'ActivityTab',
  },
  {
    name: 'FollowUps',
    labelKey: 'drawer.followUps',
    icon: 'calendar-refresh-outline',
  },

  {
    name: 'MainTabs',
    labelKey: 'drawer.prescriptions',
    icon: 'file-document-edit-outline',
    tab: 'PrescriptionsTab',
  },
  { name: 'Reports', labelKey: 'drawer.reports', icon: 'file-chart-outline' },

  { name: 'Settings', labelKey: 'settings.title', icon: 'cog-outline' },
];

const isInternalEmail = (email?: string | null): boolean =>
  /@doctormate\.local$/i.test(String(email ?? '').trim());

const Drawer = createDrawerNavigator<DrawerParamList>();

const CustomDrawerContent = observer((props: DrawerContentComponentProps) => {
  const { authStore, profileStore } = useStores();
  const { t } = useTranslation();
  const theme = useTheme();

  const activeRoute = props.state.routes[props.state.index];

  const focusedTab =
    activeRoute?.name === 'MainTabs'
      ? getFocusedRouteNameFromRoute(activeRoute) ?? 'HomeTab'
      : undefined;

  const isActive = (item: MenuItem): boolean =>
    item.tab ? focusedTab === item.tab : activeRoute?.name === item.name;

  const patientProfile = profileStore?.patientProfileData;

  const displayName =
    patientProfile?.fullName?.trim() ||
    authStore.user?.fullName?.trim() ||
    t('common.na');

  const loginEmail = authStore.user?.email?.trim() ?? '';
  const profileContact = patientProfile?.email || patientProfile?.phone;

  const contactLine = isInternalEmail(loginEmail)
    ? profileContact?.trim() ?? ''
    : loginEmail || profileContact?.trim() || '';

  const photoUrl = getFileUrl(patientProfile?.photoUrl ?? '');

  return (
    <DrawerContentScrollView
      {...props}
      contentContainerStyle={styles.scrollContainer}
    >
      <View style={styles.header}>
        <CustomAvatar
          type="image"
          value={photoUrl}
          fallback={displayName}
          size={60}
        />
        <Text style={[styles.name, { color: theme.colors.onSurface }]}>
          {displayName}
        </Text>
        {contactLine ? (
          <Text
            style={[styles.email, { color: theme.colors.onSurfaceVariant }]}
          >
            {contactLine}
          </Text>
        ) : null}
        <View
          style={[
            styles.roleBadge,
            { backgroundColor: theme.colors.primaryContainer },
          ]}
        >
          <Text style={[styles.roleText, { color: theme.colors.primary }]}>
            {authStore.user?.role || 'N/A'}
          </Text>
        </View>
      </View>
      <Divider style={styles.divider} />
      <View style={styles.drawerList}>
        {MENU_ITEMS.map(item => (
          <DrawerItem
            key={item.labelKey}
            focused={isActive(item)}
            activeBackgroundColor={theme.colors.secondaryContainer}
            icon={({ size }) => (
              <Icon name={item.icon} color={theme.colors.primary} size={size} />
            )}
            label={() => (
              <Text
                style={[
                  styles.itemLabel,
                  {
                    color: theme.colors.onSurface,
                    fontFamily: isActive(item)
                      ? fontFamilies.semibold
                      : fontFamilies.regular,
                  },
                ]}
              >
                {t(item.labelKey)}
              </Text>
            )}
            onPress={() =>
              item.tab
                ? props.navigation.navigate('MainTabs', { screen: item.tab })
                : props.navigation.navigate(item.name)
            }
          />
        ))}
      </View>
      <View style={styles.footer}>
        <Button
          mode="outlined"
          onPress={() => {
            authStore.logout();
            profileStore.clear();
          }}
          icon="logout"
          style={[styles.logoutBtn, { borderColor: theme.colors.error }]}
          textColor={theme.colors.error}
        >
          {t('profile.logoutButton')}
        </Button>
      </View>
    </DrawerContentScrollView>
  );
});

const renderDrawerContent = (props: DrawerContentComponentProps) => (
  <CustomDrawerContent {...props} />
);

export const DrawerNavigator = () => {
  const theme = useTheme();

  return (
    <Drawer.Navigator
      drawerContent={renderDrawerContent}
      screenOptions={{
        headerShown: false,
        drawerStyle: {
          backgroundColor: theme.colors.surface,
          width: 280,
        },
      }}
    >
      <Drawer.Screen name="MainTabs" component={TabNavigator} />
      <Drawer.Screen name="Settings" component={SettingsScreen} />
      <Drawer.Screen name="FollowUps" component={PatientFollowUpIndex} />
      <Drawer.Screen name="Reports" component={PatientReportIndex} />
    </Drawer.Navigator>
  );
};

const styles = StyleSheet.create({
  /*
   * Grows to the drawer's height, so Logout sits at the bottom when the menu is
   * short, but is never held to it — with `flex: 1` a menu taller than a small
   * phone ran under Logout instead of scrolling.
   */
  scrollContainer: {
    flexGrow: 1,
  },
  header: {
    padding: 20,
    alignItems: 'center',
  },
  name: {
    fontFamily: fontFamilies.bold,
    fontSize: 18,
    marginTop: 10,
  },
  email: {
    fontFamily: fontFamilies.regular,
    fontSize: 13,
  },
  roleBadge: {
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  roleText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 11,
  },
  divider: {
    marginHorizontal: 16,
  },
  // Takes the spare height without being squeezed below its own items.
  drawerList: {
    flexGrow: 1,
    paddingTop: 10,
  },
  itemLabel: {
    fontSize: 14,
  },
  footer: {
    padding: 20,
  },
  logoutBtn: {
    borderRadius: 8,
  },
});
export default DrawerNavigator;
