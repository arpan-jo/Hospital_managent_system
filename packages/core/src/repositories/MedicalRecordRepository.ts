/**
 * What the hospital issued to the patient, as the portal's Reports page reads
 * it from `/hms/portal/medical-records`: every lab and imaging test with the
 * stage it has reached (its report is the printed sheet, as a PDF, once final;
 * a radiology test's images are a link to the PACS viewer), and visit
 * prescriptions in full. Every list is the account's — the patient's
 * own and their family members' — newest first, unpaged; each row names its
 * patient so the screen can narrow by person.
 *
 * A single record the account does not own, or that is not final yet, answers
 * a bare 404 — no message.
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

export type LabTestType = 'pathology' | 'radiology';

/**
 * How far a test has got: pending → collected (sample taken) → received (in
 * the lab) → result_pending (entered, not signed off) → final. Radiology has no
 * sample, so it is only ever pending, result_pending or final.
 */
export type LabTestStatus = 'pending' | 'collected' | 'received' | 'result_pending' | 'final';

export const LAB_TEST_STATUSES: LabTestStatus[] = [
  'pending',
  'collected',
  'received',
  'result_pending',
  'final',
];

/** One ordered lab or imaging test — its name and stage; the result is the PDF once final. */
export interface LabTest extends RecordPatient {
  /** Tests are keyed by the bill row; the report PDF is too. */
  billRowId: number;
  billCode: string;
  /** 'YYYY-MM-DD'. */
  billDate: string;
  itemName: string;
  department: string;
  status: LabTestStatus;
  /** The report PDF can be opened. */
  isReportReady: boolean;
}

/**
 * A radiology test's own images. They are not kept with the report: the PACS
 * holds them, and its viewer is a web page of its own.
 */
export interface RadiologyImages {
  /** The PACS holds images for the test. */
  found: boolean;
  /** The viewer page, with a short-lived token in it; '' when not found. */
  viewerUrl: string;
  /** Why not, when not found — the server's own words. */
  message: string;
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

/** An unknown stage reads as the earliest — never as a ready report. */
const toLabTestStatus = (raw: any): LabTestStatus => {
  const status = toText(raw).toLowerCase() as LabTestStatus;
  return LAB_TEST_STATUSES.includes(status) ? status : 'pending';
};

const toLabTest = (raw: any): LabTest => {
  const status = toLabTestStatus(raw?.status);
  return {
    ...toPatient(raw),
    billRowId: toNumber(raw?.billRowId),
    billCode: toText(raw?.billCode),
    billDate: toText(raw?.billDate).slice(0, 10),
    itemName: toText(raw?.itemName),
    department: toText(raw?.department),
    status,
    // Both must agree: the PDF route answers 404 until the stage is final.
    isReportReady: status === 'final' && raw?.isReportReady !== false,
  };
};

const toRadiologyImages = (raw: any): RadiologyImages => ({
  found: Boolean(raw?.found),
  viewerUrl: toText(raw?.viewerUrl),
  message: toText(raw?.message),
});

/** One part of a saved report's name: letters, digits, '-' and '_' only. */
const toFileNamePart = (value?: string | null): string =>
  toText(value)
    .replace(/[^\w-]+/g, '_')
    .replace(/^_+|_+$/g, '');

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
const getList = async <T>(
  url: string,
  map: (raw: any) => T,
  params?: Record<string, string>,
): Promise<T[]> => {
  const api_params: ApiRequestOptions = { url, method: 'GET', baseUrl: API_URL, params };
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
  /** `GET GetMyLabTests?type=` — every test of that kind, any stage, newest bill first. */
  getLabTests: (type: LabTestType) =>
    getList(ENDPOINTS.portalLabTests, toLabTest, { type: type === 'radiology' ? 'radiology' : 'pathology' }),

  /**
   * Where one final test report is served — the printed sheet as a PDF. The
   * route is outside the API's encryption, so the query goes in plain; it needs
   * the patient's login, which `getFileHeaders` adds. `tz` stamps the sheet's
   * "Printed" time in the phone's own zone, as the portal does.
   */
  getLabReportPdfUrl: (billRowId: number): string =>
    `${API_URL}${ENDPOINTS.portalLabReportPdf}/${toNumber(billRowId)}/pdf?tz=${-new Date().getTimezoneOffset()}`,

  /**
   * The name a saved report gets, as the portal names it: `Report_CBC_BILL-2611-0084.pdf`.
   * The viewer swaps the extension when the report turns out to be an uploaded image.
   */
  getLabReportFileName: (test?: Partial<LabTest> | null): string => {
    const name = [toFileNamePart(test?.itemName), toFileNamePart(test?.billCode)]
      .filter(Boolean)
      .join('_');
    return `Report_${name || toNumber(test?.billRowId)}.pdf`;
  },

  /**
   * `GET GetRadiologyImages?billRowId=` — the PACS viewer link for one final
   * radiology test, under the same rule as its report: a bare 404 until it is
   * final, or when the test is not the account's. `found: false` with a message
   * when the PACS holds no images for it.
   */
  getRadiologyImages: (billRowId: number) =>
    getOne(ENDPOINTS.portalRadiologyImages, { billRowId: toNumber(billRowId) }, toRadiologyImages),

  /** The list is the one My Prescriptions shows; this is one of them in full. */
  getPrescription: (prescriptionId: number) =>
    getOne(
      ENDPOINTS.portalPrescriptionDetail,
      { prescriptionId: toNumber(prescriptionId) },
      toPrescriptionDetail,
    ),
};

export default MedicalRecordRepository;
