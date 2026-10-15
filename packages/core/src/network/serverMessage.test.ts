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

  it("reads the first row of the file upload's list", () => {
    expect(
      serverMessageOf(
        failure([{ fileName: 'files', message: 'Maximum File Size Allowed (5MB) Your File Size (7MB)' }]),
      ),
    ).toBe('Maximum File Size Allowed (5MB) Your File Size (7MB)');
  });

  it('gives nothing when the server said nothing', () => {
    expect(serverMessageOf(failure({ code: 'SLOT_FULL' }))).toBe('');
    expect(serverMessageOf(failure(undefined))).toBe('');
    expect(serverMessageOf(new Error('Network error: No response from server.'))).toBe('');
    expect(serverMessageOf(null)).toBe('');
  });

  it('does not take an undecrypted body for a message', () => {
    expect(serverMessageOf(failure('/+c2s6hnikGG63EeZklWTQ=='))).toBe('');
    expect(serverMessageOf(failure('Unauthorized'))).toBe('Unauthorized');
  });

  it("reads a ProblemDetails answer's detail, then its title", () => {
    // PortalAppointmentController: Problem(detail, 400, "Invalid status change")
    expect(
      serverMessageOf(
        failure({
          title: 'Invalid status change',
          status: 400,
          detail: 'Only a pending or confirmed appointment can be cancelled.',
        }),
      ),
    ).toBe('Only a pending or confirmed appointment can be cancelled.');
    // PatientRegistrationController: Conflict(new ProblemDetails { Title = … })
    expect(
      serverMessageOf(
        failure({
          status: 409,
          title: 'This patient could not be saved because it duplicates an existing record.',
        }),
      ),
    ).toBe('This patient could not be saved because it duplicates an existing record.');
  });

  it("does not take a stock ProblemDetails title for a message", () => {
    // A bare NotFound(), as dev answers it.
    expect(
      serverMessageOf(
        failure({
          type: 'https://tools.ietf.org/html/rfc9110#section-15.5.5',
          title: 'Not Found',
          status: 404,
          traceId: '00-0ae75fd2db6ca1facc9e5421156e8508-23d683c2a67cb91c-00',
        }),
      ),
    ).toBe('');
    expect(
      serverMessageOf(failure({ title: 'One or more validation errors occurred.', errors: {} })),
    ).toBe('');
  });

  it("does not take a proxy's error page for a message", () => {
    expect(serverMessageOf(failure('<html><body>502 Bad Gateway</body></html>'))).toBe('');
  });
});
