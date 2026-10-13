import React, { memo, useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  Appointment,
  AppointmentStatus,
  formatLongDate,
  formatMoney,
  getFileUrl,
  stripHonorific,
  to12Hour,
} from '@app/core';
import { CustomAvatar, fontFamilies } from '@app/ui';
import { getAppointmentTab } from './useAppointmentsViewModel';

interface AppointmentCardProps {
  appointment: Appointment;
  onViewDetails: (appointment: Appointment) => void;
}

type StatusColors = { color: string; tint: string };

export const STATUS_COLORS: Record<AppointmentStatus, StatusColors> = {
  pending: { color: '#B27400', tint: '#FEF3E0' },
  confirmed: { color: '#1B9C5D', tint: '#E6F7EE' },
  completed: { color: '#2F45E5', tint: '#E9EDFD' },
  cancelled: { color: '#B3261E', tint: '#FDECEF' },
  no_show: { color: '#5F6478', tint: '#EEEFF4' },
};

/**
 * The same five states on a dark surface. The light tints are near-white, so
 * reusing them there turns every chip into a glaring block — these are the
 * status hue lightened for the text and darkened for the fill instead.
 */
export const STATUS_COLORS_DARK: Record<AppointmentStatus, StatusColors> = {
  pending: { color: '#F5C26B', tint: '#3A2E14' },
  confirmed: { color: '#5FD39B', tint: '#12321F' },
  completed: { color: '#9FB0FF', tint: '#232A52' },
  cancelled: { color: '#F2B8B5', tint: '#3A1F1E' },
  no_show: { color: '#B9BFD4', tint: '#272B3A' },
};

/** Outstanding-amount orange. The light one goes muddy on a dark surface. */
export const getDueColor = (isDark?: boolean): string =>
  isDark ? '#F0A44A' : '#D9730D';

/** Status chip colors for the theme in play — pending covers unknown values. */
export const getStatusColors = (
  status: AppointmentStatus,
  isDark?: boolean,
): StatusColors => {
  const palette = isDark ? STATUS_COLORS_DARK : STATUS_COLORS;
  return palette[status] ?? palette.pending;
};

export const STATUS_LABEL_KEY: Record<AppointmentStatus, string> = {
  pending: 'appointments.status.pending',
  confirmed: 'appointments.status.confirmed',
  completed: 'appointments.status.completed',
  cancelled: 'appointments.status.cancelled',
  no_show: 'appointments.status.noShow',
};

/**
 * `strType` is free text, so this covers the values in use today and anything
 * else falls back to the raw string rather than rendering an empty chip.
 */
export const TYPE_LABEL_KEY: Record<string, string> = {
  in_person: 'appointments.type.inPerson',
  follow_up: 'appointments.type.followUp',
  report: 'appointments.type.report',
  audio: 'appointments.type.audio',
  video: 'appointments.type.video',
  visit: 'appointments.type.visit',
};

export const TYPE_ICON: Record<string, string> = {
  in_person: 'hospital-building',
  follow_up: 'repeat-variant',
  report: 'file-document-outline',
  audio: 'phone-outline',
  video: 'video-outline',
  visit: 'hospital-building',
};

