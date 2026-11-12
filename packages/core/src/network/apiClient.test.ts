import apiClient from './apiClient';

const mockStore = {
  authStore: { isAuthenticated: true, logout: jest.fn() },
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

const answer = (status: number, data: any = null) => ({
  config: { url: '/hms/appointments', headers: {} },
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

  it('signs nobody out on a 403, as the web does', async () => {
    await expect(onError(answer(403))).rejects.toBeTruthy();

    expect(mockStore.authStore.logout).not.toHaveBeenCalled();
    expect(mockStore.toastStore.show).not.toHaveBeenCalled();
  });
});
