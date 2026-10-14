import React, { memo, useCallback, useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text, useTheme } from 'react-native-paper';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  AppointmentDetail,
  AppointmentStatus,
  formatLongDate,
  getFileUrl,
  groupThousands,
  stripHonorific,
  to12Hour,
} from '@app/core';
import { CustomAvatar, CustomButton, CustomDialog, fontFamilies } from '@app/ui';
import ScreenHeader from '../../../components/ScreenHeader';
import { AppointmentsStackParamList } from '../../../navigation/AppointmentsStackNavigator';
import { TAB_BAR_CLEARANCE } from '../../../navigation/tabBarLayout';
import { useFocusedStatusBar } from '../../../hooks/useFocusedStatusBar';
import { useAppointmentDetailsViewModel } from './useAppointmentDetailsViewModel';
import {
  STATUS_LABEL_KEY,
  appointmentType,
  doctorDisplayName,
  isRemoteType,
  paymentBadge,
  statusTone,
} from './appointmentUi';

type DetailTab = 'overview' | 'consultation' | 'prescriptions';

const DETAIL_TABS: { key: DetailTab; labelKey: string; icon: string }[] = [
  { key: 'overview', labelKey: 'appointmentDetails.tabOverview', icon: 'view-dashboard-outline' },
  { key: 'consultation', labelKey: 'appointmentDetails.tabConsultation', icon: 'stethoscope' },
  { key: 'prescriptions', labelKey: 'appointmentDetails.tabPrescriptions', icon: 'pill' },
];

const money = (amount: number) => `৳${groupThousands(amount)}`;

// ─── Small pieces ──────────────────────────────────────────────────────────

const Card = memo<{ title?: string; icon?: string; children: React.ReactNode }>(function Card({
  title,
  icon,
  children,
}) {
  const theme = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
      {title ? (
        <View style={styles.cardTitleRow}>
          {icon ? <Icon name={icon} size={16} color={theme.colors.primary} /> : null}
          <Text style={[styles.cardTitle, { color: theme.colors.onSurface }]}>{title}</Text>
        </View>
      ) : null}
      {children}
    </View>
  );
});

/** A label on the left, its value on the right; hidden when there is no value. */
const Row = memo<{
  label: string;
  value?: string;
  strong?: boolean;
  last?: boolean;
  right?: React.ReactNode;
  onPress?: () => void;
}>(function Row({ label, value, strong, last, right, onPress }) {
  const theme = useTheme();
  if (!value && !right) return null;

  const valueText = (
    <Text
      style={[
        strong ? styles.rowValueStrong : styles.rowValue,
        { color: onPress ? theme.colors.primary : theme.colors.onSurface },
      ]}
    >
      {value}
    </Text>
  );

  return (
    <View
      style={[
        styles.row,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.outlineVariant },
      ]}
    >
      <Text style={[styles.rowLabel, { color: theme.colors.onSurfaceVariant }]}>{label}</Text>
      <View style={styles.rowRight}>
        {value ? (onPress ? <Pressable onPress={onPress} hitSlop={6}>{valueText}</Pressable> : valueText) : null}
        {right}
      </View>
    </View>
  );
});

const Tile = memo<{ icon: string; label: string; value: string }>(function Tile({ icon, label, value }) {
  const theme = useTheme();
  return (
    <View style={[styles.tile, { backgroundColor: theme.colors.surfaceVariant }]}>
      <Icon name={icon} size={16} color={theme.colors.primary} />
      <Text style={[styles.tileLabel, { color: theme.colors.onSurfaceVariant }]}>{label}</Text>
      <Text numberOfLines={1} style={[styles.tileValue, { color: theme.colors.onSurface }]}>
        {value}
      </Text>
    </View>
  );
});

const EmptyPanel = memo<{ icon: string; title: string; description: string }>(function EmptyPanel({
  icon,
  title,
  description,
}) {
  const theme = useTheme();
  return (
    <View style={[styles.card, styles.emptyPanel, { backgroundColor: theme.colors.surface }]}>
      <View style={[styles.emptyIcon, { backgroundColor: theme.colors.primaryContainer }]}>
        <Icon name={icon} size={24} color={theme.colors.primary} />
      </View>
      <Text style={[styles.emptyTitle, { color: theme.colors.onSurface }]}>{title}</Text>
      <Text style={[styles.emptyDesc, { color: theme.colors.onSurfaceVariant }]}>{description}</Text>
    </View>
  );
});

