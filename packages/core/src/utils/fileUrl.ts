import { API_URL } from '@env';
import { ENDPOINTS } from '../network/endpoints';
import { rootStore } from '../store';

/** The one path whose files are ours — anything else is somebody's public url. */
const FILE_PREFIX = `${API_URL}${ENDPOINTS.fileDownload}`;

/** Prescription PDFs the server draws — they need the patient's login. */
const PRESCRIPTION_PDF_PREFIX = `${API_URL}${ENDPOINTS.portalPrescriptionPdf}`;

/**
 * Where a stored blob is served — the same url the web portal builds. The
 * download endpoint is anonymous, so the url carries no token.
 *
 * An absolute url is returned untouched: it is already somewhere public.
 */
export const getFileUrl = (blobName?: string | null): string => {
  const name = String(blobName ?? '').trim();

  if (!name) return '';
  if (/^https?:\/\//i.test(name)) return name;

  return `${FILE_PREFIX}/${encodeURIComponent(name)}`;
};

/**
 * The bearer header for one of our file urls, and nothing for any other host.
 *
 * Stored files do not ask for it today (it is sent so a download made through
 * `react-native-blob-util` keeps working if they ever do); a prescription PDF
 * does — it is the patient's own.
 */
export const getFileHeaders = (
  url?: string | null,
): Record<string, string> | undefined => {
  const text = String(url ?? '');
  if (!text.startsWith(FILE_PREFIX) && !text.startsWith(PRESCRIPTION_PDF_PREFIX)) {
    return undefined;
  }

  const token = rootStore?.authStore?.authToken;
  return token ? { Authorization: `Bearer ${token}` } : undefined;
};

/** A ready `<Image source={...}>` for a stored blob. */
export const getFileSource = (
  blobName?: string | null,
): { uri: string; headers?: Record<string, string> } => {
  const uri = getFileUrl(blobName);
  return { uri, headers: getFileHeaders(uri) };
};

export default getFileUrl;
