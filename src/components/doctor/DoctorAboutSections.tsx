import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  DoctorEducation,
  DoctorReviewItem,
  formatLongDate,
  getFileUrl,
} from '@app/core';
import { CustomAvatar, fontFamilies } from '@app/ui';
import { useMonthNames } from '../../hooks/useMonthNames';

/**
 * About and Reviews, shared by the doctor details screen, the details sheet and
 * the doctor profile screen so every entry point stays identical as the content
 * grows.
 *
 * The props are structural rather than the full `Doctor`: the Find Doctors API
 * returns degrees as plain strings, while the profile screens carry
 * degree/institution pairs — both render through the same list.
 */

export interface DoctorAboutInfo {
  bio?: string;
  specializations?: string[];
  education?: Array<DoctorEducation | string>;
  experienceHistory?: string[];
  awards?: string[];
}

export interface DoctorReviewsInfo {
  averageRating?: number;
  totalCount?: number;
  /** Always 5 entries when set: index 0 = 1-star count ... index 4 = 5-star count. */
  ratingBreakdown?: number[];
  reviews?: DoctorReviewItem[];
}

export const StarRow = memo<{ rating: number; size?: number }>(function StarRow({
  rating,
  size = 14,
}) {
  return (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map(index => (
        <Icon
          key={index}
          name={index <= Math.round(rating ?? 0) ? 'star' : 'star-outline'}
          size={size}
          color="#F5A623"
        />
      ))}
    </View>
  );
});

export const DoctorAboutSection = memo<{ doctor?: DoctorAboutInfo }>(function DoctorAboutSection({
  doctor,
}) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <View>
      <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
        {t('doctorProfile.about')}
      </Text>
      <Text style={[styles.bio, { color: theme.colors.onSurfaceVariant }]}>{doctor?.bio}</Text>

      {doctor?.specializations?.length ? (
        <>
          <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
            {t('doctorProfile.specializations')}
          </Text>
          <View style={styles.pillRow}>
            {doctor?.specializations?.map(item => (
              <View
                key={item}
                style={[styles.pill, { backgroundColor: theme.colors.primaryContainer }]}
              >
                <Text style={[styles.pillText, { color: theme.colors.primary }]}>{item}</Text>
              </View>
            ))}
          </View>
        </>
      ) : null}

      {doctor?.education?.length ? (
        <>
          <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
            {t('doctorProfile.educationCertifications')}
          </Text>
          {doctor?.education?.map(item => {
            const isPlain = typeof item === 'string';
            return (
              <View
                key={isPlain ? item : `${item?.degree}-${item?.institution}`}
                style={styles.listRow}
              >
                <Icon name="school-outline" size={16} color={theme.colors.primary} />
                <Text style={[styles.listText, { color: theme.colors.onSurface }]}>
                  <Text style={styles.strong}>{isPlain ? item : item?.degree}</Text>
                  {isPlain ? '' : ` - ${item?.institution ?? ''}`}
                </Text>
              </View>
            );
          })}
        </>
      ) : null}

      {doctor?.experienceHistory?.length ? (
        <>
          <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
            {t('doctorProfile.experienceSection')}
          </Text>
          {doctor?.experienceHistory?.map(item => (
            <View key={item} style={styles.listRow}>
              <Icon name="briefcase-outline" size={16} color={theme.colors.primary} />
              <Text style={[styles.listText, { color: theme.colors.onSurface }]}>{item}</Text>
            </View>
          ))}
        </>
      ) : null}

      {doctor?.awards?.length ? (
        <>
          <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
            {t('doctorProfile.awardsPublications')}
          </Text>
          {doctor?.awards?.map(item => (
            <View key={item} style={styles.listRow}>
              <Icon name="trophy-outline" size={16} color="#F5A623" />
              <Text style={[styles.listText, { color: theme.colors.onSurface }]}>{item}</Text>
            </View>
          ))}
        </>
      ) : null}
    </View>
  );
});

/** One star-count bar in the rating breakdown, star 5 down to star 1. */
const RatingBar = memo<{ star: number; count: number; totalCount: number }>(
  function RatingBar({ star, count, totalCount }) {
    const theme = useTheme();
    const pct = totalCount > 0 ? Math.round(((count ?? 0) / totalCount) * 100) : 0;

    return (
      <View style={styles.ratingBarRow}>
        <Text style={[styles.ratingBarStar, { color: theme.colors.onSurfaceVariant }]}>
          {star}
        </Text>
        <Icon name="star" size={11} color="#F5A623" />
        <View style={[styles.ratingBarTrack, { backgroundColor: theme.colors.surfaceVariant }]}>
          <View style={[styles.ratingBarFill, { width: `${pct}%`, backgroundColor: '#F5A623' }]} />
        </View>
        <Text style={[styles.ratingBarCount, { color: theme.colors.onSurfaceVariant }]}>
          {count ?? 0}
        </Text>
      </View>
    );
  },
);

