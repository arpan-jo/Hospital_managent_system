import apiClient from './apiClient';

const mockStore = {
  authStore: {
    isAuthenticated: true,
    authToken: 'token-1' as string | null,
    logout: jest.fn(),
    markSessionRevoked: jest.fn(),
  },
  profileStore: { clear: jest.fn() },
  toastStore: { show: jest.fn() },
};

// A getter: the import is hoisted above `mockStore`, so it is read when used.
jest.mock('../store', () => ({
  get rootStore() {
    return mockStore;
  },
}));
jest.mock('../utils/i18n', () => ({ __esModule: true, default: { t: (key: string) => key } }));

/** The response interceptor's error side, as axios calls it. */
const onError = (apiClient.interceptors.response as any).handlers[0].rejected as (error: any) => Promise<any>;

const answer = (status: number, data: any = null, signedIn = true) => ({
  config: { url: '/hms/appointments', headers: signedIn ? { Authorization: 'Bearer token' } : {} },
  response: { status, data },
});

describe('apiClient on a 401', () => {
  beforeEach(() => {
    mockStore.authStore.isAuthenticated = true;
    mockStore.authStore.logout.mockReset().mockImplementation(() => {
      mockStore.authStore.isAuthenticated = false;
    });
    mockStore.profileStore.clear.mockReset();
    mockStore.toastStore.show.mockReset();
  });

  it('signs an expired session out and says so, once for every call in flight', async () => {
    await expect(onError(answer(401))).rejects.toBeTruthy();
    await expect(onError(answer(401))).rejects.toBeTruthy();

    expect(mockStore.authStore.logout).toHaveBeenCalled();
    expect(mockStore.profileStore.clear).toHaveBeenCalled();
    expect(mockStore.toastStore.show).toHaveBeenCalledTimes(1);
    expect(mockStore.toastStore.show).toHaveBeenCalledWith('common.sessionExpired', 'info', 5000);
  });

  it('says nothing for a wrong password, where nobody was signed in', async () => {
    mockStore.authStore.isAuthenticated = false;

    await expect(onError(answer(401, { message: 'Invalid email or password.' }))).rejects.toBeTruthy();

    expect(mockStore.toastStore.show).not.toHaveBeenCalled();
  });

});

describe('apiClient on a bare 403 — a session ended elsewhere', () => {
  const asked = mockStore.authStore.markSessionRevoked;

  beforeEach(() => {
    mockStore.authStore.isAuthenticated = true;
    mockStore.authStore.logout.mockReset();
    mockStore.profileStore.clear.mockReset();
    mockStore.toastStore.show.mockReset();
    asked.mockReset();
  });

  it('signs nobody out, as the web does, but asks once to log out and sign in again', async () => {
    mockStore.authStore.authToken = 'token-a';

    await expect(onError(answer(403))).rejects.toBeTruthy();
    await expect(onError(answer(403))).rejects.toBeTruthy();

    expect(mockStore.authStore.logout).not.toHaveBeenCalled();
    expect(mockStore.profileStore.clear).not.toHaveBeenCalled();
    expect(asked).toHaveBeenCalledTimes(1);
  });

  it('asks again for a new login that ends too', async () => {
    mockStore.authStore.authToken = 'token-b';
    await expect(onError(answer(403))).rejects.toBeTruthy();
    mockStore.authStore.authToken = 'token-c';
    await expect(onError(answer(403))).rejects.toBeTruthy();

    expect(asked).toHaveBeenCalledTimes(2);
  });

  it('asks nothing for a 403 that gives its reason — a refused action, not an ended session', async () => {
    mockStore.authStore.authToken = 'token-d';

    await expect(
      onError(answer(403, { message: 'You can only message a doctor you have had an appointment with.' })),
    ).rejects.toBeTruthy();

    expect(asked).not.toHaveBeenCalled();
  });

  it('asks nothing for a call sent without a login, or when nobody is signed in', async () => {
    mockStore.authStore.authToken = 'token-e';
    await expect(onError(answer(403, null, false))).rejects.toBeTruthy();

    mockStore.authStore.isAuthenticated = false;
    await expect(onError(answer(403))).rejects.toBeTruthy();

    expect(asked).not.toHaveBeenCalled();
  });
});
