import React, { memo, useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  FollowUp,
  FollowUpBucket,
  formatLongDate,
  getFileUrl,
  stripHonorific,
  to12Hour,
} from '@app/core';
import { CustomAvatar, fontFamilies } from '@app/ui';
import { doctorDisplayName } from '../appointments/appointmentUi';

type Tone = { color: string; tint: string };

/** The portal's tab colours: blue, amber, green, red. */
const TONE_LIGHT: Record<FollowUpBucket, Tone> = {
  upcoming: { color: '#2F55D4', tint: '#EAF0FF' },
  overdue: { color: '#B27400', tint: '#FEF3E0' },
  completed: { color: '#1B8A4B', tint: '#E6F6EC' },
  cancelled: { color: '#C62828', tint: '#FDECEC' },
};

/** The same on a dark surface — light tints would glare there. */
const TONE_DARK: Record<FollowUpBucket, Tone> = {
  upcoming: { color: '#9FB4FF', tint: '#1F2A4F' },
  overdue: { color: '#F5C26B', tint: '#3A2E14' },
  completed: { color: '#6FD3A0', tint: '#173126' },
  cancelled: { color: '#F2B8B5', tint: '#3A1F1E' },
};

export const BUCKET_LABEL_KEY: Record<FollowUpBucket, string> = {
  upcoming: 'followUps.tabUpcoming',
  overdue: 'followUps.tabOverdue',
  completed: 'followUps.tabCompleted',
  cancelled: 'followUps.tabCancelled',
};

interface FollowUpCardProps {
  followUp: FollowUp;
  bucket: FollowUpBucket;
  months: string[];
  /** Opens the doctor's page to book the visit — offered on Upcoming only. */
  onBook: (followUp: FollowUp) => void;
  /** Opens the visit the follow-up was ordered at. */
  onViewConsultation: (followUp: FollowUp) => void;
}

/**
 * One follow-up, as the portal's card shows it. A follow-up is a date the
 * doctor recommended, not a booked slot — so an upcoming one offers a way to
 * book it in place of a time.
 */
