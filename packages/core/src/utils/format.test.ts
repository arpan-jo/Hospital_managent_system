import {
  groupThousands,
  formatMoney,
  formatShortDate,
  formatDayMonthYear,
  stripHonorific,
  to12Hour,
} from './format';

describe('groupThousands', () => {
  it('groups digits in threes', () => {
    expect(groupThousands(1000)).toBe('1,000');
    expect(groupThousands(999)).toBe('999');
    expect(groupThousands(1234567)).toBe('1,234,567');
    expect(groupThousands(-1500)).toBe('-1,500');
    expect(groupThousands(1234.5)).toBe('1,234.5');
  });

  it('survives junk input', () => {
    expect(groupThousands(NaN)).toBe('0');
    expect(groupThousands(Infinity)).toBe('0');
  });
});

describe('formatMoney', () => {
  it('always shows two decimals', () => {
    expect(formatMoney(1000)).toBe('1,000.00');
    expect(formatMoney(1234.5)).toBe('1,234.50');
    expect(formatMoney(0)).toBe('0.00');
    expect(formatMoney(-250.256)).toBe('-250.26');
    expect(formatMoney(NaN)).toBe('0.00');
  });
});

describe('date formatting', () => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  it('zero-pads day and month', () => {
    expect(formatShortDate(new Date(2026, 6, 27))).toBe('27/07/2026');
    expect(formatShortDate(new Date(2026, 0, 5))).toBe('05/01/2026');
  });

  it('renders the footer summary date', () => {
    expect(formatDayMonthYear(new Date(2026, 6, 27), months)).toBe('27 Jul 2026');
  });
});

describe('to12Hour', () => {
  it('converts 24h times', () => {
    expect(to12Hour('14:00')).toBe('2:00 PM');
    expect(to12Hour('18:00')).toBe('6:00 PM');
    expect(to12Hour('00:30')).toBe('12:30 AM');
    expect(to12Hour('12:00')).toBe('12:00 PM');
    expect(to12Hour('09:05')).toBe('9:05 AM');
  });

  it('passes through anything that is not HH:mm', () => {
    expect(to12Hour('')).toBe('');
    expect(to12Hour('nope')).toBe('nope');
    expect(to12Hour('99:00')).toBe('99:00');
  });
});

describe('stripHonorific', () => {
  it('drops a leading title, with or without the space after the dot', () => {
    expect(stripHonorific('Dr. Shad')).toBe('Shad');
    expect(stripHonorific('Dr.Shad')).toBe('Shad');
    expect(stripHonorific('MD. Tamim Hasan')).toBe('Tamim Hasan');
    expect(stripHonorific('Mahedi')).toBe('Mahedi');
  });

  it('leaves a real name that merely opens with a title alone', () => {
    expect(stripHonorific('Mstislav')).toBe('Mstislav');
    expect(stripHonorific('Professor')).toBe('Professor');
    expect(stripHonorific('')).toBe('');
    expect(stripHonorific(null)).toBe('');
  });
});
