import React, { useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text, useTheme } from 'react-native-paper';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  formatLongDate,
  getFileUrl,
  stripHonorific,
  to12Hour,
  useStores,
} from '@app/core';
import {
  CustomAvatar,
  CustomBottomSheet,
  CustomButton,
  CustomDialog,
  CustomNoData,
  fontFamilies,
} from '@app/ui';
import ScreenHeader from '../../../components/ScreenHeader';
import { useErrorDialog } from '../../../hooks/useErrorDialog';
import { useFocusedStatusBar } from '../../../hooks/useFocusedStatusBar';
import { useKeyboardHeight } from '../../../hooks/useKeyboardHeight';
import { useMonthNames } from '../../../hooks/useMonthNames';
import { FindDoctorsStackParamList } from '../../../navigation/FindDoctorsStackNavigator';
import { TAB_BAR_CLEARANCE } from '../../../navigation/tabBarLayout';
import DoctorAboutPanel from './DoctorAboutPanel';
import { taka } from './DoctorListItem';
import DoctorSchedulePanel from './DoctorSchedulePanel';
import { DoctorTab, useDoctorDetailsViewModel } from './useDoctorDetailsViewModel';

const TABS: { key: DoctorTab; labelKey: string }[] = [
  { key: 'schedule', labelKey: 'doctorProfile.tabSchedule' },
  { key: 'about', labelKey: 'doctorProfile.tabAbout' },
  { key: 'reviews', labelKey: 'doctorProfile.tabReviews' },
];

/**
 * A doctor's page: the profile on top, then the booking under the Schedule
 * tab, with About and Reviews beside it. The button at the foot opens a
 * summary to confirm, and confirming places the booking.
 */
