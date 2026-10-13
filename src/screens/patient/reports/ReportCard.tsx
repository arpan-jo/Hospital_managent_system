import React, { memo, useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  fileExtensionLabel,
  formatDayMonthYear,
  formatFileSize,
  fromISODate,
  PatientDocument,
  ReportCategory,
} from '@app/core';
import { fontFamilies } from '@app/ui';
import { useMonthNames } from '../../../hooks/useMonthNames';

interface ReportCardProps {
  report: PatientDocument;
  /** True while this document's delete call is in flight. */
  isDeleting?: boolean;
  onView: (report: PatientDocument) => void;
  onDownload: (report: PatientDocument) => void;
  onDelete: (report: PatientDocument) => void;
}

const ICON_BY_EXTENSION: Record<string, string> = {
  PDF: 'file-pdf-box',
  JPG: 'file-image-outline',
  JPEG: 'file-image-outline',
  PNG: 'file-image-outline',
  GIF: 'file-image-outline',
  WEBP: 'file-image-outline',
  SVG: 'file-image-outline',
  DOC: 'file-word-outline',
  DOCX: 'file-word-outline',
};

const CATEGORY_TINT: Record<ReportCategory, { bg: string; fg: string }> = {
  Prescription: { bg: '#E9EDFD', fg: '#2F45E5' },
  Laboratory: { bg: '#E6F7EE', fg: '#1B9C5D' },
  'Radiology and Imaging': { bg: '#FDE9F2', fg: '#B3287D' },
  Other: { bg: '#F1F1F5', fg: '#5B5B66' },
};

const CATEGORY_LABEL_KEY: Record<ReportCategory, string> = {
  Prescription: 'reports.categoryPrescription',
  Laboratory: 'reports.categoryLaboratory',
  'Radiology and Imaging': 'reports.categoryRadiology',
  Other: 'reports.categoryOther',
};

export const ReportCard = memo<ReportCardProps>(function ReportCard({
  report,
  isDeleting = false,
  onView,
  onDownload,
  onDelete,
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const monthNames = useMonthNames();

  const handleView = useCallback(() => onView(report), [onView, report]);
  const handleDownload = useCallback(() => onDownload(report), [onDownload, report]);
  const handleDelete = useCallback(() => onDelete(report), [onDelete, report]);

  const extension = fileExtensionLabel(report?.fileName);
  // The repository normalises the category, so this always hits — the fallback
  // covers a payload that reached the card without going through the mapper.
  const tint = CATEGORY_TINT[report?.category] ?? CATEGORY_TINT.Other;
  // The repository normalises the payload's display date to ISO; it leaves ''
  // behind when the date could not be read, which shows as a dash.
  const uploadedLabel = report?.uploadedAt
    ? formatDayMonthYear(fromISODate(report.uploadedAt), monthNames)
    : '—';

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
      <View style={styles.topRow}>
        <View style={[styles.fileIcon, { backgroundColor: tint.bg }]}>
          <Icon name={ICON_BY_EXTENSION[extension] ?? 'file-outline'} size={22} color={tint.fg} />
        </View>
        <View style={styles.info}>
          <Text numberOfLines={1} style={[styles.title, { color: theme.colors.onSurface }]}>
            {report?.title}
          </Text>
          <Text
            numberOfLines={1}
            style={[styles.fileName, { color: theme.colors.onSurfaceVariant }]}
          >
            {report?.fileName}
          </Text>
        </View>
      </View>

      {report?.notes ? (
        <Text numberOfLines={2} style={[styles.notes, { color: theme.colors.onSurfaceVariant }]}>
          {report?.notes}
        </Text>
      ) : null}

      <View style={styles.metaRow}>
        <View style={[styles.categoryPill, { backgroundColor: tint.bg }]}>
          <Text style={[styles.categoryText, { color: tint.fg }]}>
            {t(CATEGORY_LABEL_KEY[report?.category] ?? CATEGORY_LABEL_KEY.Other)}
          </Text>
        </View>
        <Text style={[styles.metaText, { color: theme.colors.onSurfaceVariant }]}>
          {formatFileSize(report?.sizeBytes)}
        </Text>
      </View>

      <View style={[styles.bottomRow, { borderTopColor: theme.colors.outlineVariant }]}>
        <Text style={[styles.dateText, { color: theme.colors.onSurfaceVariant }]}>
          {uploadedLabel}
        </Text>
        <View style={styles.actions}>
          <Pressable
            onPress={handleView}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={t('reports.viewFile')}
          >
            <Icon name="eye-outline" size={18} color={theme.colors.onSurfaceVariant} />
          </Pressable>
          <Pressable
            onPress={handleDownload}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={t('reports.download')}
          >
            <Icon name="tray-arrow-down" size={18} color={theme.colors.onSurfaceVariant} />
          </Pressable>
          {isDeleting ? (
            <ActivityIndicator size={16} color={theme.colors.error} />
          ) : (
            <Pressable
              onPress={handleDelete}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={t('reports.deleteFile')}
            >
              <Icon name="trash-can-outline" size={18} color={theme.colors.error} />
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    elevation: 1,
    shadowColor: '#0B1030',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fileIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    marginLeft: 10,
  },
  title: {
    fontFamily: fontFamilies.bold,
    fontSize: 14,
  },
  fileName: {
    fontFamily: fontFamilies.regular,
    fontSize: 11,
    marginTop: 1,
  },
  notes: {
    fontFamily: fontFamilies.regular,
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  categoryPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  categoryText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 11,
  },
  metaText: {
    fontFamily: fontFamilies.medium,
    fontSize: 11,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    marginTop: 10,
    paddingTop: 10,
  },
  dateText: {
    fontFamily: fontFamilies.regular,
    fontSize: 11,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
});

export default ReportCard;
