import React, { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { AppointmentSummary, formatLongDate, getFileUrl, stripHonorific, to12Hour } from '@app/core';
import { CustomAvatar, CustomButton, fontFamilies, useAppTheme } from '@app/ui';
import { aiPalette, withAlpha } from '../../../components/ai/aiPalette';
import { useMonthNames } from '../../../hooks/useMonthNames';
import { STATUS_LABEL_KEY, doctorDisplayName, statusTone } from '../appointments/appointmentUi';

interface NextAppointmentCardProps {
  next: AppointmentSummary | null;
  isLoading: boolean;
  onOpen: (appointment: AppointmentSummary) => void;
  onSeeAll: () => void;
  onBook: () => void;
}

/** One fact of the visit on a glass chip — the date, the time, the token. */
const Fact = ({ icon, text, ink }: { icon: string; text: string; ink: string }) => (
  <View style={[styles.fact, { backgroundColor: withAlpha(ink, 0.16) }]}>
    <Icon name={icon} size={13} color={ink} />
    <Text numberOfLines={1} style={[styles.factText, { color: ink }]}>
      {text}
    </Text>
  </View>
);

/**
 * The portal's "Next appointment" for a phone: the visit on the brand wash —
 * the doctor, where it stands, and when — or, with none ahead, the way to book one.
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

  if (isLoading && !next) {
    return (
      <View style={[styles.plain, styles.center, { backgroundColor: theme.colors.surface }]}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  if (!next) {
    return (
      <View style={[styles.plain, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.emptyRow}>
          <View style={[styles.emptyIcon, { backgroundColor: theme.colors.primaryContainer }]}>
            <Icon name="calendar-plus" size={24} color={theme.colors.primary} />
          </View>
          <View style={styles.flex}>
            <Text style={[styles.emptyLabel, { color: muted }]}>{t('dashboard.nextAppointment')}</Text>
            <Text style={[styles.emptyTitle, { color: theme.colors.onSurface }]}>
              {t('dashboard.noUpcoming')}
            </Text>
          </View>
        </View>
        <CustomButton mode="contained" icon="stethoscope" onPress={onBook} style={styles.bookButton}>
          {t('dashboard.bookAppointment')}
        </CustomButton>
      </View>
    );
  }

  const palette = aiPalette(theme);
  const ink = palette.onGradient;
  // The status keeps its own colour as a dot — the pill itself is glass on the wash.
  const status = statusTone(next?.status, true);
  const name = doctorDisplayName(next?.doctorName) || t('dashboard.doctor');
  const photo = getFileUrl(next?.doctorPhotoUrl ?? '');
  const role = next?.doctorSpecialty || next?.doctorDesignation || '';

  return (
    <Pressable
      onPress={() => onOpen(next)}
      accessibilityRole="button"
      accessibilityLabel={`${t('dashboard.nextAppointment')}: ${name}`}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: palette.base,
          experimental_backgroundImage: palette.gradient,
          opacity: pressed ? 0.94 : 1,
        },
      ]}
    >
      {/* Echo of the rings on the sign-in hero and the AI card. */}
      <View pointerEvents="none" style={[styles.ring, styles.ringLarge, { borderColor: ink }]} />
      <View pointerEvents="none" style={[styles.ring, styles.ringSmall, { borderColor: ink }]} />

      <View style={styles.top}>
        <View style={styles.label}>
          <Icon name="calendar-check" size={15} color={ink} />
          <Text style={[styles.labelText, { color: ink }]}>{t('dashboard.nextAppointment')}</Text>
        </View>
        <Pressable onPress={onSeeAll} hitSlop={8} accessibilityRole="button" style={styles.seeAll}>
          <Text style={[styles.seeAllText, { color: ink }]}>{t('dashboard.seeAll')}</Text>
          <Icon name="chevron-right" size={16} color={ink} />
        </Pressable>
      </View>

      <View style={styles.doctor}>
        <View style={[styles.avatarRing, { borderColor: withAlpha(ink, 0.5) }]}>
          <CustomAvatar
            type={photo ? 'image' : 'text'}
            value={photo || stripHonorific(next?.doctorName) || '?'}
            fallback={stripHonorific(next?.doctorName) || '?'}
            size={52}
          />
        </View>
        <View style={styles.flex}>
          <Text numberOfLines={1} style={[styles.name, { color: ink }]}>
            {name}
          </Text>
          {role ? (
            <Text numberOfLines={1} style={[styles.role, { color: withAlpha(ink, 0.82) }]}>
              {role}
            </Text>
          ) : null}
          <View style={[styles.status, { backgroundColor: withAlpha(ink, 0.16) }]}>
            <View style={[styles.statusDot, { backgroundColor: status.color }]} />
            <Text style={[styles.statusText, { color: ink }]}>{t(STATUS_LABEL_KEY[next?.status] ?? '')}</Text>
          </View>
        </View>
      </View>

      <View style={styles.facts}>
        <Fact icon="calendar-blank-outline" text={formatLongDate(next?.date ?? '', months)} ink={ink} />
        {next?.time ? <Fact icon="clock-outline" text={to12Hour(next.time)} ink={ink} /> : null}
        {next?.token ? <Fact icon="pound" text={t('dashboard.token', { token: next.token })} ink={ink} /> : null}
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 150,
  },
  plain: {
    borderRadius: 20,
    padding: 16,
  },
  emptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyLabel: {
    fontFamily: fontFamilies.medium,
    fontSize: 12,
  },
  emptyTitle: {
    fontFamily: fontFamilies.semibold,
    fontSize: 15,
    marginTop: 2,
  },
  bookButton: {
    borderRadius: 12,
    marginTop: 14,
  },
  card: {
    borderRadius: 22,
    padding: 16,
    overflow: 'hidden',
  },
  ring: {
    position: 'absolute',
    borderWidth: 1.5,
    opacity: 0.18,
  },
  ringLarge: {
    width: 190,
    height: 190,
    borderRadius: 95,
    top: -100,
    right: -50,
  },
  ringSmall: {
    width: 96,
    height: 96,
    borderRadius: 48,
    bottom: -52,
    right: 70,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  labelText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 13,
  },
  seeAll: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  seeAllText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 12.5,
  },
  doctor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 14,
  },
  avatarRing: {
    borderWidth: 2,
    borderRadius: 32,
    padding: 2,
  },
  name: {
    fontFamily: fontFamilies.bold,
    fontSize: 17,
  },
  role: {
    fontFamily: fontFamilies.regular,
    fontSize: 13,
    marginTop: 1,
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
    marginTop: 6,
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
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  fact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  factText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 12.5,
  },
});

export default NextAppointmentCard;
