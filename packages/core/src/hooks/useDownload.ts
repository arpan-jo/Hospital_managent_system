import { useState, useRef, useCallback } from 'react';
import {
  startDownload,
  openFile,
  type DownloadConfig,
  type ActiveDownload,
} from '../utils/downloader';
import { serverMessageOf } from '../network/serverMessage';

export interface DownloadState {
  isDownloading: boolean;
  progress: number;      // 0–1
  bytesReceived: number;
  totalBytes: number;
  filePath: string | null;
  error: string | null;
}

export interface DownloadOutcome {
  /** Where the file was saved; null when it failed or was cancelled. */
  filePath: string | null;
  /** What the server said about a failure; '' when it said nothing. */
  serverMessage: string;
}

export interface UseDownloadReturn extends DownloadState {
  /** Start downloading; resolves with the saved path, or with why it failed. */
  download: (config: Omit<DownloadConfig, 'onProgress'>) => Promise<DownloadOutcome>;
  /** Abort an in-progress download and return to idle state. */
  cancel: () => void;
  /** Open the successfully downloaded file in the OS viewer. */
  openDownloadedFile: (filename: string) => Promise<void>;
  /** Reset back to idle (e.g. to allow re-downloading after success or error). */
  reset: () => void;
}

const INITIAL_STATE: DownloadState = {
  isDownloading: false,
  progress: 0,
  bytesReceived: 0,
  totalBytes: 0,
  filePath: null,
  error: null,
};

const isCancelError = (err: unknown): boolean => {
  const msg = (err as any)?.message?.toLowerCase() ?? '';
  return msg.includes('cancel') || msg.includes('abort');
};

export const useDownload = (): UseDownloadReturn => {
  const [state, setState] = useState<DownloadState>(INITIAL_STATE);
  const taskRef = useRef<ActiveDownload | null>(null);

  const download = useCallback(
    async (config: Omit<DownloadConfig, 'onProgress'>): Promise<DownloadOutcome> => {
      setState({ ...INITIAL_STATE, isDownloading: true });

      const task = startDownload({
        ...config,
        onProgress: (received, total) => {
          setState(prev => ({
            ...prev,
            bytesReceived: received,
            totalBytes: total,
            progress: total > 0 ? received / total : 0,
          }));
        },
      });
      taskRef.current = task;

      try {
        const result = await task.promise;
        taskRef.current = null;
        setState(prev => ({
          ...prev,
          isDownloading: false,
          progress: 1,
          filePath: result.filePath,
        }));
        return { filePath: result.filePath, serverMessage: '' };
      } catch (err) {
        taskRef.current = null;
        if (isCancelError(err)) {
          setState(INITIAL_STATE);
          return { filePath: null, serverMessage: '' };
        }
        const serverMessage = serverMessageOf(err);
        setState(prev => ({
          ...prev,
          isDownloading: false,
          error: serverMessage || (err as any)?.message || 'Download failed. Please try again.',
        }));
        return { filePath: null, serverMessage };
      }
    },
    [],
  );

  const cancel = useCallback(() => {
    taskRef.current?.cancel();
    taskRef.current = null;
    setState(INITIAL_STATE);
  }, []);

  const openDownloadedFile = useCallback(
    async (filename: string) => {
      if (state.filePath) {
        await openFile(state.filePath, filename);
      }
    },
    [state.filePath],
  );

  const reset = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  return { ...state, download, cancel, openDownloadedFile, reset };
};