export const FollowUpCard = memo<FollowUpCardProps>(function FollowUpCard({
  followUp,
  bucket,
  months,
  onBook,
  onViewConsultation,
}) {
  const theme = useTheme();
  const { t } = useTranslation();

  const handleBook = useCallback(() => onBook(followUp), [onBook, followUp]);
  const handleConsultation = useCallback(
    () => onViewConsultation(followUp),
    [onViewConsultation, followUp],
  );

  const tone = (theme.dark ? TONE_DARK : TONE_LIGHT)[bucket] ?? TONE_LIGHT.upcoming;
  const photoUri = getFileUrl(followUp?.doctorPhotoUrl);
  const name = doctorDisplayName(followUp?.doctorName) || t('followUps.doctor');
  const muted = theme.colors.onSurfaceVariant;
  const divider = { borderTopColor: theme.colors.outlineVariant };

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
      <View style={styles.topRow}>
        <CustomAvatar
          type={photoUri ? 'image' : 'text'}
          value={photoUri || stripHonorific(followUp?.doctorName) || '?'}
          fallback={stripHonorific(followUp?.doctorName)}
          size={48}
        />
        <View style={styles.identity}>
          <Text numberOfLines={1} style={[styles.name, { color: theme.colors.onSurface }]}>
            {name}
          </Text>
          {followUp?.doctorSpecialty ? (
            <Text numberOfLines={1} style={[styles.specialty, { color: theme.colors.primary }]}>
              {followUp.doctorSpecialty}
            </Text>
          ) : null}
        </View>
        <View style={[styles.statusPill, { backgroundColor: tone.tint }]}>
          <View style={[styles.statusDot, { backgroundColor: tone.color }]} />
          <Text style={[styles.statusText, { color: tone.color }]}>
            {t(BUCKET_LABEL_KEY[bucket] ?? BUCKET_LABEL_KEY.upcoming)}
          </Text>
        </View>
      </View>

      {followUp?.patientName ? (
        <View style={[styles.forChip, { backgroundColor: theme.colors.primaryContainer }]}>
          <Icon name="account-outline" size={13} color={theme.colors.primary} />
          <Text numberOfLines={1} style={[styles.forText, { color: theme.colors.primary }]}>
            {t('followUps.for', { name: followUp.patientName })}
          </Text>
        </View>
      ) : null}

      <View style={[styles.whenBox, { backgroundColor: theme.colors.surfaceVariant }]}>
        <View style={styles.whenItem}>
          <Icon name="calendar-blank-outline" size={15} color={muted} />
          <Text style={[styles.whenText, { color: theme.colors.onSurface }]}>
            {formatLongDate(followUp?.date ?? '', months) || '—'}
          </Text>
        </View>
        {bucket === 'upcoming' ? (
          <Pressable
            onPress={handleBook}
            accessibilityRole="button"
            hitSlop={4}
            style={({ pressed }) => [
              styles.bookButton,
              { backgroundColor: theme.colors.primary, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Icon name="calendar-plus" size={14} color={theme.colors.onPrimary} />
            <Text style={[styles.bookText, { color: theme.colors.onPrimary }]}>
              {t('followUps.bookAppointment')}
            </Text>
          </Pressable>
        ) : followUp?.time ? (
          <View style={styles.whenItem}>
            <Icon name="clock-outline" size={15} color={muted} />
            <Text style={[styles.whenText, { color: theme.colors.onSurface }]}>
              {to12Hour(followUp.time)}
            </Text>
          </View>
        ) : null}
      </View>

      {followUp?.reason ? (
        <Text style={[styles.reason, { color: muted }]}>
          <Text style={[styles.reasonLabel, { color: theme.colors.onSurface }]}>
            {`${t('followUps.reason')}: `}
          </Text>
          {followUp.reason}
        </Text>
      ) : null}

      {followUp?.notes ? (
        <View style={[styles.section, divider]}>
          <Text style={[styles.notesLabel, { color: theme.colors.primary }]}>
            {t('followUps.doctorNotes')}
          </Text>
          <Text style={[styles.notesText, { color: muted }]}>{followUp.notes}</Text>
        </View>
      ) : null}

      {/* Only the visit it came from — a follow-up is not booked from here. */}
      {followUp?.appointmentId ? (
        <Pressable
          onPress={handleConsultation}
          accessibilityRole="link"
          style={[styles.section, styles.linkRow, divider]}
        >
          <Text style={[styles.linkText, { color: theme.colors.primary }]}>
            {t('followUps.viewConsultation')}
          </Text>
          <Icon name="arrow-right" size={15} color={theme.colors.primary} />
        </Pressable>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    elevation: 1,
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
    fontSize: 12.5,
    marginTop: 2,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
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
  forChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    maxWidth: '100%',
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 4,
    marginTop: 12,
  },
  forText: {
    flexShrink: 1,
    fontFamily: fontFamilies.semibold,
    fontSize: 11.5,
  },
  whenBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    minHeight: 50,
    borderRadius: 12,
    paddingLeft: 12,
    paddingRight: 6,
    paddingVertical: 6,
    marginTop: 12,
  },
  whenItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingRight: 6,
  },
  whenText: {
    fontFamily: fontFamilies.medium,
    fontSize: 13,
  },
  bookButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 38,
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  bookText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 12,
  },
  reason: {
    fontFamily: fontFamilies.regular,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 12,
  },
  reasonLabel: {
    fontFamily: fontFamilies.semibold,
  },
  section: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 12,
    paddingTop: 12,
  },
  notesLabel: {
    fontFamily: fontFamilies.semibold,
    fontSize: 13,
  },
  notesText: {
    fontFamily: fontFamilies.regular,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  linkText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 13,
  },
});

export default FollowUpCard;
