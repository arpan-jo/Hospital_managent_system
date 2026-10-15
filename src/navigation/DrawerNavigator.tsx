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
import MyPrescriptionsStackNavigator, {
  MyPrescriptionsStackParamList,
} from './MyPrescriptionsStackNavigator';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { observer } from 'mobx-react-lite';
import {
  NavigatorScreenParams,
  getFocusedRouteNameFromRoute,
} from '@react-navigation/native';
import { useStores, getFileUrl } from '@app/core';
import { useTranslation } from 'react-i18next';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { CustomAvatar, fontFamilies } from '@app/ui';

export type DrawerParamList = {
  MainTabs: NavigatorScreenParams<TabParamList> | undefined;
  Settings: undefined;
  FollowUps: undefined;
  Prescriptions:
    | NavigatorScreenParams<MyPrescriptionsStackParamList>
    | undefined;
};

type MenuItem = {
  name: keyof DrawerParamList;
  labelKey: string;
  icon: string;
  tab?: keyof TabParamList;
  /** Starts a new group under this heading — sets the app's own entries apart from the portal's menu. */
  sectionKey?: string;
};

/**
 * The patient portal's menu, in the order of the web's sidebar — every entry
 * there is open to the Patient role. Settings is the app's own addition.
 */
const MENU_ITEMS: MenuItem[] = [
  {
    name: 'MainTabs',
    labelKey: 'drawer.findDoctors',
    icon: 'stethoscope',
    tab: 'HomeTab',
    sectionKey: 'drawer.sectionMenu',
  },
  {
    name: 'MainTabs',
    labelKey: 'drawer.appointments',
    icon: 'calendar-month-outline',
    tab: 'ActivityTab',
  },

  {
    name: 'FollowUps',
    labelKey: 'drawer.followUps',
    icon: 'calendar-refresh-outline',
  },
  {
    name: 'Prescriptions',
    labelKey: 'drawer.prescriptions',
    icon: 'clipboard-text-outline',
  },

  {
    name: 'MainTabs',
    labelKey: 'drawer.reports',
    icon: 'file-chart-outline',
    tab: 'ReportsTab',
  },
  {
    name: 'MainTabs',
    labelKey: 'drawer.profile',
    icon: 'account-circle-outline',
    tab: 'ProfileTab',
  },
  {
    name: 'Settings',
    labelKey: 'settings.title',
    icon: 'cog-outline',
    sectionKey: 'drawer.sectionGeneral',
  },
];

const Drawer = createDrawerNavigator<DrawerParamList>();

/**
 * A see-through tint of the card's ink behind a chip or button on the profile
 * card — from the theme's own colour, so it holds in light and dark alike.
 */
