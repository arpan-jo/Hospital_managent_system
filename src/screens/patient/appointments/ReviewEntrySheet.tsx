import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { REVIEW_MAX_RATING, REVIEW_MIN_RATING, stripHonorific } from '@app/core';
import {
  CustomBottomSheet,
  CustomButton,
  CustomInput,
  fontFamilies,
} from '@app/ui';

interface ReviewEntrySheetProps {
  visible: boolean;
  /** Named in the prompt so the patient knows which visit they are rating. */
  doctorName?: string;
  isSubmitting?: boolean;
  onClose: () => void;
  /** Resolves false when the save failed, which keeps the sheet open. */
  onSubmit: (rating: number, comment: string) => Promise<boolean>;
}

const STARS = Array.from(
  { length: REVIEW_MAX_RATING - REVIEW_MIN_RATING + 1 },
  (_, index) => REVIEW_MIN_RATING + index,
);

/** The word under the stars, so a tapped rating reads as more than a number. */
const RATING_LABEL_KEY: Record<number, string> = {
  1: 'appointmentDetails.review.rating1',
  2: 'appointmentDetails.review.rating2',
  3: 'appointmentDetails.review.rating3',
  4: 'appointmentDetails.review.rating4',
  5: 'appointmentDetails.review.rating5',
};

/**
 * Leaves the one review an appointment can carry — the web's ReviewEntryModal
 * as a sheet. A rating is required, the comment is not.
 */
export const ReviewEntrySheet = ({
  visible,
  doctorName,
  isSubmitting = false,
  onClose,
  onSubmit,
}: ReviewEntrySheetProps) => {
  const theme = useTheme();
  const { t } = useTranslation();

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');

  // A reopened sheet starts blank rather than showing the last attempt — the
  // only way back here is an appointment that still has no review.
  useEffect(() => {
    if (!visible) return;
    setRating(0);
    setComment('');
  }, [visible]);

  const handleSubmit = useCallback(async () => {
    if (rating < REVIEW_MIN_RATING) return;

    const saved = await onSubmit(rating, comment);
    if (saved) onClose();
  }, [rating, comment, onSubmit, onClose]);

  const ratingLabelKey = RATING_LABEL_KEY[rating];

  return (
    <CustomBottomSheet visible={visible} onClose={onClose}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: theme.colors.onSurface }]}>
          {t('appointmentDetails.review.title')}
        </Text>
        <Text style={[styles.prompt, { color: theme.colors.onSurfaceVariant }]}>
          {doctorName
            ? t('appointmentDetails.review.promptWithDoctor', {
                name: stripHonorific(doctorName) || doctorName,
              })
            : t('appointmentDetails.review.prompt')}
        </Text>

        <View style={styles.starRow}>
          {STARS?.map(star => {
            const filled = star <= rating;
            return (
              <Pressable
                key={star}
                onPress={() => setRating(star)}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityState={{ selected: filled }}
                accessibilityLabel={t('appointmentDetails.review.starLabel', {
                  count: star,
                })}
              >
                <Icon
                  name={filled ? 'star' : 'star-outline'}
                  size={36}
                  color={filled ? '#F5A623' : theme.colors.outlineVariant}
                />
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.ratingLabel, { color: theme.colors.primary }]}>
          {ratingLabelKey ? t(ratingLabelKey) : t('appointmentDetails.review.tapToRate')}
        </Text>

        <CustomInput
          label={t('appointmentDetails.review.commentLabel')}
          value={comment}
          onChangeText={setComment}
          placeholder={t('appointmentDetails.review.commentPlaceholder')}
          multiline
          numberOfLines={4}
          inputStyle={styles.textarea}
        />

        <CustomButton
          mode="contained"
          onPress={handleSubmit}
          loading={isSubmitting}
          disabled={isSubmitting || rating < REVIEW_MIN_RATING}
          style={styles.submitButton}
        >
          {t('appointmentDetails.review.submit')}
        </CustomButton>
        <CustomButton
          mode="outlined"
          onPress={onClose}
          disabled={isSubmitting}
          style={styles.cancelButton}
        >
          {t('common.cancel')}
        </CustomButton>
      </View>
    </CustomBottomSheet>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  title: {
    fontFamily: fontFamilies.bold,
    fontSize: 16,
    textAlign: 'center',
  },
  prompt: {
    fontFamily: fontFamilies.regular,
    fontSize: 12.5,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 6,
  },
  starRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginTop: 16,
  },
  ratingLabel: {
    fontFamily: fontFamilies.semibold,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 6,
  },
  textarea: {
    minHeight: 88,
  },
  submitButton: {
    marginVertical: 0,
    marginTop: 4,
    borderRadius: 12,
  },
  cancelButton: {
    marginVertical: 0,
    marginTop: 10,
    borderRadius: 12,
  },
});

export default ReviewEntrySheet;
