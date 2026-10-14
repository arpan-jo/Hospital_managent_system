import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  MedicalRecordRepository,
  PathologyReportSummary,
  PatientPrescriptionRepository,
  PortalPrescription,
  RadiologyReportSummary,
} from '@app/core';
import { ReportsStackParamList } from '../../../navigation/ReportsStackNavigator';
import { VISIT_LABEL_KEY, doctorTitle } from '../myPrescriptions/prescriptionUi';
import RecordListSection, { RecordBadge } from './RecordListSection';
import { formatRecordDate } from './reportsUi';
import { useRecordList } from './useRecordList';

interface SectionProps {
  months: string[];
  bottomPadding: number;
}

type ReportsNavigation = NativeStackNavigationProp<ReportsStackParamList>;

const pathologySearch = (item: PathologyReportSummary) => [
  item?.itemName,
  item?.department,
  item?.reportId,
  item?.billCode,
];

/** Pathology — lab reports the hospital has delivered. */
export const PathologySection = ({ months, bottomPadding }: SectionProps) => {
  const { t } = useTranslation();
  const navigation = useNavigation<ReportsNavigation>();
  const viewModel = useRecordList(MedicalRecordRepository.getPathologyReports, pathologySearch);

  const badgesOf = useCallback(
    (item: PathologyReportSummary): RecordBadge[] => [
      ...(viewModel.showPatients ? [{ label: item?.patientName ?? '', tone: 'brand' as const }] : []),
      { label: item?.billCode ?? '', tone: 'muted' },
    ],
    [viewModel.showPatients],
  );

  return (
    <RecordListSection<PathologyReportSummary>
      kind="pathology"
      viewModel={viewModel}
      bottomPadding={bottomPadding}
      searchPlaceholder={t('reports.searchLab')}
      emptyTitle={t('reports.labEmptyTitle')}
      emptyHint={t('reports.labEmptyHint')}
      noMatchTitle={t('reports.labNoMatch')}
      keyOf={item => String(item?.billRowId)}
      titleOf={item => item?.itemName || t('reports.labReport')}
      metaOf={item => [
        formatRecordDate(item?.deliveredAt || item?.billDate, months),
        item?.department,
        item?.reportId,
      ]}
      badgesOf={badgesOf}
      onOpen={item =>
        navigation.navigate('PathologyReport', { billRowId: item?.billRowId, title: item?.itemName })
      }
    />
  );
};

const radiologySearch = (item: RadiologyReportSummary) => [
  item?.itemName,
  item?.department,
  item?.reportId,
  item?.accessionNo,
];

/** Radiology — X-rays, scans and other imaging reports the hospital has delivered. */
export const RadiologySection = ({ months, bottomPadding }: SectionProps) => {
  const { t } = useTranslation();
  const navigation = useNavigation<ReportsNavigation>();
  const viewModel = useRecordList(MedicalRecordRepository.getRadiologyReports, radiologySearch);

  const badgesOf = useCallback(
    (item: RadiologyReportSummary): RecordBadge[] => [
      ...(viewModel.showPatients ? [{ label: item?.patientName ?? '', tone: 'brand' as const }] : []),
      { label: item?.accessionNo ?? '', tone: 'muted' },
    ],
    [viewModel.showPatients],
  );

  return (
    <RecordListSection<RadiologyReportSummary>
      kind="radiology"
      viewModel={viewModel}
      bottomPadding={bottomPadding}
      searchPlaceholder={t('reports.searchImaging')}
      emptyTitle={t('reports.imagingEmptyTitle')}
      emptyHint={t('reports.imagingEmptyHint')}
      noMatchTitle={t('reports.imagingNoMatch')}
      keyOf={item => String(item?.billRowId)}
      titleOf={item => item?.itemName || t('reports.imagingReport')}
      metaOf={item => [
        // The day the study was done, though the list is ordered by delivery — as on the portal.
        formatRecordDate(item?.appointmentDate || item?.deliveredAt || item?.billDate, months),
        item?.department,
        item?.reportId,
      ]}
      badgesOf={badgesOf}
      onOpen={item =>
        navigation.navigate('RadiologyReport', { billRowId: item?.billRowId, title: item?.itemName })
      }
    />
  );
};

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
