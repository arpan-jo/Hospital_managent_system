import React, { memo, useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { PatientDocument } from '@app/core';
import { fontFamilies } from '@app/ui';
import {
  CATEGORY_LABEL_KEY,
  categoryTone,
  fileIcon,
  formatBytes,
  formatUploadDate,
} from './reportsUi';

interface DocumentCardProps {
  document: PatientDocument;
  months: string[];
  isDownloading: boolean;
  isDeleting: boolean;
  onPreview: (document: PatientDocument) => void;
  onDownload: (document: PatientDocument) => void;
  onDelete: (document: PatientDocument) => void;
}

/** A round action in the card's footer. */
const Action = ({
  icon,
  label,
  color,
  tint,
  busy,
  onPress,
}: {
  icon: string;
  label: string;
  color: string;
  tint: string;
  busy?: boolean;
  onPress: () => void;
}) => (
  <Pressable
    onPress={onPress}
    disabled={busy}
    hitSlop={4}
    accessibilityRole="button"
    accessibilityLabel={label}
    style={({ pressed }) => [styles.action, { backgroundColor: tint, opacity: pressed ? 0.75 : 1 }]}
  >
    {busy ? <ActivityIndicator size={14} color={color} /> : <Icon name={icon} size={17} color={color} />}
  </Pressable>
);

/** One uploaded document, as the portal's card shows it — tap it to preview. */
export const DocumentCard = memo<DocumentCardProps>(function DocumentCard({
  document,
  months,
  isDownloading,
  isDeleting,
  onPreview,
  onDownload,
  onDelete,
}) {
  const theme = useTheme();
  const { t } = useTranslation();

  const handlePreview = useCallback(() => onPreview(document), [onPreview, document]);
  const handleDownload = useCallback(() => onDownload(document), [onDownload, document]);
  const handleDelete = useCallback(() => onDelete(document), [onDelete, document]);

  const tone = categoryTone(document?.category ?? '', theme.dark);
  const labelKey = CATEGORY_LABEL_KEY[document?.category ?? ''];
  const muted = theme.colors.onSurfaceVariant;

  return (
    <Pressable
      onPress={handlePreview}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: theme.colors.surface, opacity: pressed ? 0.94 : 1 },
      ]}
    >
      <View style={styles.topRow}>
        <View style={[styles.iconTile, { backgroundColor: tone.tint }]}>
          <Icon name={fileIcon(document?.extension)} size={22} color={tone.color} />
        </View>
        <View style={styles.identity}>
          <Text numberOfLines={1} style={[styles.title, { color: theme.colors.onSurface }]}>
            {document?.title}
          </Text>
          <Text numberOfLines={1} style={[styles.fileName, { color: muted }]}>
            {document?.fileName}
          </Text>
        </View>
      </View>

      <View style={styles.metaRow}>
        <View style={[styles.categoryPill, { backgroundColor: tone.tint }]}>
          <Text numberOfLines={1} style={[styles.categoryText, { color: tone.color }]}>
            {labelKey ? t(labelKey) : document?.category}
          </Text>
        </View>
        <Text style={[styles.size, { color: muted }]}>{formatBytes(document?.sizeBytes)}</Text>
      </View>

      {document?.notes ? (
        <View style={[styles.notes, { backgroundColor: theme.colors.surfaceVariant }]}>
          <Text numberOfLines={2} style={[styles.notesText, { color: muted }]}>
            {document.notes}
          </Text>
        </View>
      ) : null}

      <View style={[styles.footer, { borderTopColor: theme.colors.outlineVariant }]}>
        <View style={styles.dateRow}>
          <Icon name="calendar-blank-outline" size={13} color={muted} />
          <Text style={[styles.date, { color: muted }]}>
            {formatUploadDate(document?.uploadedAt, months)}
          </Text>
        </View>
        <View style={styles.actions}>
          <Action
            icon="eye-outline"
            label={t('reports.preview')}
            color={theme.colors.primary}
            tint={theme.colors.primaryContainer}
            onPress={handlePreview}
          />
          <Action
            icon="download-outline"
            label={t('reports.download')}
            color={theme.colors.primary}
            tint={theme.colors.primaryContainer}
            busy={isDownloading}
            onPress={handleDownload}
          />
          <Action
            icon="trash-can-outline"
            label={t('reports.delete')}
            color={theme.colors.error}
            tint={theme.colors.errorContainer}
            busy={isDeleting}
            onPress={handleDelete}
          />
        </View>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    elevation: 1,
    shadowColor: '#0B1030',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconTile: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identity: {
    flex: 1,
    marginLeft: 12,
  },
  title: {
    fontFamily: fontFamilies.bold,
    fontSize: 15,
  },
  fileName: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 12,
  },
  categoryPill: {
    flexShrink: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  categoryText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 11.5,
  },
  size: {
    fontFamily: fontFamilies.medium,
    fontSize: 12,
  },
  notes: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 10,
  },
  notesText: {
    fontFamily: fontFamilies.regular,
    fontSize: 12.5,
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 12,
    paddingTop: 10,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  date: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  action: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default DocumentCard;
