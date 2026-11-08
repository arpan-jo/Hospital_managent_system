import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  LabTest,
  LabTestType,
  MedicalRecordRepository,
  PatientPrescriptionRepository,
  PortalPrescription,
  UploadedLabReport,
  serverMessageOf,
  useStores,
} from '@app/core';
import { CustomDialog } from '@app/ui';
import { ReportsStackParamList } from '../../../navigation/ReportsStackNavigator';
import { prescribedOn, prescriptionKindKey, prescriptionTitle } from '../myPrescriptions/prescriptionUi';
import RecordCard from './RecordCard';
import RecordListSection, { BadgeTone, RecordAction, RecordBadge } from './RecordListSection';
import { formatRecordDate, formatRecordDateTime } from './reportsUi';
import { useRecordList } from './useRecordList';
import { useUploadedLabReports } from './useUploadedLabReports';

interface SectionProps {
  months: string[];
  bottomPadding: number;
}

type ReportsNavigation = NativeStackNavigationProp<ReportsStackParamList>;

const labTestSearch = (item: LabTest) => [item?.itemName, item?.department, item?.billCode];

/** The portal's colour for each stage: grey while waiting, amber once results are in, brand when ready. */
const STATUS_TONE: Record<LabTest['status'], BadgeTone> = {
  pending: 'muted',
  collected: 'muted',
  received: 'muted',
  result_pending: 'warn',
  final: 'brand',
};

/** What differs between the lab and the imaging list — the words only. */
const LAB_TEST_TEXT: Record<
  LabTestType,
  { search: string; emptyTitle: string; emptyHint: string; noMatch: string; fallbackTitle: string }
> = {
  pathology: {
    search: 'reports.searchLab',
    emptyTitle: 'reports.labEmptyTitle',
    emptyHint: 'reports.labEmptyHint',
    noMatch: 'reports.labNoMatch',
    fallbackTitle: 'reports.labTest',
  },
  radiology: {
    search: 'reports.searchImaging',
    emptyTitle: 'reports.imagingEmptyTitle',
    emptyHint: 'reports.imagingEmptyHint',
    noMatch: 'reports.imagingNoMatch',
    fallbackTitle: 'reports.imagingTest',
  },
};

/** What an upload is found by, as on the portal: the test, the lab, the department. */
const uploadMatches = (report: UploadedLabReport, term: string): boolean =>
  !term ||
  `${report?.testName ?? ''} ${report?.labName ?? ''} ${report?.department ?? ''}`.toLowerCase().includes(term);

/**
 * Every lab or imaging test billed to the account, at whatever stage it has
 * reached, as the portal lists them. A final one opens its report — the
 * printed sheet, as a PDF; any other says it is not ready yet. A final
 * radiology test also offers its images, as the portal does. Above them sit
 * the patient's own confirmed uploads, marked "Uploaded", each removable.
 */
