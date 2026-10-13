import React, { useCallback } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text, useTheme } from 'react-native-paper';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { getFileUrl } from '@app/core';
import {
  CustomAvatar,
  CustomButton,
  CustomDialog,
  CustomDivider,
  fontFamilies,
} from '@app/ui';
import ScreenHeader from '../../../components/ScreenHeader';
import { DoctorFlowStackParamList } from '../../../navigation/appointmentRoutes';
import { TAB_BAR_CLEARANCE } from '../../../navigation/tabBarLayout';
import { useFocusedStatusBar } from '../../../hooks/useFocusedStatusBar';
import { useConfirmAppointmentViewModel } from './useConfirmAppointmentViewModel';

const SummaryRow = ({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) => {
  const theme = useTheme();

  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: theme.colors.onSurfaceVariant }]}>{label}</Text>
      <Text
        style={[
          styles.rowValue,
          strong && styles.strong,
          { color: strong ? theme.colors.primary : theme.colors.onSurface },
        ]}
      >
        {value}
      </Text>
    </View>
  );
};

/**
 * Read-only recap between the appointment form and the success screen — the
 * "Booking Confirmation" panel from the web layout, which is its own step here
 * because the form above it already fills a phone screen on its own.
 */
export const ConfirmAppointment = observer(() => {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<DoctorFlowStackParamList>>();
  const route = useRoute<RouteProp<DoctorFlowStackParamList, 'ConfirmAppointment'>>();
  const insets = useSafeAreaInsets();
  // Light background — needs dark icons so the status bar stays legible.
  useFocusedStatusBar(theme.dark ? 'light-content' : 'dark-content');

  // Params are read defensively: a deep link can land here without them.
  const {
    doctorId = '',
    patientCode = '',
    patientName = '',
    locationId = '',
    consultationType = 'in_person',
    amount = 0,
    date = '',
    slotStart = '',
    slotLabel = '',
    location = '',
    locationAddress = '',
    chiefComplaint = '',
  } = route.params ?? {};

  const viewModel = useConfirmAppointmentViewModel({
    doctorId,
    patientCode,
    locationId,
    date,
    slotStart,
    consultationType,
    chiefComplaint,
    amount,
  });

  const doctor = viewModel?.doctor;
  const photoUri = getFileUrl(doctor?.photoUrl);

  const handleConfirm = useCallback(async () => {
    const created = await viewModel?.confirmBooking?.();
    // A failed booking keeps the user here with the error dialog up.
    if (!created) return;

    // Token, fee and payment status are decided server-side, so the success
    // screen shows the response rather than what this form held.
    navigation.navigate('BookingSuccess', {
      doctorId,
      appointmentId: created?.appointmentId,
      date: created?.date || date,
      slotLabel,
      token: created?.tokenNumber ?? 0,
      amount: created?.paymentAmount ?? amount,
      dueAmount: created?.dueAmount ?? 0,
      paymentStatus: created?.paymentStatus ?? '',
      // The server's own method/status strings — the success screen labels them.
      paymentMethod: created?.paymentMethod ?? '',
      location: created?.locationName || location,
      locationAddress: created?.locationAddress || locationAddress,
      doctorName: created?.doctorName,
      doctorSpecialty: created?.doctorSpecialty,
      patientName: created?.patientName || patientName,
    });
  }, [
    navigation,
    viewModel,
    doctorId,
    date,
    slotLabel,
    amount,
    location,
    locationAddress,
    patientName,
  ]);

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <ScreenHeader title={t('bookAppointment.bookingConfirmation')} leading="back" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + TAB_BAR_CLEARANCE },
        ]}
      >
        <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.doctorRow}>
            <CustomAvatar
              type={photoUri ? 'image' : 'text'}
              value={photoUri || doctor?.name || '?'}
              fallback={doctor?.name}
              size={44}
            />
            <View style={styles.doctorInfo}>
              {viewModel?.doctorRequest?.isLoading ? (
                <ActivityIndicator size="small" color={theme.colors.primary} />
              ) : (
                <>
                  <Text
                    numberOfLines={1}
                    style={[styles.doctorName, { color: theme.colors.onSurface }]}
                  >
                    {doctor?.name || t('common.na')}
                  </Text>
                  <Text style={[styles.doctorSpecialty, { color: theme.colors.primary }]}>
                    {doctor?.specialty ?? ''}
                  </Text>
                </>
              )}
            </View>
          </View>

          <CustomDivider marginVertical={12} />

          <SummaryRow label={t('bookAppointment.appointmentFor')} value={patientName || t('common.na')} />
          <SummaryRow label={t('createAppointment.consultationOption')} value={viewModel?.consultationLabel ?? ''} />
          <SummaryRow label={t('bookingSuccess.date')} value={date || t('common.na')} />
          <SummaryRow label={t('bookingSuccess.time')} value={slotLabel || t('common.na')} />
          <SummaryRow label={t('bookingSuccess.location')} value={location || t('common.na')} />
          {locationAddress ? (
            <SummaryRow
              label={t('createAppointment.chamberAddress')}
              value={locationAddress}
            />
          ) : null}
          <SummaryRow
            label={t('createAppointment.price')}
            value={viewModel?.amountLabel ?? ''}
            strong
          />
        </View>

        <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
            {t('bookAppointment.healthDetails')}
          </Text>
          <SummaryRow
            label={t('bookAppointment.chiefComplaint')}
            value={chiefComplaint || t('common.na')}
          />
        </View>

        <View style={[styles.notice, { backgroundColor: theme.colors.primaryContainer }]}>
          <Text style={[styles.noticeText, { color: theme.colors.primary }]}>
            {t('bookAppointment.paymentAtAppointment')}
          </Text>
        </View>

        <CustomButton
          mode="contained"
          onPress={handleConfirm}
          loading={viewModel?.bookingRequest?.isLoading}
          disabled={viewModel?.bookingRequest?.isLoading}
          style={styles.confirmButton}
        >
          {t('bookAppointment.confirmBooking')}
        </CustomButton>
        <CustomButton
          mode="outlined"
          onPress={navigation.goBack}
          disabled={viewModel?.bookingRequest?.isLoading}
          style={[styles.editButton, { borderColor: theme.colors.primary }]}
          textColor={theme.colors.primary}
        >
          {t('bookAppointment.editDetails')}
        </CustomButton>
      </ScrollView>

      <CustomDialog
        visible={Boolean(viewModel?.bookingRequest?.error)}
        title={t('bookAppointment.bookingFailed')}
        message={viewModel?.bookingRequest?.error ?? ''}
        confirmText={t('common.ok')}
        onConfirm={viewModel?.dismissError}
        onDismiss={viewModel?.dismissError}
        showCancel={false}
      />
    </SafeAreaView>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
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
    alignItems: 'center',
  },
  doctorInfo: {
    flex: 1,
    marginLeft: 12,
  },
  doctorName: {
    fontFamily: fontFamilies.bold,
    fontSize: 15,
  },
  doctorSpecialty: {
    fontFamily: fontFamilies.semibold,
    fontSize: 12,
    marginTop: 2,
  },
  sectionTitle: {
    fontFamily: fontFamilies.bold,
    fontSize: 14,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
    paddingVertical: 7,
  },
  rowLabel: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
  },
  rowValue: {
    flex: 1,
    fontFamily: fontFamilies.semibold,
    fontSize: 12,
    textAlign: 'right',
  },
  strong: {
    fontFamily: fontFamilies.bold,
    fontSize: 14,
  },
  notice: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
  },
  noticeText: {
    fontFamily: fontFamilies.medium,
    fontSize: 12,
    textAlign: 'center',
  },
  confirmButton: {
    marginVertical: 0,
    borderRadius: 12,
  },
  editButton: {
    marginVertical: 0,
    marginTop: 10,
    borderRadius: 12,
  },
});

export default ConfirmAppointment;
