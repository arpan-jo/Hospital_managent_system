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
import ReportsStackNavigator, { ReportsStackParamList } from './ReportsStackNavigator';
import { View, StyleSheet } from 'react-native';
import { Text, useTheme, Divider } from 'react-native-paper';
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
  Reports: NavigatorScreenParams<ReportsStackParamList> | undefined;
};

type MenuItem = {
  name: keyof DrawerParamList;
  labelKey: string;
  icon: string;
  tab?: keyof TabParamList;
  /** Draws a divider above it — sets the app's own entries apart from the portal's menu. */
  separated?: boolean;
};

/**
 * The patient portal's menu, in the order of the web's sidebar — every entry
 * there is open to the Patient role. Settings is the app's own addition.
 */
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
  {
    name: 'MainTabs',
    labelKey: 'drawer.profile',
    icon: 'account-outline',
    tab: 'ProfileTab',
  },
  { name: 'Reports', labelKey: 'drawer.reports', icon: 'file-chart-outline' },
  {
    name: 'Settings',
    labelKey: 'settings.title',
    icon: 'cog-outline',
    separated: true,
  },
];

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

  const contactLine =
    authStore.user?.email?.trim() ||
    patientProfile?.email?.trim() ||
    patientProfile?.phone?.trim() ||
    '';

  const photoUrl = getFileUrl(patientProfile?.photoUrl ?? '');

  // The profile card takes the brand blue in light; in dark `primary` turns
  // pale, so its container tone carries the card — the sign-in hero's rule.
  const cardColor = theme.dark
    ? theme.colors.primaryContainer
    : theme.colors.primary;
  const cardInk = theme.dark
    ? theme.colors.onPrimaryContainer
    : theme.colors.onPrimary;

  return (
    <DrawerContentScrollView
      {...props}
      contentContainerStyle={styles.scrollContainer}
    >
      <View style={[styles.profileCard, { backgroundColor: cardColor }]}>
        <View
          pointerEvents="none"
          style={[styles.cardRing, { borderColor: cardInk }]}
        />
        {/* The ring keeps the avatar off a card of its own colour. */}
        <View style={[styles.avatarRing, { borderColor: cardInk }]}>
          <CustomAvatar
            type="image"
            value={photoUrl}
            fallback={displayName}
            size={46}
          />
        </View>
        <View style={styles.identity}>
          <Text numberOfLines={1} style={[styles.name, { color: cardInk }]}>
            {displayName}
          </Text>
          {contactLine ? (
            <Text numberOfLines={1} style={[styles.email, { color: cardInk }]}>
              {contactLine}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.drawerList}>
        {MENU_ITEMS.map(item => {
          const active = isActive(item);

          return (
            <React.Fragment key={item.labelKey}>
              {item.separated ? <Divider style={styles.divider} /> : null}
              <DrawerItem
                focused={active}
                activeBackgroundColor={theme.colors.primaryContainer}
                style={styles.item}
                icon={() => (
                  <View
                    style={[
                      styles.iconTile,
                      {
                        backgroundColor: active
                          ? theme.colors.primary
                          : theme.colors.primaryContainer,
                      },
                    ]}
                  >
                    {/* Filled on the open screen's row, as on the tab bar:
                        every icon in the menu has a variant without the
                        `-outline` suffix. */}
                    <Icon
                      name={
                        active ? item.icon.replace(/-outline$/, '') : item.icon
                      }
                      color={
                        active ? theme.colors.onPrimary : theme.colors.primary
                      }
                      size={20}
                    />
                  </View>
                )}
                label={() => (
                  <Text
                    style={[
                      styles.itemLabel,
                      {
                        color: active
                          ? theme.colors.onPrimaryContainer
                          : theme.colors.onSurface,
                        fontFamily: active
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
                    ? props.navigation.navigate('MainTabs', {
                        screen: item.tab,
                      })
                    : props.navigation.navigate(item.name)
                }
              />
            </React.Fragment>
          );
        })}
      </View>

      {/* A row like the menu's own, in the error tone, rather than a button
          of another shape at the foot of the list. */}
      <View>
        <Divider style={styles.divider} />
        <DrawerItem
          style={styles.item}
          icon={() => (
            <View
              style={[
                styles.iconTile,
                { backgroundColor: theme.colors.errorContainer },
              ]}
            >
              <Icon name="logout" color={theme.colors.error} size={20} />
            </View>
          )}
          label={() => (
            <Text
              style={[
                styles.itemLabel,
                styles.logoutLabel,
                { color: theme.colors.error },
              ]}
            >
              {t('profile.logoutButton')}
            </Text>
          )}
          onPress={() => {
            authStore.logout();
            profileStore.clear();
          }}
        />
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
      <Drawer.Screen name="Reports" component={ReportsStackNavigator} />
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
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 16,
    marginTop: 4,
    overflow: 'hidden',
  },
  // Echo of the rings on the sign-in hero.
  cardRing: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 1.5,
    top: -70,
    right: -50,
    opacity: 0.18,
  },
  avatarRing: {
    borderWidth: 2,
    borderRadius: 28,
    padding: 2,
  },
  // Lets a long name or address shorten instead of pushing the card wider.
  identity: {
    flex: 1,
  },
  name: {
    fontFamily: fontFamilies.bold,
    fontSize: 16,
  },
  email: {
    fontFamily: fontFamilies.regular,
    fontSize: 12.5,
    marginTop: 2,
    opacity: 0.85,
  },
  // Takes the spare height without being squeezed below its own items.
  drawerList: {
    flexGrow: 1,
    paddingTop: 14,
  },
  item: {
    borderRadius: 14,
  },
  // The tinted tile the app puts behind an icon, as on the profile rows.
  iconTile: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemLabel: {
    fontSize: 14.5,
  },
  divider: {
    marginHorizontal: 8,
    marginVertical: 8,
  },
  logoutLabel: {
    fontFamily: fontFamilies.semibold,
  },
});
export default DrawerNavigator;
