import { ViewStyle } from 'react-native';
import { AllergySeverity, ConditionStatus } from '@app/core';

/** Semantic accents the profile screens share. Everything else comes from the theme. */
export const STATUS_COLOR: Record<ConditionStatus, string> = {
  Active: '#1B9C5D',
  Resolved: '#8A90A6',
};

export const SEVERITY_COLOR: Record<AllergySeverity, string> = {
  Mild: '#F5A623',
  Moderate: '#E8804D',
  Severe: '#E85D75',
};

/**
 * Amber "read this before treatment" treatment — emergency contact card and the
 * allergy banner. Both themes get their own set: the light-only palette left
 * the values unreadable on a dark background, since the card paints its own
 * surface while the text came from the theme.
 */
export interface WarningColors {
  background: string;
  border: string;
  /** Card title and field labels. */
  title: string;
  /**
   * Field values — the highest-contrast copy on the card. Not named `value`:
   * reanimated's Babel plugin warns about any `x.value` inside a `style`.
   */
  text: string;
  /** Tint behind the small icon tiles. */
  iconTile: string;
}

const LIGHT_WARNING: WarningColors = {
  background: '#FFFBF0',
  border: '#F5A623',
  title: '#B4780F',
  text: '#3D2E05',
  iconTile: '#FFF3D6',
};

const DARK_WARNING: WarningColors = {
  background: '#2A2110',
  border: '#8A6114',
  title: '#F5C46B',
  text: '#F6EEDD',
  iconTile: '#3A2D14',
};

/** Picks the amber set that reads on the current theme's background. */
export const useWarningColors = (isDark: boolean): WarningColors =>
  isDark ? DARK_WARNING : LIGHT_WARNING;

// Kept for the fixed accents that do not sit on the amber surface.
export const WARNING_BORDER = LIGHT_WARNING.border;

export const BLOOD_COLOR = '#E85D75';
export const BLOOD_BG = '#FDECEF';

/** The one card lift used across the profile tabs, so nothing floats higher than the rest. */
export const cardShadow: ViewStyle = {
  elevation: 1,
  shadowColor: '#0B1030',
  shadowOpacity: 0.05,
  shadowRadius: 6,
  shadowOffset: { width: 0, height: 2 },
};
