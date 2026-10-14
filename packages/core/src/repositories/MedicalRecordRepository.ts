/**
 * What the hospital issued to the patient, as the portal's Reports page reads
 * it from `/hms/portal/medical-records`: lab and imaging reports once they are
 * delivered, and visit prescriptions in full. Every list is the account's —
 * the patient's own and their family members' — newest first, unpaged; each
 * row names its patient so the screen can narrow by person.
 *
 * A single record the account does not own, or that is not delivered yet,
 * answers a bare 404 — no message.
 */
import { API_URL } from '@env';
import apiRequest, { ApiRequestOptions } from '../network/apiRequest';
import { ENDPOINTS } from '../network/endpoints';
import { PortalPrescription, toPortalPrescription } from './PatientPrescriptionRepository';

/** Who a record belongs to — shared by every list row. */
export interface RecordPatient {
  patientRegistrationId: number;
  patientName: string;
  patientCode: string;
}

export interface PathologyReportSummary extends RecordPatient {
  /** Reports are keyed by the bill row, not the result entry. */
  billRowId: number;
  billCode: string;
  /** 'YYYY-MM-DD'. */
  billDate: string;
  itemName: string;
  department: string;
  reportId: string;
  /** ISO, UTC. */
  deliveredAt: string;
}

/** The lab's own flag on a result — never derived from the range. */
export type ResultFlag = 'high' | 'low' | 'normal';

export interface PathologyResultRow {
  /** A sub-heading the row sits under, e.g. "Differential Count". */
  groupName: string;
  attribute: string;
  value: string;
  unit: string;
  normalRange: string;
  flag: ResultFlag;
  /** The test this line came from — one report can merge several. */
  itemName: string;
}

export interface PathologyReportDetail extends PathologyReportSummary {
  sampleType: string;
  interpretation: string;
  comments: string;
  advice: string;
  /** A free-form report body, kept with its line breaks. */
  manualContent: string;
  /** Set when the report was issued as a scanned file the portal cannot fetch. */
  documentFileName: string;
  preparedByName: string;
  verifiedByName: string;
  finalizedByName: string;
  finalizedAt: string;
  rows: PathologyResultRow[];
}

export interface RadiologyReportSummary extends RecordPatient {
  billRowId: number;
  billCode: string;
  billDate: string;
  itemName: string;
  department: string;
  reportId: string;
  accessionNo: string;
  /** When the study was performed — ISO, UTC. */
  appointmentDate: string;
  deliveredAt: string;
}

export interface RadiologyReportDetail extends RadiologyReportSummary {
  /** Rich-text HTML from the desk — read it through `parseReportHtml`, never as is. */
  reportContent: string;
  preparedByName: string;
  finalizedByName: string;
  finalizedAt: string;
  patientGender: string;
  /** 'YYYY-MM-DD'. */
  patientDob: string;
  patientMobile: string;
}

export interface PrescriptionDose {
  dose: string;
  durationValue: string;
  durationUnit: string;
  note: string;
}

export interface PrescriptionMedicine {
  type: string;
  generic: string;
  brand: string;
  route: string;
  dose: string;
  durationValue: string;
  durationUnit: string;
  isContinue: boolean;
  isMixed: boolean;
  note: string;
  /** Set only for a multi-dose medicine, in place of the single-dose fields. */
  multiDose: PrescriptionDose[];
}

export interface PrescriptionSectionLine {
  text: string;
  note: string;
  isUrgent: boolean;
}

export interface PrescriptionSection {
  key: string;
  label: string;
  groups: { groupName: string; lines: PrescriptionSectionLine[] }[];
}

export interface PrescriptionDetail extends PortalPrescription {
  medicines: PrescriptionMedicine[];
  /** Only the sections the doctor filled in, in the printed sheet's order. */
  sections: PrescriptionSection[];
}

const toText = (value: any): string => String(value ?? '').trim();
const toNumber = (value: any): number => Number(value ?? 0) || 0;
const toArray = (value: any): any[] => (Array.isArray(value) ? value : []);

const toPatient = (raw: any): RecordPatient => ({
  patientRegistrationId: toNumber(raw?.patientRegistrationId),
  patientName: toText(raw?.patientName),
  patientCode: toText(raw?.patientCode),
});

const toPathologySummary = (raw: any): PathologyReportSummary => ({
  ...toPatient(raw),
  billRowId: toNumber(raw?.billRowId),
  billCode: toText(raw?.billCode),
  billDate: toText(raw?.billDate).slice(0, 10),
  itemName: toText(raw?.itemName),
  department: toText(raw?.department),
  reportId: toText(raw?.reportId),
  deliveredAt: toText(raw?.deliveredAt),
});

const toFlag = (raw: any): ResultFlag => {
  const flag = toText(raw).toLowerCase();
  return flag === 'high' || flag === 'low' ? flag : 'normal';
};

