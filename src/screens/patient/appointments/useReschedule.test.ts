import { AppointmentDetail, AvailableSlot } from '@app/core';
import { isSlotFull, keptPick, startDateFor } from './useReschedule';

jest.mock('@app/core', () => ({
  toISODate: (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
  useStores: () => ({ toastStore: { show: jest.fn() } }),
}));

const slot = (fields: Partial<AvailableSlot>): AvailableSlot =>
  ({ slotId: 1, bookingCapacity: 10, availableSlots: 3, subSlots: [], ...fields } as AvailableSlot);

describe('isSlotFull', () => {
  it('is full once a window has no place left', () => {
    expect(isSlotFull(slot({ availableSlots: 0 }))).toBe(true);
    expect(isSlotFull(slot({ availableSlots: 2 }))).toBe(false);
  });

  it('calls a window with no capacity full, as the portal Reschedule does — the server refuses it', () => {
    expect(isSlotFull(slot({ bookingCapacity: 0, availableSlots: 0 }))).toBe(true);
    expect(isSlotFull(null)).toBe(false);
  });
});

describe('startDateFor', () => {
  const detail = (date: string) => ({ date } as AppointmentDetail);

  it("opens on the appointment's own day while it is still ahead", () => {
    expect(startDateFor(detail('2026-11-12'), '2026-11-08')).toBe('2026-11-12');
    expect(startDateFor(detail('2026-11-08'), '2026-11-08')).toBe('2026-11-08');
  });

  it('opens on today for a day gone by, or none', () => {
    expect(startDateFor(detail('2026-11-01'), '2026-11-08')).toBe('2026-11-08');
    expect(startDateFor(detail(''), '2026-11-08')).toBe('2026-11-08');
    expect(startDateFor(null, '2026-11-08')).toBe('2026-11-08');
  });
});

describe('keptPick', () => {
  const sub = (startTime: string, fields: { isBooked?: boolean; isPast?: boolean } = {}) => ({
    startTime,
    isBooked: false,
    isPast: false,
    ...fields,
  });
  const day = [
    slot({ slotId: 1, subSlots: [sub('09:00'), sub('09:15', { isBooked: true }), sub('09:30', { isPast: true })] as any }),
    slot({ slotId: 2, availableSlots: 0 }),
  ];

  it('keeps a pick the windows still allow', () => {
    expect(keptPick(day, 1, '09:00')).toEqual({ slotId: 1, time: '09:00' });
    expect(keptPick(day, 1, '')).toEqual({ slotId: 1, time: '' });
  });

  it('lets a window go that filled or is no longer listed', () => {
    expect(keptPick(day, 2, '')).toEqual({ slotId: null, time: '' });
    expect(keptPick(day, 9, '09:00')).toEqual({ slotId: null, time: '' });
    expect(keptPick([], 1, '09:00')).toEqual({ slotId: null, time: '' });
  });

  it('sends a time taken or passed meanwhile back to Auto, keeping its window', () => {
    expect(keptPick(day, 1, '09:15')).toEqual({ slotId: 1, time: '' });
    expect(keptPick(day, 1, '09:30')).toEqual({ slotId: 1, time: '' });
    expect(keptPick(day, 1, '10:00')).toEqual({ slotId: 1, time: '' });
  });

  it('has nothing to keep without a window', () => {
    expect(keptPick(day, null, '09:00')).toEqual({ slotId: null, time: '' });
  });
});
