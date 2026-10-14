/**
 * What the server itself said about a failed call, for the screen to show as
 * it is — the way the portal shows `response.data.message`. '' when it said
 * nothing: no answer at all, or a body without a message. The screen then
 * shows its own fallback for that action.
 *
 * `apiRequest` rejects with the decoded body on `error.data`.
 */
export const serverMessageOf = (error: any): string => {
  const data = error?.data;
  // The file upload answers one row per file: `[{ fileName, message }]`.
  const body = Array.isArray(data) ? data?.[0] : data;
  const message = typeof body === 'string' ? body : body?.message;
  const text = typeof message === 'string' ? message.trim() : '';

  // A proxy's error page is not a message.
  return text.startsWith('<') ? '' : text;
};
