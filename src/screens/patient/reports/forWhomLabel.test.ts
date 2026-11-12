import { forWhomLabel } from './forWhomLabel';

const WORDS: Record<string, string> = {
  'reports.read.self': 'Self',
  'patientProfile.relation_spouse': 'Spouse',
  'patientProfile.relation_child': 'Child',
};
const t = (key: string, options?: Record<string, unknown>) =>
  WORDS[key] ?? String(options?.defaultValue ?? key);

describe('forWhomLabel', () => {
  it('names each profile with who they are to the account, as the portal does', () => {
    expect(forWhomLabel({ fullName: 'Al Amin', relationship: 'self' }, t)).toBe('Al Amin (Self)');
    expect(forWhomLabel({ fullName: 'Rahima', relationship: 'spouse' }, t)).toBe('Rahima (Spouse)');
    expect(forWhomLabel({ fullName: 'Karim', relationship: 'Child' }, t)).toBe('Karim (Child)');
  });

  it('shows a relationship the app has no word for as the server sent it', () => {
    expect(forWhomLabel({ fullName: 'Nila', relationship: 'cousin' }, t)).toBe('Nila (cousin)');
  });

  it('falls back to the patient code, then a dash, and leaves out a missing relationship', () => {
    expect(forWhomLabel({ patientCode: 'REG-1', relationship: '' }, t)).toBe('REG-1');
    expect(forWhomLabel({ fullName: '  ', relationship: null }, t)).toBe('—');
    expect(forWhomLabel(null, t)).toBe('—');
  });
});
