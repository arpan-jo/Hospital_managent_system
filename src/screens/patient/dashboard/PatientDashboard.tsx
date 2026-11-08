import React, { useCallback, useMemo, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from 'react-native-paper';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { DrawerActions, useFocusEffect, useNavigation } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  AppointmentSummary,
  dayPeriod,
  formatLongDate,
  formatTaka,
  getFileUrl,
  greetingName,
  toISODate,
  useStores,
} from '@app/core';
import { CustomAvatar, CustomButton, fontFamilies, useAppTheme } from '@app/ui';
import { aiPalette, withAlpha } from '../../../components/ai/aiPalette';
import NotificationBell from '../../../components/NotificationBell';
import { useFocusedStatusBar } from '../../../hooks/useFocusedStatusBar';
import { useMonthNames } from '../../../hooks/useMonthNames';
import { useRefreshUnreadNotifications } from '../../../hooks/useUnreadNotifications';
import { DrawerParamList } from '../../../navigation/DrawerNavigator';
import { TAB_BAR_CLEARANCE } from '../../../navigation/tabBarLayout';
import TodayMedicinesPanel from '../myPrescriptions/TodayMedicinesPanel';
import TodayQueueCard from '../appointments/TodayQueueCard';
import { useTodayQueue } from '../appointments/useTodayQueue';
import { PromoItem, QuickActionItem, QuickActions, StatTileItem, StatTiles } from './DashboardTiles';
import NextAppointmentCard from './NextAppointmentCard';
import { useDashboard } from './useDashboard';

/** How far the next-appointment card reaches up over the header. */
const OVERLAP = 56;

/** Scrolled this far, the greeting is gone from under the status bar. */
const BAR_AFTER = 120;

