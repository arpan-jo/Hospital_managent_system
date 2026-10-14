import { serverMessageOf } from './serverMessage';

/** What `apiClient` rejects with: an Error carrying the decoded body on `data`. */
const failure = (data?: unknown) =>
  Object.assign(new Error('Error: 500'), { status: 500, data });

describe('serverMessageOf', () => {
  it("passes the server's message through unchanged", () => {
    expect(serverMessageOf(failure({ status: 500, message: 'Something went wrong. Reference: R8AYDTGZ' })))
      .toBe('Something went wrong. Reference: R8AYDTGZ');
  });

  it('takes a bare-string body as the message', () => {
    expect(serverMessageOf(failure('Invalid slotId.'))).toBe('Invalid slotId.');
  });

  it('gives nothing when the server said nothing', () => {
    expect(serverMessageOf(failure({ code: 'SLOT_FULL' }))).toBe('');
    expect(serverMessageOf(failure(undefined))).toBe('');
    expect(serverMessageOf(new Error('Network error: No response from server.'))).toBe('');
    expect(serverMessageOf(null)).toBe('');
  });

  it("does not take a proxy's error page for a message", () => {
    expect(serverMessageOf(failure('<html><body>502 Bad Gateway</body></html>'))).toBe('');
  });
});
