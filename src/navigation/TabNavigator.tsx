import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import {
  createBottomTabNavigator,
  BottomTabBarProps,
} from '@react-navigation/bottom-tabs';
import { Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTranslation } from 'react-i18next';
import { fontFamilies } from '@app/ui';
import { NavigatorScreenParams } from '@react-navigation/native';
import ProfileStackNavigator, {
  ProfileStackParamList,
} from './ProfileStackNavigator';
import FindDoctorsStackNavigator, {
  FindDoctorsStackParamList,
} from './FindDoctorsStackNavigator';
import AppointmentsStackNavigator, {
  AppointmentsStackParamList,
} from './AppointmentsStackNavigator';
import MyPrescriptionsStackNavigator from './MyPrescriptionsStackNavigator';

export type TabParamList = {
  HomeTab: NavigatorScreenParams<FindDoctorsStackParamList> | undefined;
  ActivityTab: NavigatorScreenParams<AppointmentsStackParamList> | undefined;
  PrescriptionsTab: undefined;
  ProfileTab: NavigatorScreenParams<ProfileStackParamList> | undefined;
};

type TabConfig = {
  name: keyof TabParamList;
  titleKey: string;
  /** MaterialCommunityIcons names — outlined at rest, filled when the tab is open. */
  icon: string;
  activeIcon: string;
  component: React.ComponentType<any>;
};

/**
 * The tab bar — Find Doctors, Appointments, Prescription, Profile. Each tab is
 * labelled after the screen it actually shows; the route names stay as they
 * were so existing `navigate('MainTabs', { screen: ... })` calls keep working.
 * The drawer entries of the same names focus these tabs, so each screen exists
 * exactly once whichever entry point is used.
 */
export const TABS: TabConfig[] = [
  {
    name: 'HomeTab',
    titleKey: 'tabs.findDoctors',
    icon: 'stethoscope',
    activeIcon: 'stethoscope',
    component: FindDoctorsStackNavigator,
  },
  {
    name: 'ActivityTab',
    titleKey: 'tabs.appointments',
    icon: 'calendar-month-outline',
    activeIcon: 'calendar-month',
    component: AppointmentsStackNavigator,
  },
  {
    name: 'PrescriptionsTab',
    titleKey: 'tabs.prescriptions',
    icon: 'clipboard-text-outline',
    activeIcon: 'clipboard-text',
    component: MyPrescriptionsStackNavigator,
  },
  {
    name: 'ProfileTab',
    titleKey: 'tabs.profile',
    icon: 'account-circle-outline',
    activeIcon: 'account-circle',
    component: ProfileStackNavigator,
  },
];

const TAB_BY_ROUTE: Record<string, TabConfig> = Object.fromEntries(
  TABS.map(tab => [tab.name, tab]),
);

const Tab = createBottomTabNavigator<TabParamList>();

interface TabItemProps {
  label: string;
  icon: string;
  activeIcon: string;
  isFocused: boolean;
  onPress: () => void;
}

/**
 * One tab: the icon sits on a pill that grows in when the tab opens — the
 * Material 3 navigation bar's active indicator.
 */
const TabItem = ({ label, icon, activeIcon, isFocused, onPress }: TabItemProps) => {
  const theme = useTheme();
  const progress = useRef(new Animated.Value(isFocused ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: isFocused ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [isFocused, progress]);

  const tint = isFocused ? theme.colors.primary : theme.colors.onSurfaceVariant;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={isFocused ? { selected: true } : {}}
      accessibilityLabel={label}
      hitSlop={4}
      android_ripple={{ color: 'transparent' }}
      style={styles.item}
    >
      <View style={styles.iconWrap}>
        <Animated.View
          style={[
            styles.indicator,
            {
              backgroundColor: theme.colors.primaryContainer,
              opacity: progress,
              transform: [
                { scaleX: progress.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) },
              ],
            },
          ]}
        />
        <Icon name={isFocused ? activeIcon : icon} size={22} color={tint} />
      </View>
      <Text
        numberOfLines={1}
        style={[
          styles.label,
          {
            color: isFocused ? theme.colors.onSurface : theme.colors.onSurfaceVariant,
            fontFamily: isFocused ? fontFamilies.semibold : fontFamilies.medium,
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
};

const CustomTabBar = ({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.bar,
        theme.dark ? styles.barShadowDark : styles.barShadowLight,
        {
          backgroundColor: theme.colors.surface,
          paddingBottom: insets.bottom + 8,
          borderTopColor: theme.colors.outlineVariant,
        },
      ]}
    >
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const tab = TAB_BY_ROUTE[route.name];
        const isFocused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <TabItem
            key={route.key}
            label={(options.title ?? route.name) as string}
            icon={tab?.icon ?? 'circle-outline'}
            activeIcon={tab?.activeIcon ?? 'circle'}
            isFocused={isFocused}
            onPress={onPress}
          />
        );
      })}
    </View>
  );
};

const renderTabBar = (props: BottomTabBarProps) => <CustomTabBar {...props} />;

export const TabNavigator = () => {
  const { t } = useTranslation();

  return (
    <Tab.Navigator
      tabBar={renderTabBar}
      screenOptions={{ headerShown: false }}
    >
      {TABS.map(tab => (
        <Tab.Screen
          key={tab.name}
          name={tab.name}
          component={tab.component}
          options={{ title: t(tab.titleKey) }}
        />
      ))}
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    elevation: 12,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -3 },
  },
  barShadowLight: {
    shadowColor: '#0B1030',
  },
  barShadowDark: {
    shadowColor: '#000000',
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  iconWrap: {
    width: 60,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indicator: {
    ...StyleSheet.absoluteFill,
    borderRadius: 16,
  },
  label: {
    fontSize: 11,
  },
});

export default TabNavigator;
