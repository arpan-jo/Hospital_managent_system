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
    expect(slotsOfFrequency(null)).toEqual(['morning']);
    expect(slotsOfFrequency(undefined)).toEqual(['morning']);
  });

  it('reads a dose written in Bangla digits, as doctors often write it', () => {
    expect(slotsOfFrequency('০+০+১')).toEqual(['night']);
    expect(slotsOfFrequency('১+০+১')).toEqual(['morning', 'night']);
    expect(slotsOfFrequency('১-১-১-১')).toEqual(['morning', 'afternoon', 'evening', 'night']);
    expect(slotsOfFrequency('০+০+০')).toEqual(['morning']);
  });

  it('counts a half (or any fraction) as a dose, and a zero fraction as none', () => {
    expect(slotsOfFrequency('½+0+½')).toEqual(['morning', 'night']);
    expect(slotsOfFrequency('1/2+0+1/2')).toEqual(['morning', 'night']);
    expect(slotsOfFrequency('0.5+0+0.5')).toEqual(['morning', 'night']);
    expect(slotsOfFrequency('0+0+½')).toEqual(['night']);
    expect(slotsOfFrequency('1½+0+0')).toEqual(['morning']);
    expect(slotsOfFrequency('০+০+১/২')).toEqual(['night']);
    expect(slotsOfFrequency('0/2+0+1')).toEqual(['night']);
  });

  it('reads a dose of more than one tablet, and one with a note run into it', () => {
    expect(slotsOfFrequency('2+0+2')).toEqual(['morning', 'night']);
    expect(slotsOfFrequency('10+0+0')).toEqual(['morning']);
    expect(slotsOfFrequency('1+0+1খাবারেরপরে')).toEqual(['morning', 'night']);
    expect(slotsOfFrequency('0+0+1(aftermeal)')).toEqual(['night']);
  });

  it('checks the words in the portal’s order: once / OD before "at night"', () => {
    expect(slotsOfFrequency('OD')).toEqual(['morning']);
    expect(slotsOfFrequency('once at night')).toEqual(['morning']);
    expect(slotsOfFrequency('1 time')).toEqual(['morning']);
    expect(slotsOfFrequency('at night')).toEqual(['night']);
    expect(slotsOfFrequency('HS')).toEqual(['night']);
    expect(slotsOfFrequency('BD')).toEqual(['morning', 'night']);
  });

  it('reads plain figures exactly as the portal does', () => {
    expect(slotsOfFrequency('1+0+0')).toEqual(['morning']);
    expect(slotsOfFrequency('0+1+0')).toEqual(['afternoon']);
    expect(slotsOfFrequency('0-0-1')).toEqual(['night']);
    expect(slotsOfFrequency('1+0+0+1')).toEqual(['morning', 'night']);
    expect(slotsOfFrequency('0+0+1+0')).toEqual(['evening']);
    // Not a dose pattern: two figures, or five.
    expect(slotsOfFrequency('1-2')).toEqual(['morning']);
    expect(slotsOfFrequency('0-0-1-0-1')).toEqual(['morning']);
  });
});
