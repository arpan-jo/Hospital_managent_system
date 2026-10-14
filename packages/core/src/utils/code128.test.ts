import { code128Widths } from './code128';

const toBinary = (widths: number[]) =>
  widths.map((width, index) => (index % 2 === 0 ? '1' : '0').repeat(width)).join('');

describe('code128Widths', () => {
  // Checked against jsbarcode 3.12.3 (the portal's barcode library), CODE128B.
  it('encodes as the portal does', () => {
    expect(toBinary(code128Widths('X'))).toBe(
      '1101001000011100010110111011010001100011101011',
    );
  });

  it('has start, one symbol per character, checksum and stop', () => {
    // 11 modules per symbol, 13 for the stop.
    expect(code128Widths('ACC12345').reduce((sum, width) => sum + width, 0)).toBe(11 * (1 + 8 + 1) + 13);
  });

  it('gives no barcode for nothing or for characters it cannot carry', () => {
    expect(code128Widths('')).toEqual([]);
    expect(code128Widths(null)).toEqual([]);
    expect(code128Widths('নাম')).toEqual([]);
  });
});
