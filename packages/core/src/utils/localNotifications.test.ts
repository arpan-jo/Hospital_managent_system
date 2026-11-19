import { Platform } from 'react-native';
import {
  cancelReminders,
  registerNotificationHandlers,
  requestNotificationPermission,
  scheduleReminder,
} from './localNotifications';

const mockNotifee = {
  createChannel: jest.fn(),
  createTriggerNotification: jest.fn(),
  getNotificationSettings: jest.fn(),
  getTriggerNotificationIds: jest.fn(),
  cancelTriggerNotifications: jest.fn(),
  getDisplayedNotifications: jest.fn(),
  cancelDisplayedNotifications: jest.fn(),
  cancelNotification: jest.fn(),
  requestPermission: jest.fn(),
  onBackgroundEvent: jest.fn(),
  onForegroundEvent: jest.fn(),
};

jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: mockNotifee,
  AlarmType: { SET: 0, SET_AND_ALLOW_WHILE_IDLE: 1, SET_EXACT: 2, SET_EXACT_AND_ALLOW_WHILE_IDLE: 3 },
  AndroidNotificationSetting: { NOT_SUPPORTED: -1, DISABLED: 0, ENABLED: 1 },
  AndroidImportance: { HIGH: 4 },
  AndroidCategory: { REMINDER: 'reminder' },
  AndroidStyle: { BIGTEXT: 1 },
  TriggerType: { TIMESTAMP: 0 },
  EventType: { DISMISSED: 0, PRESS: 1, ACTION_PRESS: 2, DELIVERED: 3 },
  AuthorizationStatus: { NOT_DETERMINED: -1, DENIED: 0, AUTHORIZED: 1, PROVISIONAL: 2 },
}));

const HOUR = 60 * 60 * 1000;
const reminder = (at: Date, removeAt?: Date) => ({
  id: 'followup-1-2026-11-21',
  at,
  title: 'Follow-up tomorrow',
  body: 'Dr. A · Saturday, 21 Nov',
  channel: { id: 'follow-up-reminder', name: 'Follow-up reminders' },
  dismissLabel: 'OK',
  removeAt,
});

beforeEach(() => {
  Object.values(mockNotifee).forEach(fn => fn.mockReset());
  mockNotifee.createChannel.mockResolvedValue('follow-up-reminder');
  mockNotifee.createTriggerNotification.mockResolvedValue('followup-1-2026-11-21');
  mockNotifee.getNotificationSettings.mockResolvedValue({ android: { alarm: 0 } });
  jest.replaceProperty(Platform, 'OS', 'android');
});

afterEach(() => jest.restoreAllMocks());

