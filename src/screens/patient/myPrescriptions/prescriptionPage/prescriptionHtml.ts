import JsBarcode from 'jsbarcode';
import {
  DeskSection,
  PrescriptionBand,
  PrescriptionPageLayout,
  PrescriptionSignature,
  RxDosePeriod,
  RxItem,
  SectionData,
  getFileUrl,
  toRxItem,
} from '@app/core';
import { DeskPatient, patientLookupCode } from './deskTypes';
import { buildDeskSectionSummary, countDeskSectionEntries } from './deskSummaries';
import {
  QUERY_MARKER,
  SectionSummaryGroup,
  SectionSummaryLine,
  URGENT_MARKER,
} from './sectionSummary';

/**
 * The printed prescription, as HTML.
 *
 * The page is not drawn on the phone: this builds the same standalone markup
 * the portal builds, posts it to the server, and shows the PDF that comes back.
 * That way the sheet a patient is handed is identical whichever screen wrote
 * it — the paper size, the margins, the letterhead and the two-column body all
 * come from the doctor's own page setup, not from anything decided here.
 *
 * Every block below is written against the portal's `PreviewModal` builder,
 * down to the colours and spacing, so the two print the same page.
 */

/** The portal's pixels-per-inch, so a page laid out there measures the same here. */
const DPI = 96;

const NOTE_STYLE = 'font-size:10px;color:#64748B';

const escapeHtml = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * Designer-authored HTML with anything that could run taken out — the page is
 * rendered by a browser on the server, and the portal sanitises it too.
 */
