import { useCallback, useEffect, useRef, useState } from 'react';
import ReactNativeBlobUtil from 'react-native-blob-util';
import Sound from 'react-native-nitro-sound';

/**
 * Plays a short clip handed over as base64 — the AI finder's spoken summary,
 * which the portal plays under its answer. The clip is written to the cache
 * folder, played from there, and removed again when it ends or is stopped.
 */
export const useAudioClip = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  /** The clip's file while it exists; '' when nothing is loaded. */
  const pathRef = useRef('');

  const removeFile = useCallback(async () => {
    const path = pathRef.current;
    pathRef.current = '';
    if (path) await ReactNativeBlobUtil.fs.unlink(path).catch(() => {});
  }, []);

  const stop = useCallback(async () => {
    Sound.removePlaybackEndListener();
    if (pathRef.current) await Sound.stopPlayer().catch(() => {});
    setIsPlaying(false);
    await removeFile();
  }, [removeFile]);

  /** Plays `base64` from the start, stopping whatever was playing first. */
  const play = useCallback(
    async (base64?: string | null, format?: string | null) => {
      if (!base64) return;
      await stop();

      const extension = /^[a-z0-9]{2,5}$/i.test(format ?? '') ? format : 'mp3';
      const path = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/ai-answer-${Date.now()}.${extension}`;

      try {
        await ReactNativeBlobUtil.fs.writeFile(path, base64, 'base64');
        pathRef.current = path;
        Sound.addPlaybackEndListener(() => {
          stop();
        });
        await Sound.startPlayer(`file://${path}`);
        setIsPlaying(true);
      } catch (error) {
        console.log('[AudioClip] play failed', error);
        await stop();
      }
    },
    [stop],
  );

  // Leaving the screen stops the clip and takes its file away.
  useEffect(
    () => () => {
      stop();
    },
    [stop],
  );

  return { isPlaying, play, stop };
};

export default useAudioClip;
