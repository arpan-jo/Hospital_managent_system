/**
 * What a fetched file is, by the media type the server named — for a file
 * whose name can't tell: a test report comes from a ".../pdf" route, yet a
 * File Upload result there is the uploaded file itself, as often an image.
 */
export type FileKind = 'pdf' | 'image' | 'other';

/** The images the app can draw — the viewer's own list, by media type. */
const DRAWABLE_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/bmp',
  'image/heic',
];

/** The extension a saved copy gets for each type a report can come as. */
const EXTENSION_BY_TYPE: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/bmp': 'bmp',
  'image/heic': 'heic',
  'image/svg+xml': 'svg',
  'image/tiff': 'tiff',
  'text/plain': 'txt',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
};

/** `Image/JPEG; charset=…` → `image/jpeg`; '' when there is none. */
export const mediaTypeOf = (contentType?: string | null): string =>
  String(contentType ?? '').split(';')[0].trim().toLowerCase();

/**
 * How the app can show a file of this type. Null when the server named no
 * useful type (none, or the catch-all `application/octet-stream`) — the
 * caller then goes by the file's name.
 */
export const fileKindOfType = (contentType?: string | null): FileKind | null => {
  const type = mediaTypeOf(contentType);
  if (!type || type === 'application/octet-stream') return null;
  if (type === 'application/pdf') return 'pdf';
  return DRAWABLE_IMAGE_TYPES.includes(type) ? 'image' : 'other';
};

/**
 * The name, with the extension of what actually came: `Report_CBC.pdf` is
 * saved as `Report_CBC.jpg` when the report is a JPEG. A type with no known
 * extension keeps the name as it is.
 */
export const fileNameForType = (filename: string, contentType?: string | null): string => {
  const extension = EXTENSION_BY_TYPE[mediaTypeOf(contentType)];
  if (!extension) return filename;
  const base = String(filename ?? '').replace(/\.[^./]*$/, '') || 'file';
  return `${base}.${extension}`;
};
