import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AttachmentCategory,
  ATTACHMENT_CATEGORIES,
  formatDayMonthYear,
  fromISODate,
  PortalPrescription,
} from '@app/core';
import { DropdownItem } from '@app/ui';
import UploadFileSheet, { UploadFileResult } from '../../../components/UploadFileSheet';
import { useMonthNames } from '../../../hooks/useMonthNames';
import { UploadDocumentInput } from './useMyPrescriptionsViewModel';
import { doctorTitle, prescriptionDay } from './prescriptionUi';

interface UploadDocumentSheetProps {
  visible: boolean;
  /** The prescription the document attaches to — its doctor/date fill the subtitle. */
  prescription: PortalPrescription | null;
  onClose: () => void;
  /** Resolves false when the upload failed, which keeps the sheet open. */
  onUpload: (input: UploadDocumentInput) => Promise<boolean>;
}

/** The backend stores these verbatim, so each label is mapped explicitly. */
const CATEGORY_LABEL_KEY: Record<AttachmentCategory, string> = {
  'Lab Report': 'myPrescriptions.categoryLabReport',
  'X-Ray / Scan': 'myPrescriptions.categoryXrayScan',
  Prescription: 'myPrescriptions.categoryPrescription',
  'Medical Certificate': 'myPrescriptions.categoryMedicalCertificate',
  'Discharge Summary': 'myPrescriptions.categoryDischargeSummary',
  Other: 'myPrescriptions.categoryOther',
};

/**
 * Attaches a report or document to one prescription — the shared upload form,
 * categorised for prescription attachments.
 */
export const UploadDocumentSheet = ({
  visible,
  prescription,
  onClose,
  onUpload,
}: UploadDocumentSheetProps) => {
  const { t } = useTranslation();
  const monthNames = useMonthNames();

  const categoryItems: DropdownItem<AttachmentCategory>[] = useMemo(
    () =>
      ATTACHMENT_CATEGORIES.map(item => ({
        label: t(CATEGORY_LABEL_KEY[item]),
        value: item,
      })),
    [t],
  );

  const subtitle = useMemo(() => {
    if (!prescription) return undefined;
    const day = prescriptionDay(prescription?.prescribedAt);
    const date = day ? formatDayMonthYear(fromISODate(day), monthNames) : '';
    return [date, doctorTitle(prescription?.doctorName)].filter(Boolean).join(' · ');
  }, [prescription, monthNames]);

  const handleUpload = useCallback(
    ({ file, title, category, notes }: UploadFileResult<AttachmentCategory>) =>
      onUpload({ file, title, category, notes }),
    [onUpload],
  );

  return (
    <UploadFileSheet<AttachmentCategory>
      visible={visible}
      title={t('myPrescriptions.uploadDocument')}
      subtitle={subtitle}
      categoryItems={categoryItems}
      defaultCategory="Lab Report"
      onClose={onClose}
      onUpload={handleUpload}
    />
  );
};

export default UploadDocumentSheet;