describe('scheduleReminder', () => {
  it('sets it to clear on OK or a tap, opening nothing', async () => {
    const at = new Date(Date.now() + HOUR);

    await expect(scheduleReminder(reminder(at, new Date(at.getTime() + 2 * HOUR)))).resolves.toBe(true);

    const [notification, trigger] = mockNotifee.createTriggerNotification.mock.calls[0];
    expect(notification).toMatchObject({
      id: 'followup-1-2026-11-21',
      title: 'Follow-up tomorrow',
      body: 'Dr. A · Saturday, 21 Nov',
      android: {
        channelId: 'follow-up-reminder',
        autoCancel: true,
        pressAction: { id: 'reminder-press' },
        actions: [{ title: 'OK', pressAction: { id: 'reminder-dismiss' } }],
        timeoutAfter: 2 * HOUR,
      },
    });
    // No launchActivity: Notifee adds one only for the 'default' press id.
    expect(notification.android.pressAction.launchActivity).toBeUndefined();
    expect(trigger).toEqual({ type: 0, timestamp: at.getTime(), alarmManager: { type: 1 } });
  });

  it('without "Alarms & reminders" never asks for an exact alarm, which Notifee would drop', async () => {
    await scheduleReminder(reminder(new Date(Date.now() + HOUR)));

    expect(mockNotifee.createTriggerNotification.mock.calls[0][1].alarmManager).toEqual({ type: 1 });
  });

  it('with "Alarms & reminders" on, shows on the minute', async () => {
    mockNotifee.getNotificationSettings.mockResolvedValueOnce({ android: { alarm: 1 } });

    await scheduleReminder(reminder(new Date(Date.now() + HOUR)));

    expect(mockNotifee.createTriggerNotification.mock.calls[0][1].alarmManager).toEqual({ type: 3 });
  });

  it('a time already past sets nothing', async () => {
    await expect(scheduleReminder(reminder(new Date(Date.now() - 1000)))).resolves.toBe(false);
    await expect(scheduleReminder(reminder(new Date(NaN)))).resolves.toBe(false);

    expect(mockNotifee.createTriggerNotification).not.toHaveBeenCalled();
  });

  it('Android reads the text as HTML: names are escaped and each line break is a <br>', async () => {
    await scheduleReminder({
      ...reminder(new Date(Date.now() + HOUR)),
      title: 'Follow-up <tomorrow>',
      body: 'Dr. A & B · Saturday, 21 Nov\nPatient: Karim',
    });

    const [notification] = mockNotifee.createTriggerNotification.mock.calls[0];
    expect(notification.title).toBe('Follow-up &lt;tomorrow&gt;');
    expect(notification.body).toBe('Dr. A &amp; B · Saturday, 21 Nov<br>Patient: Karim');
    expect(notification.android.style.text).toBe(notification.body);
  });

  it('elsewhere the text stays plain', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');

    await scheduleReminder({ ...reminder(new Date(Date.now() + HOUR)), body: 'A & B\nC' });

    expect(mockNotifee.createTriggerNotification.mock.calls[0][0].body).toBe('A & B\nC');
  });

  it('carries its data with it', async () => {
    await scheduleReminder({ ...reminder(new Date(Date.now() + HOUR)), data: { followUpDate: '2026-11-21' } });

    expect(mockNotifee.createTriggerNotification.mock.calls[0][0].data).toEqual({ followUpDate: '2026-11-21' });
  });

  it("on iOS, where Notifee has no channels and answers '', it is still set", async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    mockNotifee.createChannel.mockResolvedValueOnce('');

    await expect(scheduleReminder(reminder(new Date(Date.now() + HOUR)))).resolves.toBe(true);
  });

  it('on Android, a channel that could not be made sets nothing', async () => {
    mockNotifee.createChannel.mockResolvedValueOnce('');

    await expect(scheduleReminder(reminder(new Date(Date.now() + HOUR)))).resolves.toBe(false);
    expect(mockNotifee.createTriggerNotification).not.toHaveBeenCalled();
  });

  it('no removal time: no timeout', async () => {
    await scheduleReminder(reminder(new Date(Date.now() + HOUR)));

    expect(mockNotifee.createTriggerNotification.mock.calls[0][0].android.timeoutAfter).toBeUndefined();
  });

  it('never throws — false when Notifee refuses', async () => {
    mockNotifee.createTriggerNotification.mockRejectedValueOnce(new Error('bad trigger'));
    mockNotifee.getNotificationSettings.mockRejectedValueOnce(new Error('settings gone'));

    await expect(scheduleReminder(reminder(new Date(Date.now() + HOUR)))).resolves.toBe(false);
    await expect(scheduleReminder(undefined as any)).resolves.toBe(false);
  });
});

describe('cancelReminders', () => {
  it('takes away only the ones with the prefix, set or showing', async () => {
    mockNotifee.getTriggerNotificationIds.mockResolvedValueOnce(['followup-1-2026-11-21', 'abc123', 'followup-2-2026-12-01']);
    mockNotifee.getDisplayedNotifications.mockResolvedValueOnce([
      { id: 'followup-3-2026-11-19', notification: {} },
      { id: 'alarm-xyz', notification: {} },
    ]);

    await cancelReminders('followup-');

    expect(mockNotifee.cancelTriggerNotifications).toHaveBeenCalledWith(['followup-1-2026-11-21', 'followup-2-2026-12-01']);
    expect(mockNotifee.cancelDisplayedNotifications).toHaveBeenCalledWith(['followup-3-2026-11-19']);
  });

  it('never throws', async () => {
    mockNotifee.getTriggerNotificationIds.mockRejectedValueOnce(new Error('native gone'));

    await expect(cancelReminders('followup-')).resolves.toBeUndefined();
  });
});

