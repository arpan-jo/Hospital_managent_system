/**
 * The arithmetic behind ZoomableView, kept apart from the gestures so it can be
 * tested. Every function is a worklet: the gestures call them on the UI thread.
 *
 * The content is drawn at `translate + scale * point`, with the transform's
 * origin at its top-left corner.
 */

/**
 * The range one axis's translation may take at `scale`. Content larger than the
 * viewport may move until its edge meets the viewport's, never further; content
 * that fits stays put — in the middle when `center`, else at the start.
 */
export const axisBounds = (
  viewport: number,
  content: number,
  scale: number,
  center: boolean,
): [number, number] => {
  'worklet';
  const scaled = content * scale;
  if (scaled <= viewport) {
    const fixed = center ? (viewport - scaled) / 2 : 0;
    return [fixed, fixed];
  }
  return [viewport - scaled, 0];
};

/** `value` held inside axisBounds. */
export const clampAxis = (
  value: number,
  viewport: number,
  content: number,
  scale: number,
  center: boolean,
): number => {
  'worklet';
  const [min, max] = axisBounds(viewport, content, scale, center);
  return Math.min(Math.max(value, min), max);
};

export const clampScale = (scale: number, min: number, max: number): number => {
  'worklet';
  return Math.min(Math.max(scale, min), max);
};

/**
 * The translation that keeps the content point under `focal` where it is while
 * the scale goes from `fromScale` to `toScale` — the fingers stay on the word
 * they pinched.
 */
export const zoomAround = (
  focal: number,
  translate: number,
  fromScale: number,
  toScale: number,
): number => {
  'worklet';
  const safeFrom = fromScale > 0 ? fromScale : 1;
  return focal - ((focal - translate) / safeFrom) * toScale;
};
