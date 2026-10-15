import React from 'react';
import {
  createDrawerNavigator,
  DrawerContentComponentProps,
  DrawerContentScrollView,
} from '@react-navigation/drawer';
import TabNavigator, { TabParamList } from './TabNavigator';
import SettingsScreen from '../screens/common/settings/SettingsScreen';
import PatientFollowUpIndex from '../screens/patient/followUps/PatientFollowUpIndex';
import NotificationsScreen from '../screens/common/notifications/NotificationsScreen';
import { useUnreadNotificationsSync } from '../hooks/useUnreadNotifications';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStores, getFileUrl } from '@app/core';
import { useTranslation } from 'react-i18next';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { CustomAvatar, fontFamilies } from '@app/ui';

export type DrawerParamList = {
  MainTabs: NavigatorScreenParams<TabParamList> | undefined;
  Settings: undefined;
  Notifications: undefined;
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
 * there is open to the Patient role. Settings is the app's own addition, and
 * Notifications is the portal header's bell given a row of its own.
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
    name: 'Notifications',
    labelKey: 'notifications.title',
    icon: 'bell-outline',
    sectionKey: 'drawer.sectionGeneral',
  },
  {
    name: 'Settings',
    labelKey: 'settings.title',
    icon: 'cog-outline',
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

/**
 * One menu row: a tinted icon tile and the label, with an optional count at the
 * end. The open screen's row sits on the brand tint with its tile filled.
 */
const MenuRow = ({
  icon,
  label,
  active = false,
  count = 0,
  destructive = false,
  onPress,
}: {
  icon: string;
  label: string;
  active?: boolean;
  count?: number;
  destructive?: boolean;
  onPress: () => void;
}) => {
  const theme = useTheme();

  const tile = destructive
    ? theme.colors.errorContainer
    : active
    ? theme.colors.primary
    : theme.colors.surfaceVariant;
  const ink = destructive
    ? theme.colors.error
    : active
    ? theme.colors.onPrimary
    : theme.colors.onSurfaceVariant;
  const labelColor = destructive
    ? theme.colors.error
    : active
    ? theme.colors.onPrimaryContainer
    : theme.colors.onSurface;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [
        styles.row,
        active
          ? { backgroundColor: theme.colors.primaryContainer }
          : pressed
          ? {
              backgroundColor: destructive
                ? theme.colors.errorContainer
                : theme.colors.surfaceVariant,
            }
          : null,
      ]}
    >
      <View style={[styles.rowIcon, { backgroundColor: tile }]}>
        {/* Filled on the open screen's row, as on the tab bar: every icon in
            the menu has a variant without the `-outline` suffix. */}
        <Icon
          name={active ? icon.replace(/-outline$/, '') : icon}
          color={ink}
          size={19}
        />
      </View>
      <Text
        numberOfLines={1}
        style={[
          styles.rowLabel,
          {
            color: labelColor,
            fontFamily:
              active || destructive ? fontFamilies.semibold : fontFamilies.medium,
          },
        ]}
      >
        {label}
      </Text>
      {count > 0 ? (
        <View style={[styles.countPill, { backgroundColor: theme.colors.error }]}>
          <Text style={[styles.countText, { color: theme.colors.onError }]}>
            {count > 99 ? '99+' : count}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
};

const CustomDrawerContent = observer((props: DrawerContentComponentProps) => {
  const { authStore, profileStore, notificationStore } = useStores();
  const { t } = useTranslation();
  const theme = useTheme();
  const unreadCount = notificationStore.unreadCount;
  const insets = useSafeAreaInsets();

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
    <View style={styles.root}>
      <DrawerContentScrollView
        {...props}
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
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

          <View style={styles.identity}>
            {/* The ring keeps the avatar off a card of its own colour. */}
            <View style={[styles.avatarRing, { borderColor: cardInk }]}>
              <CustomAvatar
                type="image"
                value={photoUrl}
                fallback={displayName}
                size={50}
              />
            </View>
            <View style={styles.identityText}>
              <Text numberOfLines={1} style={[styles.name, { color: cardInk }]}>
                {displayName}
              </Text>
              {contactLine ? (
                <Text
                  numberOfLines={1}
                  style={[styles.email, { color: cardInk }]}
                >
                  {contactLine}
                </Text>
              ) : null}
            </View>
            <View style={styles.cardAction}>
              <Glass color={cardInk} />
              <Icon name="chevron-right" size={20} color={cardInk} />
            </View>
          </View>

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

        {MENU_ITEMS.map(item => (
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
            <MenuRow
              icon={item.icon}
              label={t(item.labelKey)}
              active={isActive(item)}
              count={item.name === 'Notifications' ? unreadCount : 0}
              onPress={() =>
                item.tab
                  ? props.navigation.navigate('MainTabs', {
                      screen: item.tab,
                    })
                  : props.navigation.navigate(item.name)
              }
            />
          </React.Fragment>
        ))}
      </DrawerContentScrollView>

      {/* Held at the foot of the drawer, under a hairline, so it is always in
          reach — the menu above scrolls on a short phone instead. */}
      <View
        style={[
          styles.footer,
          {
            borderTopColor: theme.colors.outlineVariant,
            paddingBottom: insets.bottom + 12,
          },
        ]}
      >
        <MenuRow
          icon="logout"
          label={t('profile.logoutButton')}
          destructive
          onPress={() => {
            authStore.logout();
            profileStore.clear();
          }}
        />
      </View>
    </View>
  );
});

const renderDrawerContent = (props: DrawerContentComponentProps) => (
  <CustomDrawerContent {...props} />
);

export const DrawerNavigator = () => {
  const theme = useTheme();
  // Signed in from here down: the bell's count is read once on sign-in.
  useUnreadNotificationsSync();

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
      <Drawer.Screen name="Notifications" component={NotificationsScreen} />
      <Drawer.Screen name="FollowUps" component={PatientFollowUpIndex} />
      <Drawer.Screen
        name="Prescriptions"
        component={MyPrescriptionsStackNavigator}
      />
    </Drawer.Navigator>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  // The footer below owns the bottom inset, so the list only needs a little air.
  scrollContainer: {
    paddingBottom: 8,
  },
  profileCard: {
    borderRadius: 22,
    padding: 14,
    marginTop: 4,
    marginBottom: 6,
    overflow: 'hidden',
  },
  ring: {
    position: 'absolute',
    borderWidth: 1.5,
    opacity: 0.16,
  },
  ringLarge: {
    width: 170,
    height: 170,
    borderRadius: 85,
    top: -84,
    right: -60,
  },
  ringSmall: {
    width: 96,
    height: 96,
    borderRadius: 48,
    bottom: -56,
    right: -22,
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  identityText: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  avatarRing: {
    borderWidth: 2,
    borderRadius: 30,
    padding: 2,
  },
  cardAction: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  glass: {
    opacity: 0.16,
  },
  name: {
    fontFamily: fontFamilies.bold,
    fontSize: 16.5,
  },
  email: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
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
  sectionLabel: {
    fontFamily: fontFamilies.semibold,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    paddingHorizontal: 10,
    marginTop: 16,
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 48,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 14,
    marginVertical: 1,
  },
  // The tinted tile the app puts behind an icon, as on the profile rows.
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    flex: 1,
    fontSize: 14.5,
  },
  countPill: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: {
    fontFamily: fontFamilies.bold,
    fontSize: 11,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
    paddingHorizontal: 12,
  },
});
export default DrawerNavigator;
