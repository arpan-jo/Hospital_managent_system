import React, { memo, useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  formatLongDate,
  getFileUrl,
  PrescriptionAttachment,
  PrescriptionListItem,
  stripHonorific,
} from '@app/core';
import { CustomAvatar, fontFamilies } from '@app/ui';
import { useMonthNames } from '../../../hooks/useMonthNames';
import PrescriptionAttachments from './PrescriptionAttachments';

interface PrescriptionCardProps {
  prescription: PrescriptionListItem;
  /** True while this card's "Reports and Documents" panel is open. */
  isExpanded: boolean;
  /** The open panel's documents — loaded only while this card is expanded. */
  attachments: PrescriptionAttachment[];
  isLoadingAttachments: boolean;
  onToggleAttachments: (id: string) => void;
  onOpen: (prescription: PrescriptionListItem) => void;
  onAddAttachment: (prescription: PrescriptionListItem) => void;
  onViewAttachment: (attachment: PrescriptionAttachment) => void;
  onDownloadAttachment: (attachment: PrescriptionAttachment) => void;
  onDeleteAttachment: (attachment: PrescriptionAttachment) => void;
}

export const PrescriptionCard = memo<PrescriptionCardProps>(function PrescriptionCard({
  prescription,
  isExpanded,
  attachments,
  isLoadingAttachments,
  onToggleAttachments,
  onOpen,
  onAddAttachment,
  onViewAttachment,
  onDownloadAttachment,
  onDeleteAttachment,
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const monthNames = useMonthNames();

  const handleToggle = useCallback(
    () => onToggleAttachments(prescription?.id ?? ''),
    [onToggleAttachments, prescription?.id],
  );
  const handleOpen = useCallback(() => onOpen(prescription), [onOpen, prescription]);
  const handleAdd = useCallback(
    () => onAddAttachment(prescription),
    [onAddAttachment, prescription],
  );

  const patientName = prescription?.patientName ?? '';
  const doctorPhoto = getFileUrl(prescription?.doctorPhotoUrl);

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
      <View style={styles.header}>
        <View style={[styles.dateIcon, { backgroundColor: theme.colors.primaryContainer }]}>
          <Icon name="clipboard-text-outline" size={15} color={theme.colors.primary} />
        </View>

        <View style={styles.headerText}>
          <Text style={[styles.date, { color: theme.colors.onSurface }]}>
            {formatLongDate(prescription?.issuedAt ?? '', monthNames)}
          </Text>
          {/* Whose record this is — a badge, so it stays readable beside the date. */}
          {patientName ? (
            <View style={[styles.forBadge, { backgroundColor: theme.colors.primaryContainer }]}>
              <Text
                numberOfLines={1}
                style={[styles.forText, { color: theme.colors.primary }]}
              >
                {t('myPrescriptions.forPatient', { name: patientName })}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.doctorRow}>
        <CustomAvatar
          type={doctorPhoto ? 'image' : 'text'}
          value={doctorPhoto || stripHonorific(prescription?.doctorName) || '?'}
          fallback={stripHonorific(prescription?.doctorName)}
          size={38}
        />
        <View style={styles.doctorInfo}>
          <Text numberOfLines={1} style={[styles.doctorName, { color: theme.colors.onSurface }]}>
            {prescription?.doctorName || t('common.na')}
          </Text>
          {prescription?.specialty ? (
            <Text
              numberOfLines={1}
              style={[styles.doctorMeta, { color: theme.colors.onSurfaceVariant }]}
            >
              {prescription.specialty}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={[styles.footer, { borderTopColor: theme.colors.outlineVariant }]}>
        <View style={styles.countRow}>
          <Icon name="pill" size={14} color={theme.colors.onSurfaceVariant} />
          <Text numberOfLines={1} style={[styles.count, { color: theme.colors.onSurfaceVariant }]}>
            {t('myPrescriptions.medicinesPrescribed', {
              count: prescription?.medicineCount ?? 0,
            })}
          </Text>
        </View>

        <View style={styles.footerActions}>
          <Pressable
            onPress={handleToggle}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityState={{ expanded: isExpanded }}
            accessibilityLabel={t('myPrescriptions.reportsAndDocuments', {
              count: attachments?.length ?? 0,
            })}
          >
            <Icon
              name="file-document-outline"
              size={18}
              color={isExpanded ? theme.colors.primary : theme.colors.onSurfaceVariant}
            />
          </Pressable>

          <Pressable
            onPress={handleOpen}
            hitSlop={8}
            accessibilityRole="button"
            style={styles.openButton}
          >
            <Text style={[styles.open, { color: theme.colors.primary }]}>
              {t('myPrescriptions.open')}
            </Text>
            <Icon name="chevron-right" size={16} color={theme.colors.primary} />
          </Pressable>
        </View>
      </View>

      {isExpanded ? (
        <PrescriptionAttachments
          attachments={attachments ?? []}
          isLoading={isLoadingAttachments}
          onAdd={handleAdd}
          onView={onViewAttachment}
          onDownload={onDownloadAttachment}
          onDelete={onDeleteAttachment}
        />
      ) : null}
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
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  dateIcon: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    alignItems: 'flex-start',
  },
  date: {
    fontFamily: fontFamilies.semibold,
    fontSize: 13,
  },
  forBadge: {
    maxWidth: '100%',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 5,
  },
  forText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 10,
  },
  doctorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  doctorInfo: {
    flex: 1,
    marginLeft: 10,
  },
  doctorName: {
    fontFamily: fontFamilies.bold,
    fontSize: 14,
  },
  doctorMeta: {
    fontFamily: fontFamilies.regular,
    fontSize: 11,
    marginTop: 2,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    marginTop: 12,
    paddingTop: 10,
    gap: 10,
  },
  countRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  count: {
    flexShrink: 1,
    fontFamily: fontFamilies.regular,
    fontSize: 11,
  },
  footerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  openButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  open: {
    fontFamily: fontFamilies.semibold,
    fontSize: 12,
  },
});

export default PrescriptionCard;
