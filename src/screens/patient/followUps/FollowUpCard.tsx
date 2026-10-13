import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  FollowUp,
  FollowUpBucket,
  followUpBucket,
  formatLongDate,
  getFileUrl,
  stripHonorific,
  to12Hour,
} from '@app/core';
import { CustomAvatar, fontFamilies } from '@app/ui';

interface FollowUpCardProps {
  followUp: FollowUp;
}

const STATUS_COLOR: Record<FollowUpBucket, string> = {
  pending: '#F5A623',
  overdue: '#B3261E',
  completed: '#1B9C5D',
  cancelled: '#B3261E',
};

const STATUS_TINT: Record<FollowUpBucket, string> = {
  pending: '#FEF3E0',
  overdue: '#FDECEF',
  completed: '#E6F7EE',
  cancelled: '#FBEAEA',
};

const STATUS_LABEL_KEY: Record<FollowUpBucket, string> = {
  pending: 'followUps.statusPending',
  overdue: 'followUps.statusOverdue',
  completed: 'followUps.statusCompleted',
  cancelled: 'followUps.statusCancelled',
};

export const FollowUpCard = memo<FollowUpCardProps>(function FollowUpCard({ followUp }) {
  const theme = useTheme();
  const { t } = useTranslation();

  // The pill reads by bucket, not raw status: a pending visit whose date has
  // passed sits in the Overdue tab, so the chip must say so too.
  const bucket = followUpBucket(followUp);
  const statusColor = STATUS_COLOR[bucket] ?? STATUS_COLOR.pending;
  const statusTint = STATUS_TINT[bucket] ?? STATUS_TINT.pending;
  const months = Array.from({ length: 12 }, (_, index) => t(`months.${index}`));
  const photoUri = getFileUrl(followUp?.doctorPhotoUrl);

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
      <View style={styles.topRow}>
        <CustomAvatar
          type={photoUri ? 'image' : 'text'}
          value={photoUri || stripHonorific(followUp?.doctorName) || '?'}
          fallback={stripHonorific(followUp?.doctorName)}
          size={44}
        />
        <View style={styles.info}>
          <Text numberOfLines={1} style={[styles.name, { color: theme.colors.onSurface }]}>
            {followUp?.doctorName || t('common.na')}
          </Text>
          <Text numberOfLines={1} style={[styles.specialty, { color: theme.colors.primary }]}>
            {followUp?.doctorSpecialty ?? ''}
          </Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: statusTint }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>
            {t(STATUS_LABEL_KEY[bucket] ?? STATUS_LABEL_KEY.pending)}
          </Text>
        </View>
      </View>

      {/* `patientCode` is set only when the visit is for a family member, so
          the patient's own follow-ups do not carry a "For: <their own name>"
          chip — the web card gates it the same way. */}
      {!!followUp?.patientCode && (
        <View style={[styles.patientPill, { backgroundColor: theme.colors.primaryContainer }]}>
          <Text numberOfLines={1} style={[styles.patientText, { color: theme.colors.primary }]}>
            {t('followUps.for', { name: followUp?.patientName || t('common.na') })}
          </Text>
        </View>
      )}

      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Icon name="calendar-blank-outline" size={13} color={theme.colors.onSurfaceVariant} />
          <Text style={[styles.metaText, { color: theme.colors.onSurfaceVariant }]}>
            {formatLongDate(followUp?.date ?? '', months)}
          </Text>
        </View>
        <View style={styles.metaItem}>
          <Icon name="clock-outline" size={13} color={theme.colors.onSurfaceVariant} />
          <Text style={[styles.metaText, { color: theme.colors.onSurfaceVariant }]}>
            {to12Hour(followUp?.time ?? '')}
          </Text>
        </View>
      </View>

      {/* The reason already carries the interval the doctor picked, e.g.
          "follow up — 1 Days", so the card does not add a relative-days label
          of its own — the web card shows the reason alone too. */}
      {!!followUp?.reason && (
        <View style={[styles.bottomRow, { borderTopColor: theme.colors.outlineVariant }]}>
          <Text numberOfLines={2} style={[styles.reason, { color: theme.colors.onSurface }]}>
            <Text style={styles.reasonLabel}>{`${t('followUps.reason')}: `}</Text>
            {followUp?.reason}
          </Text>
        </View>
      )}

      {/* What the doctor wrote against the visit, once they have closed it. */}
      {!!followUp?.notes && (
        <View style={[styles.bottomRow, { borderTopColor: theme.colors.outlineVariant }]}>
          <Text style={[styles.notesLabel, { color: theme.colors.primary }]}>
            {t('followUps.doctorNotes')}
          </Text>
          <Text
            numberOfLines={3}
            style={[styles.notesText, { color: theme.colors.onSurface }]}
          >
            {followUp?.notes}
          </Text>
        </View>
      )}
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
    alignItems: 'center',
  },
  info: {
    flex: 1,
    marginLeft: 10,
    marginRight: 8,
  },
  name: {
    fontFamily: fontFamilies.bold,
    fontSize: 14,
  },
  specialty: {
    fontFamily: fontFamilies.medium,
    fontSize: 12,
    marginTop: 1,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 11,
  },
  patientPill: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 10,
  },
  patientText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 11,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 10,
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
    borderTopWidth: 1,
    marginTop: 10,
    paddingTop: 10,
  },
  reason: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
  },
  reasonLabel: {
    fontFamily: fontFamilies.semibold,
  },
  notesLabel: {
    fontFamily: fontFamilies.semibold,
    fontSize: 11,
    marginBottom: 3,
  },
  notesText: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
    lineHeight: 17,
  },
});

export default FollowUpCard;