/** Pending → confirmed → completed; a cancelled or missed visit gets one banner instead. */
const StatusTimeline = memo<{ status: AppointmentStatus }>(function StatusTimeline({ status }) {
  const theme = useTheme();
  const { t } = useTranslation();

  if (status === 'cancelled' || status === 'no_show') {
    const tone = statusTone(status, theme.dark);
    return (
      <View style={[styles.banner, { backgroundColor: tone.tint }]}>
        <Icon
          name={status === 'cancelled' ? 'close-circle-outline' : 'account-off-outline'}
          size={18}
          color={tone.color}
        />
        <Text style={[styles.bannerText, { color: tone.color }]}>
          {t(status === 'cancelled' ? 'appointmentDetails.bannerCancelled' : 'appointmentDetails.bannerAbsent')}
        </Text>
      </View>
    );
  }

  const steps: AppointmentStatus[] = ['pending', 'confirmed', 'completed'];
  const reached = steps.indexOf(status);

  return (
    <View style={styles.timeline}>
      {steps.map((step, index) => {
        const done = index <= reached;
        const color = done ? theme.colors.primary : theme.colors.outlineVariant;
        return (
          <React.Fragment key={step}>
            <View style={styles.step}>
              <View
                style={[
                  styles.stepDot,
                  { backgroundColor: done ? theme.colors.primary : theme.colors.surface, borderColor: color },
                ]}
              >
                {done ? <Icon name="check" size={12} color={theme.colors.onPrimary} /> : null}
              </View>
              <Text
                style={[
                  styles.stepLabel,
                  { color: done ? theme.colors.onSurface : theme.colors.onSurfaceVariant },
                ]}
              >
                {t(STATUS_LABEL_KEY[step])}
              </Text>
            </View>
            {index < steps.length - 1 ? (
              <View
                style={[
                  styles.stepLine,
                  { backgroundColor: index < reached ? theme.colors.primary : theme.colors.outlineVariant },
                ]}
              />
            ) : null}
          </React.Fragment>
        );
      })}
    </View>
  );
});

// ─── The screen ────────────────────────────────────────────────────────────

