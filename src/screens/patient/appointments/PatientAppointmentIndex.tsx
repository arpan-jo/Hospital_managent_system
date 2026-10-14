import React, { useCallback, useMemo } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text, useTheme } from 'react-native-paper';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { AppointmentSummary } from '@app/core';
import { CustomButton, fontFamilies } from '@app/ui';
import ScreenHeader from '../../../components/ScreenHeader';
import { AppointmentsStackParamList } from '../../../navigation/AppointmentsStackNavigator';
import { TabParamList } from '../../../navigation/TabNavigator';
import { TAB_BAR_CLEARANCE } from '../../../navigation/tabBarLayout';
import { useFocusedStatusBar } from '../../../hooks/useFocusedStatusBar';
import {
  APPOINTMENT_TABS,
  AppointmentTab,
  useAppointmentsViewModel,
} from './useAppointmentsViewModel';
import AppointmentCard from './AppointmentCard';

const TAB_LABEL_KEY: Record<AppointmentTab, string> = {
  upcoming: 'appointments.tabUpcoming',
  completed: 'appointments.tabCompleted',
  cancelled: 'appointments.tabCancelled',
  absent: 'appointments.tabAbsent',
};

/** What each tab says when it has nothing — the portal's own lines. */
const EMPTY: Record<AppointmentTab, { icon: string; titleKey: string; hintKey?: string }> = {
  upcoming: {
    icon: 'calendar-plus',
    titleKey: 'appointments.emptyUpcoming',
    hintKey: 'appointments.emptyUpcomingHint',
  },
  completed: { icon: 'calendar-check-outline', titleKey: 'appointments.emptyCompleted' },
  cancelled: { icon: 'calendar-remove-outline', titleKey: 'appointments.emptyCancelled' },
  absent: { icon: 'emoticon-happy-outline', titleKey: 'appointments.emptyAbsent' },
};

/** My Appointments: every booking, split into the portal's four tabs. */
export const PatientAppointmentIndex = observer(() => {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<AppointmentsStackParamList>>();
  const insets = useSafeAreaInsets();
  const viewModel = useAppointmentsViewModel();
  useFocusedStatusBar(theme.dark ? 'light-content' : 'dark-content');

  const months = useMemo(() => Array.from({ length: 12 }, (_, index) => t(`months.${index}`)), [t]);

  /** "+ Book New" and the empty Upcoming tab both lead to Find Doctors. */
  const goToDoctors = useCallback(() => {
    navigation.getParent<BottomTabNavigationProp<TabParamList>>()?.navigate('HomeTab');
  }, [navigation]);

  const openAppointment = useCallback(
    (appointment: AppointmentSummary) => {
      if (!appointment?.id) return;
      navigation.navigate('AppointmentDetails', { appointmentId: appointment.id });
    },
    [navigation],
  );

  const empty = EMPTY[viewModel.activeTab];
  const muted = theme.colors.onSurfaceVariant;

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <ScreenHeader
        title={t('appointments.title')}
        subtitle={
          viewModel.isLoading
            ? t('appointments.loading')
            : t('appointments.totalBookings', { count: viewModel.total })
        }
        leading="menu"
        right={
          <Pressable
            onPress={goToDoctors}
            accessibilityRole="button"
            style={[styles.bookNew, { backgroundColor: theme.colors.primary }]}
          >
            <Icon name="plus" size={15} color={theme.colors.onPrimary} />
            <Text style={[styles.bookNewText, { color: theme.colors.onPrimary }]}>
              {t('appointments.bookNew')}
            </Text>
          </Pressable>
        }
      />

      <View
        accessibilityRole="tablist"
        style={[
          styles.tabs,
          { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant },
        ]}
      >
        {APPOINTMENT_TABS.map(tab => {
          const selected = viewModel.activeTab === tab;
          const count = viewModel.counts?.[tab] ?? 0;
          return (
            <Pressable
              key={tab}
              onPress={() => viewModel.setActiveTab(tab)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              style={[styles.tab, selected ? { backgroundColor: theme.colors.primary } : null]}
            >
              <Text
                numberOfLines={1}
                style={[styles.tabText, { color: selected ? theme.colors.onPrimary : muted }]}
              >
                {t(TAB_LABEL_KEY[tab])}
              </Text>
              <View
                style={[
                  styles.countBadge,
                  {
                    backgroundColor: selected
                      ? 'rgba(255,255,255,0.25)'
                      : theme.colors.surfaceVariant,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.countText,
                    { color: selected ? theme.colors.onPrimary : theme.colors.onSurface },
                  ]}
                >
                  {count}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + TAB_BAR_CLEARANCE },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={viewModel.isRefreshing}
            onRefresh={viewModel.refresh}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
      >
        {viewModel.isLoading ? (
          <View style={styles.state}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
          </View>
        ) : viewModel.error !== null ? (
          <View style={styles.state}>
            <View style={[styles.stateIcon, { backgroundColor: theme.colors.errorContainer }]}>
              <Icon name="alert-circle-outline" size={26} color={theme.colors.error} />
            </View>
            <Text style={[styles.stateTitle, { color: theme.colors.onSurface }]}>
              {viewModel.error || t('common.somethingWentWrong')}
            </Text>
            <CustomButton mode="outlined" onPress={viewModel.retry} style={styles.stateButton}>
              {t('common.retry')}
            </CustomButton>
          </View>
        ) : viewModel.appointments?.length ? (
          viewModel.appointments.map(appointment => (
            <AppointmentCard
              key={appointment?.id}
              appointment={appointment}
              months={months}
              onPress={openAppointment}
            />
          ))
        ) : (
          <View style={styles.state}>
            <View style={[styles.stateIcon, { backgroundColor: theme.colors.primaryContainer }]}>
              <Icon name={empty.icon} size={26} color={theme.colors.primary} />
            </View>
            <Text style={[styles.stateTitle, { color: theme.colors.onSurface }]}>
              {t(empty.titleKey)}
            </Text>
            {empty.hintKey ? (
              <>
                <Text style={[styles.stateHint, { color: muted }]}>{t(empty.hintKey)}</Text>
                <CustomButton mode="contained" onPress={goToDoctors} style={styles.stateButton}>
                  {t('appointments.findDoctor')}
                </CustomButton>
              </>
            ) : null}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  bookNew: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingLeft: 10,
    paddingRight: 14,
    paddingVertical: 8,
  },
  bookNewText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 12.5,
  },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 14,
    padding: 4,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 2,
    borderRadius: 10,
  },
  tabText: {
    flexShrink: 1,
    fontFamily: fontFamilies.semibold,
    fontSize: 11.5,
  },
  countBadge: {
    minWidth: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    paddingVertical: 1,
    alignItems: 'center',
  },
  countText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 10,
  },
  scrollContent: {
    paddingHorizontal: 16,
    flexGrow: 1,
  },
  state: {
    alignItems: 'center',
    paddingTop: 64,
    paddingHorizontal: 24,
  },
  stateIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  stateTitle: {
    fontFamily: fontFamilies.semibold,
    fontSize: 15,
    textAlign: 'center',
  },
  stateHint: {
    fontFamily: fontFamilies.regular,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
  },
  stateButton: {
    marginTop: 18,
    borderRadius: 12,
    minWidth: 160,
  },
});

export default PatientAppointmentIndex;
