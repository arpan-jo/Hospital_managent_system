import { API_URL } from '@env';
import apiRequest, { ApiRequestOptions } from '../network/apiRequest';
import { ENDPOINTS } from '../network/endpoints';

/** A file picked on the device, ready for `POST /api/FileUpload/upload`. */
export interface UploadFile {
  uri: string;
  name: string;
  type?: string | null;
  size?: number | null;
}

/** A file upload gets its own ceiling — the client's default is for JSON. */
const UPLOAD_TIMEOUT_MS = 60_000;

const firstText = (...values: any[]): string => {
  for (const value of values) {
    const text = String(value ?? '').trim();
    if (text) return text;
  }
  return '';
};

/**
 * `POST /api/FileUpload/upload` answers with one row per file —
 * `{ id, fileName, url }` — where **`id` is the stored blob name** the download
 * endpoint takes ("6392…Screenshot From ….png"); `fileName` is only what the
 * user picked and `url` comes back empty. Storing `fileName` would create a
 * record whose file 404s on every open, so `id` wins; the aliases behind it
 * only cover the field being renamed.
 */
const toBlobName = (item: any): string =>
  typeof item === 'string'
    ? item.trim()
    : firstText(item?.id, item?.blobName, item?.fileUrl, item?.url);

/**
 * `POST /api/FileUpload/upload` — the one place a file crosses to the server.
 * Everything that stores a file (documents, reports, profile photos) uploads
 * here first and then saves the returned blob name on its own record.
 */
export const FileRepository = {
  upload: async (file: UploadFile): Promise<string> => {
    const form = new FormData();
    form.append('files', {
      uri: file?.uri ?? '',
      name: file?.name ?? 'file',
      type: file?.type ?? 'application/octet-stream',
    } as any);

    const api_params: ApiRequestOptions = {
      url: ENDPOINTS.fileUpload,
      method: 'POST',
      baseUrl: API_URL,
      data: form,
      headers: { 'Content-Type': 'multipart/form-data' },
      // The client's 10s default is short for a few megabytes on mobile data.
      timeout: UPLOAD_TIMEOUT_MS,
      // `/api/FileUpload` is on the backend's `Encryption:ExcludedPaths`, so the
      // multipart body goes up as-is. Every other endpoint takes the client's
      // default and is encrypted — do not add these flags back elsewhere.
      encrypt: false,
      decrypt: false,
    };
    const response = await apiRequest<any>(api_params);

    const blobName = toBlobName(Array.isArray(response) ? response?.[0] : response);
    if (!blobName) throw new Error('The upload did not return a stored file name.');

    return blobName;
  },
};

export default FileRepository;