describe('requestNotificationPermission', () => {
  it("gives the phone's answer, and 'unavailable' when it could not ask", async () => {
    mockNotifee.requestPermission.mockResolvedValueOnce({ authorizationStatus: 1 });
    mockNotifee.requestPermission.mockResolvedValueOnce({ authorizationStatus: 2 });
    mockNotifee.requestPermission.mockResolvedValueOnce({ authorizationStatus: 0 });
    mockNotifee.requestPermission.mockResolvedValueOnce({ authorizationStatus: -1 });
    mockNotifee.requestPermission.mockResolvedValueOnce(undefined);
    mockNotifee.requestPermission.mockRejectedValueOnce(new Error('no activity'));

    await expect(requestNotificationPermission()).resolves.toBe('granted');
    await expect(requestNotificationPermission()).resolves.toBe('granted');
    await expect(requestNotificationPermission()).resolves.toBe('denied');
    await expect(requestNotificationPermission()).resolves.toBe('unavailable');
    await expect(requestNotificationPermission()).resolves.toBe('unavailable');
    await expect(requestNotificationPermission()).resolves.toBe('unavailable');
  });
});

describe('registerNotificationHandlers', () => {
  const event = (type: number, pressId: string, id = 'followup-1-2026-11-21') => ({
    type,
    detail: { notification: { id }, pressAction: { id: pressId } },
  });

  it('one handler for the app, background and foreground alike', async () => {
    const other = jest.fn();
    registerNotificationHandlers(other);

    expect(mockNotifee.onBackgroundEvent).toHaveBeenCalledTimes(1);
    expect(mockNotifee.onForegroundEvent).toHaveBeenCalledTimes(1);
    expect(mockNotifee.onBackgroundEvent.mock.calls[0][0]).toBe(mockNotifee.onForegroundEvent.mock.calls[0][0]);
  });

  it('OK and a tap take a reminder away; other events and presses are left alone', async () => {
    registerNotificationHandlers();
    const dispatch = mockNotifee.onBackgroundEvent.mock.calls[0][0];

    await dispatch(event(2, 'reminder-dismiss'));
    await dispatch(event(1, 'reminder-press', 'followup-2-2026-12-01'));
    await dispatch(event(2, 'stop-alarm', 'alarm-1'));
    await dispatch(event(1, 'default', 'alarm-2'));
    await dispatch(event(3, 'reminder-dismiss'));

    expect(mockNotifee.cancelNotification.mock.calls).toEqual([['followup-1-2026-11-21'], ['followup-2-2026-12-01']]);
  });

  it('a handler left undefined is skipped, never called', async () => {
    const alarm = jest.fn();
    registerNotificationHandlers(undefined as any, alarm);
    const dispatch = mockNotifee.onBackgroundEvent.mock.calls[0][0];

    await expect(dispatch(event(2, 'stop-alarm', 'alarm-1'))).resolves.toBeUndefined();
    expect(alarm).toHaveBeenCalledTimes(1);
  });

  it('passes every event on to the others, and one that throws stops none', async () => {
    const failing = jest.fn().mockRejectedValue(new Error('boom'));
    const alarm = jest.fn();
    registerNotificationHandlers(failing, alarm);
    const dispatch = mockNotifee.onBackgroundEvent.mock.calls[0][0];
    const stop = event(2, 'stop-alarm', 'alarm-1');

    await expect(dispatch(stop)).resolves.toBeUndefined();

    expect(failing).toHaveBeenCalledWith(stop);
    expect(alarm).toHaveBeenCalledWith(stop);
  });
});