export const AppointmentCard = memo<AppointmentCardProps>(function AppointmentCard({
  appointment,
  onViewDetails,
}) {
  const theme = useTheme();
  const { t } = useTranslation();

  const handleViewDetails = useCallback(
    () => onViewDetails(appointment),
    [onViewDetails, appointment],
  );

  /**
   * A pending row that is past its date sits in the Absent tab, so the chip
   * reads "Absent" too rather than contradicting the tab it was listed under.
   */
  const tab = getAppointmentTab(appointment);
  const badgeStatus: AppointmentStatus =
    tab === 'absent' ? 'no_show' : appointment?.status;
  const status = getStatusColors(badgeStatus, theme.dark);
  const statusLabelKey = STATUS_LABEL_KEY[badgeStatus] ?? STATUS_LABEL_KEY.pending;
  const months = Array.from({ length: 12 }, (_, index) => t(`months.${index}`));
  const photoUri = getFileUrl(appointment?.doctorPhotoUrl);
  const typeKey = TYPE_LABEL_KEY[appointment?.type ?? ''];
  const typeLabel = typeKey ? t(typeKey) : appointment?.type ?? '';
  const location = [appointment?.locationName, appointment?.locationAddress]
    ?.filter(Boolean)
    ?.join(' · ');
  const dueAmount = appointment?.dueAmount ?? 0;
  /**
   * Older rows carry `dueAmount: 0` while still sitting at `paymentStatus:
   * "unpaid"`, so a zero due on its own must never read as settled — only
   * `paymentStatus === 'paid'` does. Those rows fall back to the full fee.
   */
  const isPaid = dueAmount <= 0 && appointment?.paid;
  const outstanding = dueAmount > 0 ? dueAmount : appointment?.fee ?? 0;

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
      <View style={styles.topRow}>
        <CustomAvatar
          type={photoUri ? 'image' : 'text'}
          value={photoUri || stripHonorific(appointment?.doctorName) || '?'}
          fallback={stripHonorific(appointment?.doctorName)}
          size={44}
        />
        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text numberOfLines={1} style={[styles.name, { color: theme.colors.onSurface }]}>
              {appointment?.doctorName || t('common.na')}
            </Text>
            <View style={[styles.statusChip, { backgroundColor: status?.tint }]}>
              <Text style={[styles.statusText, { color: status?.color }]}>
                {t(statusLabelKey)}
              </Text>
            </View>
          </View>
          <Text numberOfLines={1} style={[styles.specialty, { color: theme.colors.primary }]}>
            {appointment?.doctorSpecialty ?? ''}
          </Text>
          <Text numberOfLines={1} style={[styles.patient, { color: theme.colors.onSurfaceVariant }]}>
            {t('appointments.forPatient', { name: appointment?.patientName || t('common.na') })}
          </Text>
        </View>
      </View>

      <View style={styles.visitRow}>
        {!!typeLabel && (
          <View style={[styles.typeChip, { backgroundColor: theme.colors.surfaceVariant }]}>
            <Icon
              name={TYPE_ICON[appointment?.type ?? ''] ?? 'stethoscope'}
              size={11}
              color={theme.colors.onSurfaceVariant}
            />
            <Text style={[styles.typeText, { color: theme.colors.onSurfaceVariant }]}>
              {typeLabel}
            </Text>
          </View>
        )}
        {!!location && (
          <View style={styles.locationRow}>
            <Icon name="map-marker-outline" size={12} color={theme.colors.onSurfaceVariant} />
            <Text
              numberOfLines={1}
              style={[styles.locationText, { color: theme.colors.onSurfaceVariant }]}
            >
              {location}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Icon name="calendar-blank-outline" size={13} color={theme.colors.onSurfaceVariant} />
          <Text style={[styles.metaText, { color: theme.colors.onSurfaceVariant }]}>
            {formatLongDate(appointment?.date ?? '', months)}
          </Text>
        </View>
        <View style={styles.metaItem}>
          <Icon name="clock-outline" size={13} color={theme.colors.onSurfaceVariant} />
          <Text style={[styles.metaText, { color: theme.colors.onSurfaceVariant }]}>
            {to12Hour(appointment?.time ?? '')}
          </Text>
        </View>
        <View style={styles.metaItem}>
          <Icon name="ticket-confirmation-outline" size={13} color={theme.colors.onSurfaceVariant} />
          <Text style={[styles.metaText, { color: theme.colors.onSurfaceVariant }]}>
            {t('appointments.token', { no: appointment?.token ?? 0 })}
          </Text>
        </View>
      </View>

      <View style={[styles.bottomRow, { borderTopColor: theme.colors.outlineVariant }]}>
        {isPaid ? (
          <View style={styles.feeRow}>
            <Icon name="check-circle" size={14} color="#1B9C5D" />
            <Text style={[styles.fee, { color: theme.colors.onSurface }]}>
              {t('appointments.paid', { amount: formatMoney(appointment?.fee ?? 0) })}
            </Text>
          </View>
        ) : (
          <Text style={[styles.due, { color: getDueColor(theme.dark) }]}>
            {t('appointments.due', { amount: formatMoney(outstanding) })}
          </Text>
        )}
        <Pressable onPress={handleViewDetails} hitSlop={8}>
          <View style={styles.viewDetailsRow}>
            <Text style={[styles.viewDetails, { color: theme.colors.primary }]}>
              {t('appointments.viewDetails')}
            </Text>
            <Icon name="chevron-right" size={16} color={theme.colors.primary} />
          </View>
        </Pressable>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    elevation: 1,
    shadowColor: '#0B1030',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  info: {
    flex: 1,
    marginLeft: 10,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  name: {
    flex: 1,
    fontFamily: fontFamilies.bold,
    fontSize: 14,
    marginRight: 8,
  },
  statusChip: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  statusText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 9.5,
  },
  specialty: {
    fontFamily: fontFamilies.medium,
    fontSize: 12,
    marginTop: 1,
  },
  patient: {
    fontFamily: fontFamilies.regular,
    fontSize: 11,
    marginTop: 3,
  },
  visitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  typeText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 10,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 1,
  },
  locationText: {
    fontFamily: fontFamilies.medium,
    fontSize: 11,
    flexShrink: 1,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontFamily: fontFamilies.regular,
    fontSize: 11,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    marginTop: 10,
    paddingTop: 10,
  },
  feeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  fee: {
    fontFamily: fontFamilies.bold,
    fontSize: 13,
  },
  due: {
    fontFamily: fontFamilies.bold,
    fontSize: 13,
  },
  viewDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewDetails: {
    fontFamily: fontFamilies.semibold,
    fontSize: 12,
  },
});

export default AppointmentCard;