const sanitizeHtml = (html: string): string =>
  String(html ?? '')
    .replace(/<(script|style|iframe|object|embed)[\s\S]*?<\/\1>/gi, '')
    .replace(/<(script|iframe|object|embed)[^>]*\/?>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*("|')\s*javascript:[^"']*\2/gi, '$1=$2#$2');

/** True when the HTML shows something — text, or at least an image. */
const htmlHasText = (html: string): boolean =>
  Boolean(html) &&
  (html.includes('<img') ||
    html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim().length > 0);

/**
 * An image the author put first, on its own, split from the rest — the portal
 * sets a leading logo beside the letterhead text and a signature image above
 * the name. It reads this with the browser's DOM parser; there is none here,
 * so the same two shapes the designer writes are matched directly: a bare
 * `<img>`, or one wrapped alone in a paragraph.
 */
const splitLeadingLogo = (html: string): { logoHtml: string | null; rest: string } => {
  const source = String(html ?? '');
  if (!source.includes('<img')) return { logoHtml: null, rest: source };

  const bare = /^\s*(<img\b[^>]*>)/i.exec(source);
  if (bare) return { logoHtml: bare[1], rest: source.slice(bare[0].length) };

  const wrapped = /^\s*<(p|div|figure|span)\b[^>]*>\s*(<img\b[^>]*>)\s*(?:<br\s*\/?>\s*)?<\/\1>/i.exec(
    source,
  );
  if (wrapped) return { logoHtml: wrapped[2], rest: source.slice(wrapped[0].length) };

  return { logoHtml: null, rest: source };
};

const pad2 = (value: number): string => String(value).padStart(2, '0');

/** Today as 'DD/MM/YYYY' — spelled out, so the phone's language never reorders it. */
const todayText = (): string => {
  const now = new Date();
  return `${pad2(now.getDate())}/${pad2(now.getMonth() + 1)}/${now.getFullYear()}`;
};

/**
 * A CODE128 barcode as inline SVG. `jsbarcode` normally draws into a DOM node;
 * given a plain object it just reports the bar pattern, which is all that is
 * needed to emit the rectangles ourselves. One pixel a module, as printed there.
 */
const barcodeSvg = (code: string): string => {
  const value = code?.trim();
  if (!value) return '';

  const target: { encodings?: Array<{ data: string; text: string }> } = {};
  try {
    JsBarcode(target, value, {
      format: 'CODE128',
      displayValue: false,
      margin: 0,
    });
  } catch {
    // An unencodable code is not worth failing the whole page for.
    return '';
  }

  const pattern = target?.encodings?.[0]?.data ?? '';
  if (!pattern) return '';

  const barWidth = 1;
  const height = 26;
  const width = pattern.length * barWidth;
  let bars = '';

  for (let index = 0; index < pattern.length; ) {
    if (pattern[index] !== '1') {
      index += 1;
      continue;
    }
    let run = 0;
    while (pattern[index + run] === '1') run += 1;

    bars += `<rect x="${index * barWidth}" y="0" width="${run * barWidth}" height="${height}" fill="#000"/>`;
    index += run;
  }

  return `<svg width="${width}" height="${height + 12}" viewBox="0 0 ${width} ${
    height + 12
  }" xmlns="http://www.w3.org/2000/svg">${bars}<text x="${(width / 2).toFixed(0)}" y="${
    height + 10
  }" font-size="9" text-anchor="middle" fill="#000">${escapeHtml(value)}</text></svg>`;
};

// ── Letterhead ───────────────────────────────────────────────────────────────

const bandBorder = (band: { borderWidth: number; borderColor: string }): string =>
  band?.borderWidth ? `border:${band.borderWidth}px solid ${band.borderColor};` : '';

/**
 * A band's columns side by side, sized in proportion, each padded and divided
 * from the next so a two-language doctor block reads as two fields.
 */
const bandColumnsHtml = (band: PrescriptionBand): string =>
  (band?.widths ?? [1])
    .slice(0, Math.max(1, band?.columns ?? 1))
    .map((width, index) => {
      const divider = index > 0 ? 'border-left:1px solid #E2E8F0;' : '';
      return `<div style="flex:${width} ${width} 0%;min-width:0;overflow:hidden;padding:4px 10px;${divider}box-sizing:border-box;line-height:1.5;color:#475569">${sanitizeHtml(
        band?.contents?.[index] ?? '',
      )}</div>`;
    })
    .join('');

/**
 * Header or footer. Without a border of its own it gets a faint rule on the
 * side that meets the page body.
 */
const bandHtml = (band: PrescriptionBand, defaultBorderSide: 'top' | 'bottom'): string => {
  const defaultBorder = band?.borderWidth ? '' : `border-${defaultBorderSide}:1px solid #E2E8F0;`;
  return `<div style="display:flex;gap:${band?.gap ?? 8}px;padding:${band?.padding ?? 8}px;background:${
    band?.background ?? '#FFFFFF'
  };${bandBorder(band)}${defaultBorder}box-sizing:border-box;height:100%">${bandColumnsHtml(
    band,
  )}</div>`;
};

/** The hospital strip — a leading logo sits to the left of its text. */
const hospitalInfoHtml = (block: PrescriptionPageLayout['hospitalInfo']): string => {
  const { logoHtml, rest } = splitLeadingLogo(sanitizeHtml(block?.content ?? ''));
  const textBlock = htmlHasText(rest) ? `<div style="min-width:0">${rest}</div>` : '';
  const defaultBorder = block?.borderWidth ? '' : 'border-bottom:1px solid #E2E8F0;';

  return `<div style="display:flex;align-items:center;height:100%;padding:${block?.padding ?? 8}px;background:${
    block?.background ?? '#FFFFFF'
  };${bandBorder(block)}${defaultBorder}box-sizing:border-box;overflow:hidden">
    <div style="display:flex;align-items:center;gap:10px;overflow:hidden">${logoHtml ?? ''}${textBlock}</div>
  </div>`;
};

/**
 * The doctor's signature: the signature image, a rule, then their name,
 * designation and BMDC number. Nothing when neither was written.
 */
const signatureHtml = (signature: PrescriptionSignature): string => {
  const { logoHtml, rest } = splitLeadingLogo(sanitizeHtml(signature?.content ?? ''));
  const hasText = htmlHasText(rest);
  if (!logoHtml && !hasText) return '';

  const imageBlock = logoHtml ? `<div style="text-align:center">${logoHtml}</div>` : '';
  const divider = logoHtml ? 'border-top:1px solid #1E293B;margin-top:4px;padding-top:4px;' : '';
  const textBlock = hasText ? `<div style="text-align:center;${divider}">${rest}</div>` : '';

  return `<div style="width:230px;padding:${signature?.padding ?? 8}px;background:${
    signature?.background ?? '#FFFFFF'
  };${bandBorder(signature)}box-sizing:border-box;font-size:11px;color:#1E293B">${imageBlock}${textBlock}</div>`;
};

/** Faint and behind everything; a blank text falls back to "Rx". */
const watermarkHtml = (watermark: PrescriptionPageLayout['watermark']): string => {
  if (!watermark?.enabled) return '';

  const text = watermark?.text?.trim() || 'Rx';
  return `<div style="position:absolute;top:0;left:0;right:0;bottom:0;z-index:-1;display:flex;align-items:center;justify-content:center;pointer-events:none;overflow:hidden">
    <div style="font-size:44px;font-weight:800;color:rgba(24,56,112,0.06);text-transform:uppercase;letter-spacing:5px;text-align:center;line-height:1.3;max-width:80%">${escapeHtml(
      text,
    )}</div>
  </div>`;
};

/** The soft curves along the top and bottom edges of the sheet. */
const backgroundShapesHtml = (): string => `
  <svg style="position:absolute;top:0;left:0;width:100%;height:60px;z-index:-2" viewBox="0 0 1000 60" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M0,0 H1000 V22 C 750,50 250,50 0,22 Z" fill="#183870" fill-opacity="0.05"/>
    <path d="M0,0 H1000 V10 C 750,32 250,32 0,10 Z" fill="#183870" fill-opacity="0.10"/>
  </svg>
  <svg style="position:absolute;bottom:0;left:0;width:100%;height:52px;z-index:-2" viewBox="0 0 1000 52" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M0,52 H1000 V30 C 750,4 250,4 0,30 Z" fill="#183870" fill-opacity="0.05"/>
    <path d="M0,52 H1000 V40 C 750,20 250,20 0,40 Z" fill="#183870" fill-opacity="0.10"/>
  </svg>`;

// ── Sections ─────────────────────────────────────────────────────────────────

/** The sections kept as named groups, each listed in the value's `__groups`. */
/** The word printed after an urgent order — capitalised under Investigation, as there. */
const URGENT_WORD: Record<string, string> = {
  investigation: 'Urgent',
  operation: 'urgent',
};

/**
 * One summary line: a queried diagnosis leads with an amber "?", an urgent
 * order ends in a red word, and a note follows in small grey brackets. A photo
 * prints under its field name, only when the doctor asked for it.
 */
const lineHtml = (sectionKey: string, line: SectionSummaryLine): string => {
  const query =
    line?.marker === QUERY_MARKER ? '<span style="color:#D97706;font-weight:700">? </span>' : '';
  const urgentWord = URGENT_WORD[sectionKey];
  const urgent =
    line?.marker === URGENT_MARKER && urgentWord
      ? ` <span style="color:#DC2626;font-weight:700">${urgentWord}</span>`
      : '';
  const note = line?.note ? ` <span style="${NOTE_STYLE}">(${escapeHtml(line.note)})</span>` : '';
  const image =
    line?.imageId && line?.showImage
      ? `<div style="padding-left:14px;margin:2px 0"><img src="${escapeHtml(
          getFileUrl(line.imageId),
        )}" alt="${escapeHtml(
          line?.text,
        )}" style="max-width:200px;max-height:200px;object-fit:contain;border:1px solid #CBD5E1;border-radius:4px"/></div>`
      : '';

  return `<div style="padding-left:14px">${query}${escapeHtml(line?.text)}${urgent}${note}</div>${image}`;
};

/**
 * A section's groups. Where the section is kept in named groups — tabs with
 * their own lists, or Physical Examination's groups — each prints under its
 * name; a single list prints its lines directly.
 */
const groupsHtml = (sectionKey: string, groups: SectionSummaryGroup[]): string =>
  groups
    .map(group => {
      const lines = group.lines.map(line => lineHtml(sectionKey, line)).join('');
      const title = group?.printTitle ?? group?.title;
      return title
        ? `<div style="margin-bottom:4px"><div>${escapeHtml(title)}</div>${lines}</div>`
        : lines;
    })
    .join('');

const LEADER_DOTS = '<span style="flex:1;border-bottom:1px dotted #94A3B8;margin:0 4px"></span>';

/** One dose line: dose ⋯ instruction ⋯ how long, or a green "Continue". */
const doseLineHtml = (line: {
  dose?: string;
  note?: string;
  isContinue?: boolean;
  durationValue?: string;
  durationUnit?: string;
}): string => {
  const right = line?.isContinue
    ? '<span style="color:#16A34A;font-weight:700">Continue</span>'
    : line?.durationValue
      ? `<span style="color:#64748B;font-weight:600">${escapeHtml(line.durationValue)} ${escapeHtml(
          line?.durationUnit ?? '',
        )}</span>`
      : '';
  const note = line?.note
    ? `<span style="font-size:10px;color:#64748B;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:35%;flex-shrink:0">${escapeHtml(
        line.note,
      )}</span>${LEADER_DOTS}`
    : '';

  return (
    '<div style="display:flex;align-items:center;gap:6px;margin-top:2px;font-size:11px">' +
    `<span style="flex-shrink:0;font-family:monospace">${escapeHtml(line?.dose || '—')}</span>` +
    LEADER_DOTS +
    note +
    `<span style="flex-shrink:0">${right}</span>` +
    '</div>'
  );
};

/**
 * One medicine in two lines: its form, the brand in bold, the generic and the
 * route (and "MIXED" when mixed), then how it is taken — or a line for each
 * period of a course that changes, nested under the name.
 */
const rxItemHtml = (item: RxItem): string => {
  const type = item?.type ? `<span style="color:#64748B">${escapeHtml(item.type)} </span>` : '';
  const generic = item?.generic
    ? `<span style="color:#64748B"> ${escapeHtml(item.generic)}</span>`
    : '';
  const route = item?.route ? `<span style="color:#64748B"> ${escapeHtml(item.route)}</span>` : '';
  const mixed = item?.isMixed
    ? '<span style="margin-left:6px;border-radius:9999px;background:#FEF3C7;color:#D97706;font-size:9px;font-weight:700;padding:1px 6px">MIXED</span>'
    : '';
  const header = `<div>${type}<span style="font-weight:700">${escapeHtml(
    item?.brand,
  )}</span>${generic}${route}${mixed}</div>`;

  const periods: RxDosePeriod[] = item?.multiDose ?? [];
  const lines = periods.length
    ? `<div style="margin-left:8px;padding-left:8px;border-left:1px solid #E2E8F0">${periods
        .map(period =>
          doseLineHtml({
            dose: period?.dose,
            note: period?.instruction,
            durationValue: period?.durationValue,
            durationUnit: period?.durationUnit,
          }),
        )
        .join('')}</div>`
    : doseLineHtml({
        dose: item?.dose,
        note: item?.note,
        isContinue: item?.isContinue,
        durationValue: item?.durationValue,
        durationUnit: item?.durationUnit,
      });

  return `<div style="padding-left:14px;margin-bottom:4px">${header}${lines}</div>`;
};

const rxHtml = (value: unknown): string =>
  (Array.isArray(value) ? (value as unknown[]).map(toRxItem) : [])
    .filter(item => item?.brand?.trim())
    .map(rxItemHtml)
    .join('');

/** Every section with something in it, under its own heading, in the doctor's order. */
const sectionsHtml = (
  sections: readonly DeskSection[],
  sectionData: SectionData,
  translate: (key: string) => string,
): string =>
  sections
    .filter(section => countDeskSectionEntries(section?.key ?? '', sectionData?.[section?.key ?? '']) > 0)
    .map(section => {
      const key = section?.key ?? '';
      const value = sectionData?.[key];
      const body =
        key === 'rx' ? rxHtml(value) : groupsHtml(key, buildDeskSectionSummary(key, value, translate));

      return `<div style="margin-bottom:8px"><div style="font-weight:700;font-size:10.5px;color:#183870;text-transform:uppercase;letter-spacing:.4px;border-bottom:1px solid #E2E8F0;padding-bottom:2px;margin-bottom:3px">${escapeHtml(
        section?.title,
      )}</div>${body ? `<div style="color:#1E293B">${body}</div>` : ''}</div>`;
    })
    .join('');

// ── The page ─────────────────────────────────────────────────────────────────

/**
 * The browser's own margins on paragraphs, headings and lists would otherwise
 * push designer text around — the server renders this with no stylesheet.
 */
const PAGE_RESET_CSS = `<style>
  .rx-page-root, .rx-page-root *{box-sizing:border-box}
  .rx-page-root p,.rx-page-root h1,.rx-page-root h2,.rx-page-root h3,
  .rx-page-root h4,.rx-page-root h5,.rx-page-root h6,
  .rx-page-root blockquote,.rx-page-root figure{margin:0}
  .rx-page-root ul,.rx-page-root ol{margin:0;padding-left:0.5em}
</style>`;

export interface PrescriptionPageInput {
  layout: PrescriptionPageLayout;
  patient: DeskPatient;
  sectionData: SectionData;
  assessmentSections: readonly DeskSection[];
  prescriptionSections: readonly DeskSection[];
  /** Printed as a scannable code once the prescription has been saved. */
  prescriptionCode?: string;
  /** Resolves the tab labels a section has no print wording for. */
  translate: (key: string) => string;
}

export const buildPrescriptionPageHtml = ({
  layout,
  patient,
  sectionData,
  assessmentSections,
  prescriptionSections,
  prescriptionCode,
  translate,
}: PrescriptionPageInput): string => {
  const page = layout?.page;
  const margins = page?.margins;
  const inches = (value: number | undefined, fallback: number): number => (value ?? fallback) * DPI;

  // A profile never issued a code still gets one, by its registration id — the
  // portal prints the same number in its place.
  const patientBarcode = barcodeSvg(patientLookupCode(patient));
  const codeBarcode = barcodeSvg(prescriptionCode ?? '');
  const barcodeRow =
    patientBarcode || codeBarcode
      ? `<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px">
          <div>${patientBarcode}</div><div>${codeBarcode}</div>
        </div>`
      : '';

  const label = (text: string): string => `<span style="color:#183870;font-weight:700">${text}:</span>`;

  const patientLine = `
    <div style="display:flex;gap:16px;align-items:flex-start;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:6px;padding:5px 10px;font-size:11px;margin-bottom:6px">
      <div style="display:flex;gap:16px;flex-wrap:wrap;align-items:center;flex:1;min-width:0">
        <span>${label('Name')} ${escapeHtml(patient?.name)}</span>
        <span>${label('Age')} ${escapeHtml(patient?.age)}</span>
        <span>${label('Gender')} ${escapeHtml(patient?.gender)}</span>
        <span>${label('Mobile')} ${escapeHtml(patient?.mobile)}</span>
        ${patient?.address ? `<span>${label('Address')} ${escapeHtml(patient.address)}</span>` : ''}
      </div>
      <span style="white-space:nowrap;flex-shrink:0;color:#334155">${label('Date')}&nbsp;${escapeHtml(
        todayText(),
      )}</span>
    </div>`;

  const notice = layout?.notice;
  const noticeHtml = notice?.enabled
    ? `<div style="min-height:${inches(notice?.height, 0.4)}px;flex-shrink:0;box-sizing:border-box;padding:${
        notice?.padding ?? 8
      }px;background:${notice?.background ?? '#FEF9C3'};border-radius:6px;${bandBorder(
        notice,
      )}font-size:11px;color:#78350F">${sanitizeHtml(notice?.content ?? '')}</div>`
    : '';

  const leftHtml = sectionsHtml(assessmentSections, sectionData, translate);
  const rightHtml = sectionsHtml(prescriptionSections, sectionData, translate);

  const bodyInner =
    layout?.body?.mode === 'split'
      ? `<div style="height:100%;display:flex;flex-direction:column;overflow:hidden">
          ${patientLine}
          <div style="flex:1;display:flex;gap:${layout.body.gap}px;min-height:0">
            <div style="width:${layout.body.leftWidth}%;border-right:1px solid #E2E8F0;padding-right:10px;overflow:hidden">${leftHtml}</div>
            <div style="flex:1;padding-left:2px;overflow:hidden">${rightHtml}</div>
          </div>
        </div>`
      : `<div style="height:100%;overflow:hidden">${patientLine}${leftHtml}${rightHtml}</div>`;

  const hospitalInfo = layout?.hospitalInfo;
  const header = layout?.header;
  const footer = layout?.footer;
  const signature = layout?.signature;
  const signatureAlign =
    signature?.position === 'right'
      ? 'flex-end'
      : signature?.position === 'center'
        ? 'center'
        : 'flex-start';

  return `${PAGE_RESET_CSS}
    <div class="rx-page-root" style="position:relative;z-index:0;width:${inches(
      page?.width,
      8.27,
    )}px;height:${inches(page?.height, 11.69)}px;background:#FFF;box-sizing:border-box;padding:${inches(
      margins?.top,
      0.4,
    )}px ${inches(margins?.right, 0.4)}px ${inches(margins?.bottom, 0.4)}px ${inches(
      margins?.left,
      0.4,
    )}px;font-family:Arial,Helvetica,'SolaimanLipi',sans-serif;font-size:12px;line-height:1.5;color:#1E293B;-webkit-font-smoothing:antialiased">
      ${backgroundShapesHtml()}
      ${watermarkHtml(layout?.watermark)}
      <div style="display:flex;flex-direction:column;height:100%">
        ${barcodeRow}
        ${
          hospitalInfo?.enabled
            ? `<div style="min-height:${inches(hospitalInfo?.height, 0.5)}px;flex-shrink:0">${hospitalInfoHtml(
                hospitalInfo,
              )}</div>`
            : ''
        }
        ${
          header?.enabled
            ? `<div style="min-height:${inches(page?.headerHeight, 0.6)}px;flex-shrink:0">${bandHtml(
                header,
                'bottom',
              )}</div>`
            : ''
        }
        ${noticeHtml}
        <div style="flex:1;min-height:0;overflow:hidden;padding:4px;box-sizing:border-box">${bodyInner}</div>
        ${
          signature?.enabled
            ? `<div style="flex-shrink:0;display:flex;justify-content:${signatureAlign}">${signatureHtml(
                signature,
              )}</div>`
            : ''
        }
        ${
          footer?.enabled
            ? `<div style="min-height:${inches(page?.footerHeight, 0.5)}px;flex-shrink:0">${bandHtml(
                footer,
                'top',
              )}</div>`
            : ''
        }
      </div>
    </div>`;
};
