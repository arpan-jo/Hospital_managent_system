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
import axios from 'axios';
import apiRequest, { ApiRequestOptions } from '../network/apiRequest';
import { ENDPOINTS } from '../network/endpoints';
import { DicomFrameInfo, multipartBody, readFrameInfo } from '../utils/dicomPixels';
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
  /** What is still unpaid on the test's bill; 0 when paid, or on a backend older than the field. */
  billDueAmount: number;
  /**
   * The bill has money due, so the report is held back online even when final —
   * the PDF and the images answer 404 until it is paid, as on the portal.
   */
  isLockedByDue: boolean;
  /**
   * When the hospital expects to hand the report over — from the item's normal
   * or urgent delivery schedule, Bangladesh wall-clock with no zone. '' when the
   * test has no schedule, or the backend is older than the field.
   */
  expectedDeliveryAt: string;
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

/** What the viewer link points at: the PACS, the studies, and the token that opens them. */
export interface PacsViewerLink {
  /** `http(s)://host:port` — DICOMweb lives under `/dicom-web` on the same host. */
  origin: string;
  studyUids: string[];
  token: string;
}

/** One frame of a series: its stored pixels, and the JPEG the PACS renders of it. */
export interface RadiologyFrame {
  /** The stored pixels, uncompressed — `getRadiologyFramePixels` reads them. */
  pixelUrl: string;
  /** A ready JPEG — thumbnails, and frames the app does not window itself (colour). */
  renderedUrl: string;
  info: DicomFrameInfo;
}

/** A DICOM attribute for the viewer's info sheet — its keyword and value, as text. */
export interface DicomTagLine {
  keyword: string;
  value: string;
}

/** One series of a study — every frame in it, in scan order. */
export interface RadiologySeries {
  uid: string;
  modality: string;
  description: string;
  frames: RadiologyFrame[];
  /** Patient, study and acquisition attributes of its first instance. */
  tags: DicomTagLine[];
}

