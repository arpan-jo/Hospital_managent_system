import { AI_ASSIST_URL } from '@env';
import axios from 'axios';
import { attachAiLogging } from '../network/aiLogging';
import { ENDPOINTS } from '../network/endpoints';
import { PortalDoctor } from './FindDoctorsRepository';
import { AI_NO_SPEECH } from './SpeechToTextRepository';

/**
 * The AI doctor finder — a patient describes how they feel, typed or spoken,
 * and pepobot names the specialist to see and picks doctors from this
 * hospital's own list, one of them as the best match.
 *
 * pepobot is outside HMS, so it gets its own client rather than `apiRequest`:
 * no HMS token goes out with it, and its 401 must not sign the patient out. It
 * speaks plain JSON and asks for no login. Each ask stands alone, as on the
 * web: only the patient's words go up.
 */
const finderClient = axios.create({
  baseURL: AI_ASSIST_URL || '',
  headers: { Accept: 'application/json' },
});

attachAiLogging(finderClient);

/** A suggestion takes pepobot about 10–15 s; the portal waits up to 120 s. */
const FINDER_TIMEOUT_MS = 120_000;

export interface AiDoctorMatch {
  /**
   * What the AI says back, in the patient's own language: its spoken-style
   * summary naming the picks when it sent one, otherwise its short message.
   */
  message: string;
  /** The specialty it recommends, e.g. "Cardiology"; '' when it named none. */
  specialist: string;
  /** The doctor it picked first; null when it found nobody to put forward. */
  topMatch: PortalDoctor | null;
  /** The other doctors it suggests, never repeating the top match. */
  others: PortalDoctor[];
  /** The summary read aloud, as base64; null when the answer came without one. */
  audio: { base64: string; format: string } | null;
}

const toText = (value: unknown): string =>
  typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';

const toNumber = (value: unknown): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const isObject = (value: unknown): value is Record<string, any> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/**
 * pepobot describes a doctor in another product's profile fields; this is the
 * portal row the cards render, mapped the way the web maps it. `userId` is
 * taken as the doctor's `employeeId`. The answer carries no schedule and no
 * tenant ids, so those stay empty until the doctor's own page loads them.
 */
const toSuggestedDoctor = (raw: any): PortalDoctor => {
  const photoUrl = toText(raw?.photoUrl);

  return {
    employeeId: toNumber(raw?.userId),
    fullName: toText(raw?.fullName),
    specialty: toText(raw?.primarySpecialization),
    departmentName: toText(raw?.department),
    gender: toText(raw?.gender),
    // pepobot sometimes puts a sentence here; only a file name or url is a photo.
    photoUrl: photoUrl && !/\s/.test(photoUrl) ? photoUrl : '',
    experienceYears:
      toNumber(raw?.totalExperience) || toNumber(raw?.yearsOfPractice),
    consultationFee: toNumber(raw?.minConsultationFee),
    followUpFee: 0,
    location:
      toText(raw?.locationNames?.[0]) || toText(raw?.hospitalClinic),
    availableDays: [],
    isAvailable: Boolean(raw?.isAvailable),
    accountId: 0,
    branchId: 0,
    officeId: 0,
  };
};

/**
 * `POST /hms_doctors_find` answers `{ summary, audio_base64, doctor_data }`,
 * where `doctor_data` is the top doctor's own fields with `message`,
 * `recommendedSpecialist` and `recommendations` alongside. Older builds sent
 * that inner object as the whole answer, so both shapes are read, as the web
 * reads them.
 */
const toAiDoctorMatch = (raw: unknown): AiDoctorMatch => {
  const answer = isObject(raw) ? raw : {};
  const data = isObject(answer?.doctor_data) ? answer.doctor_data : answer;

  // A top-level doctor without an id is an empty stub, not a doctor.
  const topMatch = toNumber(data?.userId) ? toSuggestedDoctor(data) : null;

  const others = (Array.isArray(data?.recommendations) ? data.recommendations : [])
    .filter(
      (doctor: any) =>
        toNumber(doctor?.userId) &&
        toNumber(doctor?.userId) !== topMatch?.employeeId,
    )
    .map(toSuggestedDoctor);

  const audioBase64 = typeof answer?.audio_base64 === 'string' ? answer.audio_base64 : '';

  return {
    message: toText(answer?.summary) || toText(data?.message),
    specialist: toText(data?.recommendedSpecialist),
    topMatch,
    others,
    audio: audioBase64
      ? { base64: audioBase64, format: toText(answer?.audio_format) || 'mp3' }
      : null,
  };
};

export const AiDoctorFinderRepository = {
  /** The patient's words in, the AI's pick of doctors out. */
  findDoctors: async (input: {
    text: string;
    signal?: AbortSignal;
  }): Promise<AiDoctorMatch> => {
    const text = input?.text?.trim() ?? '';
    // pepobot answers an empty ask with a 400; it is never worth sending.
    if (!text) throw new Error('Nothing to look up');
    if (!AI_ASSIST_URL) throw new Error('AI doctor finder is not configured');

    const response = await finderClient.post(
      ENDPOINTS.aiDoctorFind,
      { text },
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
 * Why an ask came back with nothing, told apart the way the portal tells
 * them: no words in the recording, the recording not turned into words, or no
 * suggestion from the finder.
 */
export type AiAssistFailure = 'noSpeech' | 'transcribeFailed' | 'failed';

/**
 * A text field from the AI. Only text or a number counts: anything else — an
 * object where a string belongs — reads as nothing, never as "[object Object]".
 */
const toAiText = (value: unknown): string =>
  typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';

/** The recording held no words. */
export const isNoSpeech = (error: unknown): boolean =>
  (error as { code?: unknown } | null)?.code === AI_NO_SPEECH;

/**
 * What an AI service itself said when it turned a call down — '' when it said
 * nothing. Both services are FastAPI: `detail` is a sentence, or a list of
 * `{ msg }` when the request itself is malformed.
 */
export const aiServiceMessageOf = (error: unknown): string => {
  if (!axios.isAxiosError(error)) return '';

  const data = error.response?.data as any;
  const detail = data?.detail ?? data?.message ?? data?.error;
  const said = Array.isArray(detail)
    ? detail
        .map(item => toAiText(item?.msg))
        .filter(Boolean)
        .join('; ')
    : toAiText(detail) || (typeof data === 'string' ? data.trim() : '');

  // A gateway's error page is not a message.
  return said.startsWith('<') ? '' : said;
};
