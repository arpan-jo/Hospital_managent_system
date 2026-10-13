import React, { useCallback, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text, useTheme } from 'react-native-paper';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  AppointmentStatus,
  ConsultationVitals,
  formatLongDate,
  formatMoney,
  getFileUrl,
  stripHonorific,
  TestPriority,
  to12Hour,
  useStores,
} from '@app/core';
import { CustomAvatar, CustomButton, CustomDialog, CustomNoData, fontFamilies } from '@app/ui';
import ScreenHeader from '../../../components/ScreenHeader';
import { AppointmentsStackParamList } from '../../../navigation/AppointmentsStackNavigator';
import { useFocusedStatusBar } from '../../../hooks/useFocusedStatusBar';
import { useAppointmentDetailsViewModel } from './useAppointmentDetailsViewModel';
import {
  getDueColor,
  getStatusColors,
  STATUS_LABEL_KEY,
  TYPE_ICON,
  TYPE_LABEL_KEY,
} from './AppointmentCard';

/** The happy path a booking walks through, in order — the header's progress row. */
const STATUS_FLOW: AppointmentStatus[] = ['pending', 'confirmed', 'completed'];

/** One pre-assessment answer or the doctor's note; drawn only when it was given. */
const AssessmentField = React.memo<{ label: string; value: string; accent?: string }>(
  function AssessmentField({ label, value, accent }) {
    const theme = useTheme();
    if (!value) return null;

    return (
      <View style={[styles.assessment, { backgroundColor: theme.colors.surfaceVariant }]}>
        <Text style={[styles.assessmentLabel, { color: accent ?? theme.colors.onSurfaceVariant }]}>
          {label}
        </Text>
        <Text style={[styles.assessmentValue, { color: theme.colors.onSurface }]}>{value}</Text>
      </View>
    );
  },
);

/** One reading of the vitals grid; drawn only when it was taken. */
const VitalChip = React.memo<{ icon: string; label: string; value: string; color: string }>(
  function VitalChip({ icon, label, value, color }) {
    const theme = useTheme();
    if (!value) return null;

    return (
      <View style={[styles.vitalChip, { backgroundColor: theme.colors.surfaceVariant }]}>
        <Icon name={icon} size={13} color={color} />
        <View style={styles.vitalText}>
          <Text style={[styles.vitalLabel, { color: theme.colors.onSurfaceVariant }]}>{label}</Text>
          <Text style={[styles.vitalValue, { color: theme.colors.onSurface }]}>{value}</Text>
        </View>
      </View>
    );
  },
);

/** Test-order urgency, in the same tint/colour shape the status chip uses. */
const PRIORITY_COLORS: Record<TestPriority, { color: string; tint: string }> = {
  routine: { color: '#2F45E5', tint: '#E9EDFD' },
  urgent: { color: '#B27400', tint: '#FEF3E0' },
  stat: { color: '#B3261E', tint: '#FDECEF' },
};

