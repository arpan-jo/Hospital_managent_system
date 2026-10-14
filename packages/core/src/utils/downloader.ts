import { Platform, Share } from 'react-native';
import RNBlobUtil from 'react-native-blob-util';
import { getFileHeaders } from './fileUrl';

export type DownloadDestination = 'documents' | 'cache';

export interface DownloadConfig {
  url: string;
  filename: string;
  destination?: DownloadDestination;
  headers?: Record<string, string>;
  onProgress?: (receivedBytes: number, totalBytes: number) => void;
}

export interface DownloadResult {
  /**
   * Where the file ended up. A save to Downloads on Android 10+ answers with a
   * `content://` uri rather than a filesystem path — `openFile` takes either.
   */
  filePath: string;
}

export interface ActiveDownload {
  promise: Promise<DownloadResult>;
  cancel: () => void;
}

const MIME_MAP: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  mp4: 'video/mp4',
  mp3: 'audio/mpeg',
  zip: 'application/zip',
  txt: 'text/plain',
  csv: 'text/csv',
  json: 'application/json',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

export const getMimeType = (filename: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  return MIME_MAP[ext] ?? 'application/octet-stream';
};

export const getDestinationPath = (
  filename: string,
  destination: DownloadDestination,
): string => {
  const { dirs } = RNBlobUtil.fs;
  const dir = destination === 'cache' ? dirs.CacheDir : dirs.DocumentDir;
  return `${dir}/${filename}`;
};

/** A failed answer's body — parsed when it is JSON, else its text; null when unreadable. */
const readErrorBody = async (path: string): Promise<unknown> => {
  try {
    const text = await RNBlobUtil.fs.readFile(path, 'utf8');
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  } catch {
    return null;
  }
};

/** Android 10 is where scoped storage — and the Downloads collection — begins. */
const isScopedStorage = Platform.OS === 'android' && Number(Platform.Version) >= 29;

/**
 * Starts a file download and returns a task with a cancel handle and a promise.
 *
 * Usage:
 *   const task = startDownload({ url, filename, onProgress: (rx, total) => ... });
 *   const { filePath } = await task.promise;
 *   // or task.cancel() to abort
 */
export const startDownload = ({
  url,
  filename,
  destination = 'documents',
  headers = {},
  onProgress,
}: DownloadConfig): ActiveDownload => {
  /**
   * A save the user asked for lands in the phone's own Downloads, visible to
   * other apps; a `cache` download stays private, since that copy only exists
   * to be handed straight to the OS viewer.
   *
   * On Android 10+ the save is a plain fetch into the cache followed by a copy
   * into the Downloads collection. Android's own DownloadManager would do both
   * in one step, and it is deliberately not used: with a MediaStore-backed
   * destination it leaves its "active download" notification behind after the
   * file is already finished, so the shade keeps showing an ongoing download
   * that nothing can cancel. Below Android 10 that collection does not exist
   * yet and the app holds no storage permission, so there DownloadManager —
   * which needs none — still writes the legacy Downloads folder.
   */
  const savesToCollection = destination === 'documents' && isScopedStorage;
  // Staged under its own name so it cannot clobber the viewer's cache copy of
  // the same document, which a `cache` download keeps at the plain filename.
  const destPath = savesToCollection
    ? getDestinationPath(`save-${filename}`, 'cache')
    : getDestinationPath(filename, destination);

  const config: Parameters<typeof RNBlobUtil.config>[0] = {
    path: destPath,
    overwrite: true,
  };

  if (Platform.OS === 'android' && destination === 'documents' && !savesToCollection) {
    config.addAndroidDownloads = {
      useDownloadManager: true,
      notification: true,
      mediaScannable: true,
      title: filename,
      mime: getMimeType(filename),
      path: `${RNBlobUtil.fs.dirs.DownloadDir}/${filename}`,
    };
  }

  /**
   * Stored files sit behind `[Authorize]`, and a download carries no session of
   * its own — so the bearer header is added here rather than at each call site.
   * `getFileHeaders` returns nothing for any other host, and an explicit header
   * from the caller still wins.
   */
  const task = RNBlobUtil.config(config).fetch('GET', url, {
    ...getFileHeaders(url),
    ...headers,
  });

  // interval: ms between progress events to avoid flooding the bridge
  task.progress({ interval: 200 }, (received, total) => {
    onProgress?.(received, total);
  });

  /**
   * A failed request still writes its body to `destPath`, so the caller would
   * "open" a 404's JSON and see a blank viewer. The status is checked here and
   * the junk removed, turning it into a rejection the screen can report.
   */
  const promise: Promise<DownloadResult> = task.then(async response => {
    // DownloadManager reports no HTTP status of its own; it fails the task.
    const status = Number(response.info()?.status ?? 0);
    const fetchedPath = response.path() ?? destPath;

    if (status && (status < 200 || status >= 300)) {
      const body = await readErrorBody(fetchedPath);
      await RNBlobUtil.fs.unlink(fetchedPath).catch(() => {});
      // Shaped like an `apiRequest` rejection, so `serverMessageOf` finds the
      // server's own words — a missing file answers `{ message: "File not found." }`.
      throw Object.assign(
        new Error(`The file could not be downloaded (status ${status}).`),
        { status, data: body },
      );
    }

    if (!savesToCollection) return { filePath: fetchedPath };

    // The collection copy is the one the user keeps; the cache copy has served
    // its purpose either way, so a failed cleanup must not fail the download.
    const contentUri = await RNBlobUtil.MediaCollection.copyToMediaStore(
      { name: filename, parentFolder: '', mimeType: getMimeType(filename) } as any,
      'Download',
      fetchedPath,
    );
    await RNBlobUtil.fs.unlink(fetchedPath).catch(() => {});

    return { filePath: contentUri };
  });

  return {
    promise,
    cancel: () => task.cancel(),
  };
};

/**
 * Puts a file the app built itself — rather than fetched — into the phone's
 * Downloads, and answers its `content://` uri. Only Android 10+ can do that
 * without a storage permission, which the app does not hold; anywhere else this
 * answers null and the caller hands the file to the OS viewer instead, from
 * where the user can save it.
 */
export const saveFileToDownloads = async (
  sourcePath: string,
  filename: string,
): Promise<string | null> => {
  if (!isScopedStorage) return null;

  return RNBlobUtil.MediaCollection.copyToMediaStore(
    { name: filename, parentFolder: '', mimeType: getMimeType(filename) } as any,
    'Download',
    sourcePath,
  );
};

/**
 * Opens a downloaded file using the OS viewer.
 * Android: ACTION_VIEW intent. iOS: Share sheet (allows Open In…).
 */
export const openFile = async (
  filePath: string,
  filename: string,
): Promise<void> => {
  if (Platform.OS === 'android') {
    await RNBlobUtil.android.actionViewIntent(filePath, getMimeType(filename));
  } else {
    await Share.share({ url: `file://${filePath}`, title: filename });
  }
};
