import { AppointmentDetail, AvailableSlot } from '@app/core';
import { isSlotFull, startDateFor } from './useReschedule';

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
