import React, { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { PatientProfile, calculateAge, getFileUrl } from '@app/core';
import { CustomAvatar, fontFamilies } from '@app/ui';
import { BLOOD_BG, BLOOD_COLOR, cardShadow } from './profileConstants';

interface ProfileHeaderCardProps {
  profile: PatientProfile;
  /** Omitted on read-only surfaces (the edit form previews itself with this card). */
  onEditPress?: () => void;
  onPhotoPress?: () => void;
  /**
   * A local `file://`/`content://` uri to show instead of the stored photo —
   * a pick that has not been uploaded yet. It must bypass `getFileUrl`, which
   * would treat it as a blob name and point it at the API.
   */
  photoPreviewUri?: string;
}

/** Avatar + identity + age/gender/blood chips. Shared by profile, edit and family. */
export const ProfileHeaderCard = memo<ProfileHeaderCardProps>(function ProfileHeaderCard({
  profile,
  onEditPress,
  onPhotoPress,
  photoPreviewUri,
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const age = calculateAge(profile?.dateOfBirth);

  return (
    <View style={[styles.card, cardShadow, { backgroundColor: theme.colors.surface }]}>
      <View style={styles.topRow}>
        <Pressable onPress={onPhotoPress} disabled={!onPhotoPress} hitSlop={4}>
          <CustomAvatar
            type="image"
            value={photoPreviewUri || getFileUrl(profile?.photoUrl)}
            fallback={profile?.fullName}
            size={58}
          />
          {onPhotoPress ? (
            <View
              style={[
                styles.cameraBadge,
                { backgroundColor: theme.colors.primary, borderColor: theme.colors.surface },
              ]}
            >
              <Icon name="camera-outline" size={11} color={theme.colors.onPrimary} />
            </View>
          ) : null}
        </Pressable>

        <View style={styles.identity}>
          <Text numberOfLines={1} style={[styles.name, { color: theme.colors.onSurface }]}>
            {profile?.fullName}
          </Text>
          <Text numberOfLines={1} style={[styles.meta, { color: theme.colors.onSurfaceVariant }]}>
            {t('patientProfile.idLabel', { id: `PT-${profile?.patientProfileId ?? ''}` })}
          </Text>
          <View style={[styles.codePill, { backgroundColor: theme.colors.surfaceVariant }]}>
            <Text numberOfLines={1} style={[styles.codeText, { color: theme.colors.onSurface }]}>
              {profile?.patientCode || '—'}
            </Text>
          </View>
        </View>

        {onEditPress ? (
          <Pressable
            onPress={onEditPress}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={t('patientProfile.editProfile')}
            style={[styles.editButton, { backgroundColor: theme.colors.primaryContainer }]}
          >
            <Icon name="pencil-outline" size={16} color={theme.colors.primary} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.chipRow}>
        <View style={[styles.chip, { backgroundColor: theme.colors.primaryContainer }]}>
          <Text style={[styles.chipText, { color: theme.colors.primary }]}>
            {t('patientProfile.years', { count: age })}
          </Text>
        </View>
        {profile?.gender ? (
          <View style={[styles.chip, { backgroundColor: theme.colors.surfaceVariant }]}>
            <Text style={[styles.chipText, { color: theme.colors.onSurface }]}>
              {profile.gender}
            </Text>
          </View>
        ) : null}
        {profile?.bloodType ? (
          <View style={[styles.chip, styles.bloodChip, { backgroundColor: BLOOD_BG }]}>
            <Icon name="water" size={11} color={BLOOD_COLOR} />
            <Text style={[styles.chipText, { color: BLOOD_COLOR }]}>{profile.bloodType}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 14,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cameraBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identity: {
    flex: 1,
    marginLeft: 12,
  },
  name: {
    fontFamily: fontFamilies.bold,
    fontSize: 16,
  },
  meta: {
    fontFamily: fontFamilies.regular,
    fontSize: 11,
    marginTop: 1,
  },
  codePill: {
    alignSelf: 'flex-start',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginTop: 5,
  },
  codeText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 10,
    letterSpacing: 0.3,
  },
  editButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 12,
  },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  bloodChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  chipText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 10,
  },
});

export default ProfileHeaderCard;
