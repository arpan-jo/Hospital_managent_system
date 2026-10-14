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
import { withAlpha } from '../../../components/ai/aiPalette';
import { DAY_ORDER, dayIndexOf, todayAbbr } from './weekdays';

/** The green of "this doctor can be booked" — a status colour, the same in both themes. */
export const AVAILABLE_COLOR = '#1B9C5D';

/** "৳1,200". */
export const taka = (amount?: number | null): string =>
  `৳${groupThousands(amount ?? 0)}`;

/** One line of the facts panel: a small icon tile, then the fact. */
const FactRow = ({ icon, children }: { icon: string; children: React.ReactNode }) => {
  const theme = useTheme();

  return (
    <View style={styles.factRow}>
      <View style={[styles.factIcon, { backgroundColor: theme.colors.surface }]}>
        <Icon name={icon} size={13} color={theme.colors.primary} />
      </View>
      {children}
    </View>
  );
};

/**
 * The week on one line, Monday first, as a strip of day tiles: the days the
 * doctor sits tinted in brand colour, today among them filled, the rest faded.
 * A doctor who cannot be booked shows no days at all, whatever their schedule
 * says.
 */
const WeekdayRow = memo<{ days: string[] }>(function WeekdayRow({ days }) {
  const theme = useTheme();
  const { t } = useTranslation();

  const openDays = useMemo(() => new Set(days ?? []), [days]);
  const today = todayAbbr();

  if (openDays.size === 0) {
    return (
      <FactRow icon="calendar-month-outline">
        <Text numberOfLines={1} style={[styles.factText, { color: theme.colors.onSurfaceVariant }]}>
          {t('findDoctors.scheduleNotPublished')}
        </Text>
      </FactRow>
    );
  }

  const openDayNames = DAY_ORDER.filter(day => openDays.has(day))
    .map(day => t(`days.${dayIndexOf(day)}`))
    .join(', ');

  return (
    <FactRow icon="calendar-month-outline">
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
              style={[
                styles.weekDayTile,
                isOpen && {
                  backgroundColor: isToday
                    ? theme.colors.primary
                    : withAlpha(theme.colors.primary, 0.1),
                },
              ]}
            >
              <Text
                numberOfLines={1}
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
    </FactRow>
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
        style={({ pressed }) => [
          styles.card,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.outlineVariant,
            opacity: pressed ? 0.94 : 1,
          },
        ]}
      >
        <View style={styles.topRow}>
          <View style={styles.avatarWrap}>
            <View style={[styles.avatarRing, { borderColor: withAlpha(theme.colors.primary, 0.18) }]}>
              <CustomAvatar
                type={photoUri ? 'image' : 'text'}
                value={photoUri || initialsFrom}
                fallback={initialsFrom}
                size={54}
              />
            </View>
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
            {experienceYears > 0 ? (
              <View style={[styles.expPill, { backgroundColor: withAlpha(theme.colors.primary, 0.08) }]}>
                <Icon name="briefcase-outline" size={11} color={theme.colors.primary} />
                <Text style={[styles.expText, { color: theme.colors.primary }]}>
                  {t('findDoctors.yearsExp', { count: experienceYears })}
                </Text>
              </View>
            ) : null}
          </View>

          <Icon name="chevron-right" size={20} color={theme.colors.onSurfaceVariant} />
        </View>

        {/* The same three facts on every card, with quiet fallbacks — as on the portal. */}
        <View style={[styles.facts, { backgroundColor: theme.colors.background }]}>
          <FactRow icon="hospital-building">
            <Text numberOfLines={1} style={[styles.factText, { color: theme.colors.onSurface }]}>
              {doctor?.departmentName || t('findDoctors.departmentNotListed')}
            </Text>
          </FactRow>

          <WeekdayRow days={isAvailable ? doctor?.availableDays ?? [] : []} />

          <FactRow icon="map-marker-outline">
            <Text
              numberOfLines={1}
              style={[
                styles.factText,
                { color: doctor?.location ? theme.colors.onSurface : theme.colors.onSurfaceVariant },
              ]}
            >
              {doctor?.location || t('findDoctors.locationNotListed')}
            </Text>
          </FactRow>
        </View>

        <View style={styles.bottomRow}>
          {fee > 0 ? (
            <Text style={[styles.fee, { color: theme.colors.primary }]}>
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
            icon={isAvailable ? 'calendar-plus' : 'account-outline'}
            // Paper's tonal mode takes `secondaryContainer`, which the theme
            // leaves at Paper's lilac — so the soft blue is set here.
            buttonColor={isAvailable ? undefined : theme.colors.primaryContainer}
            textColor={isAvailable ? undefined : theme.colors.onPrimaryContainer}
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
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
    boxShadow: '0px 4px 14px rgba(21, 30, 79, 0.06)',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  // Sized to the avatar, so the dot sits on its corner and not the row's.
  avatarWrap: {
    alignSelf: 'flex-start',
  },
  avatarRing: {
    borderWidth: 2,
    borderRadius: 31,
    padding: 2,
  },
  statusDot: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 15,
    height: 15,
    borderRadius: 8,
    borderWidth: 2.5,
  },
  info: {
    flex: 1,
  },
  name: {
    fontFamily: fontFamilies.semibold,
    fontSize: 16,
  },
  specialty: {
    fontFamily: fontFamilies.medium,
    fontSize: 12.5,
    marginTop: 2,
  },
  expPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 6,
  },
  expText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 10.5,
  },
  facts: {
    borderRadius: 14,
    padding: 10,
    gap: 8,
    marginTop: 12,
  },
  factRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  factIcon: {
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  factText: {
    flex: 1,
    fontFamily: fontFamilies.regular,
    fontSize: 12.5,
  },
  weekRow: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 4,
  },
  weekDayTile: {
    minWidth: 32,
    borderRadius: 7,
    paddingHorizontal: 4,
    paddingVertical: 3,
    alignItems: 'center',
  },
  weekDay: {
    fontSize: 10.5,
  },
  weekDayOpen: {
    fontFamily: fontFamilies.semibold,
  },
  weekDayClosed: {
    fontFamily: fontFamilies.regular,
    opacity: 0.5,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  fee: {
    fontFamily: fontFamilies.bold,
    fontSize: 18,
  },
  feeUnit: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
  },
  openButton: {
    marginVertical: 0,
    paddingVertical: 0,
    borderRadius: 12,
  },
  openButtonLabel: {
    fontSize: 13,
    marginVertical: 9,
  },
});

export default DoctorListItem;
