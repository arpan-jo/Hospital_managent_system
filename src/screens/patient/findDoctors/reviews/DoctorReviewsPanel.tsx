import React, { memo, useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { DoctorReview, REVIEW_COMMENT_MAX } from '@app/core';
import { CustomButton, CustomInput, fontFamilies } from '@app/ui';
import { useMonthNames } from '../../../../hooks/useMonthNames';
import { formatRecordDate } from '../../reports/reportsUi';
import Stars, { STAR_COLOR } from './Stars';
import { useDoctorReviews } from './useDoctorReviews';

interface DoctorReviewsPanelProps {
  employeeId: number;
  /** From a visit: the rating is tied to it and to that patient. */
  appointmentId?: number | null;
  patientRegistrationId?: number | null;
  /** Shows a few reviews only — for the visit page, where rating is the point. */
  compact?: boolean;
  /** After a rating is saved — the page can read the doctor's stars again. */
  onReviewed?: () => void;
}

/** How many reviews a compact panel lists. */
const COMPACT_LIMIT = 3;

/** A word for each star count, under the picker. */
const RATING_WORD_KEY = ['', 'reviews.word1', 'reviews.word2', 'reviews.word3', 'reviews.word4', 'reviews.word5'];

/** One patient's review: who, when, the stars, and what they wrote. */
const ReviewRow = ({ review, months }: { review: DoctorReview; months: string[] }) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const name = review?.isMine ? t('reviews.you') : review?.patientName || t('reviews.patient');
  const initial = (name ?? '').trim().charAt(0).toUpperCase() || '?';

  return (
    <View style={[styles.review, { borderTopColor: theme.colors.outlineVariant }]}>
      <View
        style={[
          styles.initial,
          { backgroundColor: review?.isMine ? theme.colors.primary : theme.colors.primaryContainer },
        ]}
      >
        <Text
          style={[
            styles.initialText,
            { color: review?.isMine ? theme.colors.onPrimary : theme.colors.onPrimaryContainer },
          ]}
        >
          {initial}
        </Text>
      </View>
      <View style={styles.reviewBody}>
        <View style={styles.reviewTop}>
          <Text numberOfLines={1} style={[styles.reviewName, { color: theme.colors.onSurface }]}>
            {name}
          </Text>
          <Text style={[styles.reviewDate, { color: theme.colors.onSurfaceVariant }]}>
            {formatRecordDate(review?.createdAt, months)}
          </Text>
        </View>
        <Stars value={review?.rating ?? 0} size={13} />
        {review?.comment ? (
          <Text style={[styles.reviewComment, { color: theme.colors.onSurface }]}>{review.comment}</Text>
        ) : null}
      </View>
    </View>
  );
};

/**
 * A doctor's reviews, as the portal shows them — the average and its stars,
 * every patient's rating, and, for a patient who has seen the doctor, the way
 * to rate them or change their rating — laid out for a phone.
 */
