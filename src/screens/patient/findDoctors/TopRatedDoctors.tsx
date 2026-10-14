import React, { memo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { getFileUrl, PortalDoctor, stripHonorific } from '@app/core';
import { CustomAvatar, fontFamilies } from '@app/ui';
import { withAlpha } from '../../../components/ai/aiPalette';
import { AVAILABLE_COLOR } from './DoctorListItem';
import { todayAbbr } from './weekdays';

interface TopRatedDoctorsProps {
  doctors: PortalDoctor[];
  onOpen: (doctor: PortalDoctor) => void;
}

/**
 * The strip above the list: a few of the longest-serving doctors, each on a
 * small card with one line of status — sitting today, else their experience,
 * else their department.
 */
export const TopRatedDoctors = memo<TopRatedDoctorsProps>(function TopRatedDoctors({
  doctors,
  onOpen,
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const today = todayAbbr();

  return (
    <View>
      <View style={styles.titleRow}>
        <Icon name="star-circle" size={20} color={theme.colors.primary} />
        <Text style={[styles.title, { color: theme.colors.onSurface }]}>
          {t('findDoctors.topRated')}
        </Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {doctors?.map(doctor => {
          const photoUri = getFileUrl(doctor?.photoUrl);
          const initialsFrom = stripHonorific(doctor?.fullName) || doctor?.fullName || '?';
          const sitsToday = doctor?.availableDays?.includes(today) ?? false;
          const experienceYears = doctor?.experienceYears ?? 0;
          const statusColor = sitsToday ? AVAILABLE_COLOR : theme.colors.onSurfaceVariant;

          return (
            <Pressable
              key={doctor?.employeeId}
              onPress={() => onOpen(doctor)}
              accessibilityRole="button"
              accessibilityLabel={doctor?.fullName}
              style={({ pressed }) => [
                styles.card,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.outlineVariant,
                  opacity: pressed ? 0.94 : 1,
                },
              ]}
            >
              {/* A brand wash behind the top half, for the avatar to sit on. */}
              <View
                pointerEvents="none"
                style={[
                  styles.wash,
                  {
                    backgroundColor: withAlpha(theme.colors.primary, 0.08),
                    experimental_backgroundImage: `linear-gradient(180deg, ${withAlpha(theme.colors.primary, 0.16)} 0%, ${withAlpha(theme.colors.primary, 0.04)} 100%)`,
                  },
                ]}
              />
              <View style={[styles.avatarRing, { backgroundColor: theme.colors.surface }]}>
                <CustomAvatar
                  type={photoUri ? 'image' : 'text'}
                  value={photoUri || initialsFrom}
                  fallback={initialsFrom}
                  size={56}
                />
              </View>
              {/* Two lines, always taken up, so the cards in the row line up. */}
              <Text numberOfLines={2} style={[styles.name, { color: theme.colors.onSurface }]}>
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
              <View style={[styles.statusPill, { backgroundColor: withAlpha(statusColor, 0.12) }]}>
                {sitsToday ? (
                  <View style={[styles.statusDot, { backgroundColor: AVAILABLE_COLOR }]} />
                ) : null}
                <Text numberOfLines={1} style={[styles.status, { color: statusColor }]}>
                  {sitsToday
                    ? t('findDoctors.availableToday')
                    : experienceYears > 0
                    ? t('findDoctors.yearsExperience', { count: experienceYears })
                    : doctor?.departmentName || t('findDoctors.viewProfile')}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
});

const styles = StyleSheet.create({
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  title: {
    fontFamily: fontFamilies.bold,
    fontSize: 16,
  },
  row: {
    gap: 12,
    paddingBottom: 6,
  },
  card: {
    width: 150,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingTop: 14,
    paddingBottom: 12,
    alignItems: 'center',
    overflow: 'hidden',
  },
  wash: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 56,
  },
  avatarRing: {
    borderRadius: 32,
    padding: 3,
  },
  name: {
    fontFamily: fontFamilies.semibold,
    fontSize: 13.5,
    lineHeight: 18,
    minHeight: 36,
    textAlign: 'center',
    marginTop: 8,
    maxWidth: '100%',
  },
  specialty: {
    fontFamily: fontFamilies.medium,
    fontSize: 11.5,
    marginTop: 2,
    maxWidth: '100%',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    marginTop: 10,
    maxWidth: '100%',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  status: {
    flexShrink: 1,
    fontFamily: fontFamilies.semibold,
    fontSize: 10.5,
  },
});

export default TopRatedDoctors;
