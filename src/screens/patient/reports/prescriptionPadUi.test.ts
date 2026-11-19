import { PrescriptionSection } from '@app/core';
import {
  ageOnDay,
  arrangePadSections,
  formatDose,
  medicineForm,
  medicineTitle,
  sheetDate,
  splitHeaderColumns,
  splitPadSections,
  takeVitals,
  withAlpha,
} from './prescriptionPadUi';

const section = (key: string, lines: string[], groupName = ''): PrescriptionSection => ({
  key,
  label: key,
  groups: [{ groupName, lines: lines.map(text => ({ text, note: '', isUrgent: false })) }],
});

describe('prescriptionPadUi', () => {
  it('puts what was found above the medicines and the instructions below, each in its own order', () => {
    const { findings, instructions } = splitPadSections([
      section('physicalExamination', ['a']),
      section('chiefComplaint', ['b']),
      section('treatmentPlan', ['c']),
      section('diagnosis', ['d']),
      section('advice', ['e']),
      section('followUp', ['f']),
      section('allergy', ['g']),
      section('somethingNew', ['h']),
    ]);
    expect(findings.map(s => s.key)).toEqual(['physicalExamination', 'chiefComplaint', 'diagnosis', 'allergy']);
    expect(instructions.map(s => s.key)).toEqual(['treatmentPlan', 'advice', 'followUp', 'somethingNew']);
  });

  it('reads the vitals group out as readings and leaves the examination without it', () => {
    const { vitals, sections } = takeVitals([
      {
        key: 'physicalExamination',
        label: 'Examination',
        groups: [
          {
            groupName: 'Vitals',
            lines: [
              { text: 'Height: 160', note: '', isUrgent: false },
              { text: 'Height Unit: CM', note: '', isUrgent: false },
              { text: 'Pulse (R): 33', note: 'resting', isUrgent: false },
              { text: 'Looks pale', note: '', isUrgent: false },
            ],
          },
          { groupName: 'General', lines: [{ text: 'Anaemic', note: '', isUrgent: false }] },
        ],
      },
      section('diagnosis', ['UTI']),
    ]);

    expect(vitals).toEqual([
      { label: 'Height', value: '160 CM' },
      { label: 'Pulse (R)', value: '33 (resting)' },
    ]);
    // The line that is not a reading stays, and so does the other group.
    expect(sections[0].groups.map(g => g.lines.map(l => l.text))).toEqual([['Looks pale'], ['Anaemic']]);
    expect(sections[1].key).toBe('diagnosis');
  });

  it('drops a unit with no reading, and an examination left empty', () => {
    const { vitals, sections } = takeVitals([
      section('physicalExamination', ['Height Unit: CM', 'BP Sys: 55'], 'Vitals'),
    ]);
    expect(vitals).toEqual([{ label: 'BP Sys', value: '55' }]);
    expect(sections).toEqual([]);
  });

  it('leaves sections alone when there is no vitals group', () => {
    const input = [section('physicalExamination', ['Pulse: 80'], 'General'), section('advice', ['Rest'])];
    const { vitals, sections } = takeVitals(input);
    expect(vitals).toEqual([]);
    expect(sections).toEqual(input);
    expect(takeVitals(null)).toEqual({ vitals: [], sections: [] });
  });

  it('writes the medicine as a printed prescription does', () => {
    expect(medicineForm('Tablet')).toBe('Tab.');
    expect(medicineForm('capsule')).toBe('Cap.');
    expect(medicineForm('Suppository')).toBe('Supp.');
    expect(medicineForm('Drops')).toBe('Drops');
    expect(medicineForm('')).toBe('');
    expect(medicineTitle({ type: 'Tablet', brand: 'Pacet [100 mg]' })).toBe('Tab. Pacet [100 mg]');
    expect(medicineTitle({ type: '', brand: 'Napa' })).toBe('Napa');
    expect(formatDose('1+0+1')).toBe('1 + 0 + 1');
    expect(formatDose('০+০+১')).toBe('০ + ০ + ১');
    expect(formatDose(' 1 + 1 ')).toBe('1 + 1');
  });

  it('gives the age on the day of the prescription', () => {
    expect(ageOnDay('1995-06-20', '2026-10-17')).toEqual({ years: 31, months: 3 });
    // The day before the birthday is still the year before.
    expect(ageOnDay('1995-10-18', '2026-10-17')).toEqual({ years: 30, months: 11 });
    expect(ageOnDay('2026-02-10', '2026-10-17')).toEqual({ years: 0, months: 8 });
    expect(ageOnDay('2027-01-01', '2026-10-17')).toBeNull();
    expect(ageOnDay('', '2026-10-17')).toBeNull();
  });

  it('turns a theme colour into a see-through one, and leaves anything else as it is', () => {
    expect(withAlpha('#2F45E5', 0.5)).toBe('rgba(47, 69, 229, 0.5)');
    expect(withAlpha('8A90A6', 0.3)).toBe('rgba(138, 144, 166, 0.3)');
    expect(withAlpha('red', 0.3)).toBe('red');
    expect(withAlpha(undefined, 0.3)).toBe('transparent');
  });

  it("follows the doctor's own section setup, medicines where the setup puts them", () => {
    const sections = [
      section('physicalExamination', ['a']),
      section('chiefComplaint', ['b']),
      section('diagnosis', ['c']),
      section('advice', ['d']),
      section('followUp', ['e']),
    ];
    const { left, right } = arrangePadSections(sections, {
      left: ['diagnosis', 'physicalExamination', 'chiefComplaint', 'allergy'],
      right: ['followUp', 'rx', 'advice'],
    });
    expect(left.map(s => s.key)).toEqual(['diagnosis', 'physicalExamination', 'chiefComplaint']);
    expect(right.map(item => (item === 'rx' ? 'rx' : item.key))).toEqual(['followUp', 'rx', 'advice']);
  });

  it('still shows a section the setup leaves out, and puts the medicines first when it has no "rx"', () => {
    const { left, right } = arrangePadSections(
      [section('diagnosis', ['a']), section('allergy', ['b']), section('referred', ['c'])],
      { left: ['diagnosis'], right: ['advice'] },
    );
    expect(left.map(s => s.key)).toEqual(['diagnosis', 'allergy']);
    expect(right.map(item => (item === 'rx' ? 'rx' : item.key))).toEqual(['rx', 'referred']);
  });

  it('falls back to the fixed split without a setup', () => {
    const { left, right } = arrangePadSections([section('advice', ['a']), section('diagnosis', ['b'])], null);
    expect(left.map(s => s.key)).toEqual(['diagnosis']);
    expect(right.map(item => (item === 'rx' ? 'rx' : item.key))).toEqual(['rx', 'advice']);
    expect(arrangePadSections(undefined, { left: [], right: [] })).toEqual({ left: [], right: ['rx'] });
  });

  it("splits the doctor's header into its Bangla and English columns, whatever their order", () => {
    const english = ['Dr. Tanjim Akter Tanha', 'MBBS, FCPS'];
    const bangla = ['ডা. তানজিম আক্তার তানহা', 'এমবিবিএস, এফসিপিএস'];
    expect(splitHeaderColumns([english, bangla, []])).toEqual({ bangla, english });
    expect(splitHeaderColumns([bangla, english])).toEqual({ bangla, english });
    expect(splitHeaderColumns([english])).toEqual({ bangla: [], english });
    expect(splitHeaderColumns([bangla])).toEqual({ bangla, english: [] });
  });

  it('reads a header of the wrong shape as empty, keeping only text lines', () => {
    expect(splitHeaderColumns(null)).toEqual({ bangla: [], english: [] });
    expect(splitHeaderColumns('x')).toEqual({ bangla: [], english: [] });
    expect(splitHeaderColumns([null, [' ', null, { a: 1 }, 'Dr. X ', 5]])).toEqual({ bangla: [], english: ['Dr. X', '5'] });
  });

  it("dates an upload by the paper's own date, a doctor's prescription by when it was written", () => {
    // The live test upload: the paper says 14 Nov, it was uploaded on 16 Nov.
    expect(sheetDate({ isUploaded: true, sourceDate: '2026-11-14T00:00:00', prescribedAt: '2026-11-16T16:56:10' })).toBe(
      '2026-11-14T00:00:00',
    );
    // An upload with no readable date on the paper keeps the upload day.
    expect(sheetDate({ isUploaded: true, sourceDate: null, prescribedAt: '2026-11-16T16:56:10' })).toBe('2026-11-16T16:56:10');
    expect(sheetDate({ isUploaded: true, sourceDate: 'not a date', prescribedAt: '2026-11-16' })).toBe('2026-11-16');
    expect(sheetDate({ isUploaded: true, sourceDate: { d: 1 }, prescribedAt: '2026-11-16' })).toBe('2026-11-16');
    // A doctor's prescription is never re-dated.
    expect(sheetDate({ isUploaded: false, sourceDate: '2026-11-14', prescribedAt: '2026-10-17T11:27:10' })).toBe(
      '2026-10-17T11:27:10',
    );
    expect(sheetDate(null)).toBe('');
    expect(sheetDate(undefined)).toBe('');
  });
});
