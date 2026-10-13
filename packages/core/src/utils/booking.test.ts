import { calculateBookingTotals, slotsForDate } from './booking';

describe('calculateBookingTotals', () => {
  it('matches the design defaults', () => {
    expect(calculateBookingTotals(1000, 0, 0)).toEqual({
      discountAmount: 0,
      netPayable: 1000,
      dueAmount: 1000,
    });
  });

  it('applies a percentage discount and subtracts what was received', () => {
    expect(calculateBookingTotals(1000, 10, 400)).toEqual({
      discountAmount: 100,
      netPayable: 900,
      dueAmount: 500,
    });
  });

  it('rounds to two decimals rather than leaking float noise', () => {
    expect(calculateBookingTotals(1000, 33.33, 0).discountAmount).toBe(333.3);
    expect(calculateBookingTotals(0.1 + 0.2, 0, 0).netPayable).toBe(0.3);
  });

  it('never produces a negative payable or due', () => {
    expect(calculateBookingTotals(1000, 150, 0).netPayable).toBe(0);
    expect(calculateBookingTotals(1000, -50, 0).discountAmount).toBe(0);
    expect(calculateBookingTotals(1000, 0, 5000).dueAmount).toBe(0);
    expect(calculateBookingTotals(1000, 0, -200).dueAmount).toBe(1000);
    expect(calculateBookingTotals(-1000, 0, 0).netPayable).toBe(0);
  });

  it('treats unparseable field input as zero', () => {
    expect(calculateBookingTotals(NaN, NaN, NaN)).toEqual({
      discountAmount: 0,
      netPayable: 0,
      dueAmount: 0,
    });
  });
});

describe('slotsForDate', () => {
  const schedule = [
    { day: 1, start: '14:00', end: '18:00' },
    { day: 1, start: '19:00', end: '21:00' },
    { day: 3, start: '09:00', end: '12:00' },
  ];

  it('returns only the slots for that weekday', () => {
    // 2026-07-27 is a Monday.
    expect(slotsForDate(schedule, new Date(2026, 6, 27))).toHaveLength(2);
    expect(slotsForDate(schedule, new Date(2026, 6, 29))).toEqual([schedule[2]]);
    expect(slotsForDate(schedule, new Date(2026, 6, 28))).toEqual([]);
  });

  it('handles missing schedule or date', () => {
    expect(slotsForDate([], new Date(2026, 6, 27))).toEqual([]);
    expect(slotsForDate(schedule, null)).toEqual([]);
    expect(slotsForDate(null, new Date(2026, 6, 27))).toEqual([]);
    expect(slotsForDate(schedule, new Date('nope'))).toEqual([]);
  });
});