export const AppointmentDetailsScreen = observer(() => {
  const theme = useTheme();
  const { t } = useTranslation();
  const route = useRoute<RouteProp<AppointmentsStackParamList, 'AppointmentDetails'>>();
  const navigation = useNavigation<NativeStackNavigationProp<AppointmentsStackParamList>>();
  const insets = useSafeAreaInsets();
  const { toastStore } = useStores();
  // Light background — needs dark icons so the status bar stays legible.
  useFocusedStatusBar(theme.dark ? 'light-content' : 'dark-content');

  const appointmentId = route?.params?.appointmentId ?? '';
  const viewModel = useAppointmentDetailsViewModel(appointmentId);
  const [isCancelDialogVisible, setIsCancelDialogVisible] = useState(false);

  const appointment = viewModel?.appointment;
  const months = Array.from({ length: 12 }, (_, index) => t(`months.${index}`));

  const handleCall = useCallback((phone?: string) => {
    if (!phone) return;
    Linking.openURL(`tel:${phone}`).catch(() => undefined);
  }, []);

  const handleConfirmCancel = useCallback(async () => {
    setIsCancelDialogVisible(false);
    const updated = await viewModel?.cancelAppointment();

    toastStore?.show(
      updated ? t('appointmentDetails.cancelled') : t('appointmentDetails.cancelFailed'),
      updated ? 'success' : 'error',
    );

    // Nothing is left to do on this screen once it is cancelled, so go back to
    // the list — its focus effect refetches, so the row lands under Cancelled.
    // A failure stays put so the patient can retry.
    if (updated && navigation?.canGoBack()) navigation.goBack();
  }, [viewModel, toastStore, t, navigation]);

  if (viewModel?.isLoading) {
    return (
      <SafeAreaView
        edges={['top', 'left', 'right']}
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        <ScreenHeader title={t('appointmentDetails.title')} leading="back" />
        <View style={styles.loader}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!appointment) {
    return (
      <SafeAreaView
        edges={['top', 'left', 'right']}
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        <ScreenHeader title={t('appointmentDetails.title')} leading="back" />
        <CustomNoData
          message={viewModel?.error ?? t('appointmentDetails.notFound')}
          style={styles.noData}
        />
      </SafeAreaView>
    );
  }

  const status = getStatusColors(appointment?.status, theme.dark);
  const statusLabelKey = STATUS_LABEL_KEY[appointment?.status] ?? STATUS_LABEL_KEY.pending;
  const stepIndex = STATUS_FLOW.indexOf(appointment?.status);
  const photoUri = getFileUrl(appointment?.doctorPhotoUrl);
  const typeKey = TYPE_LABEL_KEY[appointment?.type ?? ''];
  const typeLabel = typeKey ? t(typeKey) : appointment?.type ?? '';
  const dueAmount = appointment?.dueAmount ?? 0;
  /**
   * A zero due does not mean settled — older rows sit at `dueAmount: 0` with
   * `paymentStatus: "unpaid"`, so only `paid` counts as paid and those rows
   * show the full fee as outstanding.
   */
  const isPaid = dueAmount <= 0 && appointment?.paid;
  const outstanding = dueAmount > 0 ? dueAmount : appointment?.fee ?? 0;
  const hasPreAssessment = Boolean(
    appointment?.reason ||
      appointment?.symptoms ||
      appointment?.problemDescription ||
      appointment?.currentMedication ||
      appointment?.allergies,
  );

  const consultation = viewModel?.consultation;
  const hasSummary = Boolean(
    consultation?.diagnosis || consultation?.doctorAdvice || consultation?.notes,
  );
  const vitals: ConsultationVitals | null = consultation?.vitals ?? null;
  const prescriptions = consultation?.prescriptions ?? [];
  const testOrders = consultation?.testOrders ?? [];

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <ScreenHeader title={t('appointmentDetails.title')} leading="back" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        // +100 clears the floating tab bar — this stack is the Activity tab.
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
      >
        {/* Cancelled and absent fall outside the pending -> completed flow, so
            they show the plain status chip instead of a half-walked stepper. */}
        {stepIndex >= 0 ? (
          <View style={styles.stepperRow}>
            {STATUS_FLOW.map((step, index) => {
              const done = index <= stepIndex;
              const stepColor = getStatusColors(step, theme.dark);
              return (
                <React.Fragment key={step}>
                  {index > 0 && (
                    <Icon
                      name="chevron-right"
                      size={14}
                      color={theme.colors.onSurfaceVariant}
                    />
                  )}
                  <View
                    style={[
                      styles.step,
                      {
                        backgroundColor: done ? stepColor?.tint : theme.colors.surface,
                        borderColor: done ? stepColor?.tint : theme.colors.outlineVariant,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.stepDot,
                        { backgroundColor: done ? stepColor?.color : theme.colors.outlineVariant },
                      ]}
                    />
                    <Text
                      style={[
                        styles.stepText,
                        { color: done ? stepColor?.color : theme.colors.onSurfaceVariant },
                      ]}
                    >
                      {t(STATUS_LABEL_KEY[step])}
                    </Text>
                  </View>
                </React.Fragment>
              );
            })}
          </View>
        ) : (
          <View style={styles.stepperRow}>
            <View style={[styles.step, { backgroundColor: status?.tint, borderColor: status?.tint }]}>
              <View style={[styles.stepDot, { backgroundColor: status?.color }]} />
              <Text style={[styles.stepText, { color: status?.color }]}>{t(statusLabelKey)}</Text>
            </View>
          </View>
        )}

        <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.doctorRow}>
            <CustomAvatar
              type={photoUri ? 'image' : 'text'}
              value={photoUri || stripHonorific(appointment?.doctorName) || '?'}
              fallback={stripHonorific(appointment?.doctorName)}
              size={52}
            />
            <View style={styles.doctorInfo}>
              <Text numberOfLines={1} style={[styles.doctorName, { color: theme.colors.onSurface }]}>
                {appointment?.doctorName || t('common.na')}
              </Text>
              <Text numberOfLines={1} style={[styles.specialty, { color: theme.colors.primary }]}>
                {appointment?.doctorSpecialty ?? ''}
              </Text>
              {!!appointment?.doctorDesignation && (
                <Text
                  numberOfLines={1}
                  style={[styles.designation, { color: theme.colors.onSurfaceVariant }]}
                >
                  {appointment?.doctorDesignation}
                </Text>
              )}
              {!!appointment?.locationName && (
                <View style={styles.chamberRow}>
                  <Icon name="map-marker-outline" size={12} color={theme.colors.onSurfaceVariant} />
                  <Text
                    numberOfLines={2}
                    style={[styles.chamberText, { color: theme.colors.onSurfaceVariant }]}
                  >
                    {appointment?.locationName}
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.badgeColumn}>
              <View style={[styles.badge, { backgroundColor: theme.colors.surfaceVariant }]}>
                <Icon name="pound" size={11} color={theme.colors.onSurfaceVariant} />
                <Text style={[styles.badgeText, { color: theme.colors.onSurfaceVariant }]}>
                  {t('appointmentDetails.token', { no: appointment?.token ?? 0 })}
                </Text>
              </View>
              {!!typeLabel && (
                <View style={[styles.badge, { backgroundColor: theme.colors.surfaceVariant }]}>
                  <Icon
                    name={TYPE_ICON[appointment?.type ?? ''] ?? 'stethoscope'}
                    size={11}
                    color={theme.colors.onSurfaceVariant}
                  />
                  <Text style={[styles.badgeText, { color: theme.colors.onSurfaceVariant }]}>
                    {typeLabel}
                  </Text>
                </View>
              )}
            </View>
          </View>

          <View style={[styles.infoGrid, { borderTopColor: theme.colors.outlineVariant }]}>
            <View style={styles.infoCell}>
              <View style={styles.infoLabelRow}>
                <Icon name="calendar-blank-outline" size={12} color={theme.colors.onSurfaceVariant} />
                <Text style={[styles.infoLabel, { color: theme.colors.onSurfaceVariant }]}>
                  {t('appointmentDetails.date')}
                </Text>
              </View>
              <Text style={[styles.infoValue, { color: theme.colors.onSurface }]}>
                {formatLongDate(appointment?.date ?? '', months)}
              </Text>
            </View>
            <View style={styles.infoCell}>
              <View style={styles.infoLabelRow}>
                <Icon name="clock-outline" size={12} color={theme.colors.onSurfaceVariant} />
                <Text style={[styles.infoLabel, { color: theme.colors.onSurfaceVariant }]}>
                  {t('appointmentDetails.time')}
                </Text>
              </View>
              <Text style={[styles.infoValue, { color: theme.colors.onSurface }]}>
                {to12Hour(appointment?.time ?? '')}
              </Text>
            </View>
          </View>

          <View style={[styles.infoGrid, styles.infoGridSpaced]}>
            <View style={styles.infoCell}>
              <View style={styles.infoLabelRow}>
                <Icon name="alert-circle-outline" size={12} color={theme.colors.onSurfaceVariant} />
                <Text style={[styles.infoLabel, { color: theme.colors.onSurfaceVariant }]}>
                  {isPaid
                    ? t('appointmentDetails.amount')
                    : t('appointmentDetails.amountDue')}
                </Text>
              </View>
              <Text
                style={[
                  styles.infoValue,
                  { color: isPaid ? theme.colors.onSurface : getDueColor(theme.dark) },
                ]}
              >
                {`৳${formatMoney(isPaid ? appointment?.fee ?? 0 : outstanding)}`}
              </Text>
            </View>
            <View style={styles.infoCell}>
              <View style={styles.infoLabelRow}>
                <Icon name="map-marker-outline" size={12} color={theme.colors.onSurfaceVariant} />
                <Text style={[styles.infoLabel, { color: theme.colors.onSurfaceVariant }]}>
                  {t('appointmentDetails.location')}
                </Text>
              </View>
              <Text style={[styles.infoValue, { color: theme.colors.onSurface }]}>
                {appointment?.locationAddress || t('common.na')}
              </Text>
            </View>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.sectionTitleRow}>
            <Icon name="account-outline" size={16} color={theme.colors.onSurface} />
            <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
              {t('appointmentDetails.patientInformation')}
            </Text>
          </View>

          <View style={[styles.detailRow, { borderTopColor: theme.colors.outlineVariant }]}>
            <View style={styles.detailLabelRow}>
              <Icon name="account-outline" size={13} color={theme.colors.onSurfaceVariant} />
              <Text style={[styles.detailLabel, { color: theme.colors.onSurfaceVariant }]}>
                {t('appointmentDetails.fullName')}
              </Text>
            </View>
            <Text style={[styles.detailValue, { color: theme.colors.onSurface }]}>
              {appointment?.patientName || t('common.na')}
            </Text>
          </View>

          <View style={[styles.detailRow, { borderTopColor: theme.colors.outlineVariant }]}>
            <View style={styles.detailLabelRow}>
              <Icon name="pound" size={13} color={theme.colors.onSurfaceVariant} />
              <Text style={[styles.detailLabel, { color: theme.colors.onSurfaceVariant }]}>
                {t('appointmentDetails.patientCode')}
              </Text>
            </View>
            <Text style={[styles.detailValue, { color: theme.colors.primary }]}>
              {appointment?.patientCode || t('common.na')}
            </Text>
          </View>

          <View style={[styles.detailRow, { borderTopColor: theme.colors.outlineVariant }]}>
            <View style={styles.detailLabelRow}>
              <Icon name="heart-pulse" size={13} color={theme.colors.onSurfaceVariant} />
              <Text style={[styles.detailLabel, { color: theme.colors.onSurfaceVariant }]}>
                {t('appointmentDetails.age')}
              </Text>
            </View>
            <Text style={[styles.detailValue, { color: theme.colors.onSurface }]}>
              {t('appointmentDetails.ageValue', { count: appointment?.patientAge ?? 0 })}
            </Text>
          </View>

          <View style={[styles.detailRow, { borderTopColor: theme.colors.outlineVariant }]}>
            <View style={styles.detailLabelRow}>
              <Icon name="gender-male-female" size={13} color={theme.colors.onSurfaceVariant} />
              <Text style={[styles.detailLabel, { color: theme.colors.onSurfaceVariant }]}>
                {t('appointmentDetails.gender')}
              </Text>
            </View>
            <Text style={[styles.detailValue, { color: theme.colors.onSurface }]}>
              {appointment?.patientGender || t('common.na')}
            </Text>
          </View>

          <Pressable
            onPress={() => handleCall(appointment?.patientPhone)}
            style={[styles.detailRow, { borderTopColor: theme.colors.outlineVariant }]}
          >
            <View style={styles.detailLabelRow}>
              <Icon name="phone-outline" size={13} color={theme.colors.onSurfaceVariant} />
              <Text style={[styles.detailLabel, { color: theme.colors.onSurfaceVariant }]}>
                {t('appointmentDetails.phone')}
              </Text>
            </View>
            <Text style={[styles.detailValue, { color: theme.colors.primary }]}>
              {appointment?.patientPhone || t('common.na')}
            </Text>
          </Pressable>
        </View>

        {hasPreAssessment && (
          <View style={[styles.card, styles.assessmentCard, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.sectionTitleRow}>
              <Icon name="clipboard-text-outline" size={16} color={theme.colors.onSurface} />
              <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
                {t('appointmentDetails.preAssessment')}
              </Text>
            </View>
            <AssessmentField
              label={t('appointmentDetails.reason')}
              value={appointment?.reason ?? ''}
            />
            <AssessmentField
              label={t('appointmentDetails.symptoms')}
              value={appointment?.symptoms ?? ''}
            />
            <AssessmentField
              label={t('appointmentDetails.problemDescription')}
              value={appointment?.problemDescription ?? ''}
            />
            <AssessmentField
              label={t('appointmentDetails.currentMedication')}
              value={appointment?.currentMedication ?? ''}
            />
            {/* Allergies carry a warning colour of their own — they change
                what the doctor may prescribe. */}
            <AssessmentField
              label={t('appointmentDetails.allergies')}
              value={appointment?.allergies ?? ''}
              accent="#B27400"
            />
          </View>
        )}

        {!!appointment?.doctorNotes && (
          <View style={[styles.card, styles.assessmentCard, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.sectionTitleRow}>
              <Icon name="stethoscope" size={16} color={theme.colors.onSurface} />
              <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
                {t('appointmentDetails.doctorNotes')}
              </Text>
            </View>
            <Text style={[styles.notesText, { color: theme.colors.onSurfaceVariant }]}>
              {appointment.doctorNotes}
            </Text>
          </View>
        )}

        {hasSummary && (
          <View style={[styles.card, styles.assessmentCard, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.sectionTitleRow}>
              <Icon name="clipboard-pulse-outline" size={16} color={theme.colors.onSurface} />
              <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
                {t('appointmentDetails.consultation.summary')}
              </Text>
            </View>
            <AssessmentField
              label={t('appointmentDetails.consultation.diagnosis')}
              value={consultation?.diagnosis ?? ''}
              accent="#2F45E5"
            />
            <AssessmentField
              label={t('appointmentDetails.consultation.clinicalNotes')}
              value={consultation?.notes ?? ''}
            />
            <AssessmentField
              label={t('appointmentDetails.consultation.doctorAdvice')}
              value={consultation?.doctorAdvice ?? ''}
              accent="#1B9C5D"
            />
            {!!consultation?.followUpDate && (
              <View style={[styles.followUpBanner, { backgroundColor: theme.colors.primaryContainer }]}>
                <Icon name="calendar-check-outline" size={18} color={theme.colors.primary} />
                <View>
                  <Text style={[styles.followUpLabel, { color: theme.colors.primary }]}>
                    {t('appointmentDetails.consultation.followUpScheduled')}
                  </Text>
                  <Text style={[styles.followUpDate, { color: theme.colors.primary }]}>
                    {formatLongDate(consultation.followUpDate, months)}
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}

        {!!vitals && (
          <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.sectionTitleRow}>
              <Icon name="heart-pulse" size={16} color={theme.colors.onSurface} />
              <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
                {t('appointmentDetails.consultation.vitals')}
              </Text>
            </View>
            <View style={styles.vitalsGrid}>
              <VitalChip
                icon="heart-outline"
                label={t('appointmentDetails.consultation.bloodPressure')}
                value={vitals.bloodPressure}
                color="#B3261E"
              />
              <VitalChip
                icon="pulse"
                label={t('appointmentDetails.consultation.heartRate')}
                value={vitals.heartRate ? `${vitals.heartRate} bpm` : ''}
                color="#E85D75"
              />
              <VitalChip
                icon="thermometer"
                label={t('appointmentDetails.consultation.temperature')}
                value={vitals.temperature ? `${vitals.temperature}°C` : ''}
                color="#C2610A"
              />
              <VitalChip
                icon="weather-windy"
                label={t('appointmentDetails.consultation.oxygenSaturation')}
                value={vitals.oxygenSaturation ? `${vitals.oxygenSaturation}%` : ''}
                color="#2F45E5"
              />
              <VitalChip
                icon="lungs"
                label={t('appointmentDetails.consultation.respiratoryRate')}
                value={vitals.respiratoryRate ? `${vitals.respiratoryRate}/min` : ''}
                color="#0E7490"
              />
              <VitalChip
                icon="weight-kilogram"
                label={t('appointmentDetails.consultation.weight')}
                value={vitals.weight ? `${vitals.weight} kg` : ''}
                color="#7C3AED"
              />
              <VitalChip
                icon="human-male-height"
                label={t('appointmentDetails.consultation.height')}
                value={vitals.height ? `${vitals.height} cm` : ''}
                color="#1B9C5D"
              />
            </View>
          </View>
        )}

        {prescriptions.length > 0 && (
          <View style={[styles.card, styles.listCard, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.sectionTitleRow}>
              <Icon name="pill" size={16} color={theme.colors.onSurface} />
              <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
                {`${t('appointmentDetails.consultation.prescriptions')} (${prescriptions.length})`}
              </Text>
            </View>
            {prescriptions.map(item => (
              <View key={item?.id} style={[styles.listRow, { backgroundColor: theme.colors.surfaceVariant }]}>
                <Icon name="pill" size={15} color={theme.colors.primary} />
                <View style={styles.listInfo}>
                  <Text numberOfLines={1} style={[styles.listTitle, { color: theme.colors.onSurface }]}>
                    {item?.medicine || '—'}
                  </Text>
                  {!!item?.dosage && (
                    <Text
                      numberOfLines={1}
                      style={[styles.listSubtitle, { color: theme.colors.onSurfaceVariant }]}
                    >
                      {item.dosage}
                    </Text>
                  )}
                </View>
                <View style={styles.listTrailing}>
                  <Text style={[styles.listTrailingTop, { color: theme.colors.onSurface }]}>
                    {item?.frequency || ''}
                  </Text>
                  <Text style={[styles.listTrailingBottom, { color: theme.colors.onSurfaceVariant }]}>
                    {item?.duration || ''}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {testOrders.length > 0 && (
          <View style={[styles.card, styles.listCard, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.sectionTitleRow}>
              <Icon name="test-tube" size={16} color={theme.colors.onSurface} />
              <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
                {`${t('appointmentDetails.consultation.testOrders')} (${testOrders.length})`}
              </Text>
            </View>
            {testOrders.map(item => (
              <View key={item?.id} style={[styles.listRow, { backgroundColor: theme.colors.surfaceVariant }]}>
                <Icon name="test-tube" size={15} color="#7C3AED" />
                <View style={styles.listInfo}>
                  <Text numberOfLines={1} style={[styles.listTitle, { color: theme.colors.onSurface }]}>
                    {item?.testName || '—'}
                  </Text>
                  {!!item?.category && (
                    <Text
                      numberOfLines={1}
                      style={[styles.listSubtitle, { color: theme.colors.onSurfaceVariant }]}
                    >
                      {item.category}
                    </Text>
                  )}
                </View>
                <View style={[styles.priorityChip, { backgroundColor: PRIORITY_COLORS[item?.priority]?.tint }]}>
                  <Text style={[styles.priorityText, { color: PRIORITY_COLORS[item?.priority]?.color }]}>
                    {t(`appointmentDetails.consultation.priority.${item?.priority}`)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {viewModel?.canCancel && (
          <CustomButton
            mode="outlined"
            icon="close-circle-outline"
            onPress={() => setIsCancelDialogVisible(true)}
            loading={viewModel?.isCancelling}
            disabled={viewModel?.isCancelling}
            // Tonal danger: the fill is the error colour at low opacity so it
            // reads the same on both themes. The old pink card put a second
            // rounded box around the button and washed out in the dark theme.
            buttonColor={theme.dark ? 'rgba(242,184,181,0.10)' : '#FDECEF'}
            textColor={theme.colors.error}
            style={[styles.cancelButton, { borderColor: theme.colors.error }]}
            labelStyle={styles.cancelLabel}
          >
            {t('appointmentDetails.cancel')}
          </CustomButton>
        )}
      </ScrollView>

      <CustomDialog
        visible={isCancelDialogVisible}
        title={t('appointmentDetails.cancelTitle')}
        message={t('appointmentDetails.cancelMessage')}
        confirmText={t('appointmentDetails.cancel')}
        cancelText={t('common.cancel')}
        onConfirm={handleConfirmCancel}
        onDismiss={() => setIsCancelDialogVisible(false)}
      />
    </SafeAreaView>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loader: {
    paddingVertical: 40,
  },
  noData: {
    marginTop: 40,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 12,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  stepDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  stepText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 11,
  },
  card: {
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    elevation: 1,
    shadowColor: '#0B1030',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  doctorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  doctorInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  doctorName: {
    fontFamily: fontFamilies.bold,
    fontSize: 15,
  },
  specialty: {
    fontFamily: fontFamilies.semibold,
    fontSize: 12,
    marginTop: 2,
  },
  designation: {
    fontFamily: fontFamilies.regular,
    fontSize: 11.5,
    marginTop: 1,
  },
  chamberRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
    marginTop: 6,
  },
  chamberText: {
    flex: 1,
    fontFamily: fontFamilies.regular,
    fontSize: 11.5,
    lineHeight: 16,
  },
  badgeColumn: {
    alignItems: 'flex-end',
    gap: 6,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  badgeText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 10,
  },
  infoGrid: {
    flexDirection: 'row',
    borderTopWidth: 1,
    marginTop: 14,
    paddingTop: 12,
  },
  infoGridSpaced: {
    borderTopWidth: 0,
    marginTop: 12,
    paddingTop: 0,
  },
  infoCell: {
    flex: 1,
    paddingRight: 8,
  },
  infoLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  infoLabel: {
    fontFamily: fontFamilies.regular,
    fontSize: 10,
    letterSpacing: 0.4,
  },
  infoValue: {
    fontFamily: fontFamilies.semibold,
    fontSize: 13,
    marginTop: 3,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingBottom: 12,
  },
  sectionTitle: {
    fontFamily: fontFamilies.bold,
    fontSize: 14,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    paddingVertical: 11,
    gap: 12,
  },
  detailLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailLabel: {
    fontFamily: fontFamilies.regular,
    fontSize: 12.5,
  },
  detailValue: {
    flex: 1,
    fontFamily: fontFamilies.semibold,
    fontSize: 13,
    textAlign: 'right',
  },
  assessmentCard: {
    gap: 8,
  },
  assessment: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  assessmentLabel: {
    fontFamily: fontFamilies.semibold,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  assessmentValue: {
    fontFamily: fontFamilies.regular,
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 3,
  },
  notesText: {
    fontFamily: fontFamilies.regular,
    fontSize: 13,
    lineHeight: 19,
  },
  followUpBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  followUpLabel: {
    fontFamily: fontFamilies.medium,
    fontSize: 10,
  },
  followUpDate: {
    fontFamily: fontFamilies.bold,
    fontSize: 13,
    marginTop: 1,
  },
  vitalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  vitalChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    // Two per row, so a long reading never squeezes its label onto two lines.
    width: '48%',
    flexGrow: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  vitalText: {
    flex: 1,
  },
  vitalLabel: {
    fontFamily: fontFamilies.regular,
    fontSize: 9.5,
  },
  vitalValue: {
    fontFamily: fontFamilies.semibold,
    fontSize: 12.5,
  },
  listCard: {
    gap: 8,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  listInfo: {
    flex: 1,
  },
  listTitle: {
    fontFamily: fontFamilies.semibold,
    fontSize: 12.5,
  },
  listSubtitle: {
    fontFamily: fontFamilies.regular,
    fontSize: 10.5,
    marginTop: 1,
  },
  listTrailing: {
    alignItems: 'flex-end',
  },
  listTrailingTop: {
    fontFamily: fontFamilies.medium,
    fontSize: 11,
  },
  listTrailingBottom: {
    fontFamily: fontFamilies.regular,
    fontSize: 9.5,
    marginTop: 1,
  },
  priorityChip: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  priorityText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 9.5,
  },
  cancelButton: {
    marginTop: 0,
    marginBottom: 14,
    paddingVertical: 0,
    borderRadius: 12,
  },
  cancelLabel: {
    fontSize: 13,
    fontFamily: fontFamilies.semibold,
    marginVertical: 10,
  },
});

export default AppointmentDetailsScreen;
