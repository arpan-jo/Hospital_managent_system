import { billLabSection } from './billLabSection';

const tests = (...codes: string[]) => codes.map(billCode => ({ billCode }));

describe('billLabSection', () => {
  it('opens radiology when only the radiology list has the bill', () => {
    expect(billLabSection('BILL-1', tests('BILL-2'), tests('BILL-1'))).toBe('radiology');
  });

  it('opens pathology when the pathology list has it, alone or with radiology', () => {
    expect(billLabSection('BILL-1', tests('BILL-1'), tests('BILL-2'))).toBe('pathology');
    expect(billLabSection('BILL-1', tests('BILL-1'), tests('BILL-1'))).toBe('pathology');
  });

  it('matches the code whatever its case or spacing', () => {
    expect(billLabSection(' bill-1 ', [], tests('BILL-1'))).toBe('radiology');
  });

  it('opens pathology when neither list has it, or a list could not be read', () => {
    expect(billLabSection('BILL-1', tests('BILL-2'), tests('BILL-3'))).toBe('pathology');
    expect(billLabSection('BILL-1', tests('BILL-1'), null)).toBe('pathology');
    expect(billLabSection('BILL-1', null, null)).toBe('pathology');
  });

  it('still opens radiology when only the pathology list failed and radiology has the bill', () => {
    expect(billLabSection('BILL-1', null, tests('BILL-1'))).toBe('radiology');
  });

  it('opens pathology for a bill with no code, and skips tests with none', () => {
    expect(billLabSection('', [], tests(''))).toBe('pathology');
    expect(billLabSection(undefined, [], [{ billCode: null }, null as any])).toBe('pathology');
  });
});