/** One appointment in full, as the portal's detail page shows it. */
export const AppointmentDetailsScreen = observer(() => {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<AppointmentsStackParamList, 'AppointmentDetails'>>();
  const insets = useSafeAreaInsets();
  useFocusedStatusBar(theme.dark ? 'light-content' : 'dark-content');

  const viewModel = useAppointmentDetailsViewModel(Number(route?.params?.appointmentId ?? 0));
  const detail = viewModel.detail;

  const [tab, setTab] = useState<DetailTab>('overview');
  const [isConfirmingCancel, setIsConfirmingCancel] = useState(false);
  const months = useMemo(() => Array.from({ length: 12 }, (_, index) => t(`months.${index}`)), [t]);

  const goBack = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
  }, [navigation]);

  const handleConfirmCancel = useCallback(() => {
    setIsConfirmingCancel(false);
    viewModel.cancel();
  }, [viewModel]);

  const containerStyle = [styles.container, { backgroundColor: theme.colors.background }];

  if (!detail) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={containerStyle}>
        <ScreenHeader title={t('appointmentDetails.title')} leading="back" />
        <View style={styles.state}>
          {viewModel.isLoading ? (
            <ActivityIndicator size="small" color={theme.colors.primary} />
          ) : (
            <>
              <View style={[styles.emptyIcon, { backgroundColor: theme.colors.errorContainer }]}>
                <Icon
                  name={viewModel.isNotFound ? 'calendar-question' : 'alert-circle-outline'}
                  size={24}
                  color={theme.colors.error}
                />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.colors.onSurface }]}>
                {viewModel.isNotFound
                  ? t('appointmentDetails.notFound')
                  : viewModel.error || t('common.somethingWentWrong')}
              </Text>
              {viewModel.isNotFound ? (
                <Text style={[styles.emptyDesc, { color: theme.colors.onSurfaceVariant }]}>
                  {t('appointmentDetails.notFoundDesc')}
                </Text>
              ) : null}
              <CustomButton
                mode="outlined"
                onPress={viewModel.isNotFound ? goBack : viewModel.reload}
                style={styles.stateButton}
              >
                {viewModel.isNotFound ? t('appointmentDetails.goBack') : t('common.retry')}
              </CustomButton>
            </>
          )}
        </View>
      </SafeAreaView>
    );
  }

  const status = detail.status;
  const tone = statusTone(status, theme.dark);
  const type = appointmentType(detail.type);
  const isRemote = isRemoteType(detail.type);
  const photoUri = getFileUrl(detail.doctorPhotoUrl);
  const date = formatLongDate(detail.date, months) || '—';
  const time = to12Hour(detail.time) || '—';
  const token = detail.token ? `#${detail.token}` : '—';
  const payment = paymentBadge(detail.paymentStatus, theme.dark);
  const showDesignation =
    !!detail.doctorDesignation && detail.doctorDesignation !== detail.doctorSpecialty;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={containerStyle}>
      <ScreenHeader
        title={t('appointmentDetails.title')}
        leading="back"
        right={
          <View style={[styles.statusPill, { backgroundColor: tone.tint }]}>
            <View style={[styles.statusDot, { backgroundColor: tone.color }]} />
            <Text style={[styles.statusText, { color: tone.color }]}>{t(STATUS_LABEL_KEY[status])}</Text>
          </View>
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + TAB_BAR_CLEARANCE }]}
      >
        {/* Doctor */}
        <Card>
          <View style={styles.doctorRow}>
            <CustomAvatar
              type={photoUri ? 'image' : 'text'}
              value={photoUri || stripHonorific(detail.doctorName) || '?'}
              fallback={stripHonorific(detail.doctorName)}
              size={60}
            />
            <View style={styles.doctorInfo}>
              <Text numberOfLines={2} style={[styles.doctorName, { color: theme.colors.onSurface }]}>
                {doctorDisplayName(detail.doctorName) || t('appointments.doctor')}
              </Text>
              {detail.doctorSpecialty ? (
                <Text numberOfLines={1} style={[styles.doctorSpecialty, { color: theme.colors.primary }]}>
                  {detail.doctorSpecialty}
                </Text>
              ) : null}
              {showDesignation ? (
                <Text numberOfLines={1} style={[styles.doctorDesignation, { color: theme.colors.onSurfaceVariant }]}>
                  {detail.doctorDesignation}
                </Text>
              ) : null}
              <View style={[styles.typeBadge, { backgroundColor: theme.colors.primaryContainer }]}>
                <Icon name={type.icon} size={12} color={theme.colors.primary} />
                <Text style={[styles.typeText, { color: theme.colors.primary }]}>{t(type.labelKey)}</Text>
              </View>
            </View>
          </View>

          <View style={styles.tiles}>
            <Tile icon="calendar-blank-outline" label={t('appointments.date')} value={date} />
            <Tile icon="clock-outline" label={t('appointments.time')} value={time} />
            <Tile icon="ticket-confirmation-outline" label={t('appointments.token')} value={token} />
          </View>

          {isRemote || detail.locationName ? (
            <View style={[styles.location, { backgroundColor: theme.colors.surfaceVariant }]}>
              <Icon
                name={isRemote ? 'monitor-cellphone' : 'map-marker-outline'}
                size={18}
                color={theme.colors.primary}
              />
              <View style={styles.locationBody}>
                <Text style={[styles.locationLabel, { color: theme.colors.onSurfaceVariant }]}>
                  {t(isRemote ? 'appointmentDetails.consultationMode' : 'appointmentDetails.visitLocation')}
                </Text>
                <Text style={[styles.locationName, { color: theme.colors.onSurface }]}>
                  {isRemote ? t('appointments.remote') : detail.locationName}
                </Text>
                {!isRemote && detail.locationAddress ? (
                  <Text style={[styles.locationAddress, { color: theme.colors.onSurfaceVariant }]}>
                    {detail.locationAddress}
                  </Text>
                ) : null}
              </View>
            </View>
          ) : null}
        </Card>

        {/* Booking summary */}
        <Card title={t('appointmentDetails.bookingSummary')} icon="receipt">
          <Row label={t('appointmentDetails.patient')} value={detail.patientName || '—'} />
          <Row label={t('appointmentDetails.patientCode')} value={detail.patientCode} />
          <Row label={t('appointmentDetails.consultation')} value={t(type.labelKey)} />
          <Row label={t('appointments.date')} value={date} />
          <Row label={t('appointments.time')} value={time} />
          <Row label={t('appointments.token')} value={detail.token ? token : ''} />
          {!isRemote ? <Row label={t('appointmentDetails.office')} value={detail.locationName} /> : null}
          <Row label={t('appointmentDetails.paid')} value={detail.paidAmount > 0 ? money(detail.paidAmount) : ''} />
          <Row label={t('appointmentDetails.due')} value={detail.dueAmount > 0 ? money(detail.dueAmount) : ''} />
          <Row
            label={t('appointmentDetails.fee')}
            value={detail.fee > 0 ? money(detail.fee) : '—'}
            strong
            last
            right={
              <View style={[styles.payBadge, { backgroundColor: payment.tone.tint }]}>
                <Text style={[styles.payText, { color: payment.tone.color }]}>{t(payment.labelKey)}</Text>
              </View>
            }
          />
        </Card>

        {/* Sections */}
        <View
          accessibilityRole="tablist"
          style={[styles.tabs, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}
        >
          {DETAIL_TABS.map(item => {
            const selected = tab === item.key;
            const color = selected ? theme.colors.onPrimary : theme.colors.onSurfaceVariant;
            return (
              <Pressable
                key={item.key}
                onPress={() => setTab(item.key)}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                style={[styles.tab, selected ? { backgroundColor: theme.colors.primary } : null]}
              >
                <Icon name={item.icon} size={14} color={color} />
                <Text numberOfLines={1} style={[styles.tabText, { color }]}>
                  {t(item.labelKey)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {tab === 'overview' ? (
          <OverviewTab detail={detail} />
        ) : tab === 'consultation' ? (
          <EmptyPanel
            icon="stethoscope"
            title={t('appointmentDetails.noConsultation')}
            description={t('appointmentDetails.noConsultationDesc')}
          />
        ) : (
          <EmptyPanel
            icon="pill"
            title={t('appointmentDetails.noPrescription')}
            description={t('appointmentDetails.noPrescriptionDesc')}
          />
        )}

        {viewModel.canCancel ? (
          <View style={styles.cancelBlock}>
            <CustomButton
              mode="outlined"
              icon="close-circle-outline"
              onPress={() => setIsConfirmingCancel(true)}
              loading={viewModel.isCancelling}
              disabled={viewModel.isCancelling}
              textColor={theme.colors.error}
              style={[styles.cancelButton, { borderColor: theme.colors.error }]}
            >
              {t('appointmentDetails.cancel')}
            </CustomButton>
            <Text style={[styles.cancelNote, { color: theme.colors.onSurfaceVariant }]}>
              {t('appointmentDetails.cancelNote')}
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <CustomDialog
        visible={isConfirmingCancel}
        title={t('appointmentDetails.cancelTitle')}
        message={t('appointmentDetails.cancelMessage')}
        confirmText={t('appointmentDetails.cancel')}
        cancelText={t('appointmentDetails.keep')}
        onConfirm={handleConfirmCancel}
        onDismiss={() => setIsConfirmingCancel(false)}
      />
    </SafeAreaView>
  );
});

/** Where the visit stands, who it is for, and what the patient wrote. */
const OverviewTab = memo<{ detail: AppointmentDetail }>(function OverviewTab({ detail }) {
  const theme = useTheme();
  const { t } = useTranslation();

  const callPatient = useCallback(() => {
    if (detail?.patientPhone) Linking.openURL(`tel:${detail.patientPhone}`).catch(() => {});
  }, [detail?.patientPhone]);

  const gender = detail?.patientGender
    ? `${detail.patientGender.charAt(0).toUpperCase()}${detail.patientGender.slice(1)}`
    : '';

  return (
    <>
      <Card title={t('appointmentDetails.status')} icon="progress-check">
        <StatusTimeline status={detail?.status} />
      </Card>

      <Card title={t('appointmentDetails.patientInformation')} icon="account-outline">
        <Row label={t('appointmentDetails.fullName')} value={detail?.patientName} />
        <Row label={t('appointmentDetails.patientCode')} value={detail?.patientCode} />
        <Row
          label={t('appointmentDetails.age')}
          value={detail?.patientAge !== null ? t('appointmentDetails.ageValue', { count: detail?.patientAge ?? 0 }) : ''}
        />
        <Row label={t('appointmentDetails.gender')} value={gender} />
        <Row label={t('appointmentDetails.bloodGroup')} value={detail?.patientBloodType} />
        <Row
          label={t('appointmentDetails.phone')}
          value={detail?.patientPhone}
          onPress={detail?.patientPhone ? callPatient : undefined}
          last
        />
      </Card>

      {detail?.reason ? (
        <Card title={t('appointmentDetails.reason')} icon="text-box-outline">
          <Text style={[styles.paragraph, { color: theme.colors.onSurface }]}>{detail.reason}</Text>
        </Card>
      ) : null}

      {detail?.doctorNotes ? (
        <Card title={t('appointmentDetails.doctorNotes')} icon="note-text-outline">
          <Text style={[styles.paragraph, { color: theme.colors.onSurface }]}>{detail.doctorNotes}</Text>
        </Card>
      ) : null}
    </>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  state: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  stateButton: {
    marginTop: 18,
    borderRadius: 12,
    minWidth: 150,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 11,
  },
  card: {
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#0B1030',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 6,
  },
  cardTitle: {
    fontFamily: fontFamilies.semibold,
    fontSize: 14,
  },
  doctorRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  doctorInfo: {
    flex: 1,
    marginLeft: 14,
  },
  doctorName: {
    fontFamily: fontFamilies.bold,
    fontSize: 16.5,
  },
  doctorSpecialty: {
    fontFamily: fontFamilies.medium,
    fontSize: 12.5,
    marginTop: 2,
  },
  doctorDesignation: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
    marginTop: 1,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 8,
  },
  typeText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 11,
  },
  tiles: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  tile: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 6,
    gap: 2,
  },
  tileLabel: {
    fontFamily: fontFamilies.medium,
    fontSize: 10,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  tileValue: {
    fontFamily: fontFamilies.semibold,
    fontSize: 12.5,
  },
  location: {
    flexDirection: 'row',
    gap: 10,
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
  },
  locationBody: {
    flex: 1,
  },
  locationLabel: {
    fontFamily: fontFamilies.medium,
    fontSize: 10.5,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  locationName: {
    fontFamily: fontFamilies.semibold,
    fontSize: 13.5,
    marginTop: 2,
  },
  locationAddress: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
    marginTop: 2,
    lineHeight: 17,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    gap: 12,
  },
  rowLabel: {
    fontFamily: fontFamilies.regular,
    fontSize: 12.5,
  },
  rowRight: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowValue: {
    flexShrink: 1,
    textAlign: 'right',
    fontFamily: fontFamilies.medium,
    fontSize: 13,
  },
  rowValueStrong: {
    flexShrink: 1,
    textAlign: 'right',
    fontFamily: fontFamilies.bold,
    fontSize: 15,
  },
  payBadge: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  payText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 10.5,
  },
  tabs: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 12,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    borderRadius: 10,
  },
  tabText: {
    flexShrink: 1,
    fontFamily: fontFamilies.semibold,
    fontSize: 12,
  },
  emptyPanel: {
    alignItems: 'center',
    paddingVertical: 28,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontFamily: fontFamilies.semibold,
    fontSize: 15,
    textAlign: 'center',
  },
  emptyDesc: {
    fontFamily: fontFamilies.regular,
    fontSize: 12.5,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    padding: 12,
    marginTop: 4,
  },
  bannerText: {
    flex: 1,
    fontFamily: fontFamilies.semibold,
    fontSize: 13,
  },
  timeline: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 8,
  },
  step: {
    alignItems: 'center',
    width: 74,
  },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepLabel: {
    fontFamily: fontFamilies.medium,
    fontSize: 11.5,
    marginTop: 6,
  },
  stepLine: {
    flex: 1,
    height: 2,
    marginTop: 11,
    marginHorizontal: -14,
  },
  paragraph: {
    fontFamily: fontFamilies.regular,
    fontSize: 13.5,
    lineHeight: 20,
  },
  cancelBlock: {
    marginTop: 4,
    alignItems: 'center',
  },
  cancelButton: {
    alignSelf: 'stretch',
    borderRadius: 12,
  },
  cancelNote: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
    marginTop: 8,
  },
});

export default AppointmentDetailsScreen;
