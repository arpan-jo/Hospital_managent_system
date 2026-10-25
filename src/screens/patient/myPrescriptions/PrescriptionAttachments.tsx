import React, { memo, useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  fileExtensionLabel,
  formatFileSize,
  PrescriptionAttachment,
} from '@app/core';
import { fontFamilies } from '@app/ui';

interface AttachmentRowProps {
  attachment: PrescriptionAttachment;
  onView: (attachment: PrescriptionAttachment) => void;
  onDownload: (attachment: PrescriptionAttachment) => void;
  onDelete: (attachment: PrescriptionAttachment) => void;
}

const ICON_BY_EXTENSION: Record<string, string> = {
  PDF: 'file-pdf-box',
  JPG: 'image-outline',
  JPEG: 'image-outline',
  PNG: 'image-outline',
  WEBP: 'image-outline',
  GIF: 'image-outline',
  DOC: 'file-word-outline',
  DOCX: 'file-word-outline',
};

const AttachmentRow = memo<AttachmentRowProps>(function AttachmentRow({
  attachment,
  onView,
  onDownload,
  onDelete,
}) {
  const theme = useTheme();
  const { t } = useTranslation();

  const handleView = useCallback(() => onView(attachment), [onView, attachment]);
  const handleDownload = useCallback(() => onDownload(attachment), [onDownload, attachment]);
  const handleDelete = useCallback(() => onDelete(attachment), [onDelete, attachment]);

  const extension = fileExtensionLabel(attachment?.name);
  const meta = [
    // The file's own name, as the web lists it under the title.
    attachment?.name ?? '',
    // The backend leaves the size at 0 on older rows — better blank than "0 B".
    attachment?.sizeBytes ? formatFileSize(attachment.sizeBytes) : '',
    // Already formatted by the API ("06 Aug 2026"), so it is shown as sent.
    attachment?.uploadedAt ?? '',
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={[styles.row, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.fileIcon, { backgroundColor: theme.colors.primaryContainer }]}>
        <Icon
          name={ICON_BY_EXTENSION[extension] ?? 'file-outline'}
          size={16}
          color={theme.colors.primary}
        />
      </View>

      <View style={styles.rowInfo}>
        <View style={styles.nameRow}>
          <Text numberOfLines={1} style={[styles.name, { color: theme.colors.onSurface }]}>
            {attachment?.title || attachment?.name}
          </Text>
          <View style={[styles.badge, { backgroundColor: theme.colors.surfaceVariant }]}>
            <Text style={[styles.badgeText, { color: theme.colors.onSurfaceVariant }]}>
              {attachment?.category}
            </Text>
          </View>
        </View>
        <Text numberOfLines={1} style={[styles.meta, { color: theme.colors.onSurfaceVariant }]}>
          {meta}
        </Text>
        {attachment?.notes ? (
          <Text numberOfLines={2} style={[styles.notes, { color: theme.colors.onSurfaceVariant }]}>
            {attachment.notes}
          </Text>
        ) : null}
      </View>

      <View style={styles.actions}>
        <Pressable
          onPress={handleView}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={t('myPrescriptions.viewFile')}
        >
          <Icon name="eye-outline" size={18} color={theme.colors.onSurfaceVariant} />
        </Pressable>
        <Pressable
          onPress={handleDownload}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={t('myPrescriptions.download')}
        >
          <Icon name="tray-arrow-down" size={18} color={theme.colors.onSurfaceVariant} />
        </Pressable>
        <Pressable
          onPress={handleDelete}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={t('myPrescriptions.deleteFile')}
        >
          <Icon name="trash-can-outline" size={18} color={theme.colors.error} />
        </Pressable>
      </View>
    </View>
  );
});

interface PrescriptionAttachmentsProps {
  attachments: PrescriptionAttachment[];
  /** True while this panel's documents are still being fetched. */
  isLoading: boolean;
  onAdd: () => void;
  onView: (attachment: PrescriptionAttachment) => void;
  onDownload: (attachment: PrescriptionAttachment) => void;
  onDelete: (attachment: PrescriptionAttachment) => void;
}

/** "Reports and Documents" — the panel a card's attachment button expands. */
export const PrescriptionAttachments = memo<PrescriptionAttachmentsProps>(
  function PrescriptionAttachments({
    attachments,
    isLoading,
    onAdd,
    onView,
    onDownload,
    onDelete,
  }) {
    const theme = useTheme();
    const { t } = useTranslation();

    return (
      <View style={[styles.container, { borderTopColor: theme.colors.outlineVariant }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.colors.onSurface }]}>
            {t('myPrescriptions.reportsAndDocuments', {
              count: attachments?.length ?? 0,
            })}
          </Text>
          <Pressable
            onPress={onAdd}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('myPrescriptions.addDocument')}
          >
            <Text style={[styles.add, { color: theme.colors.primary }]}>
              {t('myPrescriptions.addDocument')}
            </Text>
          </Pressable>
        </View>

        {isLoading ? (
          <View style={styles.loader}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
          </View>
        ) : attachments?.length ? (
          attachments.map((attachment, index) => (
            <AttachmentRow
              key={attachment?.id ?? index}
              attachment={attachment}
              onView={onView}
              onDownload={onDownload}
              onDelete={onDelete}
            />
          ))
        ) : (
          <View style={styles.emptyBox}>
            <Icon
              name="file-document-outline"
              size={28}
              color={theme.colors.onSurfaceVariant}
              style={styles.emptyIcon}
            />
            <Text style={[styles.empty, { color: theme.colors.onSurfaceVariant }]}>
              {t('myPrescriptions.noDocuments')}
            </Text>
            <Pressable onPress={onAdd} hitSlop={8} accessibilityRole="button">
              <Text style={[styles.add, { color: theme.colors.primary }]}>
                {t('myPrescriptions.uploadFirstDocument')}
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  loader: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  container: {
    borderTopWidth: 1,
    marginTop: 10,
    paddingTop: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title: {
    fontFamily: fontFamilies.semibold,
    fontSize: 12,
  },
  add: {
    fontFamily: fontFamilies.semibold,
    fontSize: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    marginBottom: 6,
  },
  fileIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowInfo: {
    flex: 1,
    marginHorizontal: 10,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    flexShrink: 1,
    fontFamily: fontFamilies.semibold,
    fontSize: 12,
  },
  badge: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  badgeText: {
    fontFamily: fontFamilies.medium,
    fontSize: 9,
  },
  meta: {
    fontFamily: fontFamilies.regular,
    fontSize: 10,
    marginTop: 2,
  },
  notes: {
    fontFamily: fontFamilies.regular,
    fontSize: 10,
    marginTop: 2,
    fontStyle: 'italic',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  emptyBox: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: 14,
  },
  emptyIcon: {
    opacity: 0.4,
  },
  empty: {
    fontFamily: fontFamilies.regular,
    fontSize: 11,
    textAlign: 'center',
  },
});

export default PrescriptionAttachments;
