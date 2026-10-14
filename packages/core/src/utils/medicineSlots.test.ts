import { slotsOfFrequency } from './medicineSlots';

describe('slotsOfFrequency', () => {
  it('reads three figures as morning / afternoon / night', () => {
    expect(slotsOfFrequency('1-0-1')).toEqual(['morning', 'night']);
    expect(slotsOfFrequency('1+1+1')).toEqual(['morning', 'afternoon', 'night']);
  });

  it('reads a fourth figure as the evening dose', () => {
    expect(slotsOfFrequency('1-0-1-1')).toEqual(['morning', 'evening', 'night']);
  });

  it('reads the usual words', () => {
    expect(slotsOfFrequency('QID')).toEqual(['morning', 'afternoon', 'evening', 'night']);
    expect(slotsOfFrequency('tds')).toEqual(['morning', 'afternoon', 'night']);
    expect(slotsOfFrequency('Twice daily')).toEqual(['morning', 'night']);
    expect(slotsOfFrequency('nocte')).toEqual(['night']);
  });

  it('falls back to the morning', () => {
    expect(slotsOfFrequency('0-0-0')).toEqual(['morning']);
    expect(slotsOfFrequency('')).toEqual(['morning']);
    expect(slotsOfFrequency('as needed')).toEqual(['morning']);
  });
});
