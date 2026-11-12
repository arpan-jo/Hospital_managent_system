import { authErrorMessageOf } from './authErrorMessage';

const answer = (status: number, data?: unknown) => Object.assign(new Error(`Error: ${status}`), { status, data });

describe('authErrorMessageOf', () => {
  it("passes the server's words through first — the sign-in lockout says why", () => {
    expect(authErrorMessageOf(answer(429, { message: 'Too many failed attempts. Try again in 15 minutes.' }))).toBe(
      'Too many failed attempts. Try again in 15 minutes.',
    );
    expect(authErrorMessageOf(answer(401, { message: 'Invalid email or password.' }))).toBe(
      'Invalid email or password.',
    );
  });

  it('names a wordless 429 — the auth rate limit — instead of leaving the screen to guess', () => {
    expect(authErrorMessageOf(answer(429))).toBe('Too many attempts. Please wait a minute and try again.');
  });

  it('names the connection when no answer came at all — not a wrong password', () => {
    // As apiClient rejects a call that never reached the server: no status, an axios error without a response.
    const offline = Object.assign(new Error('Network error'), { originalError: { request: {} } });
    expect(authErrorMessageOf(offline)).toBe(
      "Couldn't reach the server. Check your internet connection and try again.",
    );
  });

  it('leaves any other wordless failure to the screen', () => {
    expect(authErrorMessageOf(answer(500))).toBe('');
    expect(authErrorMessageOf(null)).toBe('');
  });
});
