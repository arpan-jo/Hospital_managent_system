import { API_URL } from '@env';
import { ENDPOINTS } from '../network/endpoints';
import { rootStore } from '../store';

/** The one path whose files are ours — anything else is somebody's public url. */
const FILE_PREFIX = `${API_URL}${ENDPOINTS.fileDownload}`;

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
 * The endpoint does not ask for it today; it is sent so a download made
 * through `react-native-blob-util` keeps working if the endpoint gains auth.
 */
export const getFileHeaders = (
  url?: string | null,
): Record<string, string> | undefined => {
  if (!String(url ?? '').startsWith(FILE_PREFIX)) return undefined;

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
