import { Platform } from 'react-native';
import { cancelAllAlarms } from './alarm';

const mockNotifee = {
  getTriggerNotifications: jest.fn(),
  cancelTriggerNotifications: jest.fn(),
  getDisplayedNotifications: jest.fn(),
  cancelDisplayedNotifications: jest.fn(),
};

jest.mock('@notifee/react-native', () => ({ __esModule: true, default: mockNotifee }));

const alarm = (id: string) => ({ id, android: { channelId: 'patient-alarm' } });
const other = (id: string) => ({ id, android: { channelId: 'something-else' } });

describe('cancelAllAlarms', () => {
  beforeEach(() => {
    Object.values(mockNotifee).forEach(fn => fn.mockReset());
    jest.replaceProperty(Platform, 'OS', 'android');
  });

  afterEach(() => jest.restoreAllMocks());

  it('takes away the alarms still to ring and one ringing now, and nothing else', async () => {
    mockNotifee.getTriggerNotifications.mockResolvedValueOnce([
      { notification: alarm('a1') },
      { notification: other('o1') },
      { notification: alarm('a2') },
    ]);
    mockNotifee.getDisplayedNotifications.mockResolvedValueOnce([
      { id: 'a3', notification: alarm('a3') },
      { id: 'o2', notification: other('o2') },
    ]);

    await cancelAllAlarms();

    expect(mockNotifee.cancelTriggerNotifications).toHaveBeenCalledWith(['a1', 'a2']);
    expect(mockNotifee.cancelDisplayedNotifications).toHaveBeenCalledWith(['a3']);
  });

  it('cancels nothing when no alarm is set', async () => {
    mockNotifee.getTriggerNotifications.mockResolvedValueOnce([]);
    mockNotifee.getDisplayedNotifications.mockResolvedValueOnce([]);

    await cancelAllAlarms();

    expect(mockNotifee.cancelTriggerNotifications).not.toHaveBeenCalled();
    expect(mockNotifee.cancelDisplayedNotifications).not.toHaveBeenCalled();
  });

  it('never throws, so a sign-out cannot fail on it', async () => {
    mockNotifee.getTriggerNotifications.mockRejectedValueOnce(new Error('native gone'));

    await expect(cancelAllAlarms()).resolves.toBeUndefined();
  });
});
