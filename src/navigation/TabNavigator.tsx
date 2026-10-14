import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
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
import AppointmentsStackNavigator from './AppointmentsStackNavigator';
import MyPrescriptionsStackNavigator from './MyPrescriptionsStackNavigator';

export type TabParamList = {
  HomeTab: NavigatorScreenParams<FindDoctorsStackParamList> | undefined;
  ActivityTab: undefined;
  PrescriptionsTab: undefined;
  ProfileTab: NavigatorScreenParams<ProfileStackParamList> | undefined;
};

type TabConfig = {
  name: keyof TabParamList;
  titleKey: string;
  /** MaterialCommunityIcons name. */
  icon: string;
  component: React.ComponentType<any>;
};

/**
 * The tab bar — Find Doctors, Appointments, Prescription, Profile. Each tab is
 * labelled after the screen it actually shows; the route names stay as they
 * were so existing `navigate('MainTabs', { screen: ... })` calls keep working.
 * The drawer entries of the same names focus these tabs, so each screen exists
 * exactly once whichever entry point is used.
 */
const TABS: TabConfig[] = [
  {
    name: 'HomeTab',
    titleKey: 'tabs.findDoctors',
    icon: 'account-search-outline',
    component: FindDoctorsStackNavigator,
  },
  {
    name: 'ActivityTab',
    titleKey: 'tabs.appointments',
    icon: 'calendar-check-outline',
    component: AppointmentsStackNavigator,
  },
  {
    name: 'PrescriptionsTab',
    titleKey: 'tabs.prescriptions',
    icon: 'file-document-edit-outline',
    component: MyPrescriptionsStackNavigator,
  },
  {
    name: 'ProfileTab',
    titleKey: 'tabs.profile',
    icon: 'account-outline',
    component: ProfileStackNavigator,
  },
];

/** Route name -> icon, for the custom tab bar below. */
const TAB_ICONS: Record<string, string> = Object.fromEntries(
  TABS.map(tab => [tab.name, tab.icon]),
);

const Tab = createBottomTabNavigator<TabParamList>();

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
        {
          backgroundColor: theme.colors.surface,
          paddingBottom: insets.bottom + 8,
          shadowColor: theme.dark ? '#000000' : '#0B1030',
          borderTopWidth: 1,
          borderTopColor: theme.colors.outlineVariant,
        },
      ]}
    >
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const label = (options.title ?? route.name) as string;
        const isFocused = state.index === index;
        const outlineIcon = TAB_ICONS?.[route.name] ?? 'circle-outline';
        // Every icon in the map above follows MaterialCommunityIcons' outline
        // naming, so the filled variant for the active tab is the same name
        // with that suffix dropped.
        const iconName = isFocused
          ? outlineIcon.replace(/-outline$/, '')
          : outlineIcon;
        const tintColor = isFocused
          ? theme.colors.primary
          : theme.colors.onSurfaceVariant;

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
          <Pressable
            key={route.key}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={label}
            hitSlop={4}
            android_ripple={{ color: 'transparent' }}
            style={styles.item}
          >
            <View style={styles.itemInner}>
              <Icon name={iconName} size={22} color={tintColor} />
              <Text
                numberOfLines={1}
                style={[
                  styles.label,
                  {
                    color: tintColor,
                    fontFamily: isFocused
                      ? fontFamilies.semibold
                      : fontFamilies.regular,
                  },
                ]}
              >
                {label}
              </Text>
            </View>
          </Pressable>
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
    paddingHorizontal: 6,
    paddingTop: 8,
    elevation: 10,
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -2 },
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemInner: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  label: {
    fontSize: 10.5,
  },
});

export default TabNavigator;
