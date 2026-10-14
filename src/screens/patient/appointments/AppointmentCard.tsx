import React, { memo, useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  AppointmentSummary,
  formatLongDate,
  getFileUrl,
  groupThousands,
  stripHonorific,
  to12Hour,
} from '@app/core';
import { CustomAvatar, fontFamilies } from '@app/ui';
import {
  STATUS_LABEL_KEY,
  appointmentType,
  doctorDisplayName,
  isRemoteType,
  statusTone,
} from './appointmentUi';

interface AppointmentCardProps {
  appointment: AppointmentSummary;
  months: string[];
  onPress: (appointment: AppointmentSummary) => void;
}

/**
 * A date / time / token tile under the doctor. `weight` is its share of the
 * row: the date is the longest value and on a 360dp phone an equal third cut
 * it to "Oct 15, 20…"; a value still too long (a long month name) shrinks a
 * little instead.
 */
const Tile = memo<{ icon: string; label: string; value: string; weight?: number }>(function Tile({
  icon,
  label,
  value,
  weight = 1,
}) {
  const theme = useTheme();
  return (
    <View style={[styles.tile, { flex: weight, backgroundColor: theme.colors.surfaceVariant }]}>
      <View style={styles.tileLabelRow}>
        <Icon name={icon} size={12} color={theme.colors.onSurfaceVariant} />
        <Text style={[styles.tileLabel, { color: theme.colors.onSurfaceVariant }]}>{label}</Text>
      </View>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
        style={[styles.tileValue, { color: theme.colors.onSurface }]}
      >
        {value}
      </Text>
    </View>
  );
});

/**
 * One booking, as the portal's list shows it. The list's patient fields are
 * not reliable, so — like the portal — there is no "for whom" line here; the
 * detail has it.
 */
export const AppointmentCard = memo<AppointmentCardProps>(function AppointmentCard({
  appointment,
  months,
  onPress,
}) {
  const theme = useTheme();
  const { t } = useTranslation();

  const handlePress = useCallback(() => onPress(appointment), [onPress, appointment]);

  const tone = statusTone(appointment?.status, theme.dark);
  const type = appointmentType(appointment?.type);
  const photoUri = getFileUrl(appointment?.doctorPhotoUrl);
  const name = doctorDisplayName(appointment?.doctorName) || t('appointments.doctor');
  const fee = appointment?.fee ?? 0;

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: theme.colors.surface, opacity: pressed ? 0.92 : 1 },
      ]}
    >
      <View style={styles.topRow}>
        <CustomAvatar
          type={photoUri ? 'image' : 'text'}
          value={photoUri || stripHonorific(appointment?.doctorName) || '?'}
          fallback={stripHonorific(appointment?.doctorName)}
          size={48}
        />
        <View style={styles.identity}>
          <Text numberOfLines={1} style={[styles.name, { color: theme.colors.onSurface }]}>
            {name}
          </Text>
          <Text numberOfLines={1} style={[styles.specialty, { color: theme.colors.primary }]}>
            {appointment?.doctorSpecialty || appointment?.doctorDesignation}
          </Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: tone.tint }]}>
          <View style={[styles.statusDot, { backgroundColor: tone.color }]} />
          <Text style={[styles.statusText, { color: tone.color }]}>
            {t(STATUS_LABEL_KEY[appointment?.status] ?? STATUS_LABEL_KEY.pending)}
          </Text>
        </View>
      </View>

      <View style={styles.badgeRow}>
        <View style={[styles.typeBadge, { backgroundColor: theme.colors.primaryContainer }]}>
          <Icon name={type.icon} size={12} color={theme.colors.primary} />
          <Text style={[styles.typeText, { color: theme.colors.primary }]}>{t(type.labelKey)}</Text>
        </View>
        {isRemoteType(appointment?.type) ? (
          <View style={styles.whereRow}>
            <Icon name="monitor-cellphone" size={13} color={theme.colors.onSurfaceVariant} />
            <Text style={[styles.whereText, { color: theme.colors.onSurfaceVariant }]}>
              {t('appointments.remote')}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.tiles}>
        <Tile
          icon="calendar-blank-outline"
          label={t('appointments.date')}
          value={formatLongDate(appointment?.date ?? '', months) || '—'}
          weight={1.35}
        />
        <Tile
          icon="clock-outline"
          label={t('appointments.time')}
          value={to12Hour(appointment?.time ?? '') || '—'}
        />
        <Tile
          icon="ticket-confirmation-outline"
          label={t('appointments.token')}
          value={appointment?.token ? `#${appointment.token}` : '—'}
        />
      </View>

      <View style={[styles.footer, { borderTopColor: theme.colors.outlineVariant }]}>
        <Text style={[styles.fee, { color: fee > 0 ? theme.colors.onSurface : theme.colors.onSurfaceVariant }]}>
          {fee > 0
            ? t('appointments.consultationFee', { amount: groupThousands(fee) })
            : t('appointments.feeNotRecorded')}
        </Text>
        <View style={styles.viewDetails}>
          <Text style={[styles.viewDetailsText, { color: theme.colors.primary }]}>
            {t('appointments.viewDetails')}
          </Text>
          <Icon name="chevron-right" size={16} color={theme.colors.primary} />
        </View>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
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
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  identity: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  name: {
    fontFamily: fontFamilies.bold,
    fontSize: 15,
  },
  specialty: {
    fontFamily: fontFamilies.medium,
    fontSize: 12,
    marginTop: 2,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 10.5,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  typeText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 11,
  },
  whereRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  whereText: {
    fontFamily: fontFamilies.medium,
    fontSize: 11.5,
  },
  tiles: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  tile: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  tileLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tileLabel: {
    fontFamily: fontFamilies.medium,
    fontSize: 10,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  tileValue: {
    fontFamily: fontFamilies.semibold,
    fontSize: 12.5,
    marginTop: 3,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 12,
    paddingTop: 10,
  },
  fee: {
    flexShrink: 1,
    fontFamily: fontFamilies.semibold,
    fontSize: 12.5,
    marginRight: 8,
  },
  viewDetails: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewDetailsText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 12.5,
  },
});

export default AppointmentCard;
