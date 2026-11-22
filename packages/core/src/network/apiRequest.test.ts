import { apiRequest, WRITE_TIMEOUT_MS } from './apiRequest';

const mockRequest = jest.fn();

jest.mock('./apiClient', () => ({
  apiClient: { request: (...args: any[]) => mockRequest(...args) },
}));

beforeEach(() => {
  mockRequest.mockReset();
  mockRequest.mockResolvedValue({ data: { ok: true } });
});

const sentTimeout = () => mockRequest.mock.calls[0]?.[0]?.timeout;

describe('apiRequest timeouts', () => {
  it('gives a write the longer write time when it sets none', async () => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'post'] as const) {
      mockRequest.mockClear();
      await apiRequest({ url: '/hms/x', method });
      expect(sentTimeout()).toBe(WRITE_TIMEOUT_MS);
    }
    expect(WRITE_TIMEOUT_MS).toBe(30_000);
  });

  it("leaves a read on the client's default", async () => {
    await apiRequest({ url: '/hms/x' });
    expect(sentTimeout()).toBeUndefined();
    mockRequest.mockClear();
    await apiRequest({ url: '/hms/x', method: 'GET' });
    expect(sentTimeout()).toBeUndefined();
  });

  it("keeps a call's own time, shorter or longer", async () => {
    await apiRequest({ url: '/hms/auth/logout', method: 'POST', timeout: 5000 });
    expect(sentTimeout()).toBe(5000);
    mockRequest.mockClear();
    await apiRequest({ url: '/hms/fileupload', method: 'POST', timeout: 60_000 });
    expect(sentTimeout()).toBe(60_000);
    mockRequest.mockClear();
    await apiRequest({ url: '/hms/x', method: 'GET', timeout: 20_000 });
    expect(sentTimeout()).toBe(20_000);
  });

  it('answers with the response body', async () => {
    await expect(apiRequest({ url: '/hms/x', method: 'POST' })).resolves.toEqual({ ok: true });
  });
});
