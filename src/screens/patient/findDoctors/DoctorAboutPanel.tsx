import React, { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { DoctorConsultationDetail } from '@app/core';
import { fontFamilies } from '@app/ui';
import { taka } from './DoctorListItem';

interface DoctorAboutPanelProps {
  detail: DoctorConsultationDetail | null;
  officeName: string;
  /** From the doctor's list row; 0 falls back to the detail's own wording. */
  experienceYears: number;
}

/**
 * The About tab of a doctor's page: what they specialise in, an overview, and
 * the fee of each visit type they offer. A row or a section with nothing to
 * say is left out.
 */
export const DoctorAboutPanel = memo<DoctorAboutPanelProps>(function DoctorAboutPanel({
  detail,
  officeName,
  experienceYears,
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const muted = theme.colors.onSurfaceVariant;

  /** Specialty, department and sub-specialty, each once, in that order. */
  const specializations = useMemo(() => {
    const seen = new Set<string>();
    return [detail?.doctorSpecialty, detail?.departmentName, detail?.departmentSection]
      .map(value => (value ?? '').trim())
      .filter(value => {
        const key = value.toLowerCase();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }, [detail]);

  const overview = [
    { label: t('doctorProfile.specialty'), value: detail?.doctorSpecialty ?? '' },
    { label: t('doctorProfile.department'), value: detail?.departmentName ?? '' },
    { label: t('doctorProfile.office'), value: officeName ?? '' },
    {
      label: t('doctorProfile.experience'),
      value: experienceYears
        ? t('doctorProfile.experienceYears', { count: experienceYears })
        : detail?.experience ?? '',
    },
  ].filter(row => row.value);

  const fees = [
    { label: t('doctorProfile.newPatient'), value: detail?.fee ?? 0, hint: officeName },
    {
      label: t('doctorProfile.followUpVisit'),
      value: detail?.followUpFee ?? 0,
      hint: detail?.followUpValidDuration
        ? t('doctorProfile.validDays', { count: detail.followUpValidDuration })
        : '',
    },
    {
      label: t('doctorProfile.reportVisit'),
      value: detail?.reportVisitFee ?? 0,
      hint: t('doctorProfile.reportDiscussion'),
    },
  ].filter(fee => fee.value > 0);

  return (
    <View>
      {specializations.length > 0 ? (
        <View style={styles.section}>
          <Text style={[styles.title, { color: theme.colors.onSurface }]}>
            {t('doctorProfile.specializations')}
          </Text>
          <View style={styles.chips}>
            {specializations.map(item => (
              <View key={item} style={[styles.chip, { backgroundColor: theme.colors.primaryContainer }]}>
                <Text style={[styles.chipText, { color: theme.colors.onPrimaryContainer }]}>
                  {item}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {overview.length > 0 ? (
        <View style={styles.section}>
          <Text style={[styles.title, { color: theme.colors.onSurface }]}>
            {t('doctorProfile.overview')}
          </Text>
          <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}>
            {overview.map((row, index) => (
              <View
                key={row.label}
                style={[
                  styles.row,
                  index > 0 && { borderTopWidth: 1, borderTopColor: theme.colors.outlineVariant },
                ]}
              >
                <Text style={[styles.rowLabel, { color: muted }]}>{row.label}</Text>
                <Text style={[styles.rowValue, { color: theme.colors.onSurface }]}>{row.value}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {fees.length > 0 ? (
        <View style={styles.section}>
          <Text style={[styles.title, { color: theme.colors.onSurface }]}>
            {t('doctorProfile.consultationFees')}
          </Text>
          <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}>
            {fees.map((fee, index) => (
              <View
                key={fee.label}
                style={[
                  styles.row,
                  index > 0 && { borderTopWidth: 1, borderTopColor: theme.colors.outlineVariant },
                ]}
              >
                <View style={styles.flex}>
                  <Text style={[styles.feeLabel, { color: theme.colors.onSurface }]}>{fee.label}</Text>
                  {fee.hint ? (
                    <Text numberOfLines={1} style={[styles.rowLabel, { color: muted }]}>
                      {fee.hint}
                    </Text>
                  ) : null}
                </View>
                <Text style={[styles.feeValue, { color: theme.colors.primary }]}>{taka(fee.value)}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  section: {
    marginBottom: 18,
  },
  title: {
    fontFamily: fontFamilies.semibold,
    fontSize: 14,
    marginBottom: 8,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipText: {
    fontFamily: fontFamilies.medium,
    fontSize: 12.5,
  },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 12,
  },
  rowLabel: {
    fontFamily: fontFamilies.regular,
    fontSize: 12.5,
  },
  rowValue: {
    flexShrink: 1,
    fontFamily: fontFamilies.semibold,
    fontSize: 13,
    textAlign: 'right',
  },
  feeLabel: {
    fontFamily: fontFamilies.semibold,
    fontSize: 13.5,
  },
  feeValue: {
    fontFamily: fontFamilies.bold,
    fontSize: 14.5,
  },
});

export default DoctorAboutPanel;
