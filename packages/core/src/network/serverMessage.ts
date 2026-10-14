/**
 * What the server itself said about a failed call, for the screen to show as
 * it is — the way the portal shows `response.data.message`. '' when it said
 * nothing: no answer at all, or a body without a message. The screen then
 * shows its own fallback for that action.
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

export const serverMessageOf = (error: any): string => {
  const data = error?.data;
  // The file upload answers one row per file: `[{ fileName, message }]`.
  const body = Array.isArray(data) ? data?.[0] : data;
  const message = typeof body === 'string' ? body : body?.message;
  const text = typeof message === 'string' ? message.trim() : '';

  // A proxy's error page is not a message, and neither is cipher text.
  return text.startsWith('<') || looksLikeCipher(text) ? '' : text;
};
