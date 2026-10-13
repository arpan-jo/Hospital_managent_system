/**
 * The printed prescription page — the shapes a saved prescription and its page
 * layout arrive in, and the call that renders the finished sheet to PDF.
 *
 * A prescription is written on the doctor's side of the system, section by
 * section, onto a page the doctor laid out themselves. A patient only ever
 * reads it back, so nothing here writes: these are the types and mappers
 * PatientPrescriptionRepository and the patient's preview screen share.
 */
import { API_URL } from '@env';
import ReactNativeBlobUtil from 'react-native-blob-util';
import apiRequest, { ApiRequestOptions } from '../network/apiRequest';
import { ENDPOINTS } from '../network/endpoints';

// ─────────────────────────────────────────────────────────────────────────────
// Shared mapping helpers
// ─────────────────────────────────────────────────────────────────────────────

const toText = (value: any): string => String(value ?? '').trim();

const toNumber = (value: any, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

// ─────────────────────────────────────────────────────────────────────────────
// Sections — what a prescription is made of, and in which column
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Which of the doctor's two columns a section belongs to. The web lays them
 * out side by side, "Medical Assessment" and "Prescription", and the printed
 * page keeps the same two — the split is the doctor's own setup.
 */
export type DeskSectionColumn = 'left' | 'right';

export interface DeskSection {
  /** `componentKey`, kept as the free text the API stores. */
  key: string;
  /** The doctor's own label, e.g. "O/E" in place of Physical Examination. */
  title: string;
  column: DeskSectionColumn;
  /** Order within the column, ascending. */
  serial: number;
}

/**
 * Whatever the doctor has entered, keyed by section. Each section owns the
 * shape of its own value, so the desk carries the whole thing as one opaque
 * blob — it is stored as JSON and read back the same way.
 */
export type SectionData = Record<string, unknown>;

// ─────────────────────────────────────────────────────────────────────────────
// Page layout — the paper the prescription prints on
// ─────────────────────────────────────────────────────────────────────────────

/** A header or footer strip of the printed page, laid out in columns. */
export interface PrescriptionBand {
  enabled: boolean;
  columns: number;
  /** Relative column widths, one per column. */
  widths: number[];
  /** One HTML string per column, authored in the web's page designer. */
  contents: string[];
  gap: number;
  padding: number;
  background: string;
  borderWidth: number;
  borderColor: string;
}

/** A single-block strip — the hospital letterhead and the notice band. */
export interface PrescriptionBlock {
  enabled: boolean;
  /** Inches. */
  height: number;
  padding: number;
  background: string;
  borderWidth: number;
  borderColor: string;
  /** HTML authored in the web's page designer. */
  content: string;
}

/**
 * The doctor's signature at the foot of the page — a signature image followed
 * by their name, designation and BMDC number, all authored in the designer.
 */
export interface PrescriptionSignature extends PrescriptionBlock {
  /** Where the block sits across the page. */
  position: 'left' | 'center' | 'right';
}

/**
 * The doctor's printed page. Every length is in inches, matching the designer
 * that produced it; the preview scales them to the device.
 */
export interface PrescriptionPageLayout {
  page: {
    size: string;
    orientation: string;
    width: number;
    height: number;
    margins: { top: number; right: number; bottom: number; left: number };
    headerHeight: number;
    footerHeight: number;
  };
  hospitalInfo: PrescriptionBlock;
  header: PrescriptionBand;
  footer: PrescriptionBand;
  notice: PrescriptionBlock;
  body: {
    mode: 'single' | 'split';
    gap: number;
    /** Percent of the width the left column takes when `mode` is `split`. */
    leftWidth: number;
  };
  watermark: { enabled: boolean; text: string };
  signature: PrescriptionSignature;
}

const emptyBand = (): PrescriptionBand => ({
  enabled: false,
  columns: 1,
  widths: [1],
  contents: [''],
  gap: 8,
  padding: 8,
  background: '#FFFFFF',
  borderWidth: 0,
  borderColor: '#E2E8F0',
});

const emptyBlock = (
  background: string,
  borderColor: string,
): PrescriptionBlock => ({
  enabled: false,
  height: 0.5,
  padding: 8,
  background,
  borderWidth: 0,
  borderColor,
  content: '',
});

/** A4 portrait with plain margins — what an unconfigured doctor prints on. */
export const defaultPrescriptionPageLayout = (): PrescriptionPageLayout => ({
  page: {
    size: 'A4',
    orientation: 'Portrait',
    width: 8.27,
    height: 11.69,
    margins: { top: 0.4, right: 0.4, bottom: 0.4, left: 0.4 },
    headerHeight: 0.6,
    footerHeight: 0.5,
  },
  hospitalInfo: emptyBlock('#FFFFFF', '#E2E8F0'),
  header: emptyBand(),
  footer: emptyBand(),
  notice: emptyBlock('#FEF9C3', '#FDE68A'),
  body: { mode: 'single', gap: 12, leftWidth: 50 },
  watermark: { enabled: false, text: '' },
  // On by default, as the designer has it — with nothing written it prints nothing.
  signature: { ...emptyBlock('#FFFFFF', '#E2E8F0'), enabled: true, height: 0.9, position: 'left' },
});

const toBand = (raw: any): PrescriptionBand => {
  const fallback = emptyBand();

  return {
    enabled: Boolean(raw?.enabled),
    columns: Math.max(1, toNumber(raw?.columns, fallback.columns)),
    widths: Array.isArray(raw?.widths)
      ? raw.widths.map((width: any) => toNumber(width, 1))
      : fallback.widths,
    contents: Array.isArray(raw?.contents)
      ? raw.contents.map((content: any) => String(content ?? ''))
      : fallback.contents,
    gap: toNumber(raw?.gap, fallback.gap),
    padding: toNumber(raw?.padding, fallback.padding),
    background: toText(raw?.background) || fallback.background,
    borderWidth: toNumber(raw?.borderWidth, fallback.borderWidth),
    borderColor: toText(raw?.borderColor) || fallback.borderColor,
  };
};

const toBlock = (raw: any, fallback: PrescriptionBlock): PrescriptionBlock => ({
  enabled: Boolean(raw?.enabled),
  height: toNumber(raw?.height, fallback.height),
  padding: toNumber(raw?.padding, fallback.padding),
  background: toText(raw?.background) || fallback.background,
  borderWidth: toNumber(raw?.borderWidth, fallback.borderWidth),
  borderColor: toText(raw?.borderColor) || fallback.borderColor,
  // The notice band calls its HTML `text`; the letterhead calls it `content`.
  content: String(raw?.content ?? raw?.text ?? fallback.content),
});

/**
 * `layoutJson` is written by a designer this app does not host, so it is read
 * field by field against the defaults rather than trusted whole. A payload
 * without a page width never came from that designer and is discarded.
 *
 * Exported because `GET /api/prescriptions/{id}/preview` carries the very same
 * `layoutJson` — the patient's own copy of a saved prescription — so its
 * repository parses it through this rather than keeping a second reader that
 * would drift the moment the designer gains a field.
 */
export const toPageLayout = (json: any): PrescriptionPageLayout | null => {
  if (!json) return null;

  let parsed: any;
  try {
    parsed = typeof json === 'string' ? JSON.parse(json) : json;
  } catch {
    return null;
  }
  if (!parsed?.page?.width) return null;

  const fallback = defaultPrescriptionPageLayout();
  const margins = parsed?.page?.margins;

  return {
    page: {
      size: toText(parsed?.page?.size) || fallback.page.size,
      orientation:
        toText(parsed?.page?.orientation) || fallback.page.orientation,
      width: toNumber(parsed?.page?.width, fallback.page.width),
      height: toNumber(parsed?.page?.height, fallback.page.height),
      margins: {
        top: toNumber(margins?.top, fallback.page.margins.top),
        right: toNumber(margins?.right, fallback.page.margins.right),
        bottom: toNumber(margins?.bottom, fallback.page.margins.bottom),
        left: toNumber(margins?.left, fallback.page.margins.left),
      },
      headerHeight: toNumber(
        parsed?.page?.headerHeight,
        fallback.page.headerHeight,
      ),
      footerHeight: toNumber(
        parsed?.page?.footerHeight,
        fallback.page.footerHeight,
      ),
    },
    hospitalInfo: toBlock(parsed?.hospitalInfo, fallback.hospitalInfo),
    header: toBand(parsed?.header),
    footer: toBand(parsed?.footer),
    notice: toBlock(parsed?.notice, fallback.notice),
    body: {
      mode: parsed?.body?.mode === 'split' ? 'split' : 'single',
      gap: toNumber(parsed?.body?.gap, fallback.body.gap),
      leftWidth: toNumber(parsed?.body?.leftWidth, fallback.body.leftWidth),
    },
    watermark: {
      enabled: Boolean(parsed?.watermark?.enabled),
      text: toText(parsed?.watermark?.text),
    },
    // Added to the designer after the first layouts were saved, so an older
    // layout has none and takes the default — enabled, and empty.
    signature: parsed?.signature
      ? {
          ...toBlock(parsed.signature, fallback.signature),
          position: ['center', 'right'].includes(parsed?.signature?.position)
            ? parsed.signature.position
            : 'left',
        }
      : fallback.signature,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Lookups — the categories a section's entries are filed under
// ─────────────────────────────────────────────────────────────────────────────

/** The categories the API files lookup entries under. */
export type OpdLookupType =
  | 'ChiefComplaint'
  | 'Diagnosis'
  | 'Disposal'
  | 'TreatmentPlan'
  | 'Advice'
  | 'FollowUp'
  | 'Referred'
  | 'Investigation'
  | 'Services'
  | 'BtOrder'
  | 'Operation'
  /** Not a section — the phrases Rx offers under its instruction boxes. */
  | 'Instruction';

// ─────────────────────────────────────────────────────────────────────────────
// Medicines — the Rx rows of a saved prescription
// ─────────────────────────────────────────────────────────────────────────────

/**
 * One dose period of a medicine whose course changes partway — "2+0+2 for 5
 * days, then 1+0+1 for 5 days". A row with these carries no scalar dose of its
 * own; the periods replace it.
 */
export interface RxDosePeriod {
  dose: string;
  durationValue: string;
  durationUnit: string;
  instruction: string;
}

/** One line of the prescription's medicine table. */
export interface RxItem {
  /** 'Generic' or 'Brand' — which name the doctor prescribed by. */
  type: string;
  generic: string;
  /** The only field the API requires. */
  brand: string;
  route: string;
  /** e.g. '1+0+1'. Empty when `multiDose` carries the schedule instead. */
  dose: string;
  durationValue: string;
  durationUnit: string;
  /** The patient is already on this and carries on with it. */
  isContinue: boolean;
  /** Mixed into another medicine rather than taken on its own. */
  isMixed: boolean;
  note: string;
  /**
   * The periods of a course that changes partway. Named as the API and every
   * other reader of the saved snapshot names it — the portal, the printed page
   * and the patient's own copy all look for `multiDose`.
   */
  multiDose: RxDosePeriod[];
}

const toDosePeriod = (raw: any): RxDosePeriod => ({
  dose: toText(raw?.dose),
  durationValue: toText(raw?.durationValue),
  durationUnit: toText(raw?.durationUnit),
  instruction: toText(raw?.instruction),
});

/** Exported so the Rx form can read the items back out of a saved snapshot. */
export const toRxItem = (raw: any): RxItem => {
  // Drafts and prescriptions this app wrote before the name was brought in
  // line with the API carry the same periods under `dosePeriods`.
  const periods = Array.isArray(raw?.multiDose)
    ? raw.multiDose
    : Array.isArray(raw?.dosePeriods)
    ? raw.dosePeriods
    : [];

  return {
    type: toText(raw?.type),
    generic: toText(raw?.generic),
    brand: toText(raw?.brand),
    route: toText(raw?.route),
    dose: toText(raw?.dose),
    durationValue: toText(raw?.durationValue),
    durationUnit: toText(raw?.durationUnit),
    isContinue: Boolean(raw?.isContinue),
    isMixed: Boolean(raw?.isMixed),
    note: toText(raw?.note),
    // A period with no dose is one added and never filled — the portal drops
    // it too, so it is never saved or printed as a bare "—" line.
    multiDose: periods.map(toDosePeriod).filter((period: RxDosePeriod) => period.dose),
  };
};

/**
 * Raw response bytes as base64. Chunked because a page's worth of bytes passed
 * to `fromCharCode` in one call overflows the argument stack.
 */
const toBase64 = (data: any): string => {
  if (!data) return '';
  if (typeof data === 'string') return ReactNativeBlobUtil.base64.encode(data);

  const bytes = new Uint8Array(data);
  const CHUNK = 8192;
  let binary = '';

  for (let index = 0; index < bytes.length; index += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(index, index + CHUNK));
  }
  return ReactNativeBlobUtil.base64.encode(binary);
};

// ─────────────────────────────────────────────────────────────────────────────
// Repository
// ─────────────────────────────────────────────────────────────────────────────

export const PrescriptionPageRepository = {
  /**
   * `POST /api/prescription-pdf` — the server renders the prescription's HTML
   * onto the doctor's own paper size and answers with the PDF itself.
   *
   * It comes back as bytes, and is handed on as a data URI so the viewer can
   * show it without anything being written to disk first. The page is one sheet,
   * so the conversion stays small.
   */
  generatePrescriptionPdf: async (input: {
    html: string;
    /** Inches, from the doctor's page layout. */
    widthIn: number;
    heightIn: number;
    /** Only names the file when it is downloaded. */
    prescriptionId?: number | null;
  }): Promise<string> => {
    const api_params: ApiRequestOptions = {
      url: ENDPOINTS.prescriptionPdf,
      method: 'POST',
      data: {
        html: input?.html ?? '',
        widthIn: toNumber(input?.widthIn, 8.27),
        heightIn: toNumber(input?.heightIn, 11.69),
        prescriptionId: input?.prescriptionId ?? null,
      },
      baseUrl: API_URL,
      responseType: 'arraybuffer',
      // A rendered page takes longer than a JSON read.
      timeout: 60_000,
      // `/api/prescription-pdf` is on the backend's `Encryption:ExcludedPaths`,
      // and the reply is a raw PDF rather than JSON — both sides stay plaintext.
      encrypt: false,
      decrypt: false,
    };
    const response = await apiRequest<any>(api_params);

    return `data:application/pdf;base64,${toBase64(response)}`;
  },
};

export default PrescriptionPageRepository;
