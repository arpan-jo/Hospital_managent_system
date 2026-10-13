import { AI_ASSIST_URL } from '@env';
import axios from 'axios';
import { attachAiLogging } from '../network/aiLogging';
import { ENDPOINTS } from '../network/endpoints';
import { DoctorSummary, toDoctorSummary } from './FindDoctorsRepository';
import { AI_NO_SPEECH } from './SpeechToTextRepository';

/**
 * The AI doctor finder — a patient describes how they feel, typed or spoken,
 * and pepobot names the specialist to see and picks doctors from this
 * hospital's own list, one of them as the best match.
 *
 * pepobot is outside HMS, so it gets its own client rather than `apiRequest`:
 * no HMS token goes out with it, and its 401 must not sign the patient out. It
 * speaks plain JSON and asks for no login.
 */
const finderClient = axios.create({
  baseURL: AI_ASSIST_URL || '',
  headers: { Accept: 'application/json' },
});

attachAiLogging(finderClient);

/** A suggestion takes pepobot about 10–15 s; the portal waits up to 120 s. */
const FINDER_TIMEOUT_MS = 120_000;

/** One earlier turn, so a follow-up ("a female doctor, please") builds on it. */
export interface AiFinderTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface AiDoctorMatch {
  /** What the AI says back, in the patient's own language. */
  message: string;
  /** The specialty it recommends, e.g. "Cardiology"; '' when it named none. */
  specialist: string;
  /** The doctor it picked first; null when it found nobody to put forward. */
  topMatch: DoctorSummary | null;
  /** The other doctors it suggests, never repeating the top match. */
  others: DoctorSummary[];
}

const toText = (value: unknown): string =>
  typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';

const isObject = (value: unknown): value is Record<string, any> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/**
 * `POST /doctors_find` answers `{ summary, audio_base64, language, doctor_data }`
 * (pepobot's swagger), where `doctor_data` is the top doctor's own fields with
 * `message`, `recommendedSpecialist` and `recommendations` alongside. The
 * portal still reads that inner object as the whole answer, and has said it
 * may change again, so both shapes are read: the wrapper's `doctor_data` when
 * it is there, the answer itself when it is not.
 */
const toAiDoctorMatch = (raw: unknown): AiDoctorMatch => {
  const answer = isObject(raw) ? raw : {};
  const data = isObject(answer?.doctor_data) ? answer.doctor_data : answer;

  // A top-level doctor without an id is an empty stub, not a doctor.
  const topMatch = toText(data?.userId) && Number(data?.userId) > 0 ? toDoctorSummary(data) : null;

  const seen = new Set(topMatch?.id ? [topMatch.id] : []);
  const others = (Array.isArray(data?.recommendations) ? data.recommendations : [])
    .map(toDoctorSummary)
    .filter((doctor: DoctorSummary) => {
      if (!doctor?.id || seen.has(doctor.id)) return false;
      seen.add(doctor.id);
      return true;
    });

  return {
    message: toText(data?.message) || toText(answer?.summary),
    specialist: toText(data?.recommendedSpecialist),
    topMatch,
    others,
  };
};

export const AiDoctorFinderRepository = {
  /**
   * The patient's words in, the AI's pick of doctors out. `history` carries the
   * earlier turns of the same search, oldest first, without this message.
   */
  findDoctors: async (input: {
    text: string;
    history?: AiFinderTurn[];
    sessionId?: string;
    signal?: AbortSignal;
  }): Promise<AiDoctorMatch> => {
    const text = input?.text?.trim() ?? '';
    // pepobot answers an empty ask with a 400; it is never worth sending.
    if (!text) throw new Error('Nothing to look up');
    if (!AI_ASSIST_URL) throw new Error('AI doctor finder is not configured');

    const history = (input?.history ?? []).filter(turn => turn?.content?.trim());

    const response = await finderClient.post(
      ENDPOINTS.aiDoctorFind,
      {
        text,
        ...(history.length ? { history } : {}),
        ...(input?.sessionId ? { session_id: input.sessionId } : {}),
      },
      {
        timeout: FINDER_TIMEOUT_MS,
        signal: input?.signal,
        // isConsole: true,
        // isConsoleParams: true,
      },
    );

    return toAiDoctorMatch(response?.data);
  },
};

export default AiDoctorFinderRepository;

// ─────────────────────────────────────────────────────────────────────────────
// Failures
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Why an ask came back with nothing. Only a recording with no speech in it is
 * the patient's to fix, so that one is told apart from the rest.
 */
export type AiAssistFailure = 'noSpeech' | 'network' | 'failed';

/**
 * A text field from the AI. Only text or a number counts: anything else — an
 * object where a string belongs — reads as nothing, never as "[object Object]".
 */
const toAiText = (value: unknown): string =>
  typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';

/**
 * Which failure an ask ran into. Only a recording with no words in it is the
 * doctor's to fix; anything the services turn down — a bad key, audio they
 * cannot read, an empty ask — is simply a failure.
 */
export const aiAssistFailureOf = (error: unknown): AiAssistFailure => {
  if ((error as { code?: unknown } | null)?.code === AI_NO_SPEECH) return 'noSpeech';
  if (!axios.isAxiosError(error)) return 'failed';
  // No answer at all — offline, unreachable, or out of time.
  return error.response ? 'failed' : 'network';
};

/** Longer than this is a stack trace or a page, not a message for the patient. */
const AI_ERROR_MESSAGE_MAX_LENGTH = 200;

/**
 * What the service itself said when it turned an ask down, to show under the
 * notice — '' when it said nothing readable. Both services are FastAPI:
 * `detail` is a sentence ("text is required.", "Invalid or missing X-API-Key
 * header") or, when the request itself is malformed, a list of `{ msg }`. A
 * gateway that is down answers with an HTML page instead, which says nothing
 * past its status.
 */
export const aiAssistErrorMessage = (error: unknown): string => {
  if (!axios.isAxiosError(error)) {
    // The app's own reasons — settings missing, no recording — but not "no
    // speech", which the notice already says in full.
    const failure = error as { code?: unknown; message?: unknown } | null;
    return failure?.code !== AI_NO_SPEECH && typeof failure?.message === 'string'
      ? failure.message
      : '';
  }

  const status = error.response?.status;
  if (!status) return '';

  const data = error.response?.data as any;
  const detail = data?.detail ?? data?.message ?? data?.error;
  const said = Array.isArray(detail)
    ? detail
        .map(item => toAiText(item?.msg))
        .filter(Boolean)
        .join('; ')
    : toAiText(detail) ||
      (typeof data === 'string' && !data.trim().startsWith('<') ? data.trim() : '');

  const message = said.slice(0, AI_ERROR_MESSAGE_MAX_LENGTH).trim();
  return message ? `${message} (HTTP ${status})` : `HTTP ${status}`;
};
