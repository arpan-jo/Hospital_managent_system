import { AI_STT_API_KEY, AI_STT_URL } from '@env';
import axios from 'axios';
import { attachAiLogging } from '../network/aiLogging';
import { ENDPOINTS } from '../network/endpoints';
import { UploadFile } from './FileRepository';

/**
 * The Whisper speech-to-text service the AI features share — a doctor's
 * recorded consultation for AI Assist, a patient's spoken symptoms for the
 * doctor finder. Both then hand the words on exactly as typed ones would go.
 *
 * Its own client rather than `apiRequest`, which attaches the HMS token and
 * signs the user out on any 401 — neither may happen against a service outside
 * HMS. The service's key rides only on this client.
 */
const sttClient = axios.create({
  baseURL: AI_STT_URL || '',
  headers: { Accept: 'application/json', 'x-api-key': AI_STT_API_KEY ?? '' },
});

attachAiLogging(sttClient);

/**
 * Speech-to-text runs at about 1.6× the length of the recording plus some ten
 * seconds (4 s of audio took 11 s, 29 s took 47 s), so its wait grows with the
 * recording rather than being one fixed figure.
 */
const sttTimeoutFor = (durationMs: number): number =>
  Math.max(60_000, 2 * (Number.isFinite(durationMs) ? durationMs : 0) + 30_000);

/** Patients and doctors speak Bangla — the language the portal asks for. */
const STT_LANGUAGE = 'bn';

/**
 * Marks a recording that came back with no words in it. A code rather than an
 * Error subclass, so telling it apart does not rest on `instanceof` surviving
 * the build.
 */
export const AI_NO_SPEECH = 'AI_NO_SPEECH';

export const SpeechToTextRepository = {
  /**
   * `POST /transcribe` — a recording into its words. The recorder's m4a goes up
   * as it is: the service decodes it itself, so it is not converted to WAV the
   * way the portal's browser recording is.
   *
   * Throws with code `AI_NO_SPEECH` when nothing was heard — the service still
   * answers 200, with empty `text`.
   */
  transcribe: async (
    recording: UploadFile,
    /** How long the recording runs — the wait for its words grows with it. */
    durationMs: number,
    /** Stops the upload when the user cancels or leaves. */
    signal?: AbortSignal,
  ): Promise<string> => {
    // Missing settings would otherwise send a request to nowhere and read as
    // being offline.
    if (!AI_STT_URL || !AI_STT_API_KEY) {
      throw new Error('AI speech-to-text is not configured');
    }
    if (!recording?.uri) throw new Error('No recording to transcribe');

    const form = new FormData();
    form.append('file', {
      uri: recording.uri,
      name: recording?.name || 'recording.m4a',
      type: recording?.type || 'audio/mp4',
    } as any);
    form.append('task', 'transcribe');
    form.append('language', STT_LANGUAGE);

    const response = await sttClient.post(ENDPOINTS.aiTranscribe, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: sttTimeoutFor(durationMs),
      signal,
      // isConsole: true,
      // isConsoleParams: true,
    });

    const text = (response?.data as { text?: unknown } | null)?.text;
    const transcript = typeof text === 'string' ? text.trim() : '';
    if (!transcript) {
      throw Object.assign(new Error('No speech detected in the recording'), {
        code: AI_NO_SPEECH,
      });
    }
    return transcript;
  },
};

export default SpeechToTextRepository;
