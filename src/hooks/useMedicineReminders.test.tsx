jest.mock('@app/core', () => ({
  TodayMedicinesRepository: { getTodayMedicines: jest.fn(), getSchedule: jest.fn() },
  claimMedicineReminders: jest.fn(),
  onTakenLogChange: jest.fn(),
  rebuildMedicineReminders: jest.fn(),
  setMedicineReminderSource: jest.fn(),
  setMedicineReminderTimes: jest.fn(),
}));
let mockLanguage = 'en';
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ i18n: { language: mockLanguage } }),
}));

import React from 'react';
import { AppState } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import {
  TodayMedicinesRepository,
  claimMedicineReminders,
  onTakenLogChange,
  rebuildMedicineReminders,
  setMedicineReminderSource,
  setMedicineReminderTimes,
} from '@app/core';
import { useMedicineReminders } from './useMedicineReminders';

const getTodayMedicines = TodayMedicinesRepository.getTodayMedicines as jest.Mock;
const getSchedule = TodayMedicinesRepository.getSchedule as jest.Mock;
const claim = claimMedicineReminders as jest.Mock;
const rebuild = rebuildMedicineReminders as jest.Mock;
const setSource = setMedicineReminderSource as jest.Mock;
const setTimes = setMedicineReminderTimes as jest.Mock;

const LIST = [{ prescriptionId: 3047, medicine: 'Monas [10 mg]', frequency: '0+0+1' }];
const TIMES = { morning: '08:00', afternoon: '14:00', evening: '18:00', night: '21:30' };
const TEN_MINUTES = 10 * 60 * 1000;

/** The app-state listener the hook registered — the test plays the OS. */
let onAppState: ((state: string) => void) | undefined;
/** The tick listener the hook registered. */
let onTick: (() => void) | undefined;
/** The last read is module state: each test starts an hour on, so its first read is due. */
let clock = new Date(2026, 10, 22, 9, 0).getTime();

const Probe = ({ signedIn, userId }: { signedIn: boolean; userId: number }) => {
  useMedicineReminders(signedIn, userId);
  return null;
};

const mount = async (signedIn = true, userId = 5) => {
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(<Probe signedIn={signedIn} userId={userId} />);
  });
  return renderer;
};

const comeBack = async () => {
  await act(async () => onAppState?.('active'));
};

const clearCalls = () =>
  [getTodayMedicines, getSchedule, claim, rebuild, setSource, setTimes].forEach(fn => fn.mockClear());