/** A heading over one part of the page, with an optional link at its end. */
const SectionTitle = ({ children, action, onAction }: { children: string; action?: string; onAction?: () => void }) => {
  const theme = useAppTheme();
  return (
    <View style={styles.sectionRow}>
      <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>{children}</Text>
      {action && onAction ? (
        <Pressable onPress={onAction} hitSlop={8} accessibilityRole="button">
          <Text style={[styles.sectionAction, { color: theme.colors.primary }]}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
};

/**
 * Home — the portal's patient dashboard, laid out for a phone: a greeting on
 * the brand wash, the next visit floating over it, today's queue, the figures
 * that wait on the patient (reports, money owed, messages), the quick ways in,
 * and today's medicines. Every figure is the one the portal works out, from
 * the same lists.
 */
export const PatientDashboard = observer(() => {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const months = useMonthNames();
  const navigation = useNavigation();
  const { authStore, profileStore } = useStores();
  const viewModel = useDashboard();
  const queue = useTodayQueue();
  const palette = aiPalette(theme);
  const ink = palette.onGradient;
  // Light text over the wash, in light and dark alike.
  useFocusedStatusBar('light-content');

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

  // "Good afternoon," then the first name — the header's greeting, as on Find Doctors.
  const userName =
    profileStore?.patientProfileData?.fullName?.trim() || authStore?.user?.fullName?.trim() || t('common.na');
  const photoUrl = getFileUrl(profileStore?.patientProfileData?.photoUrl ?? '');
  const greeting = t(`findDoctors.greeting.${dayPeriod()}`);
  const firstName = greetingName(profileStore?.patientProfileData?.fullName || authStore?.user?.fullName);
  const now = new Date();
  const today = `${t(`days.${now.getDay()}`)}, ${formatLongDate(toISODate(now), months)}`;

  const openMenu = useCallback(() => navigation.dispatch(DrawerActions.openDrawer()), [navigation]);
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
  const openHomeCollection = useCallback(() => drawer()?.navigate?.('HomeCollection'), [drawer]);
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
      { key: 'messages', label: t('dashboard.messageDoctor'), icon: 'message-text-outline', tone: 'brand', onPress: openMessages },
      {
        key: 'prescriptions',
        label: t('dashboard.prescriptions'),
        icon: 'clipboard-text-outline',
        tone: 'violet',
        onPress: openPrescriptions,
      },
      { key: 'vitals', label: t('dashboard.vitals'), icon: 'heart-pulse', tone: 'pink', onPress: openVitals },
      { key: 'reports', label: t('dashboard.reports'), icon: 'file-chart-outline', tone: 'orange', onPress: openReports },
    ],
    [t, openMessages, openPrescriptions, openVitals, openReports],
  );

  // The portal's order: book a visit, then order a lab test.
  const primaries: PromoItem[] = useMemo(
    () => [
      {
        key: 'book',
        label: t('dashboard.bookAppointment'),
        hint: t('dashboard.bookHint'),
        icon: 'stethoscope',
        wash: 'brand',
        onPress: openFindDoctors,
      },
      {
        key: 'labTest',
        label: t('dashboard.orderLabTest'),
        hint: t('dashboard.orderLabTestHint'),
        icon: 'home-plus-outline',
        wash: 'teal',
        onPress: openHomeCollection,
      },
    ],
    [t, openFindDoctors, openHomeCollection],
  );

  const refresh = useCallback(() => {
    viewModel.refresh();
    queue.refresh();
  }, [viewModel, queue]);

  // Once the wash has scrolled away, the light status bar would sit on the page:
  // a strip of the brand colour takes its place behind it.
  const [showBar, setShowBar] = useState(false);
  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const past = (event?.nativeEvent?.contentOffset?.y ?? 0) > BAR_AFTER;
    setShowBar(current => (current === past ? current : past));
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={32}
        contentContainerStyle={{ paddingBottom: insets.bottom + TAB_BAR_CLEARANCE }}
        refreshControl={
          <RefreshControl
            refreshing={viewModel.isRefreshing}
            onRefresh={refresh}
            colors={[theme.colors.primary]}
            tintColor={ink}
            progressViewOffset={insets.top}
          />
        }
      >
        {/* ── The greeting, on the brand wash up to the top edge ── */}
        <View
          style={[
            styles.hero,
            {
              paddingTop: insets.top + 8,
              paddingBottom: OVERLAP + 20,
              backgroundColor: palette.base,
              experimental_backgroundImage: palette.gradient,
            },
          ]}
        >
          <View pointerEvents="none" style={[styles.ring, styles.ringLarge, { borderColor: ink }]} />
          <View pointerEvents="none" style={[styles.ring, styles.ringSmall, { borderColor: ink }]} />

          <View style={styles.heroBar}>
            <Pressable
              onPress={openMenu}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('common.menu')}
              style={[styles.glassButton, { backgroundColor: withAlpha(ink, 0.16) }]}
            >
              <Icon name="menu" size={22} color={ink} />
            </Pressable>
            <View style={styles.flex} />
            <NotificationBell onPress={openNotifications} />
            <Pressable onPress={openProfile} accessibilityRole="button" accessibilityLabel={t('profile.title')}>
              <View style={[styles.avatarRing, { borderColor: withAlpha(ink, 0.6) }]}>
                <CustomAvatar type="image" value={photoUrl} fallback={userName} size={36} />
              </View>
            </Pressable>
          </View>

          <Text style={[styles.greeting, { color: withAlpha(ink, 0.85) }]}>{firstName ? `${greeting},` : greeting}</Text>
          {firstName ? (
            <Text numberOfLines={1} style={[styles.name, { color: ink }]}>
              {`${firstName} 👋`}
            </Text>
          ) : null}
          <View style={[styles.datePill, { backgroundColor: withAlpha(ink, 0.16) }]}>
            <Icon name="calendar-today" size={13} color={ink} />
            <Text style={[styles.dateText, { color: ink }]}>{today}</Text>
          </View>
        </View>

        <View style={[styles.body, { marginTop: -OVERLAP }]}>
          <NextAppointmentCard
            next={viewModel.next}
            isLoading={viewModel.isLoading}
            onOpen={openAppointment}
            onSeeAll={openAppointments}
            onBook={openFindDoctors}
          />

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

          {/* Today's tokens, when there is a visit today — as the portal puts them up top. */}
          <TodayQueueCard entries={queue.entries} />

          <SectionTitle>{t('dashboard.overview')}</SectionTitle>
          <StatTiles items={tiles} />

          <SectionTitle>{t('dashboard.quickActions')}</SectionTitle>
          <QuickActions primaries={primaries} items={shortcuts} />

          <SectionTitle action={t('dashboard.seeAll')} onAction={openPrescriptions}>
            {t('dashboard.todayMedicines')}
          </SectionTitle>
          <TodayMedicinesPanel patientCode={null} />
        </View>
      </ScrollView>
      {showBar ? (
        <View
          pointerEvents="none"
          style={[styles.statusBar, { height: insets.top, backgroundColor: palette.base }]}
        />
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  statusBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  flex: {
    flex: 1,
  },
  hero: {
    paddingHorizontal: 20,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: 'hidden',
  },
  ring: {
    position: 'absolute',
    borderWidth: 1.5,
    opacity: 0.16,
  },
  ringLarge: {
    width: 260,
    height: 260,
    borderRadius: 130,
    top: -110,
    right: -90,
  },
  ringSmall: {
    width: 140,
    height: 140,
    borderRadius: 70,
    bottom: -40,
    left: -50,
  },
  heroBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  glassButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarRing: {
    borderWidth: 2,
    borderRadius: 22,
    padding: 1,
  },
  greeting: {
    fontFamily: fontFamilies.medium,
    fontSize: 15,
    marginTop: 18,
  },
  name: {
    fontFamily: fontFamilies.bold,
    fontSize: 26,
    marginTop: 2,
  },
  datePill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginTop: 12,
  },
  dateText: {
    fontFamily: fontFamilies.medium,
    fontSize: 12.5,
  },
  body: {
    paddingHorizontal: 16,
    gap: 14,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  sectionTitle: {
    fontFamily: fontFamilies.bold,
    fontSize: 17,
  },
  sectionAction: {
    fontFamily: fontFamilies.semibold,
    fontSize: 13,
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
