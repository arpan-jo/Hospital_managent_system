import React, { memo, useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  getFileUrl,
  groupThousands,
  PortalDoctor,
  stripHonorific,
} from '@app/core';
import { CustomAvatar, CustomButton, fontFamilies } from '@app/ui';
import { DAY_ORDER, dayIndexOf, todayAbbr } from './weekdays';

/** The green of "this doctor can be booked" — a status colour, the same in both themes. */
export const AVAILABLE_COLOR = '#1B9C5D';

/** "৳1,200". */
export const taka = (amount?: number | null): string =>
  `৳${groupThousands(amount ?? 0)}`;

/**
 * The week on one line, Monday first: the days the doctor sits in brand colour,
 * today among them as a filled pill, the rest faded. A doctor who cannot be
 * booked shows no days at all, whatever their schedule says.
 */
const WeekdayRow = memo<{ days: string[] }>(function WeekdayRow({ days }) {
  const theme = useTheme();
  const { t } = useTranslation();

  const openDays = useMemo(() => new Set(days ?? []), [days]);
  const today = todayAbbr();

  if (openDays.size === 0) {
    return (
      <View style={styles.metaRow}>
        <Icon name="calendar-month-outline" size={13} color={theme.colors.onSurfaceVariant} />
        <Text numberOfLines={1} style={[styles.metaText, { color: theme.colors.onSurfaceVariant }]}>
          {t('findDoctors.scheduleNotPublished')}
        </Text>
      </View>
    );
  }

  const openDayNames = DAY_ORDER.filter(day => openDays.has(day))
    .map(day => t(`days.${dayIndexOf(day)}`))
    .join(', ');

  return (
    <View style={styles.metaRow}>
      <Icon name="calendar-month-outline" size={13} color={theme.colors.onSurfaceVariant} />
      <View
        accessible
        accessibilityLabel={t('findDoctors.availableOnDays', { days: openDayNames })}
        style={styles.weekRow}
      >
        {DAY_ORDER.map(day => {
          const isOpen = openDays.has(day);
          const isToday = isOpen && day === today;

          return (
            <View
              key={day}
              style={[styles.weekDayPill, isToday && { backgroundColor: theme.colors.primary }]}
            >
              <Text
                style={[
                  styles.weekDay,
                  isOpen ? styles.weekDayOpen : styles.weekDayClosed,
                  {
                    color: isToday
                      ? theme.colors.onPrimary
                      : isOpen
                      ? theme.colors.primary
                      : theme.colors.onSurfaceVariant,
                  },
                ]}
              >
                {t(`days.${dayIndexOf(day)}`)}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
});

interface DoctorListItemProps {
  doctor: PortalDoctor;
  /** Opens the doctor's page — where the profile is read and the visit is booked. */
  onOpen: (doctor: PortalDoctor) => void;
}

export const DoctorListItem = memo<DoctorListItemProps>(
  function DoctorListItem({ doctor, onOpen }) {
    const theme = useTheme();
    const { t } = useTranslation();

    const handleOpen = useCallback(() => onOpen(doctor), [onOpen, doctor]);

    const photoUri = getFileUrl(doctor?.photoUrl);
    // "Dr. Ahsan Habib" would give every doctor the same initials.
    const initialsFrom = stripHonorific(doctor?.fullName) || doctor?.fullName || '?';
    const isAvailable = Boolean(doctor?.isAvailable);
    const experienceYears = doctor?.experienceYears ?? 0;
    const fee = doctor?.consultationFee ?? 0;

    return (
      <Pressable
        onPress={handleOpen}
        style={[
          styles.card,
          { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant },
        ]}
      >
        <View style={styles.topRow}>
          <View style={styles.avatarWrap}>
            <CustomAvatar
              type={photoUri ? 'image' : 'text'}
              value={photoUri || initialsFrom}
              fallback={initialsFrom}
              size={52}
            />
            <View
              accessible
              accessibilityLabel={t(isAvailable ? 'findDoctors.available' : 'findDoctors.notAvailable')}
              style={[
                styles.statusDot,
                {
                  backgroundColor: isAvailable ? AVAILABLE_COLOR : theme.colors.onSurfaceVariant,
                  borderColor: theme.colors.surface,
                },
              ]}
            />
          </View>

          <View style={styles.info}>
            <Text numberOfLines={1} style={[styles.name, { color: theme.colors.onSurface }]}>
              {doctor?.fullName || t('common.na')}
            </Text>
            <Text
              numberOfLines={1}
              style={[
                styles.specialty,
                { color: doctor?.specialty ? theme.colors.primary : theme.colors.onSurfaceVariant },
              ]}
            >
              {doctor?.specialty || t('findDoctors.specialtyNotListed')}
            </Text>

            <View style={styles.metaRow}>
              <Icon name="hospital-building" size={13} color={theme.colors.onSurfaceVariant} />
              <Text numberOfLines={1} style={[styles.metaText, { color: theme.colors.onSurfaceVariant }]}>
                {doctor?.departmentName || t('findDoctors.departmentNotListed')}
              </Text>
            </View>

            <WeekdayRow days={isAvailable ? doctor?.availableDays ?? [] : []} />

            <View style={styles.metaRow}>
              <Icon name="map-marker-outline" size={13} color={theme.colors.onSurfaceVariant} />
              <Text numberOfLines={1} style={[styles.metaText, { color: theme.colors.onSurfaceVariant }]}>
                {doctor?.location || t('findDoctors.locationNotListed')}
                {experienceYears > 0
                  ? `  •  ${t('findDoctors.yearsExp', { count: experienceYears })}`
                  : ''}
              </Text>
            </View>
          </View>
        </View>

        <View style={[styles.bottomRow, { borderTopColor: theme.colors.outlineVariant }]}>
          {fee > 0 ? (
            <Text style={[styles.fee, { color: theme.colors.onSurface }]}>
              {taka(fee)}
              <Text style={[styles.feeUnit, { color: theme.colors.onSurfaceVariant }]}>
                {` ${t('findDoctors.perVisit')}`}
              </Text>
            </Text>
          ) : (
            <Text style={[styles.feeUnit, { color: theme.colors.onSurfaceVariant }]}>
              {t('findDoctors.feeOnRequest')}
            </Text>
          )}
          <CustomButton
            mode={isAvailable ? 'contained' : 'outlined'}
            onPress={handleOpen}
            style={styles.openButton}
            labelStyle={styles.openButtonLabel}
          >
            {t(isAvailable ? 'findDoctors.bookNow' : 'findDoctors.viewProfile')}
          </CustomButton>
        </View>
      </Pressable>
    );
  },
);

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  topRow: {
    flexDirection: 'row',
    gap: 12,
  },
  // Sized to the avatar, so the dot sits on its corner and not the row's.
  avatarWrap: {
    alignSelf: 'flex-start',
  },
  statusDot: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
  },
  info: {
    flex: 1,
  },
  name: {
    fontFamily: fontFamilies.semibold,
    fontSize: 15.5,
  },
  specialty: {
    fontFamily: fontFamilies.medium,
    fontSize: 12.5,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  metaText: {
    flex: 1,
    fontFamily: fontFamilies.regular,
    fontSize: 12,
  },
  weekRow: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 2,
  },
  weekDayPill: {
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  weekDay: {
    fontSize: 11,
  },
  weekDayOpen: {
    fontFamily: fontFamilies.semibold,
  },
  weekDayClosed: {
    fontFamily: fontFamilies.regular,
    opacity: 0.55,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    marginTop: 12,
    paddingTop: 10,
  },
  fee: {
    fontFamily: fontFamilies.bold,
    fontSize: 16,
  },
  feeUnit: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
  },
  openButton: {
    marginVertical: 0,
    paddingVertical: 0,
    borderRadius: 10,
  },
  openButtonLabel: {
    fontSize: 13,
    marginVertical: 8,
  },
});

export default DoctorListItem;
