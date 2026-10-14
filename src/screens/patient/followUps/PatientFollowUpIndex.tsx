import React, { useCallback, useMemo } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text, useTheme } from 'react-native-paper';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { FollowUp, FollowUpBucket } from '@app/core';
import { CustomButton, fontFamilies } from '@app/ui';
import ScreenHeader from '../../../components/ScreenHeader';
import { DrawerParamList } from '../../../navigation/DrawerNavigator';
import { useFocusedStatusBar } from '../../../hooks/useFocusedStatusBar';
import { useRequirePatientProfile } from '../../../hooks/useRequirePatientProfile';
import FollowUpCard, { BUCKET_LABEL_KEY } from './FollowUpCard';
import { useFollowUpsViewModel } from './useFollowUpsViewModel';

/** What each tab says when it has nothing — the portal's own lines. */
const EMPTY_KEY: Record<FollowUpBucket, { title: string; hint: string }> = {
  upcoming: { title: 'followUps.emptyUpcoming', hint: 'followUps.emptyUpcomingHint' },
  overdue: { title: 'followUps.emptyOverdue', hint: 'followUps.emptyOverdueHint' },
  completed: { title: 'followUps.emptyCompleted', hint: 'followUps.emptyCompletedHint' },
  cancelled: { title: 'followUps.emptyCancelled', hint: 'followUps.emptyCancelledHint' },
};

/** My Follow-ups: every follow-up a doctor ordered, in the portal's four tabs. */
export const PatientFollowUpIndex = observer(() => {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<DrawerNavigationProp<DrawerParamList>>();
  const insets = useSafeAreaInsets();
  const viewModel = useFollowUpsViewModel();
  const { ensureProfile } = useRequirePatientProfile();
  useFocusedStatusBar(theme.dark ? 'light-content' : 'dark-content');

  const months = useMemo(() => Array.from({ length: 12 }, (_, index) => t(`months.${index}`)), [t]);

  /** "Book Appointment": the doctor's page, where the visit is booked — behind the profile gate, as from Find Doctors. */
  const openDoctor = useCallback(
    async (followUp: FollowUp) => {
      const employeeId = followUp?.doctorId ?? 0;
      if (!employeeId) return;
      if (!(await ensureProfile(employeeId))) return;
      navigation.navigate('MainTabs', {
        screen: 'HomeTab',
        params: { screen: 'DoctorDetails', params: { employeeId }, initial: false },
      });
    },
    [navigation, ensureProfile],
  );

  /** "View Consultation": the appointment it was ordered at, with My Appointments under it. */
  const openConsultation = useCallback(
    (followUp: FollowUp) => {
      const appointmentId = followUp?.appointmentId ?? 0;
      if (!appointmentId) return;
      navigation.navigate('MainTabs', {
        screen: 'ActivityTab',
        params: { screen: 'AppointmentDetails', params: { appointmentId }, initial: false },
      });
    },
    [navigation],
  );

  const muted = theme.colors.onSurfaceVariant;
  const error = viewModel.error;
  const empty = EMPTY_KEY[viewModel.activeTab] ?? EMPTY_KEY.upcoming;

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <ScreenHeader title={t('followUps.title')} subtitle={t('followUps.subtitle')} leading="menu" />

      <View
        accessibilityRole="tablist"
        style={[
          styles.tabs,
          { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant },
        ]}
      >
        {viewModel.tabs.map(tab => {
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
                {t(BUCKET_LABEL_KEY[tab])}
              </Text>
              {/* Counted only when there is something to count, as on the portal. */}
              {count > 0 ? (
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
              ) : null}
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
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
        ) : error ? (
          // A failed read must not look like "no follow-ups" — the portal tells them apart too.
          <View style={styles.state}>
            <View style={[styles.stateIcon, { backgroundColor: theme.colors.errorContainer }]}>
              <Icon name="alert-circle-outline" size={26} color={theme.colors.error} />
            </View>
            <Text style={[styles.stateTitle, { color: theme.colors.onSurface }]}>
              {t('followUps.loadFailed')}
            </Text>
            <Text style={[styles.stateHint, { color: muted }]}>
              {error.message ||
                (error.status
                  ? t('followUps.serverResponded', { status: error.status })
                  : t('followUps.serverUnreachable'))}
            </Text>
            <CustomButton mode="outlined" onPress={viewModel.retry} style={styles.stateButton}>
              {t('followUps.tryAgain')}
            </CustomButton>
          </View>
        ) : viewModel.followUps?.length ? (
          viewModel.followUps.map(({ item, bucket }) => (
            <FollowUpCard
              key={item?.id}
              followUp={item}
              bucket={bucket}
              months={months}
              onBook={openDoctor}
              onViewConsultation={openConsultation}
            />
          ))
        ) : (
          <View style={styles.state}>
            <View style={[styles.stateIcon, { backgroundColor: theme.colors.primaryContainer }]}>
              <Icon name="calendar-refresh-outline" size={26} color={theme.colors.primary} />
            </View>
            <Text style={[styles.stateTitle, { color: theme.colors.onSurface }]}>
              {t(empty.title)}
            </Text>
            <Text style={[styles.stateHint, { color: muted }]}>{t(empty.hint)}</Text>
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
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 6,
  },
  stateButton: {
    marginTop: 18,
    borderRadius: 12,
    minWidth: 160,
  },
});

export default PatientFollowUpIndex;
