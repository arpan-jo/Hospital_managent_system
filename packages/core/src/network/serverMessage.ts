/**
 * What the server itself said about a failed call, for the screen to show as
 * it is — the way the portal shows `response.data.message`, or a ProblemDetails
 * `detail` / `title`. '' when it said nothing: no answer at all, or a body
 * without a message. The screen then shows its own fallback for that action.
 *
 * `apiRequest` rejects with the decoded body on `error.data`.
 */
/**
 * A body the app could not decrypt arrives as its cipher text — base64 with no
 * spaces, a whole number of blocks, usually '='-padded (a route that does not
 * exist answers an encrypted empty body like this). That is not words.
 */
const looksLikeCipher = (text: string): boolean =>
  /^[A-Za-z0-9+/]+={0,2}$/.test(text) &&
  text.length % 4 === 0 &&
  (/[+/=]/.test(text) || text.length >= 24);

/**
 * ASP.NET's stock ProblemDetails titles: they only name the status code (a bare
 * `NotFound()` answers `{ title: "Not Found" }`), so they are not words from
 * the server about this action.
 */
const STOCK_TITLES = new Set(
  [
    'Bad Request',
    'Unauthorized',
    'Forbidden',
    'Not Found',
    'Method Not Allowed',
    'Not Acceptable',
    'Request Timeout',
    'Conflict',
    'Precondition Failed',
    'Unsupported Media Type',
    'Unprocessable Entity',
    'Upgrade Required',
    'Too Many Requests',
    'An error occurred while processing your request.',
    'One or more validation errors occurred.',
  ].map(title => title.toLowerCase()),
);

const textOf = (value: any): string => (typeof value === 'string' ? value.trim() : '');

export const serverMessageOf = (error: any): string => {
  const data = error?.data;
  // The file upload answers one row per file: `[{ fileName, message }]`.
  const body = Array.isArray(data) ? data?.[0] : data;
  // A ProblemDetails answer (`Problem(…)`, `Conflict(new ProblemDetails …)`)
  // has its words in `detail`, or in `title` when it has no detail.
  const title = textOf(body?.title);
  const text =
    typeof body === 'string'
      ? body.trim()
      : textOf(body?.message) ||
        textOf(body?.detail) ||
        (STOCK_TITLES.has(title.toLowerCase()) ? '' : title);

  // A proxy's error page is not a message, and neither is cipher text.
  return text.startsWith('<') || looksLikeCipher(text) ? '' : text;
};

/**
 * True only when no answer came back at all — offline, unreachable, timed out.
 * `apiClient` keeps the axios error on `originalError`, and one without a
 * `response` never reached the server. An answer the app could not read (a
 * repository's own "unexpected response" error) is not this, nor is any
 * answer with a status.
 */
export const isServerUnreachable = (error: any): boolean =>
  !error?.status && !!error?.originalError && !error?.originalError?.response;

/**
 * A 403 with no words from the server. On a signed-in call that is a revoked
 * session: since 2026-11-07 the backend refuses a token issued before the
 * account's last logout or password reset — on any device — with exactly this.
 * A 403 that says why ("You can only message a doctor …") is a refused action,
 * not an ended session.
 */
export const isBareForbidden = (error: any): boolean =>
  Number(error?.status) === 403 && !serverMessageOf(error);

/**
 * A 429 — too many calls. The sign-in lockout says why in words; the auth rate
 * limit (60 a minute per network) answers with no body at all.
 */
export const isRateLimited = (error: any): boolean => Number(error?.status) === 429;

/** Why a read failed, as a screen tells it: the session ended, no answer came, or anything else. */
export type FailureKind = 'session' | 'offline' | 'other';

/**
 * A bare 403 on a signed-in call is a session ended elsewhere (see
 * `isBareForbidden`) — signing in again is the cure, not a retry. No answer at
 * all is the connection. Anything else is just a failure.
 */
export const failureKindOf = (error: any): FailureKind =>
  isBareForbidden(error) ? 'session' : isServerUnreachable(error) ? 'offline' : 'other';
