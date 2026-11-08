import React, { useCallback, useMemo } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { AppointmentSummary, dayPeriod, formatTaka, getFileUrl, greetingName, useStores } from '@app/core';
import { CustomAvatar, CustomButton, fontFamilies } from '@app/ui';
import NotificationBell from '../../../components/NotificationBell';
import ScreenHeader from '../../../components/ScreenHeader';
import { useFocusedStatusBar } from '../../../hooks/useFocusedStatusBar';
import { useRefreshUnreadNotifications } from '../../../hooks/useUnreadNotifications';
import { DrawerParamList } from '../../../navigation/DrawerNavigator';
import { TAB_BAR_CLEARANCE } from '../../../navigation/tabBarLayout';
import TodayMedicinesPanel from '../myPrescriptions/TodayMedicinesPanel';
import TodayQueueCard from '../appointments/TodayQueueCard';
import { useTodayQueue } from '../appointments/useTodayQueue';
import { QuickActionItem, QuickActions, StatTileItem, StatTiles } from './DashboardTiles';
import NextAppointmentCard from './NextAppointmentCard';
import { useDashboard } from './useDashboard';

/** A heading over one part of the page. */
const SectionTitle = ({ children }: { children: string }) => {
  const theme = useTheme();
  return <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>{children}</Text>;
};

/**
 * Home — the portal's patient dashboard, laid out for a phone: today's queue,
 * the next visit, the figures that wait on the patient (reports, money owed,
 * messages), the quick ways in, and today's medicines. Every figure is the one
 * the portal works out, from the same lists.
 */
