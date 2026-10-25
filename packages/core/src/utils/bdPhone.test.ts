import { isBdMobile, toLocalBdMobile } from './bdPhone';

describe('toLocalBdMobile', () => {
  it('drops the country code however it was dialled', () => {
    expect(toLocalBdMobile('+8801822421743')).toBe('01822421743');
    expect(toLocalBdMobile('8801822421743')).toBe('01822421743');
    expect(toLocalBdMobile('008801822421743')).toBe('01822421743');
    expect(toLocalBdMobile('01822421743')).toBe('01822421743');
  });

  it('drops spaces, dashes and brackets', () => {
    expect(toLocalBdMobile(' +880 1822-421743 ')).toBe('01822421743');
    expect(toLocalBdMobile('0088 (01822) 421743')).toBe('01822421743');
  });

  it('gives nothing for no number', () => {
    expect(toLocalBdMobile('')).toBe('');
    expect(toLocalBdMobile(null)).toBe('');
    expect(toLocalBdMobile(undefined)).toBe('');
  });
});

describe('isBdMobile', () => {
  it('takes a BD mobile number in any usual form', () => {
    expect(isBdMobile('01822421743')).toBe(true);
    expect(isBdMobile('+8801822421743')).toBe(true);
    expect(isBdMobile('008801822421743')).toBe(true);
  });

  it('refuses anything else', () => {
    expect(isBdMobile('01222421743')).toBe(false);
    expect(isBdMobile('0182242174')).toBe(false);
    expect(isBdMobile('00881822421743')).toBe(false);
    expect(isBdMobile('')).toBe(false);
    expect(isBdMobile(null)).toBe(false);
  });
});