export const DoctorReviewsSection = memo<{
  doctor?: DoctorReviewsInfo;
  isLoading?: boolean;
}>(function DoctorReviewsSection({ doctor, isLoading = false }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const monthNames = useMonthNames();
  const reviews = doctor?.reviews ?? [];
  const totalCount = doctor?.totalCount ?? reviews?.length ?? 0;
  const ratingBreakdown = doctor?.ratingBreakdown ?? [];

  if (isLoading) {
    return (
      <View style={styles.reviewsLoader}>
        <ActivityIndicator size="small" color={theme.colors.primary} />
      </View>
    );
  }

  if (totalCount === 0) {
    return (
      <View style={styles.emptyReviews}>
        <View style={[styles.emptyIconWrap, { backgroundColor: theme.colors.primaryContainer }]}>
          <Icon name="star-outline" size={24} color={theme.colors.primary} />
        </View>
        <Text style={[styles.emptyTitle, { color: theme.colors.onSurface }]}>
          {t('doctorProfile.reviewsComingSoon')}
        </Text>
        <Text style={[styles.emptyDesc, { color: theme.colors.onSurfaceVariant }]}>
          {t('doctorProfile.reviewsComingSoonDesc')}
        </Text>
      </View>
    );
  }

  return (
    <View>
      <View style={[styles.ratingSummaryCard, { backgroundColor: theme.colors.primaryContainer }]}>
        <View style={styles.ratingSummary}>
          <Text style={[styles.ratingBig, { color: theme.colors.onSurface }]}>
            {(doctor?.averageRating ?? 0).toFixed(1)}
          </Text>
          <View>
            <StarRow rating={doctor?.averageRating ?? 0} size={16} />
            <Text style={[styles.reviewsCount, { color: theme.colors.onSurfaceVariant }]}>
              {t('doctorProfile.reviewsCount', { count: totalCount })}
            </Text>
          </View>
        </View>

        {ratingBreakdown?.length === 5 ? (
          <View style={styles.ratingBarList}>
            {[5, 4, 3, 2, 1]?.map(star => (
              <RatingBar
                key={star}
                star={star}
                count={ratingBreakdown?.[star - 1] ?? 0}
                totalCount={totalCount}
              />
            ))}
          </View>
        ) : null}
      </View>

      {reviews?.map(review => {
        const reviewDateLabel = review?.date
          ? formatLongDate(review?.date, monthNames)
          : '';
        const reviewerPhotoUri = getFileUrl(review?.patientPhotoUrl);

        return (
          <View
            key={review?.id}
            style={[styles.reviewRow, { borderColor: theme.colors.outlineVariant }]}
          >
            <CustomAvatar
              type={reviewerPhotoUri ? 'image' : 'text'}
              value={reviewerPhotoUri || review?.patientName || '?'}
              fallback={review?.patientName}
              size={36}
            />
            <View style={styles.reviewBody}>
              <View style={styles.reviewHeader}>
                <Text style={[styles.reviewName, { color: theme.colors.onSurface }]}>
                  {review?.patientName || t('common.na')}
                </Text>
                <Text style={[styles.reviewDate, { color: theme.colors.onSurfaceVariant }]}>
                  {reviewDateLabel}
                </Text>
              </View>
              <StarRow rating={review?.rating ?? 0} size={12} />
              {review?.comment ? (
                <Text style={[styles.reviewComment, { color: theme.colors.onSurfaceVariant }]}>
                  {review?.comment}
                </Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  sectionTitle: {
    fontFamily: fontFamilies.bold,
    fontSize: 14,
    marginBottom: 8,
  },
  bio: {
    fontFamily: fontFamilies.regular,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 20,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  pill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pillText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 12,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 10,
  },
  listText: {
    flex: 1,
    fontFamily: fontFamilies.regular,
    fontSize: 12,
    lineHeight: 17,
  },
  strong: {
    fontFamily: fontFamilies.semibold,
  },
  starRow: {
    flexDirection: 'row',
    gap: 1,
  },
  reviewsLoader: {
    paddingVertical: 30,
    alignItems: 'center',
  },
  ratingSummaryCard: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 18,
  },
  ratingSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  ratingBig: {
    fontFamily: fontFamilies.bold,
    fontSize: 34,
  },
  reviewsCount: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
    marginTop: 4,
  },
  ratingBarList: {
    marginTop: 14,
    gap: 6,
  },
  ratingBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ratingBarStar: {
    fontFamily: fontFamilies.medium,
    fontSize: 11,
    width: 8,
  },
  ratingBarTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  ratingBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  ratingBarCount: {
    fontFamily: fontFamilies.regular,
    fontSize: 11,
    width: 20,
    textAlign: 'right',
  },
  reviewRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderTopWidth: 1,
    paddingTop: 14,
    marginTop: 14,
  },
  reviewBody: {
    flex: 1,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reviewName: {
    fontFamily: fontFamilies.semibold,
    fontSize: 13,
  },
  reviewDate: {
    fontFamily: fontFamilies.regular,
    fontSize: 11,
  },
  reviewComment: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 6,
  },
  emptyReviews: {
    alignItems: 'center',
    paddingVertical: 30,
    gap: 10,
  },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontFamily: fontFamilies.bold,
    fontSize: 15,
  },
  emptyDesc: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});
