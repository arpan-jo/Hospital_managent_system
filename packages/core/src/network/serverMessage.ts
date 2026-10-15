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