export const PatientDashboard = observer(() => {
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { authStore, profileStore } = useStores();
  const viewModel = useDashboard();
  const queue = useTodayQueue();
  useFocusedStatusBar(theme.dark ? 'light-content' : 'dark-content');

  /** Everything this page opens lives on the drawer, the tabs among it. */
  const drawer = useCallback(
    () => navigation.getParent<DrawerNavigationProp<DrawerParamList>>(),
    [navigation],
  );

  // The bell lives on this screen too: its count is read again each time it comes into view.
  const refreshUnread = useRefreshUnreadNotifications();
  useFocusEffect(
    useCallback(() => {
      refreshUnread();
    }, [refreshUnread]),
  );

  // "Good afternoon, Maruf 👋" — the header's greeting, as on Find Doctors.
  const userName =
    profileStore?.patientProfileData?.fullName?.trim() || authStore.user?.fullName?.trim() || t('common.na');
  const photoUrl = getFileUrl(profileStore?.patientProfileData?.photoUrl ?? '');
  const greeting = t(`findDoctors.greeting.${dayPeriod()}`);
  const firstName = greetingName(profileStore?.patientProfileData?.fullName || authStore.user?.fullName);
  const headerGreeting = firstName ? t('findDoctors.greetingWithName', { greeting, name: firstName }) : greeting;

  const openFindDoctors = useCallback(() => drawer()?.navigate?.('MainTabs', { screen: 'HomeTab' }), [drawer]);
  const openAppointments = useCallback(
    () => drawer()?.navigate?.('MainTabs', { screen: 'ActivityTab', params: { screen: 'AppointmentsList' } }),
    [drawer],
  );
  const openAppointment = useCallback(
    (appointment: AppointmentSummary) => {
      if (!appointment?.id) return;
      drawer()?.navigate?.('MainTabs', {
        screen: 'ActivityTab',
        params: { screen: 'AppointmentDetails', params: { appointmentId: appointment.id }, initial: false },
      });
    },
    [drawer],
  );
  const openReports = useCallback(() => drawer()?.navigate?.('MainTabs', { screen: 'ReportsTab' }), [drawer]);
  const openBills = useCallback(() => drawer()?.navigate?.('Bills'), [drawer]);
  const openMessages = useCallback(() => drawer()?.navigate?.('Messages'), [drawer]);
  const openPrescriptions = useCallback(() => drawer()?.navigate?.('Prescriptions'), [drawer]);
  const openVitals = useCallback(() => drawer()?.navigate?.('Vitals'), [drawer]);
  const openProfile = useCallback(() => drawer()?.navigate?.('MainTabs', { screen: 'ProfileTab' }), [drawer]);
  const openNotifications = useCallback(() => drawer()?.navigate?.('Notifications'), [drawer]);

  const { pendingReports, readyReports, dueTotal, unreadMessages } = viewModel;

  const tiles: StatTileItem[] = useMemo(
    () => [
      {
        key: 'pending',
        label: t('dashboard.reportsPending'),
        value: String(pendingReports ?? 0),
        icon: 'file-clock-outline',
        tone: 'amber',
        onPress: openReports,
      },
      {
        key: 'ready',
        label: t('dashboard.reportsReady'),
        value: String(readyReports ?? 0),
        icon: 'flask-outline',
        tone: 'green',
        highlight: (readyReports ?? 0) > 0,
        onPress: openReports,
      },
      {
        key: 'bills',
        label: t('dashboard.billsDue'),
        value: formatTaka(dueTotal),
        icon: 'receipt',
        tone: 'rose',
        highlight: (dueTotal ?? 0) > 0,
        onPress: openBills,
      },
      {
        key: 'messages',
        label: t('dashboard.unreadMessages'),
        value: String(unreadMessages ?? 0),
        icon: 'message-text-outline',
        tone: 'brand',
        highlight: (unreadMessages ?? 0) > 0,
        onPress: openMessages,
      },
    ],
    [t, pendingReports, readyReports, dueTotal, unreadMessages, openReports, openBills, openMessages],
  );

  const shortcuts: QuickActionItem[] = useMemo(
    () => [
      { key: 'messages', label: t('dashboard.messageDoctor'), icon: 'message-text-outline', onPress: openMessages },
      { key: 'prescriptions', label: t('dashboard.prescriptions'), icon: 'clipboard-text-outline', onPress: openPrescriptions },
      { key: 'vitals', label: t('dashboard.vitals'), icon: 'heart-pulse', onPress: openVitals },
      { key: 'reports', label: t('dashboard.reports'), icon: 'file-chart-outline', onPress: openReports },
    ],
    [t, openMessages, openPrescriptions, openVitals, openReports],
  );

  const refresh = useCallback(() => {
    viewModel.refresh();
    queue.refresh();
  }, [viewModel, queue]);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScreenHeader
        title={t('dashboard.title')}
        subtitle={headerGreeting}
        leading="menu"
        right={
          <View style={styles.headerActions}>
            <NotificationBell onPress={openNotifications} />
            <Pressable onPress={openProfile} accessibilityRole="button" accessibilityLabel={t('profile.title')}>
              <View style={[styles.headerAvatar, { borderColor: theme.colors.primaryContainer }]}>
                <CustomAvatar type="image" value={photoUrl} fallback={userName} size={36} />
              </View>
            </Pressable>
          </View>
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + TAB_BAR_CLEARANCE }]}
        refreshControl={
          <RefreshControl
            refreshing={viewModel.isRefreshing}
            onRefresh={refresh}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
      >
        {viewModel.allFailed && !viewModel.isLoading ? (
          <View style={[styles.failed, { backgroundColor: theme.colors.errorContainer }]}>
            <Icon name="wifi-off" size={18} color={theme.colors.error} />
            <Text style={[styles.failedText, { color: theme.colors.onErrorContainer }]}>
              {t('dashboard.loadFailed')}
            </Text>
            <CustomButton mode="text" onPress={viewModel.retry}>
              {t('common.retry')}
            </CustomButton>
          </View>
        ) : null}

        {/* Today's tokens first, as the portal puts them. */}
        <TodayQueueCard entries={queue.entries} />

        <NextAppointmentCard
          next={viewModel.next}
          isLoading={viewModel.isLoading}
          onOpen={openAppointment}
          onSeeAll={openAppointments}
          onBook={openFindDoctors}
        />

        <SectionTitle>{t('dashboard.overview')}</SectionTitle>
        <StatTiles items={tiles} />

        <SectionTitle>{t('dashboard.quickActions')}</SectionTitle>
        <QuickActions
          primary={{
            key: 'book',
            label: t('dashboard.bookAppointment'),
            hint: t('dashboard.bookHint'),
            icon: 'stethoscope',
            onPress: openFindDoctors,
          }}
          items={shortcuts}
        />

        <SectionTitle>{t('dashboard.todayMedicines')}</SectionTitle>
        <TodayMedicinesPanel patientCode={null} />
      </ScrollView>
    </SafeAreaView>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerAvatar: {
    borderWidth: 2,
    borderRadius: 22,
    padding: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 4,
    gap: 12,
  },
  sectionTitle: {
    fontFamily: fontFamilies.semibold,
    fontSize: 15,
    marginTop: 8,
  },
  failed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    paddingLeft: 12,
    paddingVertical: 4,
  },
  failedText: {
    flex: 1,
    fontFamily: fontFamilies.medium,
    fontSize: 13,
  },
});

export default PatientDashboard;
