jest.mock('@app/core', () => ({
  NotificationRepository: { getUnreadCount: jest.fn() },
  useStores: jest.fn(),
}));

import React from 'react';
import { AppState } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { NotificationRepository, useStores } from '@app/core';
import { UNREAD_POLL_MS, useUnreadNotificationsSync } from './useUnreadNotifications';

const getUnreadCount = NotificationRepository.getUnreadCount as jest.Mock;
const store = { setUnreadCount: jest.fn(), reset: jest.fn() };
const remove = jest.fn();
/** The app-state listener the hook registered — the test plays the OS. */
let onAppState: ((state: string) => void) | undefined;

const Probe = () => {
  useUnreadNotificationsSync();
  return null;
};

const mount = async () => {
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(<Probe />);
  });
  return renderer;
};

/** Moves the clock on and lets the reads it started settle. */
const wait = async (ms: number) => {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
};

describe('useUnreadNotificationsSync', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    getUnreadCount.mockReset().mockResolvedValue(3);
    store.setUnreadCount.mockReset();
    store.reset.mockReset();
    remove.mockReset();
    (useStores as jest.Mock).mockReturnValue({ notificationStore: store });
    Object.defineProperty(AppState, 'currentState', { value: 'active', configurable: true });
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((_type: string, handler: any) => {
      onAppState = handler;
      return { remove };
    }) as any);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('reads on sign-in, then every 30 s while the app is open', async () => {
    const renderer = await mount();
    expect(getUnreadCount).toHaveBeenCalledTimes(1);
    expect(store.setUnreadCount).toHaveBeenCalledWith(3);

    await wait(UNREAD_POLL_MS);
    expect(getUnreadCount).toHaveBeenCalledTimes(2);
    await wait(UNREAD_POLL_MS);
    expect(getUnreadCount).toHaveBeenCalledTimes(3);

    await act(async () => renderer.unmount());
  });

  it('stays quiet in the background and reads at once on coming back', async () => {
    const renderer = await mount();
    expect(getUnreadCount).toHaveBeenCalledTimes(1);

    await act(async () => onAppState?.('background'));
    await wait(UNREAD_POLL_MS * 3);
    expect(getUnreadCount).toHaveBeenCalledTimes(1);

    await act(async () => onAppState?.('active'));
    expect(getUnreadCount).toHaveBeenCalledTimes(2);
    await wait(UNREAD_POLL_MS);
    expect(getUnreadCount).toHaveBeenCalledTimes(3);

    await act(async () => renderer.unmount());
  });

  it('stops the timer and drops the count on sign-out', async () => {
    const renderer = await mount();
    await act(async () => renderer.unmount());

    expect(remove).toHaveBeenCalledTimes(1);
    expect(store.reset).toHaveBeenCalledTimes(1);
    await wait(UNREAD_POLL_MS * 2);
    expect(getUnreadCount).toHaveBeenCalledTimes(1);
  });

  it('does not start the timer when the app opens in the background', async () => {
    Object.defineProperty(AppState, 'currentState', { value: 'background', configurable: true });
    const renderer = await mount();
    expect(getUnreadCount).toHaveBeenCalledTimes(1);

    await wait(UNREAD_POLL_MS * 2);
    expect(getUnreadCount).toHaveBeenCalledTimes(1);

    await act(async () => renderer.unmount());
  });
});
