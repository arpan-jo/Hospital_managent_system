/**
 * CODE 128 — the barcode the printed prescription carries (the backend draws it
 * with ZXing's CODE_128). Text goes in code set B; a run of four or more digits
 * goes in code set C, two digits to a symbol, which keeps a code like
 * "PRS-20261017-000000001" narrow enough for a phone's width.
 *
 * The result is the module widths, bar first, alternating bar / space, stop
 * pattern included — what a renderer draws, left to right, with a quiet zone of
 * ten modules on each side.
 */

/** Bar/space widths of each symbol value 0–105; 106 is the stop pattern. */
const PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
];

const START_B = 104;
const START_C = 105;
const CODE_B = 100; // in set C: switch to set B
const CODE_C = 99; // in set B: switch to set C
const STOP = 106;

/** Code set B holds printable ASCII, space to tilde. */
const isSetB = (char: string) => {
  const code = char.charCodeAt(0);
  return code >= 32 && code <= 126;
};

const isDigit = (char: string) => char >= '0' && char <= '9';

/** How many digits run from `index` on. */
const digitRun = (text: string, index: number) => {
  let end = index;
  while (end < text.length && isDigit(text[end])) end += 1;
  return end - index;
};

/**
 * The symbol values for `text`, start and checksum included, stop excluded.
 * Null when it holds a character CODE 128 set B cannot carry.
 */
export const code128Values = (text: unknown): number[] | null => {
  // Only a string or a finite number is a code — anything else (an object, NaN) has none.
  const value =
    typeof text === 'string' ? text : typeof text === 'number' && Number.isFinite(text) ? String(text) : '';
  if (!value || [...value].some(char => !isSetB(char))) return null;

  const values: number[] = [];
  let set: 'B' | 'C';
  let index = 0;

  // A code that opens with an even run of 4+ digits starts in set C.
  const opening = digitRun(value, 0);
  if (opening >= 4 && opening % 2 === 0) {
    set = 'C';
    values.push(START_C);
  } else {
    set = 'B';
    values.push(START_B);
  }

  while (index < value.length) {
    const run = digitRun(value, index);
    if (set === 'B' && run >= 4) {
      // An odd run leaves its first digit in set B, so the rest pair up evenly.
      if (run % 2 === 1) {
        values.push(value.charCodeAt(index) - 32);
        index += 1;
      }
      values.push(CODE_C);
      set = 'C';
      continue;
    }
    if (set === 'C') {
      if (run >= 2) {
        values.push(Number(value.slice(index, index + 2)));
        index += 2;
        continue;
      }
      values.push(CODE_B);
      set = 'B';
      continue;
    }
    values.push(value.charCodeAt(index) - 32);
    index += 1;
  }

  // Checksum: the start value plus each symbol times its place, mod 103.
  const checksum = values.reduce((sum, symbol, place) => sum + symbol * (place === 0 ? 1 : place), 0) % 103;
  values.push(checksum);
  return values;
};

/** The module widths to draw — bar, space, bar… — stop included; null when it cannot be encoded. */
export const encodeCode128 = (text: unknown): number[] | null => {
  const values = code128Values(text);
  if (!values) return null;
  return [...values, STOP].flatMap(symbol => [...(PATTERNS?.[symbol] ?? '')].map(Number));
};

/** Its width in modules, quiet zones not included. */
export const code128Width = (modules: number[] | null | undefined): number =>
  (modules ?? []).reduce((sum, width) => sum + width, 0);
