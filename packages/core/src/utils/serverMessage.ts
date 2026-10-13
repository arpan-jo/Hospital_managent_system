/**
 * What the HMS backend said when it turned a request down, for a toast — or ''
 * when it said nothing a person can read.
 *
 * `apiClient` rejects with an Error whose message is the backend's own
 * (`message`, `detail`, `title`…) and whose `status` is the HTTP status. When
 * the backend sent nothing readable it makes one up — "Error: 500", or a
 * network note with no status — and those are left to the caller's own wording.
 * So is ASP.NET's own error page, `{ title: 'Not Found', status: 404 }`, whose
 * title only names the status ("Not Found", "One or more validation errors
 * occurred.") rather than saying what went wrong.
 */
export const serverMessageOf = (error: unknown): string => {
  const failure = error as { status?: unknown; message?: unknown; data?: any } | null;
  if (typeof failure?.status !== 'number') return '';

  const message = typeof failure?.message === 'string' ? failure.message.trim() : '';
  if (/^Error: \d+$/.test(message)) return '';

  const data = failure?.data;
  const isStatusTitle =
    typeof data?.title === 'string' && data.title.trim() === message && !data?.detail;
  return isStatusTitle ? '' : message;
};

export default serverMessageOf;
