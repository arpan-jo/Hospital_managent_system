import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  DOCUMENT_CATEGORIES,
  DocumentCategory,
  LabReportType,
  PatientProfile,
  PatientRepository,
  READ_CATEGORIES,
} from '@app/core';
import { DropdownItem, fontFamilies } from '@app/ui';
import UploadFileSheet, { UploadFileResult } from '../../../components/UploadFileSheet';
import FilterPills, { FilterPill } from './FilterPills';
import { forWhomLabel } from './forWhomLabel';
import { CATEGORY_LABEL_KEY } from './reportsUi';
import { UploadDocumentInput } from './useUploadsViewModel';

interface UploadReportSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Resolves false when the upload failed, which keeps the sheet open. */
  onUpload: (input: UploadDocumentInput) => Promise<boolean>;
}

/** Leave Pathology or Radiology to the AI's read, or say which — the patient can still change it on review. */
const REPORT_TYPES: { value: LabReportType | 'Auto'; labelKey: string }[] = [
  { value: 'Auto', labelKey: 'reports.read.typeAuto' },
  { value: 'Pathology', labelKey: 'reports.read.typePathology' },
  { value: 'Radiology', labelKey: 'reports.read.typeRadiology' },
];

/** Only a profile with a hospital registration can hold a read prescription or report. */
const isLinked = (profile?: PatientProfile | null): boolean => (profile?.registrationId ?? 0) > 0;

/**
 * "Upload Document" on My Uploads — the shared form with the portal's six
 * categories. A prescription or a lab report also asks whose it is (and, for
 * a lab report, which kind): the AI reads it after the upload, and the
 * patient reviews the read before it is added to that profile — as on the portal.
 */
export const UploadReportSheet = ({ visible, onClose, onUpload }: UploadReportSheetProps) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const muted = theme.colors.onSurfaceVariant;

  const [profiles, setProfiles] = useState<PatientProfile[]>([]);
  const [registrationId, setRegistrationId] = useState(0);
  const [reportType, setReportType] = useState<LabReportType | 'Auto'>('Auto');
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // The profiles, each time the sheet opens; the choices start afresh.
  useEffect(() => {
    if (!visible) return;
    setRegistrationId(0);
    setReportType('Auto');
    PatientRepository.getAllProfiles()
      .then(rows => {
        if (isMountedRef.current) setProfiles((rows ?? []).filter(isLinked));
      })
      .catch((e: any) => {
        console.log('getAllProfiles (upload) error ==>', e?.message);
        if (isMountedRef.current) setProfiles([]);
      });
  }, [visible]);

  // The chosen one, else the patient's own, else the first — as on the portal.
  const forWhom = useMemo(
    () =>
      profiles.find(profile => profile?.registrationId === registrationId) ??
      profiles.find(profile => profile?.relationship === 'self') ??
      profiles[0] ??
      null,
    [profiles, registrationId],
  );

  const categoryItems: DropdownItem<DocumentCategory>[] = useMemo(
    () =>
      DOCUMENT_CATEGORIES.map(item => ({
        label: t(CATEGORY_LABEL_KEY[item] ?? item),
        value: item,
      })),
    [t],
  );

  const pills: FilterPill[] = useMemo(
    () =>
      profiles.map(profile => ({
        key: String(profile?.registrationId ?? ''),
        // Who they are to the account too, as the portal labels its choices.
        label: forWhomLabel(profile, t),
      })),
    [profiles, t],
  );

  const renderExtra = useCallback(
    (category: DocumentCategory) => {
      if (!READ_CATEGORIES.includes(category) || !profiles.length) return null;
      const isLab = category === 'Lab Report';
      return (
        <View style={styles.extra}>
          <Text style={[styles.label, { color: theme.colors.onSurface }]}>{`${t('reports.read.forWhom')} *`}</Text>
          <FilterPills
            items={pills}
            selected={String(forWhom?.registrationId ?? '')}
            onSelect={key => setRegistrationId(Number(key) || 0)}
          />
          <View style={[styles.note, { backgroundColor: theme.colors.primaryContainer }]}>
            <Icon name="creation" size={15} color={theme.colors.primary} />
            <Text style={[styles.noteText, { color: theme.colors.onPrimaryContainer }]}>
              {t(isLab ? 'reports.read.willReadLab' : 'reports.read.willReadRx')}
            </Text>
          </View>

          {isLab ? (
            <>
              <Text style={[styles.label, { color: theme.colors.onSurface }]}>{`${t('reports.read.reportType')} *`}</Text>
              <View style={styles.types}>
                {REPORT_TYPES.map(option => {
                  const active = reportType === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      onPress={() => setReportType(option.value)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      style={[
                        styles.type,
                        {
                          backgroundColor: active ? theme.colors.primaryContainer : theme.colors.surface,
                          borderColor: active ? theme.colors.primary : theme.colors.outlineVariant,
                        },
                      ]}
                    >
                      <Text
                        numberOfLines={1}
                        style={[styles.typeText, { color: active ? theme.colors.primary : theme.colors.onSurface }]}
                      >
                        {t(option.labelKey)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={[styles.typeHint, { color: muted }]}>
                {t(
                  reportType === 'Radiology'
                    ? 'reports.read.typeRadiologyHint'
                    : reportType === 'Pathology'
                    ? 'reports.read.typePathologyHint'
                    : 'reports.read.typeAutoHint',
                )}
              </Text>
            </>
          ) : null}
        </View>
      );
    },
    [profiles.length, pills, forWhom, reportType, theme, muted, t],
  );

  const busyHint = useCallback(
    (category: DocumentCategory) =>
      READ_CATEGORIES.includes(category) && forWhom ? t('reports.read.busyHint') : undefined,
    [forWhom, t],
  );

  const handleUpload = useCallback(
    ({ file, title, category, notes }: UploadFileResult<DocumentCategory>) =>
      onUpload({
        file,
        title,
        category,
        notes,
        // Whose it is only matters for a category the AI reads.
        forWhom: READ_CATEGORIES.includes(category) ? forWhom : null,
        reportType: category === 'Lab Report' ? reportType : 'Auto',
      }),
    [onUpload, forWhom, reportType],
  );

  return (
    <UploadFileSheet<DocumentCategory>
      visible={visible}
      title={t('reports.uploadDocument')}
      categoryItems={categoryItems}
      defaultCategory="Lab Report"
      onClose={onClose}
      onUpload={handleUpload}
      renderExtra={renderExtra}
      busyHint={busyHint}
    />
  );
};

const styles = StyleSheet.create({
  extra: {
    gap: 8,
    marginTop: 4,
    marginBottom: 8,
  },
  label: {
    fontFamily: fontFamilies.semibold,
    fontSize: 13,
  },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  noteText: {
    flex: 1,
    fontFamily: fontFamilies.regular,
    fontSize: 12.5,
    lineHeight: 18,
  },
  types: {
    flexDirection: 'row',
    gap: 8,
  },
  type: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 4,
  },
  typeText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 13,
  },
  typeHint: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
  },
});

export default UploadReportSheet;