const LabTestsSection = ({ type, months, bottomPadding }: SectionProps & { type: LabTestType }) => {
  const { t } = useTranslation();
  const navigation = useNavigation<ReportsNavigation>();
  const { toastStore } = useStores();
  const text = LAB_TEST_TEXT[type] ?? LAB_TEST_TEXT.pathology;
  const fetchTests = useCallback(() => MedicalRecordRepository.getLabTests(type), [type]);
  const viewModel = useRecordList(fetchTests, labTestSearch);
  const uploads = useUploadedLabReports(type);
  const [removeTarget, setRemoveTarget] = useState<UploadedLabReport | null>(null);

  // The same family chip and search narrow the uploads as the hospital's tests.
  const { patientCode, search } = viewModel;
  const shownUploads = useMemo(() => {
    const term = (search ?? '').trim().toLowerCase();
    return (uploads.reports ?? []).filter(
      report => (!patientCode || report?.patientCode === patientCode) && uploadMatches(report, term),
    );
  }, [uploads.reports, patientCode, search]);

  const openUpload = useCallback(
    (report: UploadedLabReport) => {
      if (!report?.uploadedLabReportId) return;
      navigation.navigate('UploadedLabReport', { report });
    },
    [navigation],
  );

  const cancelRemove = useCallback(() => {
    if (!uploads.removingId) setRemoveTarget(null);
  }, [uploads.removingId]);

  /** The question stays open while it removes, and after a failure. */
  const confirmRemove = useCallback(async () => {
    if (!removeTarget || uploads.removingId) return;
    const removed = await uploads.remove(removeTarget);
    if (removed) setRemoveTarget(null);
  }, [removeTarget, uploads]);

  /**
   * When a test still in the pipeline is due, as the portal shows it — the
   * hospital's own delivery schedule. '' once the report is ready, or when the
   * test has no schedule.
   */
  const expectedOf = useCallback(
    (item: LabTest): string =>
      item?.isReportReady ? '' : formatRecordDateTime(item?.expectedDeliveryAt, months),
    [months],
  );

  const badgesOf = useCallback(
    (item: LabTest): RecordBadge[] => {
      const expected = expectedOf(item);
      return [
        ...(viewModel.showPatients ? [{ label: item?.patientName ?? '', tone: 'brand' as const }] : []),
        {
          label: t(`reports.labStatus.${item?.status ?? 'pending'}`),
          tone: STATUS_TONE[item?.status] ?? 'muted',
        },
        // A badge of its own: on the single meta line it would be cut off.
        ...(expected ? [{ label: t('reports.expectedBy', { time: expected }), tone: 'muted' as const }] : []),
      ];
    },
    [viewModel.showPatients, expectedOf, t],
  );

  const openTest = useCallback(
    (item: LabTest) => {
      if (!item?.billRowId) return;
      if (!item?.isReportReady) {
        const expected = expectedOf(item);
        toastStore.show(
          expected ? t('reports.reportNotReadyBy', { time: expected }) : t('reports.reportNotReady'),
          'info',
        );
        return;
      }
      navigation.navigate('FileViewer', {
        url: MedicalRecordRepository.getLabReportPdfUrl(item.billRowId),
        filename: MedicalRecordRepository.getLabReportFileName(item),
        title: t('reports.reportPreview'),
        subtitle: [item?.itemName, item?.patientName, formatRecordDate(item?.billDate, months), item?.billCode]
          .filter(Boolean)
          .join(' · '),
        canDownload: true,
        // Drawn on request — the sheet carries the time it was printed.
        fresh: true,
        // A File Upload result is the uploaded file itself, often an image.
        typeFromServer: true,
      });
    },
    [navigation, toastStore, t, months, expectedOf],
  );

  /** The images live in the PACS; the viewer screen asks for its own short-lived link. */
  const openImages = useCallback(
    (item: LabTest) => {
      if (!item?.billRowId) return;
      navigation.navigate('RadiologyViewer', {
        billRowId: item.billRowId,
        title: item?.itemName || t('reports.viewImages'),
        subtitle: [item?.patientName, formatRecordDate(item?.billDate, months), item?.billCode]
          .filter(Boolean)
          .join(' · '),
      });
    },
    [navigation, t, months],
  );

  const actionOf = useCallback(
    (item: LabTest): RecordAction | null =>
      type === 'radiology' && item?.isReportReady
        ? {
            icon: 'image-multiple-outline',
            label: t('reports.viewImages'),
            onPress: () => openImages(item),
          }
        : null,
    [type, openImages, t],
  );

  // Shown above the hospital's tests — not over a failed read, which replaces the whole page.
  const uploadsHeader =
    viewModel.error === null && shownUploads.length ? (
      <>
        {shownUploads.map(report => (
          <RecordCard
            key={`upload-${report?.uploadedLabReportId}`}
            kind={type}
            title={report?.testName || t(text.fallbackTitle)}
            meta={[formatRecordDate(report?.reportedAt || report?.createdAt, months), report?.labName]}
            badges={[
              { label: report?.patientName ?? '', tone: 'brand' },
              { label: t('reports.uploaded'), tone: 'muted' },
            ]}
            onOpen={() => openUpload(report)}
            action={{
              icon: 'trash-can-outline',
              label: t('reports.removeUpload'),
              destructive: true,
              isBusy: uploads.removingId === report?.uploadedLabReportId,
              onPress: () => {
                if (!uploads.removingId) setRemoveTarget(report);
              },
            }}
          />
        ))}
      </>
    ) : null;

  return (
    <>
      <RecordListSection<LabTest>
        kind={type}
        // A pull reads the uploads again too.
        viewModel={{
          ...viewModel,
          refresh: async () => {
            uploads.reload();
            await viewModel.refresh();
          },
        }}
        bottomPadding={bottomPadding}
        searchPlaceholder={t(text.search)}
        emptyTitle={t(text.emptyTitle)}
        emptyHint={t(text.emptyHint)}
        noMatchTitle={t(text.noMatch)}
        keyOf={item => String(item?.billRowId)}
        titleOf={item => item?.itemName || t(text.fallbackTitle)}
        metaOf={item => [formatRecordDate(item?.billDate, months), item?.department, item?.billCode]}
        badgesOf={badgesOf}
        onOpen={openTest}
        actionOf={actionOf}
        header={uploadsHeader}
      />
      <CustomDialog
        visible={!!removeTarget}
        title={t('reports.removeUploadTitle')}
        message={t('reports.removeUploadMessage', { name: removeTarget?.testName || t(text.fallbackTitle) })}
        confirmText={t('reports.remove')}
        cancelText={t('common.cancel')}
        loading={!!uploads.removingId}
        onConfirm={confirmRemove}
        onDismiss={cancelRemove}
      />
    </>
  );
};

