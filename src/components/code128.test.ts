import { code128Values, code128Width, encodeCode128 } from './code128';

describe('code128', () => {
  it('encodes a prescription code: text in set B, the long digit runs in set C', () => {
    const values = code128Values('PRS-20261017-000000001');
    // Start B, "PRS-", Code C, 20 26 10 17, Code B, "-", "0", Code C, 00 00 00 01, checksum.
    expect(values?.slice(0, -1)).toEqual([
      104, 48, 50, 51, 13, 99, 20, 26, 10, 17, 100, 13, 16, 99, 0, 0, 0, 1,
    ]);
    const body = (values ?? []).slice(0, -1);
    const checksum = body.reduce((sum, symbol, place) => sum + symbol * (place === 0 ? 1 : place), 0) % 103;
    expect(values?.[values.length - 1]).toBe(checksum);
  });

  it('starts in set C for a code that opens with an even run of digits', () => {
    expect(code128Values('12345678')?.slice(0, 5)).toEqual([105, 12, 34, 56, 78]);
    // An odd run starts in B with its first digit, then pairs the rest.
    expect(code128Values('12345')?.slice(0, 5)).toEqual([104, 17, 99, 23, 45]);
    // A short run stays in set B.
    expect(code128Values('URX-123')?.slice(0, 8)).toEqual([104, 53, 50, 56, 13, 17, 18, 19]);
  });

  it('draws 11 modules a symbol and 13 for the stop, bar first', () => {
    const modules = encodeCode128('URX-20261116-0001');
    const symbols = (code128Values('URX-20261116-0001') ?? []).length;
    expect(code128Width(modules)).toBe(symbols * 11 + 13);
    // Six elements a symbol, seven for the stop: an odd count, so it ends on a bar.
    expect((modules ?? []).length).toBe(symbols * 6 + 7);
    expect((modules ?? []).every(width => width >= 1 && width <= 4)).toBe(true);
  });

  it('has nothing to draw for an empty code or one set B cannot carry', () => {
    expect(encodeCode128('')).toBeNull();
    expect(encodeCode128(null)).toBeNull();
    expect(encodeCode128(undefined)).toBeNull();
    expect(encodeCode128('প্রেসক্রিপশন')).toBeNull();
    expect(code128Width(null)).toBe(0);
    // Not a string or a finite number: never "[object Object]" or "NaN" in bars.
    expect(encodeCode128({ code: 'PRS-1' })).toBeNull();
    expect(encodeCode128(['PRS-1'])).toBeNull();
    expect(encodeCode128(Number.NaN)).toBeNull();
    expect(encodeCode128(Infinity)).toBeNull();
    expect(code128Values(1234)?.slice(0, 3)).toEqual([105, 12, 34]);
  });
});