const Glass = ({ color }: { color: string }) => (
  <View
    pointerEvents="none"
    style={[StyleSheet.absoluteFill, styles.glass, { backgroundColor: color }]}
  />
);

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
  const patientCode = patientProfile?.patientCode?.trim() ?? '';
  const bloodType = patientProfile?.bloodType?.trim() ?? '';

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
      <Pressable
        onPress={() =>
          props.navigation.navigate('MainTabs', { screen: 'ProfileTab' })
        }
        accessibilityRole="button"
        accessibilityLabel={t('drawer.viewProfile')}
        style={({ pressed }) => [
          styles.profileCard,
          { backgroundColor: cardColor, opacity: pressed ? 0.92 : 1 },
        ]}
      >
        {/* Echo of the rings on the sign-in hero. */}
        <View
          pointerEvents="none"
          style={[styles.ring, styles.ringLarge, { borderColor: cardInk }]}
        />
        <View
          pointerEvents="none"
          style={[styles.ring, styles.ringSmall, { borderColor: cardInk }]}
        />

        <View style={styles.cardTop}>
          {/* The ring keeps the avatar off a card of its own colour. */}
          <View style={[styles.avatarRing, { borderColor: cardInk }]}>
            <CustomAvatar
              type="image"
              value={photoUrl}
              fallback={displayName}
              size={52}
            />
          </View>
          <View style={styles.cardAction}>
            <Glass color={cardInk} />
            <Icon name="chevron-right" size={20} color={cardInk} />
          </View>
        </View>

        <Text numberOfLines={1} style={[styles.name, { color: cardInk }]}>
          {displayName}
        </Text>
        {contactLine ? (
          <Text numberOfLines={1} style={[styles.email, { color: cardInk }]}>
            {contactLine}
          </Text>
        ) : null}

        {/* A profile not saved yet has neither. */}
        {patientCode || bloodType ? (
          <View style={styles.chipRow}>
            {patientCode ? (
              <View style={styles.chip}>
                <Glass color={cardInk} />
                <Icon
                  name="card-account-details-outline"
                  size={12}
                  color={cardInk}
                />
                <Text
                  numberOfLines={1}
                  style={[styles.chipText, { color: cardInk }]}
                >
                  {patientCode}
                </Text>
              </View>
            ) : null}
            {bloodType ? (
              <View style={styles.chip}>
                <Glass color={cardInk} />
                <Icon name="water" size={12} color={cardInk} />
                <Text style={[styles.chipText, { color: cardInk }]}>
                  {bloodType}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </Pressable>

      <View style={styles.drawerList}>
        {MENU_ITEMS.map(item => {
          const active = isActive(item);

          return (
            <React.Fragment key={item.labelKey}>
              {item.sectionKey ? (
                <Text
                  style={[
                    styles.sectionLabel,
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                >
                  {t(item.sectionKey)}
                </Text>
              ) : null}
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
                          : theme.colors.surfaceVariant,
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
                        active
                          ? theme.colors.onPrimary
                          : theme.colors.onSurfaceVariant
                      }
                      size={20}
                    />
                  </View>
                )}
                label={() => (
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.itemLabel,
                      {
                        color: active
                          ? theme.colors.onPrimaryContainer
                          : theme.colors.onSurface,
                        fontFamily: active
                          ? fontFamilies.semibold
                          : fontFamilies.medium,
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

      {/* A tonal row in the error tone at the foot of the menu — the same
          shape as the rows above, so it reads as part of the list. */}
      <DrawerItem
        style={[styles.item, styles.logoutItem]}
        inactiveBackgroundColor={theme.colors.errorContainer}
        icon={() => (
          <View
            style={[styles.iconTile, { backgroundColor: theme.colors.surface }]}
          >
            <Icon name="logout" color={theme.colors.error} size={20} />
          </View>
        )}
        label={() => (
          <Text
            style={[
              styles.itemLabel,
              styles.logoutLabel,
              { color: theme.colors.onErrorContainer },
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
          width: 300,
          borderTopRightRadius: 28,
          borderBottomRightRadius: 28,
        },
      }}
    >
      <Drawer.Screen name="MainTabs" component={TabNavigator} />
      <Drawer.Screen name="Settings" component={SettingsScreen} />
      <Drawer.Screen name="FollowUps" component={PatientFollowUpIndex} />
      <Drawer.Screen
        name="Prescriptions"
        component={MyPrescriptionsStackNavigator}
      />
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
    borderRadius: 24,
    padding: 16,
    marginTop: 4,
    overflow: 'hidden',
  },
  ring: {
    position: 'absolute',
    borderWidth: 1.5,
    opacity: 0.16,
  },
  ringLarge: {
    width: 190,
    height: 190,
    borderRadius: 95,
    top: -90,
    right: -70,
  },
  ringSmall: {
    width: 110,
    height: 110,
    borderRadius: 55,
    bottom: -62,
    right: -28,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  avatarRing: {
    borderWidth: 2,
    borderRadius: 31,
    padding: 3,
  },
  cardAction: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  glass: {
    opacity: 0.16,
  },
  name: {
    fontFamily: fontFamilies.bold,
    fontSize: 17,
  },
  email: {
    fontFamily: fontFamilies.regular,
    fontSize: 12.5,
    marginTop: 2,
    opacity: 0.85,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 12,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    overflow: 'hidden',
    maxWidth: '100%',
  },
  chipText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 11.5,
    flexShrink: 1,
  },
  // Takes the spare height without being squeezed below its own items.
  drawerList: {
    flexGrow: 1,
    paddingBottom: 12,
  },
  sectionLabel: {
    fontFamily: fontFamilies.semibold,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    marginTop: 20,
    marginBottom: 6,
  },
  item: {
    borderRadius: 16,
    marginVertical: 1,
  },
  // The tinted tile the app puts behind an icon, as on the profile rows.
  iconTile: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemLabel: {
    fontSize: 14.5,
  },
  logoutItem: {
    marginBottom: 4,
  },
  logoutLabel: {
    fontFamily: fontFamilies.semibold,
  },
});
export default DrawerNavigator;
