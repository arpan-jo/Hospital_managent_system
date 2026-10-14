import React, { memo, useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  PortalPrescription,
  PrescriptionAttachment,
  formatLongDate,
  stripHonorific,
} from '@app/core';
import { CustomAvatar, fontFamilies } from '@app/ui';
import { useMonthNames } from '../../../hooks/useMonthNames';
import PrescriptionAttachments from './PrescriptionAttachments';
import { VISIT_LABEL_KEY, doctorTitle, prescriptionDay } from './prescriptionUi';

interface PrescriptionCardProps {
  prescription: PortalPrescription;
  /** True while this card's "Reports & Documents" panel is open. */
  isExpanded: boolean;
  /** The open panel's documents — loaded only while this card is expanded. */
  attachments: PrescriptionAttachment[];
  isLoadingAttachments: boolean;
  /** This card's PDF is being saved. */
  isDownloading: boolean;
  onToggleAttachments: (id: number) => void;
  onOpen: (prescription: PortalPrescription) => void;
  onDownload: (prescription: PortalPrescription) => void;
  onAddAttachment: (prescription: PortalPrescription) => void;
  onViewAttachment: (attachment: PrescriptionAttachment) => void;
  onDownloadAttachment: (attachment: PrescriptionAttachment) => void;
  onDeleteAttachment: (attachment: PrescriptionAttachment) => void;
}

const EMERGENCY = { color: '#B27400', tint: '#FEF3E0' };

/** One prescription, as the portal's list shows it. */
export const PrescriptionCard = memo<PrescriptionCardProps>(function PrescriptionCard({
  prescription,
  isExpanded,
  attachments,
  isLoadingAttachments,
  isDownloading,
  onToggleAttachments,
  onOpen,
  onDownload,
  onAddAttachment,
  onViewAttachment,
  onDownloadAttachment,
  onDeleteAttachment,
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const monthNames = useMonthNames();

  const handleToggle = useCallback(
    () => onToggleAttachments(prescription?.id ?? 0),
    [onToggleAttachments, prescription?.id],
  );
  const handleOpen = useCallback(() => onOpen(prescription), [onOpen, prescription]);
  const handleDownload = useCallback(() => onDownload(prescription), [onDownload, prescription]);
  const handleAdd = useCallback(() => onAddAttachment(prescription), [onAddAttachment, prescription]);

  const muted = theme.colors.onSurfaceVariant;
  const day = prescriptionDay(prescription?.prescribedAt);
  const doctor = doctorTitle(prescription?.doctorName, t('myPrescriptions.doctorFallback'));
  const isEmergency = prescription?.visitType === 'emergency';

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
      <View style={styles.header}>
        <View style={[styles.dateIcon, { backgroundColor: theme.colors.primaryContainer }]}>
          <Icon name="calendar-blank-outline" size={15} color={theme.colors.primary} />
        </View>
        <Text style={[styles.date, { color: theme.colors.onSurface }]}>
          {day ? formatLongDate(day, monthNames) : '—'}
        </Text>
        {prescription?.patientName ? (
          <View style={[styles.forBadge, { backgroundColor: theme.colors.primaryContainer }]}>
            <Text numberOfLines={1} style={[styles.forText, { color: theme.colors.primary }]}>
              {t('myPrescriptions.forPatient', { name: prescription.patientName })}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.doctorRow}>
        <CustomAvatar
          type="text"
          value={stripHonorific(prescription?.doctorName) || 'D'}
          fallback={stripHonorific(prescription?.doctorName) || 'D'}
          size={42}
        />
        <View style={styles.doctorInfo}>
          <Text numberOfLines={1} style={[styles.doctorName, { color: theme.colors.onSurface }]}>
            {doctor}
          </Text>
          {prescription?.departmentName ? (
            <Text numberOfLines={1} style={[styles.department, { color: muted }]}>
              {prescription.departmentName}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.pills}>
        <View
          style={[
            styles.pill,
            { backgroundColor: isEmergency ? EMERGENCY.tint : theme.colors.surfaceVariant },
          ]}
        >
          <Text style={[styles.pillText, { color: isEmergency ? EMERGENCY.color : muted }]}>
            {t(VISIT_LABEL_KEY[prescription?.visitType ?? 'opd'] ?? VISIT_LABEL_KEY.opd)}
          </Text>
        </View>
        {prescription?.code ? (
          <View style={[styles.pill, { backgroundColor: theme.colors.surfaceVariant }]}>
            <Icon name="barcode" size={12} color={muted} />
            <Text style={[styles.pillText, { color: theme.colors.onSurface }]}>{prescription.code}</Text>
          </View>
        ) : null}
      </View>

      <View style={[styles.footer, { borderTopColor: theme.colors.outlineVariant }]}>
        <View style={styles.countRow}>
          <Icon name="pill" size={15} color={theme.colors.primary} />
          <Text numberOfLines={1} style={[styles.count, { color: theme.colors.onSurface }]}>
            {t('myPrescriptions.medicinesPrescribed', { count: prescription?.medicineCount ?? 0 })}
          </Text>
        </View>

        <View style={styles.actions}>
          <Pressable
            onPress={handleDownload}
            disabled={isDownloading}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('myPrescriptions.downloadPdf')}
            style={[styles.iconButton, { backgroundColor: theme.colors.surfaceVariant }]}
          >
            {isDownloading ? (
              <ActivityIndicator size={14} color={theme.colors.primary} />
            ) : (
              <Icon name="download-outline" size={17} color={theme.colors.primary} />
            )}
          </Pressable>
          <Pressable
            onPress={handleToggle}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityState={{ expanded: isExpanded }}
            accessibilityLabel={t('myPrescriptions.documentsTitle')}
            style={[
              styles.iconButton,
              { backgroundColor: isExpanded ? theme.colors.primary : theme.colors.surfaceVariant },
            ]}
          >
            <Icon
              name="paperclip"
              size={17}
              color={isExpanded ? theme.colors.onPrimary : theme.colors.primary}
            />
          </Pressable>
          <Pressable
            onPress={handleOpen}
            hitSlop={8}
            accessibilityRole="button"
            style={[styles.openButton, { backgroundColor: theme.colors.primary }]}
          >
            <Text style={[styles.open, { color: theme.colors.onPrimary }]}>{t('myPrescriptions.open')}</Text>
            <Icon name="chevron-right" size={15} color={theme.colors.onPrimary} />
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
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#0B1030',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  date: {
    fontFamily: fontFamilies.semibold,
    fontSize: 13.5,
  },
  forBadge: {
    flexShrink: 1,
    marginLeft: 'auto',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  forText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 10.5,
  },
  doctorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  doctorInfo: {
    flex: 1,
    marginLeft: 12,
  },
  doctorName: {
    fontFamily: fontFamilies.bold,
    fontSize: 15,
  },
  department: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
    marginTop: 2,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  pillText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 10.5,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
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
    fontFamily: fontFamilies.medium,
    fontSize: 12,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  openButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingLeft: 12,
    paddingRight: 8,
    height: 34,
  },
  open: {
    fontFamily: fontFamilies.semibold,
    fontSize: 12.5,
  },
});

export default PrescriptionCard;