export const DoctorDetails = observer(() => {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<FindDoctorsStackParamList>>();
  const route = useRoute<RouteProp<FindDoctorsStackParamList, 'DoctorDetails'>>();
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();
  const monthNames = useMonthNames();
  const errorDialog = useErrorDialog();
  const { toastStore } = useStores();
  useFocusedStatusBar(theme.dark ? 'light-content' : 'dark-content');

  // Read defensively: a deep link can land here without the id.
  const employeeId = Number(route?.params?.employeeId ?? 0) || 0;
  const viewModel = useDoctorDetailsViewModel(employeeId);
  const { doctor, detail, displayName, officeName, activeTab } = viewModel;

  const goBack = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
  }, [navigation]);

  const handleConfirm = useCallback(async () => {
    const outcome = await viewModel.book();

    if (!outcome?.ok) {
      if (outcome?.message) errorDialog.show(outcome.message);
      return;
    }

    const { result, consultationLabelKey, amount } = outcome.booking;
    viewModel.closeConfirmation();

    // The patient left while the booking was on its way: there is no page to
    // replace, so the token is told the way the portal tells it.
    if (!navigation.isFocused()) {
      toastStore.show(
        t('doctorProfile.booked', { token: result?.serialNo ?? 0 }),
        'success',
      );
      return;
    }

    // Replaces this page: behind the success screen there must be nothing to
    // go back to and confirm a second time.
    navigation.replace('BookingSuccess', {
      doctorName: displayName,
      doctorSpecialty: detail?.doctorSpecialty || doctor?.specialty || '',
      patientName: viewModel.patient?.fullName ?? '',
      date: result?.appointmentDate || viewModel.date,
      time: result?.time || viewModel.bookingTime,
      officeName,
      token: result?.serialNo ?? 0,
      consultationLabel: t(consultationLabelKey),
      amount,
      paymentStatus: result?.paymentStatus ?? '',
    });
  }, [viewModel, errorDialog, toastStore, navigation, displayName, detail, doctor, officeName, t]);

  const muted = theme.colors.onSurfaceVariant;
  const containerStyle = [styles.container, { backgroundColor: theme.colors.background }];

  if (viewModel.isLoading) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={containerStyle}>
        <ScreenHeader title={t('doctorProfile.title')} leading="back" />
        <View style={styles.centered}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!doctor) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={containerStyle}>
        <ScreenHeader title={t('doctorProfile.title')} leading="back" />
        <View style={styles.centered}>
          <CustomNoData
            iconName="account-off-outline"
            message={
              viewModel.isNotFound
                ? t('doctorProfile.notFoundTitle')
                : viewModel.loadError || t('common.somethingWentWrong')
            }
          />
          {viewModel.isNotFound ? (
            <Text style={[styles.caption, styles.centeredText, { color: muted }]}>
              {t('doctorProfile.notFoundBody')}
            </Text>
          ) : null}
          <CustomButton
            mode="contained"
            onPress={viewModel.isNotFound ? goBack : viewModel.reload}
            style={styles.stateButton}
          >
            {t(viewModel.isNotFound ? 'doctorProfile.backToDoctors' : 'common.retry')}
          </CustomButton>
        </View>
      </SafeAreaView>
    );
  }

  const photoUri = getFileUrl(doctor?.photoUrl);
  const experienceYears = doctor?.experienceYears ?? 0;
  const currentFee = viewModel.currentFee ?? 0;

  const stats = [
    {
      label: t('doctorProfile.experience'),
      value: experienceYears
        ? t('doctorProfile.yearsShort', { count: experienceYears })
        : detail?.experience || '—',
    },
    { label: t('doctorProfile.office'), value: officeName || '—' },
    { label: t('doctorProfile.fee'), value: currentFee > 0 ? taka(currentFee) : '—' },
  ];

  const summary = [
    { label: t('doctorProfile.patient'), value: viewModel.patient?.fullName || '—' },
    {
      label: t('doctorProfile.consultationOption'),
      value: viewModel.selectedOption ? t(viewModel.selectedOption.labelKey) : '—',
    },
    { label: t('doctorProfile.date'), value: formatLongDate(viewModel.date, monthNames) || '—' },
    {
      label: t('doctorProfile.time'),
      value: viewModel.selectedSlot ? to12Hour(viewModel.bookingTime) : '—',
    },
    { label: t('doctorProfile.office'), value: officeName },
    { label: t('doctorProfile.chiefComplaint'), value: viewModel.reason?.trim() ?? '' },
  ].filter(row => row.value);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={containerStyle}>
      <ScreenHeader title={t('doctorProfile.title')} leading="back" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: keyboardHeight ? keyboardHeight + 24 : 24 },
        ]}
      >
        {/* ── The doctor ── */}
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}>
          <View style={styles.profileRow}>
            <CustomAvatar
              type={photoUri ? 'image' : 'text'}
              value={photoUri || stripHonorific(displayName) || '?'}
              fallback={stripHonorific(displayName)}
              size={64}
            />
            <View style={styles.flex}>
              <Text style={[styles.name, { color: theme.colors.onSurface }]}>
                {displayName || t('common.na')}
              </Text>
              {detail?.doctorSpecialty || doctor?.specialty ? (
                <Text style={[styles.specialty, { color: theme.colors.primary }]}>
                  {detail?.doctorSpecialty || doctor?.specialty}
                </Text>
              ) : null}
              {detail?.experience ? (
                <View style={styles.inline}>
                  <Icon name="star" size={13} color="#F5A524" />
                  <Text style={[styles.caption, { color: muted }]}>
                    {t('doctorProfile.experienceLine', { experience: detail.experience })}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          <View style={styles.stats}>
            {stats.map(stat => (
              <View key={stat.label} style={[styles.stat, { backgroundColor: theme.colors.background }]}>
                <Text numberOfLines={1} style={[styles.statValue, { color: theme.colors.onSurface }]}>
                  {stat.value}
                </Text>
                <Text numberOfLines={1} style={[styles.statLabel, { color: muted }]}>
                  {stat.label}
                </Text>
              </View>
            ))}
          </View>

          {officeName ? (
            <View style={[styles.practice, { borderTopColor: theme.colors.outlineVariant }]}>
              <View style={[styles.practiceIcon, { backgroundColor: theme.colors.primaryContainer }]}>
                <Icon name="hospital-building" size={18} color={theme.colors.primary} />
              </View>
              <View style={styles.flex}>
                <Text style={[styles.statLabel, { color: muted }]}>
                  {t('doctorProfile.practicingAt')}
                </Text>
                <Text style={[styles.practiceName, { color: theme.colors.onSurface }]}>
                  {officeName}
                </Text>
                {detail?.departmentName ? (
                  <Text style={[styles.caption, { color: muted }]}>{detail.departmentName}</Text>
                ) : null}
              </View>
            </View>
          ) : null}
        </View>

        {/* ── Tabs: the choices made under Schedule survive a look at the others ── */}
        <View style={[styles.tabs, { backgroundColor: theme.colors.surfaceVariant }]}>
          {TABS.map(tab => {
            const active = tab.key === activeTab;
            return (
              <Pressable
                key={tab.key}
                onPress={() => viewModel.setActiveTab(tab.key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                style={[styles.tab, active && { backgroundColor: theme.colors.surface }]}
              >
                <Text
                  style={[
                    styles.tabText,
                    {
                      color: active ? theme.colors.primary : muted,
                      fontFamily: active ? fontFamilies.semibold : fontFamilies.regular,
                    },
                  ]}
                >
                  {t(tab.labelKey)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {activeTab === 'schedule' ? <DoctorSchedulePanel viewModel={viewModel} /> : null}

        {activeTab === 'about' ? (
          <DoctorAboutPanel
            detail={detail}
            officeName={officeName}
            experienceYears={experienceYears}
          />
        ) : null}

        {activeTab === 'reviews' ? (
          <View style={styles.reviews}>
            <Icon name="star-outline" size={36} color={muted} />
            <Text style={[styles.reviewsTitle, { color: theme.colors.onSurface }]}>
              {t('doctorProfile.reviewsSoonTitle')}
            </Text>
            <Text style={[styles.caption, styles.centeredText, { color: muted }]}>
              {t('doctorProfile.reviewsSoonBody')}
            </Text>
          </View>
        ) : null}
      </ScrollView>

      {/* ── The way on: open while a date and a window are chosen ── */}
      <View
        style={[
          styles.footer,
          {
            backgroundColor: theme.colors.surface,
            borderTopColor: theme.colors.outlineVariant,
            paddingBottom: insets.bottom + TAB_BAR_CLEARANCE - 24,
          },
        ]}
      >
        {viewModel.canBook ? null : (
          <Text style={[styles.caption, styles.footerHint, { color: muted }]}>
            {t('doctorProfile.selectFirst')}
          </Text>
        )}
        <CustomButton
          mode="contained"
          onPress={viewModel.openConfirmation}
          disabled={!viewModel.canBook}
          style={styles.footerButton}
        >
          {currentFee > 0
            ? `${t('doctorProfile.appointment')}  •  ${taka(currentFee)}`
            : t('doctorProfile.appointment')}
        </CustomButton>
      </View>

      {/* ── Confirmation: nothing is sent until this is confirmed ── */}
      <CustomBottomSheet visible={viewModel.isConfirming} onClose={viewModel.closeConfirmation}>
        <Text style={[styles.sheetTitle, { color: theme.colors.onSurface }]}>
          {t('doctorProfile.confirmationTitle')}
        </Text>
        <View style={[styles.summary, { borderColor: theme.colors.outlineVariant }]}>
          {summary.map((row, index) => (
            <View
              key={row.label}
              style={[
                styles.summaryRow,
                index > 0 && { borderTopWidth: 1, borderTopColor: theme.colors.outlineVariant },
              ]}
            >
              <Text style={[styles.caption, { color: muted }]}>{row.label}</Text>
              <Text style={[styles.summaryValue, { color: theme.colors.onSurface }]}>{row.value}</Text>
            </View>
          ))}
          <View style={[styles.summaryRow, { borderTopWidth: 1, borderTopColor: theme.colors.outlineVariant }]}>
            <Text style={[styles.priceLabel, { color: theme.colors.onSurface }]}>
              {t('doctorProfile.price')}
            </Text>
            <Text style={[styles.priceValue, { color: theme.colors.primary }]}>
              {currentFee > 0 ? taka(currentFee) : '—'}
            </Text>
          </View>
        </View>
        <CustomButton
          mode="contained"
          onPress={handleConfirm}
          loading={viewModel.isBooking}
          style={styles.footerButton}
        >
          {t(viewModel.isBooking ? 'doctorProfile.booking' : 'doctorProfile.confirmBooking')}
        </CustomButton>
      </CustomBottomSheet>

      <CustomDialog
        visible={errorDialog.visible}
        title={t('doctorProfile.errorTitle')}
        message={errorDialog.message}
        confirmText={t('common.ok')}
        onConfirm={errorDialog.dismiss}
        onDismiss={errorDialog.dismiss}
        showCancel={false}
      />
    </SafeAreaView>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  centeredText: {
    textAlign: 'center',
  },
  stateButton: {
    marginTop: 16,
    borderRadius: 12,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  name: {
    fontFamily: fontFamilies.bold,
    fontSize: 17,
  },
  specialty: {
    fontFamily: fontFamilies.medium,
    fontSize: 13,
    marginTop: 2,
  },
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  caption: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
  },
  stats: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 6,
  },
  statValue: {
    fontFamily: fontFamilies.semibold,
    fontSize: 13,
  },
  statLabel: {
    fontFamily: fontFamilies.regular,
    fontSize: 11,
    marginTop: 2,
  },
  practice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderTopWidth: 1,
    marginTop: 14,
    paddingTop: 12,
  },
  practiceIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  practiceName: {
    fontFamily: fontFamilies.semibold,
    fontSize: 13.5,
  },
  tabs: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 4,
    marginTop: 14,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 10,
    paddingVertical: 9,
  },
  tabText: {
    fontSize: 13,
  },
  reviews: {
    alignItems: 'center',
    paddingVertical: 36,
    gap: 6,
  },
  reviewsTitle: {
    fontFamily: fontFamilies.semibold,
    fontSize: 15,
  },
  footer: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  footerHint: {
    textAlign: 'center',
    marginBottom: 6,
  },
  footerButton: {
    marginVertical: 0,
    borderRadius: 12,
  },
  sheetTitle: {
    fontFamily: fontFamilies.bold,
    fontSize: 17,
    marginBottom: 12,
  },
  summary: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 11,
  },
  summaryValue: {
    flexShrink: 1,
    fontFamily: fontFamilies.semibold,
    fontSize: 13,
    textAlign: 'right',
  },
  priceLabel: {
    fontFamily: fontFamilies.semibold,
    fontSize: 14,
  },
  priceValue: {
    fontFamily: fontFamilies.bold,
    fontSize: 16,
  },
});

export default DoctorDetails;
