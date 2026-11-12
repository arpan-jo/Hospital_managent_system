/** Used when the send answer carried no expiry: 04:44. */
export const DEFAULT_OTP_EXPIRY_SECONDS = 284;

/**
 * When a code sent now runs out, as a wall-clock time (ms). The countdown
 * works back from it, so time spent away from the app — reading the SMS or
 * the email — is counted: Android stops an app's timers while it is away.
 */
export const otpDeadline = (expiresInSeconds?: number | null, now: number = Date.now()): number => {
  const seconds = Number(expiresInSeconds);
  const valid = Number.isFinite(seconds) && seconds > 0 ? seconds : DEFAULT_OTP_EXPIRY_SECONDS;
  return now + valid * 1000;
};

/** Whole seconds left until `deadline`, never below 0. */
export const secondsUntil = (deadline: number, now: number = Date.now()): number => {
  const left = Math.ceil(((Number(deadline) || 0) - now) / 1000);
  return Number.isFinite(left) && left > 0 ? left : 0;
};

/**
 * What one box's new text means. A box holds a single digit, so its text is
 * that digit plus whatever came in — the caret sits after it.
 * - One character in: typing — `digit` is the box's new digit ('' when cleared).
 * - More than one: a paste — `pasted` holds the first `length` digits of it,
 *   as the portal reads a paste ("Your code is 123456. It expires in 5
 *   minutes." gives 123456), to fill the boxes from the first.
 */
export const readOtpBox = (
  previous: string | null | undefined,
  text: string | null | undefined,
  length: number,
): { digit: string; pasted: null } | { digit: null; pasted: string[] } => {
  const old = previous ?? '';
  const raw = text ?? '';
  const incoming = old && raw.startsWith(old) ? raw.slice(old.length) : raw;
  const added = incoming.replace(/\D/g, '');
  if (incoming.length > 1 && added.length > 1) {
    return { digit: null, pasted: added.slice(0, Math.max(0, length)).split('') };
  }
  return { digit: raw.replace(/\D/g, '').slice(-1), pasted: null };
};
