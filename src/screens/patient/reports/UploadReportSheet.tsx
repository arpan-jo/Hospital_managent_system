import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { DOCUMENT_CATEGORIES, DocumentCategory } from '@app/core';
import { DropdownItem } from '@app/ui';
import UploadFileSheet, { UploadFileResult } from '../../../components/UploadFileSheet';
import { CATEGORY_LABEL_KEY } from './reportsUi';
import { UploadDocumentInput } from './useUploadsViewModel';

interface UploadReportSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Resolves false when the upload failed, which keeps the sheet open. */
  onUpload: (input: UploadDocumentInput) => Promise<boolean>;
}

/** "Upload Document" on My Uploads — the shared form with the portal's six categories. */
export const UploadReportSheet = ({ visible, onClose, onUpload }: UploadReportSheetProps) => {
  const { t } = useTranslation();

  const categoryItems: DropdownItem<DocumentCategory>[] = useMemo(
    () =>
      DOCUMENT_CATEGORIES.map(item => ({
        label: t(CATEGORY_LABEL_KEY[item] ?? item),
        value: item,
      })),
    [t],
  );

  const handleUpload = useCallback(
    ({ file, title, category, notes }: UploadFileResult<DocumentCategory>) =>
      onUpload({ file, title, category, notes }),
    [onUpload],
  );

  return (
    <UploadFileSheet<DocumentCategory>
      visible={visible}
      title={t('reports.uploadDocument')}
      categoryItems={categoryItems}
      defaultCategory="Lab Report"
      onClose={onClose}
      onUpload={handleUpload}
    />
  );
};

export default UploadReportSheet;
