const mockStore = new Map<string, unknown>();
const mockStorage = {
  getBoolean: jest.fn((key: string) => mockStore.get(key) as boolean | undefined),
  set: jest.fn((key: string, value: unknown) => {
    mockStore.set(key, value);
  }),
};
const mockRequest = jest.fn();

jest.mock('./secureStorage', () => ({
  get storage() {
    return mockStorage;
  },
}));
jest.mock('./localNotifications', () => ({
  requestNotificationPermission: (...args: any[]) => mockRequest(...args),
}));

import { AppState } from 'react-native';
import { askNotificationPermissionOnce } from './notificationPermission';

const KEY = 'reminder_permission_asked';

// The jest mock's currentState is a function, so it is swapped by hand and put back after.
const originalAppState = (AppState as any).currentState;
const setAppState = (state: string) => {
  (AppState as any).currentState = state;
};

beforeEach(() => {
  mockStore.clear();
  mockRequest.mockReset();
  setAppState('active');
});
afterAll(() => {
  (AppState as any).currentState = originalAppState;
});

describe('askNotificationPermissionOnce', () => {
  it('asks once; after an answer it never asks again', async () => {
    mockRequest.mockResolvedValue('granted');
    await askNotificationPermissionOnce();
    await askNotificationPermissionOnce();
    expect(mockRequest).toHaveBeenCalledTimes(1);
    expect(mockStore.get(KEY)).toBe(true);
  });

  it('a "no" counts as the answer too', async () => {
    mockRequest.mockResolvedValue('denied');
    await askNotificationPermissionOnce();
    await askNotificationPermissionOnce();
    expect(mockRequest).toHaveBeenCalledTimes(1);
  });

  it('one that could not be asked is asked again next time', async () => {
    mockRequest.mockResolvedValueOnce('unavailable').mockResolvedValueOnce('granted');
    await askNotificationPermissionOnce();
    expect(mockStore.get(KEY)).toBeUndefined();
    await askNotificationPermissionOnce();
    expect(mockRequest).toHaveBeenCalledTimes(2);
    expect(mockStore.get(KEY)).toBe(true);
  });

  it('never asks while the app is in the background', async () => {
    setAppState('background');
    await askNotificationPermissionOnce();
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it('a patient asked before (by the follow-up reminder) is not asked again', async () => {
    mockStore.set(KEY, true);
    await askNotificationPermissionOnce();
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it('two asks at the same moment show one dialog', async () => {
    let answer: (value: string) => void = () => {};
    mockRequest.mockReturnValue(new Promise(resolve => (answer = resolve)));
    const first = askNotificationPermissionOnce();
    const second = askNotificationPermissionOnce();
    answer('granted');
    await Promise.all([first, second]);
    expect(mockRequest).toHaveBeenCalledTimes(1);
  });

  it('never throws', async () => {
    mockRequest.mockRejectedValue(new Error('no activity'));
    await expect(askNotificationPermissionOnce()).resolves.toBeUndefined();
    mockStorage.getBoolean.mockImplementationOnce(() => {
      throw new Error('storage gone');
    });
    await expect(askNotificationPermissionOnce()).resolves.toBeUndefined();
  });
});
