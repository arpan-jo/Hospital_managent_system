import { API_URL } from '@env';
import { ENDPOINTS } from '../network/endpoints';
import { rootStore } from '../store';

/** The one path whose files are ours — anything else is somebody's public url. */
const FILE_PREFIX = `${API_URL}${ENDPOINTS.fileMobileDownload}`;

/**
 * Where a stored blob is served to the app, with the session's JWT as an
 * `access_token` query param.
 *
 * The token rides in the url rather than a header because React Native's new
 * architecture drops `headers` from an `<Image>` source before it reaches the
 * native fetcher — every header-authenticated photo came back 401, confirmed
 * on device against the live API. `/api/FileUpload/mobile` exists for exactly
 * this; the web portal still uses `/download` with its cookie.
 *
 * An absolute url is returned untouched: it is already somewhere public, and
 * appending the token would hand it to a host that never issued it.
 */
export const getFileUrl = (blobName?: string | null): string => {
  const name = String(blobName ?? '').trim();

  if (!name) return '';
  if (/^https?:\/\//i.test(name)) return name;

  const url = `${FILE_PREFIX}/${encodeURIComponent(name)}`;
  const token = rootStore?.authStore?.authToken;

  // Signed out, the url is useless either way — returned bare rather than with
  // an empty `access_token=` the API would only reject differently.
  return token ? `${url}?access_token=${encodeURIComponent(token)}` : url;
};

/**
 * The bearer header for one of our file urls, and nothing for any other host.
 *
 * Redundant for an `<Image>`, whose url already carries the token — it is here
 * for the download path, which fetches through `react-native-blob-util` where
 * headers *do* arrive, so a saved file need not put the token in a url that
 * ends up in logs.
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
