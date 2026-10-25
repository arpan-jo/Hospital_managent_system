import {
  groupThousands,
  formatMoney,
  formatShortDate,
  formatDayMonthYear,
  stripHonorific,
  to12Hour,
  withDoctorTitle,
  dayPeriod,
  greetingName,
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

describe('withDoctorTitle', () => {
  it('keeps "Md." and "Mohammad", which are part of the name', () => {
    expect(withDoctorTitle('Md. Emdad Karim')).toBe('Dr. Md. Emdad Karim');
    expect(withDoctorTitle('Mohammad Ali')).toBe('Dr. Mohammad Ali');
  });

  it('puts "Dr." in front once, whatever title the stored name carries', () => {
    expect(withDoctorTitle('Dr. Ahsan Habib')).toBe('Dr. Ahsan Habib');
    expect(withDoctorTitle('Dr.Ahmed')).toBe('Dr. Ahmed');
    expect(withDoctorTitle('dr ahmed')).toBe('Dr. ahmed');
    expect(withDoctorTitle('Bijoy Saha')).toBe('Dr. Bijoy Saha');
    expect(withDoctorTitle('Drake Ramos')).toBe('Dr. Drake Ramos');
    expect(withDoctorTitle('Andrew Dreyer')).toBe('Dr. Andrew Dreyer');
  });

  it('adds no second "Dr." when the title sits after a rank', () => {
    expect(withDoctorTitle('Assoc. Prof. Dr. Md. Nabid Alam')).toBe('Assoc. Prof. Dr. Md. Nabid Alam');
    expect(withDoctorTitle('ASSOC. PROF. DR. ANWARUL ANAM KIBRIA')).toBe('ASSOC. PROF. DR. ANWARUL ANAM KIBRIA');
    expect(withDoctorTitle('Asstt. Prof Dr. Sumitra Das Gupta')).toBe('Asstt. Prof Dr. Sumitra Das Gupta');
    expect(withDoctorTitle('Prof.Dr.Rahman')).toBe('Prof.Dr.Rahman');
  });

  it('puts no "Dr." in front of a rank', () => {
    expect(withDoctorTitle('Prof. Rahman')).toBe('Prof. Rahman');
    expect(withDoctorTitle('Asst. Prof. Karim')).toBe('Asst. Prof. Karim');
  });

  it('gives nothing for no name', () => {
    expect(withDoctorTitle('')).toBe('');
    expect(withDoctorTitle('   ')).toBe('');
    expect(withDoctorTitle('Dr.')).toBe('');
    expect(withDoctorTitle(null)).toBe('');
    expect(withDoctorTitle(undefined)).toBe('');
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

describe('dayPeriod', () => {
  it('splits the day as the portal does', () => {
    expect(dayPeriod(new Date(2026, 9, 25, 0, 0))).toBe('morning');
    expect(dayPeriod(new Date(2026, 9, 25, 11, 59))).toBe('morning');
    expect(dayPeriod(new Date(2026, 9, 25, 12, 0))).toBe('afternoon');
    expect(dayPeriod(new Date(2026, 9, 25, 16, 59))).toBe('afternoon');
    expect(dayPeriod(new Date(2026, 9, 25, 17, 0))).toBe('evening');
  });
});

describe('greetingName', () => {
  it('takes the first name after any title', () => {
    expect(greetingName('Md. Jahed Hossain')).toBe('Jahed');
    expect(greetingName('Al Amin')).toBe('Al');
    expect(greetingName('Dr. Rahim')).toBe('Rahim');
  });

  it('gives nothing for no name, an email or a number', () => {
    expect(greetingName('')).toBe('');
    expect(greetingName(null)).toBe('');
    expect(greetingName(undefined)).toBe('');
    expect(greetingName('01822421743')).toBe('');
    expect(greetingName('+880 1822-421743')).toBe('');
    expect(greetingName('dev.alamin@ibos.io')).toBe('');
  });
});