/** Pathology — lab tests and, once final, their reports. */
export const PathologySection = (props: SectionProps) => <LabTestsSection type="pathology" {...props} />;

/** Radiology — X-rays, scans and other imaging tests and, once final, their reports. */
export const RadiologySection = (props: SectionProps) => <LabTestsSection type="radiology" {...props} />;

const prescriptionSearch = (item: PortalPrescription) => [
  item?.code,
  item?.doctorName,
  item?.departmentName,
  item?.sourceHospitalName,
];

/**
 * Prescriptions — written at a hospital visit, read in full rather than as the
 * PDF. One the patient uploaded can be removed, as on the portal; a doctor's
 * never can.
 */
export const VisitPrescriptionsSection = ({ months, bottomPadding }: SectionProps) => {
  const { t } = useTranslation();
  const navigation = useNavigation<ReportsNavigation>();
  const { toastStore } = useStores();
  const viewModel = useRecordList(PatientPrescriptionRepository.getMyPrescriptions, prescriptionSearch);
  const [removeTarget, setRemoveTarget] = useState<PortalPrescription | null>(null);
  const [removingId, setRemovingId] = useState<number | null>(null);

  const titleOf = useCallback(
    (item: PortalPrescription) =>
      prescriptionTitle(item, t(item?.isUploaded ? 'reports.uploadedPrescription' : 'reports.prescription')),
    [t],
  );

  const actionOf = useCallback(
    (item: PortalPrescription): RecordAction | null =>
      item?.isUploaded && item?.id
        ? {
            icon: 'trash-can-outline',
            label: t('reports.removeUpload'),
            destructive: true,
            isBusy: removingId === item.id,
            onPress: () => {
              if (!removingId) setRemoveTarget(item);
            },
          }
        : null,
    [removingId, t],
  );

  const cancelRemove = useCallback(() => {
    if (!removingId) setRemoveTarget(null);
  }, [removingId]);

  /** The question stays open while it removes, and after a failure. */
  const { refresh } = viewModel;
  const confirmRemove = useCallback(async () => {
    const id = Number(removeTarget?.id ?? 0) || 0;
    if (!id || removingId) return;
    setRemovingId(id);
    try {
      await PatientPrescriptionRepository.removeUploadedPrescription(id);
      setRemoveTarget(null);
      toastStore.show(t('reports.uploadedPrescriptionRemoved'), 'success');
      refresh();
    } catch (e: any) {
      console.log('removeUploadedPrescription error ==>', e?.message);
      // The backend answers 204 or a bare 404 — our words unless it ever says more.
      toastStore.show(serverMessageOf(e) || t('reports.removeFailed'), 'error');
    } finally {
      setRemovingId(null);
    }
  }, [removeTarget, removingId, toastStore, t, refresh]);

  const badgesOf = useCallback(
    (item: PortalPrescription): RecordBadge[] => [
      ...(viewModel.showPatients ? [{ label: item?.patientName ?? '', tone: 'brand' as const }] : []),
      {
        label: t(prescriptionKindKey(item)),
        tone: !item?.isUploaded && item?.visitType === 'emergency' ? 'warn' : 'muted',
      },
      { label: item?.code ?? '', tone: 'muted' },
    ],
    [viewModel.showPatients, t],
  );

  return (
    <>
      <RecordListSection<PortalPrescription>
        kind="prescriptions"
        viewModel={viewModel}
        bottomPadding={bottomPadding}
        searchPlaceholder={t('reports.searchPrescriptions')}
        emptyTitle={t('reports.rxEmptyTitle')}
        emptyHint={t('reports.rxEmptyHint')}
        noMatchTitle={t('reports.rxNoMatch')}
        keyOf={item => String(item?.id)}
        titleOf={titleOf}
        metaOf={item => [
          formatRecordDate(prescribedOn(item), months),
          item?.departmentName,
          (item?.medicineCount ?? 0) > 0 ? t('reports.medicineCount', { count: item.medicineCount }) : '',
        ]}
        badgesOf={badgesOf}
        onOpen={item =>
          navigation.navigate('VisitPrescription', {
            prescriptionId: item?.id,
            title: item?.code,
          })
        }
        actionOf={actionOf}
      />
      <CustomDialog
        visible={!!removeTarget}
        title={t('reports.removeUploadTitle')}
        message={t('reports.removeUploadMessage', { name: removeTarget ? titleOf(removeTarget) : '' })}
        confirmText={t('reports.remove')}
        cancelText={t('common.cancel')}
        loading={!!removingId}
        onConfirm={confirmRemove}
        onDismiss={cancelRemove}
      />
    </>
  );
};
