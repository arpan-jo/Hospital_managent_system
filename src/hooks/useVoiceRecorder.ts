import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, PermissionsAndroid, Platform } from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';
import Sound, {
  AVEncoderAudioQualityIOSType,
  AudioEncoderAndroidType,
  AudioSourceAndroidType,
  OutputFormatAndroidType,
} from 'react-native-nitro-sound';
import type { AudioSet, RecordBackType } from 'react-native-nitro-sound';
import { UploadFile } from '@app/core';

/**
 * A voice recording for the AI features — the doctor's consultation for AI
 * Assist, a patient describing how they feel for the doctor finder.
 *
 * One recording at a time, owned from start to finish: the microphone
 * permission, the live level the screen draws, pausing, and the file itself.
 * That file is someone's health in their own words, so it is deleted as soon
 * as it has been sent or dropped — Android keeps every recording in the app's
 * files otherwise.
 */

/**
 * Speech, not music: mono at 16 kHz is what transcription works from, and even
 * a whole visit stays small — about 240 KB a minute.
 */
const AUDIO_SET: AudioSet = {
  AudioSourceAndroid: AudioSourceAndroidType.MIC,
  OutputFormatAndroid: OutputFormatAndroidType.MPEG_4,
  AudioEncoderAndroid: AudioEncoderAndroidType.AAC,
  AVFormatIDKeyIOS: 'aac',
  AVEncoderAudioQualityKeyIOS: AVEncoderAudioQualityIOSType.medium,
  AVNumberOfChannelsKeyIOS: 1,
  AVSampleRateKeyIOS: 16000,
  AudioChannels: 1,
  AudioSamplingRate: 16000,
  AudioEncodingBitRate: 32000,
};

/** How often the recorder reports, in seconds — often enough for the meter to move with speech. */
const TICK_SECONDS = 0.1;

/** Levels kept for the waveform: about three seconds at one per tick. */
export const RECORDER_LEVEL_COUNT = 32;

/** The meter's floor. Speech sits around −35 to −5 dB; under −50 is a quiet room. */
const METER_FLOOR_DB = -50;

/** A level under this counts as nothing heard. */
export const SILENT_LEVEL = 0.12;

/** How long nothing may be heard before the speaker is told to check the microphone. */
const SILENCE_WARNING_MS = 3000;

export type RecorderStatus = 'idle' | 'recording' | 'paused';

export type RecorderFailure = 'micDenied' | 'recordFailed';

/**
 * How a start ended. `ignored` means there is nothing to show: a start was
 * already under way, or the recording was stopped before it began.
 */
export type RecorderStartResult = 'started' | 'ignored' | RecorderFailure;

export interface VoiceRecording extends UploadFile {
  durationMs: number;
}

/** The recorder's decibels as 0–1 for the meter. */
const toLevel = (decibels?: number): number => {
  if (decibels == null || !Number.isFinite(decibels)) return 0;
  return Math.min(1, Math.max(0, (decibels - METER_FLOOR_DB) / -METER_FLOOR_DB));
};

/** Android asks at runtime; iOS shows its own prompt the first time recording starts. */
const ensureMicrophonePermission = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') return true;

  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
  return result === PermissionsAndroid.RESULTS.GRANTED;
};

