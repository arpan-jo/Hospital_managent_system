import React, { memo, useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  getFileUrl,
  DoctorSummary,
  experienceLabel,
  groupThousands,
} from '@app/core';
import { CustomAvatar, CustomButton, fontFamilies } from '@app/ui';

/** "৳500", "৳500 - ৳1,000", or `none` when the doctor has set no fee. */
export const formatFeeRange = (minFee: number, maxFee: number, none: string): string => {
  if (!minFee && !maxFee) return none;
  if (!maxFee || minFee === maxFee) return `৳${groupThousands(minFee ?? 0)}`;
  return `৳${groupThousands(minFee ?? 0)} - ৳${groupThousands(maxFee ?? 0)}`;
};

/** Monday first, as the portal's card reads the week — indexes into the `days` locale block. */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

/**
 * The week on one line, the days the doctor sits in brand colour and the rest
 * faded, as on the portal's card. A doctor who has published no days says so.
 */
const WeekdayRow = memo<{ availableDays: number[] }>(function WeekdayRow({ availableDays }) {
  const theme = useTheme();
  const { t } = useTranslation();

  const openDays = useMemo(() => new Set(availableDays ?? []), [availableDays]);
  const openDayNames = WEEK_ORDER.filter(day => openDays.has(day))
    .map(day => t(`days.${day}`))
    .join(', ');

  return (
    <View style={styles.metaRow}>
      <Icon name="calendar-month-outline" size={12} color={theme.colors.onSurfaceVariant} />
      {openDays.size > 0 ? (
        <View
          accessible
          accessibilityLabel={t('findDoctors.availableOnDays', { days: openDayNames })}
          style={styles.weekRow}
        >
          {WEEK_ORDER.map(day => {
            const isOpen = openDays.has(day);
            return (
              <Text
                key={day}
                style={[
                  styles.weekDay,
                  isOpen ? styles.weekDayOpen : styles.weekDayClosed,
                  { color: isOpen ? theme.colors.primary : theme.colors.onSurfaceVariant },
                ]}
              >
                {t(`days.${day}`)}
              </Text>
            );
          })}
        </View>
      ) : (
        <Text
          numberOfLines={1}
          style={[styles.metaText, styles.weekDayClosed, { color: theme.colors.onSurfaceVariant }]}
        >
          {t('findDoctors.scheduleNotPublished')}
        </Text>
      )}
    </View>
  );
});

interface DoctorListItemProps {
  doctor: DoctorSummary;
  onPress: (doctor: DoctorSummary) => void;
  onBook: (doctor: DoctorSummary) => void;
}

