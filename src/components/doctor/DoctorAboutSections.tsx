import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { DoctorEducation } from '@app/core';
import { fontFamilies } from '@app/ui';

/**
 * About, shared by the doctor details screen, the details sheet and the doctor
 * profile screen so every entry point stays identical as the content grows.
 *
 * The props are structural: the Find Doctors API returns degrees as plain
 * strings, while the profile screens carry degree/institution pairs — both
 * render through the same list.
 */

export interface DoctorAboutInfo {
  bio?: string;
  specializations?: string[];
  education?: Array<DoctorEducation | string>;
  experienceHistory?: string[];
  awards?: string[];
}

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
});