const toFilePath = (uri?: string | null): string => {
  const raw = String(uri ?? '').replace(/^file:\/\//, '');
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
};

/** Takes a recording off the phone. A file that is already gone is not an error. */
export const deleteRecording = async (uri?: string | null): Promise<void> => {
  const path = toFilePath(uri);
  if (!path) return;

  await ReactNativeBlobUtil.fs.unlink(path).catch(() => {});
};

export const useVoiceRecorder = () => {
  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [levels, setLevels] = useState<number[]>([]);
  const [isSilent, setIsSilent] = useState(false);

  // Read inside the recorder's callbacks, which outlive any one render.
  const statusRef = useRef<RecorderStatus>('idle');
  const elapsedRef = useRef(0);
  const lastHeardAtRef = useRef(0);

  /*
   * A start waits on the permission prompt and then on the native recorder, and
   * the status only turns to recording partway through — so a second tap, or a
   * stop from closing the sheet, can land in between. The start under way is
   * kept here, and every stop bumps the generation: a start that finds it
   * changed was called off, and must not leave the microphone on.
   */
  const pendingStartRef = useRef<Promise<RecorderStartResult> | null>(null);
  const generationRef = useRef(0);

  const updateStatus = useCallback((next: RecorderStatus) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  const handleTick = useCallback((meta: RecordBackType) => {
    if (statusRef.current !== 'recording') return;

    const elapsed = meta?.currentPosition ?? 0;
    const level = toLevel(meta?.currentMetering);
    if (level >= SILENT_LEVEL) lastHeardAtRef.current = elapsed;

    elapsedRef.current = elapsed;
    setElapsedMs(elapsed);
    setLevels(previous => [...previous.slice(-(RECORDER_LEVEL_COUNT - 1)), level]);
    setIsSilent(elapsed - lastHeardAtRef.current >= SILENCE_WARNING_MS);
  }, []);

  /** Starts a fresh recording, unless one is already running or starting. */
  const start = useCallback((): Promise<RecorderStartResult> => {
    if (statusRef.current !== 'idle' || pendingStartRef.current) {
      return Promise.resolve('ignored');
    }

    const generation = generationRef.current;
    const isCalledOff = () => generation !== generationRef.current;

    const attempt = (async (): Promise<RecorderStartResult> => {
      const isAllowed = await ensureMicrophonePermission().catch(() => false);
      if (isCalledOff()) return 'ignored';
      if (!isAllowed) return 'micDenied';

      elapsedRef.current = 0;
      lastHeardAtRef.current = 0;
      setElapsedMs(0);
      setLevels([]);
      setIsSilent(false);

      try {
        Sound.setSubscriptionDuration(TICK_SECONDS);
        Sound.addRecordBackListener(handleTick);
        updateStatus('recording');
        await Sound.startRecorder(undefined, AUDIO_SET, true);
        // Stopped while the recorder was starting — that stop is waiting for
        // this start, and ends the recording as soon as it returns.
        return isCalledOff() ? 'ignored' : 'started';
      } catch (error) {
        console.log('[VoiceRecorder] start recording', error);
        Sound.removeRecordBackListener();
        updateStatus('idle');
        return 'recordFailed';
      }
    })();

    pendingStartRef.current = attempt;
    attempt.then(() => {
      pendingStartRef.current = null;
    });
    return attempt;
  }, [handleTick, updateStatus]);

  const pause = useCallback(async () => {
    if (statusRef.current !== 'recording') return;

    try {
      await Sound.pauseRecorder();
      updateStatus('paused');
      setIsSilent(false);
    } catch (error) {
      console.log('[VoiceRecorder] pause recording', error);
    }
  }, [updateStatus]);

  const resume = useCallback(async () => {
    if (statusRef.current !== 'paused') return;

    try {
      // A pause is not silence — the "nothing heard" clock starts again from here.
      lastHeardAtRef.current = elapsedRef.current;
      await Sound.resumeRecorder();
      updateStatus('recording');
    } catch (error) {
      console.log('[VoiceRecorder] resume recording', error);
    }
  }, [updateStatus]);

  /** Ends the recording and hands back its file; null when nothing was recording. */
  const stop = useCallback(async (): Promise<VoiceRecording | null> => {
    // Calls off a start still under way, then lets it finish before stopping.
    generationRef.current += 1;
    await pendingStartRef.current;

    if (statusRef.current === 'idle') return null;

    updateStatus('idle');
    Sound.removeRecordBackListener();

    try {
      const uri = await Sound.stopRecorder();
      if (!uri) return null;

      return {
        uri,
        name: `recording-${Date.now()}.m4a`,
        type: 'audio/mp4',
        size: null,
        durationMs: elapsedRef.current,
      };
    } catch (error) {
      console.log('[VoiceRecorder] stop recording', error);
      return null;
    }
  }, [updateStatus]);

  /** Stops and throws the recording away — cancelled, or the screen closed mid-way. */
  const discard = useCallback(async () => {
    const recording = await stop();
    await deleteRecording(recording?.uri);
  }, [stop]);

  // A locked phone or a backgrounded app loses the microphone, so recording
  // pauses rather than quietly capturing silence, to be resumed or stopped.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', next => {
      if (next === 'background') pause();
    });
    return () => subscription.remove();
  }, [pause]);

  // Leaving with a recording running — or still starting — stops it and deletes the file.
  useEffect(
    () => () => {
      generationRef.current += 1;

      const release = () => {
        if (statusRef.current === 'idle') return;

        statusRef.current = 'idle';
        Sound.removeRecordBackListener();
        Sound.stopRecorder()
          .then(deleteRecording)
          .catch(() => {});
      };

      if (pendingStartRef.current) pendingStartRef.current.then(release);
      else release();
    },
    [],
  );

  /**
   * Whether a recording is running or paused right now — read from the ref, so
   * a second tap that lands before the next render already sees it stopped.
   */
  const isActive = useCallback(() => statusRef.current !== 'idle', []);

  return { status, elapsedMs, levels, isSilent, start, pause, resume, stop, discard, isActive };
};

export default useVoiceRecorder;
