import {
  handlePushEvent,
  registerPushDevice,
  toPushOpen,
  unregisterPushDevice,
  watchPush,
} from './pushNotifications';
import { NotificationRepository } from '../repositories/NotificationRepository';

const mockStore = new Map<string, string>();
jest.mock('./secureStorage', () => ({
  storage: {
    set: (key: string, value: string) => mockStore.set(key, value),
    getString: (key: string) => mockStore.get(key),
    remove: (key: string) => mockStore.delete(key),
  },
}));

jest.mock('../repositories/NotificationRepository', () => ({
  NotificationRepository: { registerDevice: jest.fn(), removeDevice: jest.fn() },
}));

jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: { getInitialNotification: jest.fn(async () => null) },
  EventType: { PRESS: 1, ACTION_PRESS: 2 },
}));

const mockMessaging = {
  getMessaging: jest.fn(() => ({})),
  getToken: jest.fn(async () => 'fcm-token-1'),
  onTokenRefresh: jest.fn(() => () => {}),
  onMessage: jest.fn(() => () => {}),
  onNotificationOpenedApp: jest.fn(() => () => {}),
  getInitialNotification: jest.fn(async () => null),
  setBackgroundMessageHandler: jest.fn(),
};
jest.mock('@react-native-firebase/messaging', () => mockMessaging);

const repo = NotificationRepository as unknown as {
  registerDevice: jest.Mock;
  removeDevice: jest.Mock;
};

const pressPush = (data: Record<string, string>) =>
  handlePushEvent({
    type: 1,
    detail: { pressAction: { id: 'push-open' }, notification: { data } },
  } as any);

beforeEach(() => {
  mockStore.clear();
  jest.clearAllMocks();
});

test('toPushOpen reads the backend data and ignores pushes naming nothing', () => {
  expect(toPushOpen({ link: ' /appointments/3 ', notificationId: '42' })).toEqual({
    link: '/appointments/3',
    notificationId: 42,
  });
  expect(toPushOpen({ link: '', notificationId: 'x' })).toBeNull();
  expect(toPushOpen(null)).toBeNull();
});

test('register sends the token; Logout takes the same one back with the old login', async () => {
  await registerPushDevice();
  expect(repo.registerDevice).toHaveBeenCalledWith('fcm-token-1', expect.any(String));

  await unregisterPushDevice('jwt-1');
  expect(repo.removeDevice).toHaveBeenCalledWith('fcm-token-1', 'jwt-1');

  // Once only: nothing left to take back.
  await unregisterPushDevice('jwt-1');
  expect(repo.removeDevice).toHaveBeenCalledTimes(1);
});

test('a failed register keeps nothing for Logout to remove', async () => {
  repo.registerDevice.mockRejectedValueOnce(new Error('offline'));
  await registerPushDevice();
  await unregisterPushDevice('jwt-1');
  expect(repo.removeDevice).not.toHaveBeenCalled();
});

test('a tap before anyone listens is handed over when watching starts', async () => {
  await pressPush({ link: '/follow-ups', notificationId: '7' });
  const onOpen = jest.fn();
  const stop = watchPush({ onOpen });
  expect(onOpen).toHaveBeenCalledWith({ link: '/follow-ups', notificationId: 7 });

  // Then live, and not again once stopped.
  await pressPush({ link: '/messages', notificationId: '8' });
  expect(onOpen).toHaveBeenCalledTimes(2);
  stop();
  await pressPush({ link: '/messages', notificationId: '9' });
  expect(onOpen).toHaveBeenCalledTimes(2);
});

test('other notifications’ presses are not pushes', async () => {
  const onOpen = jest.fn();
  // The tap left from the test above (made after it stopped watching) arrives first.
  const stop = watchPush({ onOpen });
  expect(onOpen).toHaveBeenCalledWith({ link: '/messages', notificationId: 9 });
  await handlePushEvent({
    type: 1,
    detail: { pressAction: { id: 'reminder-press' }, notification: { data: { link: '/x' } } },
  } as any);
  expect(onOpen).toHaveBeenCalledTimes(1);
  stop();
});