describe('useMedicineReminders', () => {
  beforeEach(() => {
    clock += 60 * 60 * 1000;
    jest.useFakeTimers({ now: clock });
    mockLanguage = 'en';
    getTodayMedicines.mockReset().mockResolvedValue(LIST);
    getSchedule.mockReset().mockResolvedValue(TIMES);
    claim.mockReset();
    rebuild.mockReset().mockResolvedValue(undefined);
    setSource.mockReset().mockResolvedValue(undefined);
    setTimes.mockReset().mockResolvedValue(undefined);
    (onTakenLogChange as jest.Mock).mockReset().mockImplementation((listener: () => void) => {
      onTick = listener;
      return jest.fn();
    });
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((_type: string, handler: any) => {
      onAppState = handler;
      return { remove: jest.fn() };
    }) as any);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('signed in: claims them for the account, reads the list and the times, and sets them from both', async () => {
    const renderer = await mount();
    expect(claim).toHaveBeenCalledWith(5);
    expect(getTodayMedicines).toHaveBeenCalledWith(null);
    expect(getSchedule).toHaveBeenCalledTimes(1);
    expect(setSource).toHaveBeenCalledWith({ userId: 5, medicines: LIST, times: TIMES });
    expect(setTimes).not.toHaveBeenCalled();
    await act(async () => renderer.unmount());
  });

  it('the times read fails: the list is still used, with the times kept from before', async () => {
    getSchedule.mockRejectedValue(new Error('timeout'));
    const renderer = await mount();
    expect(setSource).toHaveBeenCalledWith({ userId: 5, medicines: LIST, times: null });

    // A failed read is tried again at the next return, ten minutes or not.
    clearCalls();
    getSchedule.mockResolvedValue(TIMES);
    await comeBack();
    expect(getSchedule).toHaveBeenCalledTimes(1);
    expect(setSource).toHaveBeenCalledWith({ userId: 5, medicines: LIST, times: TIMES });
    await act(async () => renderer.unmount());
  });

  it('the list read fails: the times are still used, for this account only', async () => {
    getTodayMedicines.mockRejectedValue(new Error('Network Error'));
    const renderer = await mount();
    expect(setSource).not.toHaveBeenCalled();
    expect(setTimes).toHaveBeenCalledWith(TIMES, 5);
    await act(async () => renderer.unmount());
  });

  it('both reads fail: set again from what the phone holds', async () => {
    getTodayMedicines.mockRejectedValue(new Error('Network Error'));
    getSchedule.mockRejectedValue(new Error('Network Error'));
    const renderer = await mount();
    expect(setSource).not.toHaveBeenCalled();
    expect(setTimes).not.toHaveBeenCalled();
    expect(rebuild).toHaveBeenCalled();
    await act(async () => renderer.unmount());
  });

  it('back within ten minutes: set again from the phone (a permission just allowed counts), no read', async () => {
    const renderer = await mount();
    clearCalls();

    await comeBack();
    expect(getTodayMedicines).not.toHaveBeenCalled();
    expect(rebuild).toHaveBeenCalledTimes(1);

    clearCalls();
    jest.setSystemTime(Date.now() + TEN_MINUTES);
    await comeBack();
    expect(getTodayMedicines).toHaveBeenCalledTimes(1);
    expect(setSource).toHaveBeenCalledWith({ userId: 5, medicines: LIST, times: TIMES });
    await act(async () => renderer.unmount());
  });

  it('a clock set back does not hold the reads up', async () => {
    const renderer = await mount();
    clearCalls();
    jest.setSystemTime(Date.now() - 24 * 60 * 60 * 1000);
    await comeBack();
    expect(getTodayMedicines).toHaveBeenCalledTimes(1);
    await act(async () => renderer.unmount());
  });

  it('no session: set from the phone at launch and on every return, never read, never claimed', async () => {
    const renderer = await mount(false, 0);
    expect(rebuild).toHaveBeenCalledTimes(1);
    expect(claim).not.toHaveBeenCalled();
    expect(getTodayMedicines).not.toHaveBeenCalled();

    await comeBack();
    expect(rebuild).toHaveBeenCalledTimes(2);
    expect(getTodayMedicines).not.toHaveBeenCalled();

    await act(async () => onAppState?.('background'));
    expect(rebuild).toHaveBeenCalledTimes(2);
    await act(async () => renderer.unmount());
  });

  it('a dose ticked, and the language changed: set again', async () => {
    const renderer = await mount();
    clearCalls();

    await act(async () => onTick?.());
    expect(rebuild).toHaveBeenCalledTimes(1);

    mockLanguage = 'bn';
    await act(async () => renderer.update(<Probe signedIn userId={5} />));
    expect(rebuild).toHaveBeenCalledTimes(2);

    // The same language again sets nothing.
    await act(async () => renderer.update(<Probe signedIn userId={5} />));
    expect(rebuild).toHaveBeenCalledTimes(2);
    await act(async () => renderer.unmount());
  });

  it('never throws, whatever the reads and the phone do', async () => {
    getTodayMedicines.mockImplementation(() => {
      throw new Error('sync throw');
    });
    getSchedule.mockRejectedValue(undefined);
    rebuild.mockResolvedValue(undefined);
    const renderer = await mount();
    expect(rebuild).toHaveBeenCalled();
    await act(async () => renderer.unmount());
  });
});
