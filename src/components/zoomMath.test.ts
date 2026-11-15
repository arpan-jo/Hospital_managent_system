import { axisBounds, clampAxis, clampScale, zoomAround } from './zoomMath';

describe('zoomMath', () => {
  it('lets content larger than the viewport move only until its edge meets the viewport', () => {
    // 400 wide at 2× is 800 on a 400 viewport: from -400 (right edge in) to 0.
    expect(axisBounds(400, 400, 2, true)).toEqual([-400, 0]);
    expect(clampAxis(50, 400, 400, 2, true)).toBe(0);
    expect(clampAxis(-900, 400, 400, 2, true)).toBe(-400);
    expect(clampAxis(-120, 400, 400, 2, true)).toBe(-120);
  });

  it('keeps content that fits centred, or at the top when not centred', () => {
    expect(axisBounds(400, 300, 1, true)).toEqual([50, 50]);
    expect(axisBounds(800, 600, 1, false)).toEqual([0, 0]);
    expect(clampAxis(-200, 800, 600, 1, false)).toBe(0);
  });

  it('scrolls a page taller than the screen at its normal size', () => {
    // A 1200-tall page on an 800-tall screen can move up 400.
    expect(axisBounds(800, 1200, 1, false)).toEqual([-400, 0]);
  });

  it('holds the scale between its limits', () => {
    expect(clampScale(0.5, 1, 4)).toBe(1);
    expect(clampScale(6, 1, 4)).toBe(4);
    expect(clampScale(2.2, 1, 4)).toBe(2.2);
  });

  it('keeps the pinched point under the fingers', () => {
    // At 1× with no offset, point 100 is under focal 100; at 2× it must stay there.
    const translate = zoomAround(100, 0, 1, 2);
    expect(translate + 2 * 100).toBe(100);
    // And back from 2× to 1× returns to no offset.
    expect(zoomAround(100, translate, 2, 1)).toBe(0);
  });

  it('does not divide by a zero scale', () => {
    expect(Number.isFinite(zoomAround(100, 0, 0, 2))).toBe(true);
  });
});
