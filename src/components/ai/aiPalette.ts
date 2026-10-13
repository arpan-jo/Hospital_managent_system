import { AppTheme } from '@app/ui';

/**
 * The look of the app's AI features — the doctor's AI Assist, the patient's
 * AI doctor finder — drawn from the theme so dark mode follows.
 *
 * Two things mark something as AI's: a dark console for the one thing it is
 * busy with — listening, or drafting — and a cyan glow on whatever it is doing
 * or offering. The primary actions keep the brand wash — blue into the tab
 * bar's navy — so they still read as this app's buttons. In dark mode the brand
 * blue is pale and would not carry light text, so the darker container tone
 * starts that wash instead.
 */

/** '#22D3EE' at 0.35 → '#22D3EE59'. Anything but a six-digit hex is returned as it is. */
export const withAlpha = (color: string, alpha: number): string => {
  if (!/^#[0-9a-f]{6}$/i.test(String(color ?? ''))) return color;

  const channel = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `${color}${channel}`;
};

export interface AiPalette {
  /** Painted under a wash — what shows wherever a gradient cannot be drawn. */
  base: string;
  /** The brand wash, for `experimental_backgroundImage`. */
  gradient: string;
  /** Text and icons laid on the wash. */
  onGradient: string;
  /** The cyan that marks what is AI's. */
  glow: string;
  /** A soft glow under whatever is AI's to press, for `boxShadow`. */
  glowShadow: string;
  /** A tighter glow for the toolbar's small pills, so it fits inside the row's scroll bounds. */
  chipGlowShadow: string;
  /**
   * Icons and text that are AI's on an ordinary surface. The cyan glow is too
   * faint to read on a light one, so the light theme uses the brand blue.
   */
  accent: string;
  /** A thin cyan-to-brand edge around what is AI's to press, for `experimental_backgroundImage`. */
  edgeGradient: string;
  console: string;
  consoleRaised: string;
  consoleGradient: string;
  onConsole: string;
  onConsoleMuted: string;
}

export const aiPalette = (theme: AppTheme): AiPalette => {
  const colors = theme?.colors;
  const from = theme?.dark ? colors?.primaryContainer : colors?.primary;

  return {
    base: from,
    gradient: `linear-gradient(135deg, ${from} 0%, ${colors?.secondary} 100%)`,
    onGradient: theme?.dark ? colors?.onPrimaryContainer : colors?.onPrimary,
    glow: colors?.aiGlow,
    glowShadow: `0px 6px 18px ${withAlpha(colors?.aiGlow, 0.35)}`,
    chipGlowShadow: `0px 2px 8px ${withAlpha(colors?.aiGlow, 0.4)}`,
    accent: theme?.dark ? colors?.aiGlow : colors?.primary,
    edgeGradient: `linear-gradient(90deg, ${colors?.aiGlow} 0%, ${colors?.primary} 100%)`,
    console: colors?.aiConsole,
    consoleRaised: colors?.aiConsoleRaised,
    consoleGradient: `linear-gradient(160deg, ${colors?.aiConsoleRaised} 0%, ${colors?.aiConsole} 100%)`,
    onConsole: colors?.onAiConsole,
    onConsoleMuted: colors?.onAiConsoleMuted,
  };
};
