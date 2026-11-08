import React, { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { AppointmentSummary, formatLongDate, getFileUrl, stripHonorific, to12Hour } from '@app/core';
import { CustomAvatar, fontFamilies, useAppTheme } from '@app/ui';
import { useMonthNames } from '../../../hooks/useMonthNames';
import { STATUS_LABEL_KEY, doctorDisplayName, statusTone } from '../appointments/appointmentUi';

interface NextAppointmentCardProps {
  next: AppointmentSummary | null;
  isLoading: boolean;
  onOpen: (appointment: AppointmentSummary) => void;
  onSeeAll: () => void;
  onBook: () => void;
}

/** One fact of the visit in a column of the strip — the date, the time, the token. */
const Fact = ({ icon, label, value, divided }: { icon: string; label: string; value: string; divided?: boolean }) => {
  const theme = useAppTheme();
  return (
    <View style={[styles.fact, divided && styles.factDivided, divided && { borderLeftColor: theme.colors.outlineVariant }]}>
      <View style={styles.factLabelRow}>
        <Icon name={icon} size={13} color={theme.colors.primary} />
        <Text numberOfLines={1} style={[styles.factLabel, { color: theme.colors.onSurfaceVariant }]}>
          {label}
        </Text>
      </View>
      <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.factValue, { color: theme.colors.onSurface }]}>
        {value || '—'}
      </Text>
    </View>
  );
};

/**
 * The portal's "Next appointment", as a card that floats over the page's
 * header: the doctor and where the visit stands, then the day, the time and
 * the token in a strip — or, with nothing ahead, the way to book one.
 */
export const NextAppointmentCard = memo<NextAppointmentCardProps>(function NextAppointmentCard({
  next,
  isLoading,
  onOpen,
  onSeeAll,
  onBook,
}) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const months = useMonthNames();
  const muted = theme.colors.onSurfaceVariant;
  const cardStyle = [styles.card, theme.dark ? styles.shadowDark : styles.shadowLight, { backgroundColor: theme.colors.surface }];

  const head = (
    <View style={styles.head}>
      <Text style={[styles.headTitle, { color: muted }]}>{t('dashboard.nextAppointment')}</Text>
      {next ? (
        <Pressable onPress={onSeeAll} hitSlop={8} accessibilityRole="button" style={styles.seeAll}>
          <Text style={[styles.seeAllText, { color: theme.colors.primary }]}>{t('dashboard.seeAll')}</Text>
          <Icon name="chevron-right" size={16} color={theme.colors.primary} />
        </Pressable>
      ) : null}
    </View>
  );

  if (isLoading && !next) {
    return (
      <View style={cardStyle}>
        {head}
        <View style={styles.loading}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      </View>
    );
  }

  if (!next) {
    return (
      <View style={cardStyle}>
        {head}
        <View style={styles.emptyRow}>
          <View style={[styles.emptyIcon, { backgroundColor: theme.colors.primaryContainer }]}>
            <Icon name="calendar-blank-outline" size={24} color={theme.colors.primary} />
          </View>
          <View style={styles.flex}>
            <Text style={[styles.emptyTitle, { color: theme.colors.onSurface }]}>{t('dashboard.noUpcoming')}</Text>
            <Text style={[styles.emptyHint, { color: muted }]}>{t('dashboard.noUpcomingHint')}</Text>
          </View>
        </View>
        <Pressable
          onPress={onBook}
          accessibilityRole="button"
          style={({ pressed }) => [styles.bookButton, { backgroundColor: theme.colors.primary, opacity: pressed ? 0.9 : 1 }]}
        >
          <Icon name="plus" size={18} color={theme.colors.onPrimary} />
          <Text style={[styles.bookText, { color: theme.colors.onPrimary }]}>{t('dashboard.bookAppointment')}</Text>
        </Pressable>
      </View>
    );
  }

  const status = statusTone(next?.status, theme.dark);
  const name = doctorDisplayName(next?.doctorName) || t('dashboard.doctor');
  const photo = getFileUrl(next?.doctorPhotoUrl ?? '');
  const role = next?.doctorSpecialty || next?.doctorDesignation || '';

  return (
    <Pressable
      onPress={() => onOpen(next)}
      accessibilityRole="button"
      accessibilityLabel={`${t('dashboard.nextAppointment')}: ${name}`}
      style={({ pressed }) => [...cardStyle, { opacity: pressed ? 0.95 : 1 }]}
    >
      {head}
      <View style={styles.doctor}>
        <CustomAvatar
          type={photo ? 'image' : 'text'}
          value={photo || stripHonorific(next?.doctorName) || '?'}
          fallback={stripHonorific(next?.doctorName) || '?'}
          size={54}
        />
        <View style={styles.flex}>
          <Text numberOfLines={1} style={[styles.name, { color: theme.colors.onSurface }]}>
            {name}
          </Text>
          {role ? (
            <Text numberOfLines={1} style={[styles.role, { color: theme.colors.primary }]}>
              {role}
            </Text>
          ) : null}
        </View>
        <View style={[styles.status, { backgroundColor: status.tint }]}>
          <View style={[styles.statusDot, { backgroundColor: status.color }]} />
          <Text style={[styles.statusText, { color: status.color }]}>{t(STATUS_LABEL_KEY[next?.status] ?? '')}</Text>
        </View>
      </View>

      <View style={[styles.facts, { backgroundColor: theme.colors.background }]}>
        <Fact icon="calendar-blank-outline" label={t('dashboard.date')} value={formatLongDate(next?.date ?? '', months)} />
        <Fact icon="clock-outline" label={t('dashboard.time')} value={next?.time ? to12Hour(next.time) : ''} divided />
        <Fact icon="pound" label={t('dashboard.tokenLabel')} value={next?.token ? `#${next.token}` : ''} divided />
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  card: {
    borderRadius: 24,
    padding: 16,
  },
  shadowLight: {
    shadowColor: '#0B1030',
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  shadowDark: {
    shadowColor: '#000000',
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headTitle: {
    fontFamily: fontFamilies.semibold,
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  seeAll: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  seeAllText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 12.5,
  },
  loading: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 110,
  },
  emptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  emptyIcon: {
    width: 50,
    height: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontFamily: fontFamilies.semibold,
    fontSize: 15,
  },
  emptyHint: {
    fontFamily: fontFamilies.regular,
    fontSize: 12.5,
    marginTop: 2,
  },
  bookButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 14,
    minHeight: 46,
    marginTop: 14,
  },
  bookText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 14.5,
  },
  doctor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  name: {
    fontFamily: fontFamilies.bold,
    fontSize: 16.5,
  },
  role: {
    fontFamily: fontFamilies.medium,
    fontSize: 13,
    marginTop: 1,
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 11.5,
  },
  facts: {
    flexDirection: 'row',
    borderRadius: 16,
    paddingVertical: 10,
    marginTop: 14,
  },
  fact: {
    flex: 1,
    paddingHorizontal: 10,
  },
  factDivided: {
    borderLeftWidth: 1,
  },
  factLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  factLabel: {
    fontFamily: fontFamilies.medium,
    fontSize: 11,
  },
  factValue: {
    fontFamily: fontFamilies.bold,
    fontSize: 14,
    marginTop: 3,
  },
});

export default NextAppointmentCard;