/** A study as the app's own viewer draws it. */
export interface RadiologyStudy {
  /** The viewer token: the PACS proxy checks it on every request. */
  token: string;
  /** Headers for a rendered JPEG. */
  imageHeaders: Record<string, string>;
  series: RadiologySeries[];
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

/** Who a record belongs to — every portal list row carries the same three fields. */
export const toRecordPatient = (raw: any): RecordPatient => ({
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
  const billDueAmount = Math.max(0, toNumber(raw?.billDueAmount));
  return {
    ...toRecordPatient(raw),
    billRowId: toNumber(raw?.billRowId),
    billCode: toText(raw?.billCode),
    billDate: toText(raw?.billDate).slice(0, 10),
    itemName: toText(raw?.itemName),
    department: toText(raw?.department),
    status,
    // Both must agree: the PDF route answers 404 until the stage is final.
    isReportReady: status === 'final' && raw?.isReportReady !== false,
    billDueAmount,
    // The server's own flag is `billDueAmount > 0`; either says the bill is owed.
    isLockedByDue: raw?.isLockedByDue === true || billDueAmount > 0,
    expectedDeliveryAt: toText(raw?.expectedDeliveryAt),
  };
};

const toRadiologyImages = (raw: any): RadiologyImages => ({
  found: Boolean(raw?.found),
  viewerUrl: toText(raw?.viewerUrl),
  message: toText(raw?.message),
});

/** A DICOM UID: digits and dots only — it goes into a URL path, so nothing else is let through. */
const DICOM_UID = /^[0-9]+(\.[0-9]+)*$/;

/** Series that hold no pictures — a structured report, presentation state, key-object note, PDF. */
const NON_IMAGE_MODALITIES = ['SR', 'PR', 'KO', 'DOC'];

/**
 * The backend's viewer link — `{PACS}/ohif/viewer?StudyInstanceUIDs=1.2,3.4&token=<JWT>` —
 * read for the app's own viewer. Null when any part is missing or odd.
 */
export const parsePacsViewerLink = (viewerUrl?: string | null): PacsViewerLink | null => {
  const url = toText(viewerUrl);
  const origin = /^https?:\/\/[^/?#]+/i.exec(url)?.[0] ?? '';
  const query: Record<string, string> = {};
  (url.split('#')[0]?.split('?')[1] ?? '').split('&').forEach(pair => {
    const [key = '', ...value] = pair.split('=');
    try {
      query[key.toLowerCase()] = decodeURIComponent(value.join('='));
    } catch {
      // A malformed escape leaves that value out; the checks below refuse the link.
    }
  });
  const studyUids = (query.studyinstanceuids ?? '').split(',').map(uid => uid.trim()).filter(Boolean);
  const token = query.token?.trim() ?? '';
  if (!origin || !token || !studyUids.length || !studyUids.every(uid => DICOM_UID.test(uid))) return null;
  return { origin, studyUids, token };
};

/** A DICOM JSON attribute's first value: `{ "00200013": { "vr": "IS", "Value": [4] } }`. */
const dicomValue = (raw: any, tag: string): any => raw?.[tag]?.Value?.[0];

/**
 * A DICOMweb search, straight to the PACS — not through `apiRequest`, which would encrypt it
 * and swap the viewer token for the HMS login. An empty answer (Orthanc sends 204) is no rows.
 */
const getDicomJson = async (url: string, token: string): Promise<any[]> => {
  const response = await axios.get(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/dicom+json' },
    timeout: 20000,
  });
  return toArray(response?.data);
};

/** The attributes the info sheet lists, in its order — keyword and tag. */
const INFO_TAGS: [string, string][] = [
  ['PatientName', '00100010'],
  ['PatientID', '00100020'],
  ['PatientSex', '00100040'],
  ['PatientAge', '00101010'],
  ['StudyDate', '00080020'],
  ['StudyDescription', '00081030'],
  ['SeriesDescription', '0008103E'],
  ['Modality', '00080060'],
  ['BodyPartExamined', '00180015'],
  ['ViewPosition', '00185101'],
  ['InstitutionName', '00080080'],
  ['Manufacturer', '00080070'],
  ['ManufacturerModelName', '00081090'],
  ['Rows', '00280010'],
  ['Columns', '00280011'],
  ['BitsStored', '00280101'],
  ['PixelSpacing', '00280030'],
  ['ImagerPixelSpacing', '00181164'],
  ['SliceThickness', '00180050'],
  ['KVP', '00180060'],
  ['ExposureTime', '00181150'],
  ['XRayTubeCurrent', '00181151'],
  ['WindowCenter', '00281050'],
  ['WindowWidth', '00281051'],
  ['RescaleIntercept', '00281052'],
  ['RescaleSlope', '00281053'],
];

/** A value as text — a person's name is an object in DICOM JSON. */
const tagText = (raw: any, tag: string): string =>
  toArray(raw?.[tag]?.Value)
    .map(value => (typeof value === 'object' ? toText(value?.Alphabetic) : toText(value)))
    .filter(Boolean)
    .join(' \\ ');

/**
 * One series, from its metadata — every instance's attributes in one request: each instance
 * in instance-number order, each of its frames in turn.
 */
const readSeries = async (studyPath: string, raw: any, token: string) => {
  const uid = toText(dicomValue(raw, '0020000E'));
  const modality = toText(dicomValue(raw, '00080060')).toUpperCase();
  if (!DICOM_UID.test(uid) || NON_IMAGE_MODALITIES.includes(modality)) return null;

  const seriesPath = `${studyPath}/series/${uid}`;
  const instances = (await getDicomJson(`${seriesPath}/metadata`, token))
    .map(item => ({
      raw: item,
      uid: toText(dicomValue(item, '00080018')),
      number: toNumber(dicomValue(item, '00200013')),
    }))
    // An instance with no Rows holds no picture (a stray report or key-object note).
    .filter(item => DICOM_UID.test(item.uid) && toNumber(dicomValue(item.raw, '00280010')) > 0)
    .sort((a, b) => a.number - b.number);

  const frames = instances.flatMap(item => {
    const info = readFrameInfo(item.raw);
    const count = Math.max(1, toNumber(dicomValue(item.raw, '00280008')));
    return Array.from({ length: count }, (_, index) => {
      const framePath = `${seriesPath}/instances/${item.uid}/frames/${index + 1}`;
      return { pixelUrl: framePath, renderedUrl: `${framePath}/rendered`, info };
    });
  });

  const first = instances[0]?.raw;
  return {
    number: toNumber(dicomValue(raw, '00200011')),
    series: {
      uid,
      modality,
      description: toText(dicomValue(raw, '0008103E')),
      frames,
      tags: INFO_TAGS.map(([keyword, tag]) => ({ keyword, value: tagText(first, tag) })).filter(
        line => line.value,
      ),
    },
  };
};

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

  /**
   * The studies behind a viewer link, read over DICOMweb with the link's own token: every
   * series that holds pictures, in series-number order. The PACS renders each frame to a
   * JPEG, so the phone never decodes DICOM. The token expires (an hour, by default), so a
   * failing image means asking `getRadiologyImages` for a fresh link.
   */
  getRadiologyStudy: async (viewerUrl: string): Promise<RadiologyStudy> => {
    const link = parsePacsViewerLink(viewerUrl);
    if (!link) throw new Error('Unexpected images link');

    const perStudy = await Promise.all(
      link.studyUids.map(async studyUid => {
        const studyPath = `${link.origin}/dicom-web/studies/${studyUid}`;
        const rows = await getDicomJson(`${studyPath}/series`, link.token);
        const series = await Promise.all(rows.map(raw => readSeries(studyPath, raw, link.token)));
        return series
          .filter(item => (item?.series?.frames?.length ?? 0) > 0)
          .sort((a, b) => (a?.number ?? 0) - (b?.number ?? 0))
          .map(item => item!.series);
      }),
    );

    return {
      token: link.token,
      imageHeaders: { Authorization: `Bearer ${link.token}`, Accept: 'image/jpeg' },
      series: perStudy.flat(),
    };
  },

  /**
   * One frame's stored pixels, uncompressed: the PACS transcodes whatever it holds (JPEG
   * lossless, JPEG 2000…) to Explicit VR Little Endian and answers it as one multipart part.
   */
  getRadiologyFramePixels: async (pixelUrl: string, token: string): Promise<Uint8Array> => {
    const response = await axios.get(pixelUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'multipart/related; type="application/octet-stream"; transfer-syntax=1.2.840.10008.1.2.1',
      },
      responseType: 'arraybuffer',
      timeout: 60000,
    });
    const answer = new Uint8Array(response?.data ?? new ArrayBuffer(0));
    if (!answer.length) throw new Error('Empty frame response');
    return multipartBody(answer);
  },

  /** The JPEG the PACS renders of a frame — for thumbnails, and colour frames. */
  getRadiologyRenderedFrame: async (renderedUrl: string, token: string): Promise<Uint8Array> => {
    const response = await axios.get(renderedUrl, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'image/jpeg' },
      responseType: 'arraybuffer',
      timeout: 30000,
    });
    const answer = new Uint8Array(response?.data ?? new ArrayBuffer(0));
    if (!answer.length) throw new Error('Empty image response');
    return answer;
  },

  /** The list is the one My Prescriptions shows; this is one of them in full. */
  getPrescription: (prescriptionId: number) =>
    getOne(
      ENDPOINTS.portalPrescriptionDetail,
      { prescriptionId: toNumber(prescriptionId) },
      toPrescriptionDetail,
    ),
};

export default MedicalRecordRepository;