export const DoctorReviewsPanel = memo<DoctorReviewsPanelProps>(function DoctorReviewsPanel({
  employeeId,
  appointmentId,
  patientRegistrationId,
  compact = false,
  onReviewed,
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const months = useMonthNames();
  const viewModel = useDoctorReviews(employeeId, { appointmentId, patientRegistrationId });
  const { summary, mine } = viewModel;
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [editing, setEditing] = useState(false);
  /** A compact panel opens to every review on request — the portal lists them all. */
  const [showAll, setShowAll] = useState(false);
  const muted = theme.colors.onSurfaceVariant;

  const reviews = useMemo(() => summary?.reviews ?? [], [summary]);
  // How the stars fall, from the reviews listed — the bars beside the average.
  const spread = useMemo(() => {
    const counts = [0, 0, 0, 0, 0, 0];
    reviews.forEach(review => {
      const stars = Number(review?.rating ?? 0) || 0;
      if (stars >= 1 && stars <= 5) counts[stars] += 1;
    });
    return counts;
  }, [reviews]);

  const startEdit = useCallback(() => {
    setRating(mine?.rating ?? 0);
    setComment(mine?.comment ?? '');
    setEditing(true);
  }, [mine]);

  const cancelEdit = useCallback(() => setEditing(false), []);

  const send = useCallback(async () => {
    const saved = await viewModel.submit(rating, comment);
    if (saved) {
      setEditing(false);
      setRating(0);
      setComment('');
      onReviewed?.();
    }
  }, [viewModel, rating, comment, onReviewed]);

  if (viewModel.isLoading) {
    return (
      <View style={styles.state}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  if (viewModel.error !== null || !summary) {
    return (
      <View style={styles.state}>
        <Icon name="star-off-outline" size={32} color={muted} />
        <Text style={[styles.stateText, { color: muted }]}>{viewModel.error || t('reviews.loadFailed')}</Text>
        <CustomButton mode="outlined" onPress={viewModel.retry} style={styles.retry}>
          {t('common.retry')}
        </CustomButton>
      </View>
    );
  }

  const showForm = viewModel.canReview && (editing || !mine);
  const shown = compact && !showAll ? reviews.slice(0, COMPACT_LIMIT) : reviews;
  const maxSpread = Math.max(...spread.slice(1), 1);
  // Null until someone has rated — and never a value that is not a number.
  const average =
    summary?.averageRating !== null &&
    summary?.averageRating !== undefined &&
    Number.isFinite(summary.averageRating)
      ? summary.averageRating
      : null;

  return (
    <View style={styles.panel}>
      {/* ── The average, and how the stars fall ── */}
      <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}>
        <View style={styles.summary}>
          <View style={styles.average}>
            <Text style={[styles.averageValue, { color: theme.colors.onSurface }]}>
              {average !== null ? average.toFixed(1) : '—'}
            </Text>
            <Stars value={average ?? 0} size={15} />
            <Text style={[styles.averageCount, { color: muted }]}>
              {t('reviews.count', { count: summary?.reviewCount ?? 0 })}
            </Text>
          </View>
          <View style={styles.bars}>
            {[5, 4, 3, 2, 1].map(star => (
              <View key={star} style={styles.barRow}>
                <Text style={[styles.barLabel, { color: muted }]}>{star}</Text>
                <Icon name="star" size={10} color={STAR_COLOR} />
                <View style={[styles.barTrack, { backgroundColor: theme.colors.surfaceVariant }]}>
                  <View style={[styles.barFill, { width: `${(spread[star] / maxSpread) * 100}%` }]} />
                </View>
              </View>
            ))}
          </View>
        </View>

        {mine && !editing ? (
          <Pressable
            onPress={startEdit}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.mine,
              { backgroundColor: theme.colors.primaryContainer, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Icon name="account-check-outline" size={16} color={theme.colors.primary} />
            <Text style={[styles.mineText, { color: theme.colors.primary }]}>
              {t('reviews.yourReview', { rating: mine?.rating ?? 0 })}
            </Text>
            <Icon name="pencil-outline" size={15} color={theme.colors.primary} />
            <Text style={[styles.mineEdit, { color: theme.colors.primary }]}>{t('reviews.edit')}</Text>
          </Pressable>
        ) : null}
      </View>

      {/* ── Rate: only for a patient who has seen this doctor ── */}
      {showForm ? (
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}>
          <Text style={[styles.formTitle, { color: theme.colors.onSurface }]}>
            {appointmentId ? t('reviews.rateVisit') : t('reviews.rateTitle')}
          </Text>
          <View style={styles.picker}>
            <Stars value={rating} size={32} onPick={setRating} />
            <Text style={[styles.word, { color: rating ? STAR_COLOR : muted }]}>
              {rating ? t(RATING_WORD_KEY[rating]) : t('reviews.tapToRate')}
            </Text>
          </View>
          <CustomInput
            label={t('reviews.commentLabel')}
            value={comment}
            onChangeText={text => setComment((text ?? '').slice(0, REVIEW_COMMENT_MAX))}
            placeholder={t('reviews.commentPlaceholder')}
            multiline
            numberOfLines={3}
            compact
          />
          <Text style={[styles.counter, { color: muted }]}>{`${comment.length}/${REVIEW_COMMENT_MAX}`}</Text>
          <View style={styles.formActions}>
            {editing ? (
              <CustomButton
                mode="outlined"
                onPress={cancelEdit}
                disabled={viewModel.isSubmitting}
                style={styles.formButton}
              >
                {t('common.cancel')}
              </CustomButton>
            ) : null}
            <CustomButton
              mode="contained"
              onPress={send}
              disabled={rating < 1 || viewModel.isSubmitting}
              loading={viewModel.isSubmitting}
              style={styles.formButton}
            >
              {t('reviews.submit')}
            </CustomButton>
          </View>
        </View>
      ) : null}

      {/* ── What patients said ── */}
      <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}>
        <Text style={[styles.listTitle, { color: theme.colors.onSurface }]}>{t('reviews.title')}</Text>
        {shown.length ? (
          shown.map((review, index) => (
            <ReviewRow key={`${review?.reviewId}-${index}`} review={review} months={months} />
          ))
        ) : (
          <View style={styles.empty}>
            <Icon name="star-outline" size={30} color={muted} />
            <Text style={[styles.emptyTitle, { color: theme.colors.onSurface }]}>{t('reviews.empty')}</Text>
            <Text style={[styles.stateText, { color: muted }]}>{t('reviews.emptyHint')}</Text>
          </View>
        )}
        {compact && reviews.length > shown.length ? (
          <Pressable
            onPress={() => setShowAll(true)}
            accessibilityRole="button"
            hitSlop={6}
            style={({ pressed }) => [styles.moreButton, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Text style={[styles.moreText, { color: theme.colors.primary }]}>
              {t('reviews.showAll', { count: reviews.length })}
            </Text>
            <Icon name="chevron-down" size={16} color={theme.colors.primary} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  panel: {
    gap: 12,
  },
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
  },
  state: {
    alignItems: 'center',
    paddingVertical: 28,
    gap: 8,
  },
  stateText: {
    fontFamily: fontFamilies.regular,
    fontSize: 13,
    textAlign: 'center',
  },
  retry: {
    marginTop: 4,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  average: {
    alignItems: 'center',
    minWidth: 92,
  },
  averageValue: {
    fontFamily: fontFamilies.bold,
    fontSize: 34,
    lineHeight: 40,
  },
  averageCount: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
    marginTop: 4,
  },
  bars: {
    flex: 1,
    gap: 4,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  barLabel: {
    width: 10,
    fontFamily: fontFamilies.semibold,
    fontSize: 11,
    textAlign: 'right',
  },
  barTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginLeft: 4,
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: STAR_COLOR,
  },
  mine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginTop: 14,
  },
  mineText: {
    flex: 1,
    fontFamily: fontFamilies.semibold,
    fontSize: 13,
  },
  mineEdit: {
    fontFamily: fontFamilies.semibold,
    fontSize: 13,
  },
  formTitle: {
    fontFamily: fontFamilies.bold,
    fontSize: 15,
  },
  picker: {
    alignItems: 'center',
    marginVertical: 10,
    gap: 4,
  },
  word: {
    fontFamily: fontFamilies.semibold,
    fontSize: 13,
  },
  counter: {
    alignSelf: 'flex-end',
    fontFamily: fontFamilies.regular,
    fontSize: 11,
    marginTop: 4,
  },
  formActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  formButton: {
    flex: 1,
  },
  listTitle: {
    fontFamily: fontFamilies.bold,
    fontSize: 15,
    marginBottom: 4,
  },
  review: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  initial: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialText: {
    fontFamily: fontFamilies.bold,
    fontSize: 14,
  },
  reviewBody: {
    flex: 1,
    gap: 3,
  },
  reviewTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  reviewName: {
    flex: 1,
    fontFamily: fontFamilies.semibold,
    fontSize: 13.5,
  },
  reviewDate: {
    fontFamily: fontFamilies.regular,
    fontSize: 11.5,
  },
  reviewComment: {
    fontFamily: fontFamilies.regular,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 2,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 18,
    gap: 6,
  },
  emptyTitle: {
    fontFamily: fontFamilies.semibold,
    fontSize: 14,
  },
  moreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingTop: 10,
  },
  moreText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 13,
  },
});

export default DoctorReviewsPanel;
