import { PrescriptionSection } from '@app/core';
import {
  ageOnDay,
  formatDose,
  medicineForm,
  medicineTitle,
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
        label: 'Physical Examination',
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
});
