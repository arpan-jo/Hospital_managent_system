import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  LabTest,
  LabTestType,
  MedicalRecordRepository,
  PatientPrescriptionRepository,
  PortalPrescription,
  useStores,
} from '@app/core';
import { ReportsStackParamList } from '../../../navigation/ReportsStackNavigator';
import { VISIT_LABEL_KEY, doctorTitle } from '../myPrescriptions/prescriptionUi';
import RecordListSection, { BadgeTone, RecordBadge } from './RecordListSection';
import { formatRecordDate } from './reportsUi';
import { useRecordList } from './useRecordList';

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

/**
 * Every lab or imaging test billed to the account, at whatever stage it has
 * reached, as the portal lists them. A final one opens its report — the
 * printed sheet, as a PDF; any other says it is not ready yet.
 */
const LabTestsSection = ({ type, months, bottomPadding }: SectionProps & { type: LabTestType }) => {
  const { t } = useTranslation();
  const navigation = useNavigation<ReportsNavigation>();
  const { toastStore } = useStores();
  const text = LAB_TEST_TEXT[type] ?? LAB_TEST_TEXT.pathology;
  const fetchTests = useCallback(() => MedicalRecordRepository.getLabTests(type), [type]);
  const viewModel = useRecordList(fetchTests, labTestSearch);

  const badgesOf = useCallback(
    (item: LabTest): RecordBadge[] => [
      ...(viewModel.showPatients ? [{ label: item?.patientName ?? '', tone: 'brand' as const }] : []),
      {
        label: t(`reports.labStatus.${item?.status ?? 'pending'}`),
        tone: STATUS_TONE[item?.status] ?? 'muted',
      },
    ],
    [viewModel.showPatients, t],
  );

  const openTest = useCallback(
    (item: LabTest) => {
      if (!item?.billRowId) return;
      if (!item?.isReportReady) {
        toastStore.show(t('reports.reportNotReady'), 'info');
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
    [navigation, toastStore, t, months],
  );

  return (
    <RecordListSection<LabTest>
      kind={type}
      viewModel={viewModel}
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
    />
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
];

/** Prescriptions — written at a hospital visit, read in full rather than as the PDF. */
export const VisitPrescriptionsSection = ({ months, bottomPadding }: SectionProps) => {
  const { t } = useTranslation();
  const navigation = useNavigation<ReportsNavigation>();
  const viewModel = useRecordList(PatientPrescriptionRepository.getMyPrescriptions, prescriptionSearch);

  const badgesOf = useCallback(
    (item: PortalPrescription): RecordBadge[] => [
      ...(viewModel.showPatients ? [{ label: item?.patientName ?? '', tone: 'brand' as const }] : []),
      {
        label: t(VISIT_LABEL_KEY[item?.visitType] ?? VISIT_LABEL_KEY.opd),
        tone: item?.visitType === 'emergency' ? 'warn' : 'muted',
      },
      { label: item?.code ?? '', tone: 'muted' },
    ],
    [viewModel.showPatients, t],
  );

  return (
    <RecordListSection<PortalPrescription>
      kind="prescriptions"
      viewModel={viewModel}
      bottomPadding={bottomPadding}
      searchPlaceholder={t('reports.searchPrescriptions')}
      emptyTitle={t('reports.rxEmptyTitle')}
      emptyHint={t('reports.rxEmptyHint')}
      noMatchTitle={t('reports.rxNoMatch')}
      keyOf={item => String(item?.id)}
      titleOf={item => doctorTitle(item?.doctorName) || item?.code || t('reports.prescription')}
      metaOf={item => [
        formatRecordDate(item?.prescribedAt, months),
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
    />
  );
};