export const DoctorListItem = memo<DoctorListItemProps>(
  function DoctorListItem({ doctor, onPress, onBook }) {
    const theme = useTheme();
    const { t } = useTranslation();

    const handlePress = useCallback(() => onPress(doctor), [onPress, doctor]);
    const handleBook = useCallback(() => onBook(doctor), [onBook, doctor]);

    const photoUri = getFileUrl(doctor?.photoUrl);

    // Where they sit, as the portal's card reads it: the first chamber, and
    // the hospital on the profile only when no chamber is published.
    const place = doctor?.locations?.[0] || doctor?.hospital || t('common.na');
    const metaLabel = `${
      doctor?.experienceYears
        ? `${experienceLabel(doctor?.experienceYears)} Exp.`
        : t('common.na')
    } • ${place}`;

    const feeLabel = useMemo(
      () => formatFeeRange(doctor?.minFee ?? 0, doctor?.maxFee ?? 0, t('common.na')),
      [doctor?.minFee, doctor?.maxFee, t],
    );

    return (
      <Pressable
        onPress={handlePress}
        style={[styles.card, { backgroundColor: theme.colors.surface }]}
      >
        <View style={styles.topRow}>
          <CustomAvatar
            type={photoUri ? 'image' : 'text'}
            value={photoUri || doctor?.name || '?'}
            fallback={doctor?.name}
            size={48}
          />
          <View style={styles.info}>
            <View style={styles.nameRow}>
              <Text
                numberOfLines={1}
                style={[styles.name, { color: theme.colors.onSurface }]}
              >
                {doctor?.name || t('common.na')}
              </Text>
              <View
                style={[
                  styles.availabilityBadge,
                  {
                    backgroundColor: doctor?.isAvailable
                      ? '#E6F7EE'
                      : theme.colors.surfaceVariant,
                  },
                ]}
              >
                <Text
                  numberOfLines={1}
                  style={[
                    styles.availabilityText,
                    {
                      color: doctor?.isAvailable
                        ? '#1B9C5D'
                        : theme.colors.onSurfaceVariant,
                    },
                  ]}
                >
                  {doctor?.isAvailable
                    ? t('findDoctors.available')
                    : t('findDoctors.notAvailable')}
                </Text>
              </View>
            </View>
            {/* The specialty and the degrees each keep a line, as on the
                portal's card — a doctor with degrees no longer loses the
                specialty a patient is choosing by. */}
            <Text
              numberOfLines={1}
              style={[
                styles.specialty,
                {
                  color: doctor?.specialty
                    ? theme.colors.primary
                    : theme.colors.onSurfaceVariant,
                },
              ]}
            >
              {doctor?.specialty || t('common.na')}
            </Text>
            {doctor?.qualification ? (
              <Text
                numberOfLines={1}
                style={[
                  styles.qualification,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                {doctor.qualification}
              </Text>
            ) : null}
            {/* Only when the source sends the days at all — see `availableDays`. */}
            {doctor?.availableDays ? (
              <WeekdayRow availableDays={doctor.availableDays} />
            ) : null}
            <View style={styles.metaRow}>
              <Icon
                name="hospital-building"
                size={12}
                color={theme.colors.onSurfaceVariant}
              />
              <Text
                numberOfLines={1}
                style={[
                  styles.metaText,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                {metaLabel}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.bottomRow}>
          <View>
            <Text
              style={[
                styles.feeLabel,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              {t('details.consultationFee')}
            </Text>
            <Text style={[styles.fee, { color: theme.colors.primary }]}>
              {feeLabel}
            </Text>
          </View>
          <CustomButton
            mode="contained"
            onPress={handleBook}
            style={styles.bookButton}
            labelStyle={styles.bookButtonLabel}
          >
            {t('findDoctors.bookAppointment')}
          </CustomButton>
        </View>
      </Pressable>
    );
  },
);

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
    marginLeft: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  name: {
    flex: 1,
    fontFamily: fontFamilies.bold,
    fontSize: 14,
  },
  availabilityBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  availabilityText: {
    fontFamily: fontFamilies.medium,
    fontSize: 9,
  },
  specialty: {
    fontFamily: fontFamilies.medium,
    fontSize: 11.5,
    marginTop: 2,
  },
  qualification: {
    fontFamily: fontFamilies.regular,
    fontSize: 11,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 5,
  },
  metaText: {
    fontFamily: fontFamilies.regular,
    fontSize: 11,
    flexShrink: 1,
  },
  weekRow: {
    flexDirection: 'row',
    // Bangla day names run longer — wrap rather than clip on a narrow phone.
    flexWrap: 'wrap',
    columnGap: 7,
    flexShrink: 1,
  },
  weekDay: {
    fontFamily: fontFamilies.regular,
    fontSize: 11,
  },
  weekDayOpen: {
    fontFamily: fontFamilies.semibold,
  },
  weekDayClosed: {
    opacity: 0.45,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  feeLabel: {
    fontFamily: fontFamilies.regular,
    fontSize: 10,
  },
  fee: {
    fontFamily: fontFamilies.bold,
    fontSize: 16,
    marginTop: 1,
  },
  bookButton: {
    marginVertical: 0,
    paddingVertical: 0,
    borderRadius: 999,
  },
  bookButtonLabel: {
    fontSize: 12,
    marginVertical: 8,
    marginHorizontal: 14,
  },
});

export default DoctorListItem;
