import React, { memo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { getFileUrl, PortalDoctor, stripHonorific } from '@app/core';
import { CustomAvatar, fontFamilies } from '@app/ui';
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
      <Text style={[styles.title, { color: theme.colors.onSurface }]}>
        {t('findDoctors.topRated')}
      </Text>
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

          return (
            <Pressable
              key={doctor?.employeeId}
              onPress={() => onOpen(doctor)}
              accessibilityRole="button"
              accessibilityLabel={doctor?.fullName}
              style={[
                styles.card,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant },
              ]}
            >
              <CustomAvatar
                type={photoUri ? 'image' : 'text'}
                value={photoUri || initialsFrom}
                fallback={initialsFrom}
                size={48}
              />
              <Text numberOfLines={1} style={[styles.name, { color: theme.colors.onSurface }]}>
                {doctor?.fullName || t('common.na')}
              </Text>
              {doctor?.specialty ? (
                <Text numberOfLines={1} style={[styles.specialty, { color: theme.colors.primary }]}>
                  {doctor.specialty}
                </Text>
              ) : null}
              <Text
                numberOfLines={1}
                style={[
                  styles.status,
                  { color: sitsToday ? AVAILABLE_COLOR : theme.colors.onSurfaceVariant },
                ]}
              >
                {sitsToday
                  ? t('findDoctors.availableToday')
                  : experienceYears > 0
                  ? t('findDoctors.yearsExperience', { count: experienceYears })
                  : doctor?.departmentName || t('findDoctors.viewProfile')}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
});

const styles = StyleSheet.create({
  title: {
    fontFamily: fontFamilies.semibold,
    fontSize: 15,
    marginBottom: 10,
  },
  row: {
    gap: 10,
    paddingBottom: 4,
  },
  card: {
    width: 138,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  name: {
    fontFamily: fontFamilies.semibold,
    fontSize: 13,
    marginTop: 8,
    maxWidth: '100%',
  },
  specialty: {
    fontFamily: fontFamilies.medium,
    fontSize: 11.5,
    marginTop: 2,
    maxWidth: '100%',
  },
  status: {
    fontFamily: fontFamilies.regular,
    fontSize: 11,
    marginTop: 6,
    maxWidth: '100%',
  },
});

export default TopRatedDoctors;
