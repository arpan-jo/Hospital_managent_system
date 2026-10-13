import { useRef, useCallback, useEffect } from 'react';
import { useDownload } from './useDownload';
import { viewDocument } from '../utils/documentViewer';
import { getMimeType } from '../utils/downloader';

export interface DocumentViewerConfig {
  /** File path, local URI, or remote URL (http/https) */
  uri: string;
  /** Saved filename including extension (required for remote URLs), e.g. "report.pdf" */
  filename?: string;
  /** Title shown in iOS QuickLook header. Defaults to the filename. */
  title?: string;
  /** Custom mime-type. If not provided, it will be inferred from the filename. */
  mimeType?: string;
  /** Storage location for remote downloads: 'documents' or 'cache' (default) */
  destination?: 'documents' | 'cache';
  /** Optional HTTP headers forwarded to the download request */
  headers?: Record<string, string>;
}

export interface UseDocumentViewerReturn {
  /**
   * Trigger document viewing.
   * - If remote (starts with http/https), downloads the file first (updating state), then opens it.
   * - If local (file://, content://, etc.), opens the document immediately.
   */
  view: (config: DocumentViewerConfig) => Promise<void>;
  /** Cancel any active document download */
  cancel: () => void;
  /** Reset states back to idle */
  reset: () => void;
  /** True if a remote document is currently downloading */
  isDownloading: boolean;
  /** Download progress value (0 to 1) */
  progress: number;
  /** Number of bytes downloaded so far */
  bytesReceived: number;
  /** Total size of the file in bytes */
  totalBytes: number;
  /** Error message if download or opening fails */
  error: string | null;
  /** Local path to the file once downloaded or resolved */
  filePath: string | null;
}

/**
 * Reusable hook to programmatically view local or remote documents.
 * Can be triggered from list items, buttons, or custom press handlers.
 */
export const useDocumentViewer = (): UseDocumentViewerReturn => {
  const {
    download,
    cancel: cancelDownload,
    reset: resetDownload,
    isDownloading,
    progress,
    bytesReceived,
    totalBytes,
    filePath,
    error,
  } = useDownload();

  const isDownloadingCompletedRef = useRef(false);
  const activeConfigRef = useRef<DocumentViewerConfig | null>(null);

  // Monitor download completion to automatically trigger the native viewer
  useEffect(() => {
    if (filePath && isDownloadingCompletedRef.current && activeConfigRef.current) {
      isDownloadingCompletedRef.current = false;
      const config = activeConfigRef.current;
      const targetFilename = config.filename || 'document';
      const inferredMime = config.mimeType || getMimeType(targetFilename);

      viewDocument({
        uri: filePath,
        title: config.title || targetFilename,
        mimeType: inferredMime,
      }).catch((err: any) => {
        if (__DEV__) {
          console.warn('[useDocumentViewer] Failed to open downloaded document:', err);
        }
      });
    }
  }, [filePath]);

  const view = useCallback(
    async (config: DocumentViewerConfig) => {
      const isRemote = config.uri.startsWith('http://') || config.uri.startsWith('https://');

      if (isRemote) {
        let targetFilename = config.filename;
        if (!targetFilename) {
          targetFilename = config.uri.split('/').pop()?.split('?')[0] || 'document.pdf';
        }
        activeConfigRef.current = { ...config, filename: targetFilename };
        isDownloadingCompletedRef.current = true;

        await download({
          url: config.uri,
          filename: targetFilename,
          destination: config.destination || 'cache',
          headers: config.headers,
        });
      } else {
        // Open local document directly
        const targetFilename = config.filename || config.uri.split('/').pop() || 'document';
        const inferredMime = config.mimeType || getMimeType(targetFilename);

        await viewDocument({
          uri: config.uri,
          title: config.title || targetFilename,
          mimeType: inferredMime,
        });
      }
    },
    [download]
  );

  const cancel = useCallback(() => {
    cancelDownload();
    isDownloadingCompletedRef.current = false;
    activeConfigRef.current = null;
  }, [cancelDownload]);

  const reset = useCallback(() => {
    resetDownload();
    isDownloadingCompletedRef.current = false;
    activeConfigRef.current = null;
  }, [resetDownload]);

  return {
    view,
    cancel,
    reset,
    isDownloading,
    progress,
    bytesReceived,
    totalBytes,
    error,
    filePath,
  };
};
