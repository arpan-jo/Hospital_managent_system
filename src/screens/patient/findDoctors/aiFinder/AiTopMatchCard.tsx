import React, { memo, useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { getFileUrl, PortalDoctor, stripHonorific } from '@app/core';
import { CustomAvatar, CustomButton, fontFamilies, useAppTheme } from '@app/ui';
import { withAlpha } from '../../../../components/ai/aiPalette';
import { AVAILABLE_COLOR, taka } from '../DoctorListItem';

/**
 * The doctor AI picked first. Built like the list's own doctor card — same
 * fee, same button — but outlined in the brand blue under an "AI top match"
 * badge, so the pick reads as the answer, not one row among many.
 */

interface AiTopMatchCardProps {
  doctor: PortalDoctor;
  /** Opens the doctor's page, as every doctor card does. */
  onOpen: (doctor: PortalDoctor) => void;
}

const AVATAR_SIZE = 52;

export const AiTopMatchCard = memo<AiTopMatchCardProps>(function AiTopMatchCard({
  doctor,
  onOpen,
}) {
  const theme = useAppTheme();
  const { t } = useTranslation();

  const handleOpen = useCallback(() => onOpen(doctor), [onOpen, doctor]);

  const photoUri = getFileUrl(doctor?.photoUrl);
  const initialsFrom = stripHonorific(doctor?.fullName) || doctor?.fullName || '?';
  const experienceYears = doctor?.experienceYears ?? 0;
  const fee = doctor?.consultationFee ?? 0;
  const meta = [
    doctor?.location || t('findDoctors.locationNotListed'),
    experienceYears > 0 ? t('findDoctors.yearsExp', { count: experienceYears }) : '',
  ]
    .filter(Boolean)
    .join('  •  ');

  return (
    <Pressable
      onPress={handleOpen}
      accessibilityRole="button"
      accessibilityLabel={doctor?.fullName}
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          borderColor: withAlpha(theme.colors.primary, 0.55),
        },
      ]}
    >
      <View style={[styles.badge, { backgroundColor: theme.colors.primary }]}>
        <Icon name="star-four-points" size={11} color={theme.colors.onPrimary} />
        <Text style={[styles.badgeText, { color: theme.colors.onPrimary }]}>
          {t('findDoctors.ai.topMatch')}
        </Text>
      </View>

      <View style={styles.topRow}>
        <View>
          <CustomAvatar
            type={photoUri ? 'image' : 'text'}
            value={photoUri || initialsFrom}
            fallback={initialsFrom}
            size={AVATAR_SIZE}
          />
          {doctor?.isAvailable ? (
            <View style={[styles.onlineDot, { borderColor: theme.colors.surface }]} />
          ) : null}
        </View>

        <View style={styles.info}>
          <Text numberOfLines={1} style={[styles.name, { color: theme.colors.onSurface }]}>
            {doctor?.fullName || t('common.na')}
          </Text>
          <Text numberOfLines={1} style={[styles.specialty, { color: theme.colors.primary }]}>
            {doctor?.specialty || t('findDoctors.specialtyNotListed')}
          </Text>
          <Text numberOfLines={1} style={[styles.meta, { color: theme.colors.onSurfaceVariant }]}>
            {doctor?.departmentName || t('findDoctors.departmentNotListed')}
          </Text>
          {meta ? (
            <View style={styles.metaRow}>
              <Icon name="map-marker-outline" size={12} color={theme.colors.onSurfaceVariant} />
              <Text
                numberOfLines={1}
                style={[styles.meta, styles.metaText, { color: theme.colors.onSurfaceVariant }]}
              >
                {meta}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={[styles.footer, { borderTopColor: theme.colors.outlineVariant }]}>
        {fee > 0 ? (
          <Text style={[styles.fee, { color: theme.colors.primary }]}>
            {taka(fee)}
            <Text style={[styles.feeLabel, { color: theme.colors.onSurfaceVariant }]}>
              {` ${t('findDoctors.perVisit')}`}
            </Text>
          </Text>
        ) : (
          <Text style={[styles.feeLabel, { color: theme.colors.onSurfaceVariant }]}>
            {t('findDoctors.feeOnRequest')}
          </Text>
        )}
        <CustomButton
          mode="contained"
          onPress={handleOpen}
          style={styles.book}
          labelStyle={styles.bookLabel}
        >
          {t(doctor?.isAvailable ? 'findDoctors.bookNow' : 'findDoctors.viewProfile')}
        </CustomButton>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 12,
    elevation: 1,
    shadowColor: '#0B1030',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
    marginBottom: 10,
  },
  badgeText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 10.5,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  onlineDot: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 13,
    height: 13,
    borderRadius: 7,
    borderWidth: 2,
    backgroundColor: AVAILABLE_COLOR,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontFamily: fontFamilies.bold,
    fontSize: 15,
  },
  specialty: {
    fontFamily: fontFamilies.semibold,
    fontSize: 12,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  meta: {
    fontFamily: fontFamilies.regular,
    fontSize: 11,
  },
  metaText: {
    flexShrink: 1,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
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
  book: {
    marginVertical: 0,
    paddingVertical: 0,
    borderRadius: 999,
  },
  bookLabel: {
    fontSize: 12,
    marginVertical: 8,
    marginHorizontal: 14,
  },
});

export default AiTopMatchCard;