const toPathologyDetail = (raw: any): PathologyReportDetail => ({
  ...toPathologySummary(raw),
  sampleType: toText(raw?.sampleType),
  interpretation: toText(raw?.interpretation),
  comments: toText(raw?.comments),
  advice: toText(raw?.advice),
  manualContent: toText(raw?.manualContent),
  documentFileName: toText(raw?.documentFileName),
  preparedByName: toText(raw?.preparedByName),
  verifiedByName: toText(raw?.verifiedByName),
  finalizedByName: toText(raw?.finalizedByName),
  finalizedAt: toText(raw?.finalizedAt),
  rows: toArray(raw?.rows).map(row => ({
    groupName: toText(row?.attributeGroupName),
    attribute: toText(row?.attribute),
    value: toText(row?.resultValue),
    unit: toText(row?.unit),
    normalRange: toText(row?.normalRange),
    flag: toFlag(row?.resultStatus),
    itemName: toText(row?.itemName),
  })),
});

const toRadiologySummary = (raw: any): RadiologyReportSummary => ({
  ...toPatient(raw),
  billRowId: toNumber(raw?.billRowId),
  billCode: toText(raw?.billCode),
  billDate: toText(raw?.billDate).slice(0, 10),
  itemName: toText(raw?.itemName),
  department: toText(raw?.department),
  reportId: toText(raw?.reportId),
  accessionNo: toText(raw?.accessionNo),
  appointmentDate: toText(raw?.appointmentDate),
  deliveredAt: toText(raw?.deliveredAt),
});

const toRadiologyDetail = (raw: any): RadiologyReportDetail => ({
  ...toRadiologySummary(raw),
  reportContent: String(raw?.reportContent ?? ''),
  preparedByName: toText(raw?.preparedByName),
  finalizedByName: toText(raw?.finalizedByName),
  finalizedAt: toText(raw?.finalizedAt),
  patientGender: toText(raw?.patientGender),
  patientDob: toText(raw?.patientDob).slice(0, 10),
  patientMobile: toText(raw?.patientMobile),
});

const toDose = (raw: any): PrescriptionDose => ({
  dose: toText(raw?.dose),
  durationValue: toText(raw?.durationValue),
  durationUnit: toText(raw?.durationUnit),
  note: toText(raw?.note),
});

const toPrescriptionDetail = (raw: any): PrescriptionDetail => ({
  ...toPortalPrescription(raw),
  medicines: toArray(raw?.medicines).map(item => ({
    ...toDose(item),
    type: toText(item?.type),
    generic: toText(item?.generic),
    brand: toText(item?.brand),
    route: toText(item?.route),
    isContinue: Boolean(item?.isContinue),
    isMixed: Boolean(item?.isMixed),
    multiDose: toArray(item?.multiDose).map(toDose),
  })),
  sections: toArray(raw?.sections).map(section => ({
    key: toText(section?.key),
    label: toText(section?.label),
    groups: toArray(section?.groups).map(group => ({
      groupName: toText(group?.groupName),
      lines: toArray(group?.lines).map(line => ({
        text: toText(line?.text),
        note: toText(line?.note),
        isUrgent: Boolean(line?.isUrgent),
      })),
    })),
  })),
});

/** The lists answer bare arrays; anything else is a failure, not "no reports". */
const getList = async <T>(url: string, map: (raw: any) => T): Promise<T[]> => {
  const api_params: ApiRequestOptions = { url, method: 'GET', baseUrl: API_URL };
  const response = await apiRequest<any>(api_params);
  if (!Array.isArray(response)) throw new Error('Unexpected records response');
  return response?.map(map) ?? [];
};

const getOne = async <T>(url: string, params: Record<string, number>, map: (raw: any) => T): Promise<T> => {
  const api_params: ApiRequestOptions = { url, method: 'GET', baseUrl: API_URL, params };
  const response = await apiRequest<any>(api_params);
  if (!response || typeof response !== 'object' || Array.isArray(response)) {
    throw new Error('Unexpected record response');
  }
  return map(response);
};

export const MedicalRecordRepository = {
  getPathologyReports: () => getList(ENDPOINTS.portalPathologyReports, toPathologySummary),

  getPathologyReport: (billRowId: number) =>
    getOne(ENDPOINTS.portalPathologyReport, { billRowId: toNumber(billRowId) }, toPathologyDetail),

  getRadiologyReports: () => getList(ENDPOINTS.portalRadiologyReports, toRadiologySummary),

  getRadiologyReport: (billRowId: number) =>
    getOne(ENDPOINTS.portalRadiologyReport, { billRowId: toNumber(billRowId) }, toRadiologyDetail),

  /** The list is the one My Prescriptions shows; this is one of them in full. */
  getPrescription: (prescriptionId: number) =>
    getOne(
      ENDPOINTS.portalPrescriptionDetail,
      { prescriptionId: toNumber(prescriptionId) },
      toPrescriptionDetail,
    ),
};

export default MedicalRecordRepository;
