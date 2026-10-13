import { MD3LightTheme, MD3DarkTheme, configureFonts, useTheme } from 'react-native-paper';
import { DefaultTheme as NavLightTheme, DarkTheme as NavDarkTheme } from '@react-navigation/native';
import { fontFamilies } from './typography';

const customFonts = configureFonts({
  config: {
    displayLarge: { fontFamily: fontFamilies.bold, letterSpacing: 0, fontSize: 57, lineHeight: 64 },
    displayMedium: { fontFamily: fontFamilies.semibold, letterSpacing: 0, fontSize: 45, lineHeight: 52 },
    displaySmall: { fontFamily: fontFamilies.regular, letterSpacing: 0, fontSize: 36, lineHeight: 44 },
    headlineLarge: { fontFamily: fontFamilies.bold, letterSpacing: 0, fontSize: 32, lineHeight: 40 },
    headlineMedium: { fontFamily: fontFamilies.semibold, letterSpacing: 0, fontSize: 28, lineHeight: 36 },
    headlineSmall: { fontFamily: fontFamilies.regular, letterSpacing: 0, fontSize: 24, lineHeight: 32 },
    titleLarge: { fontFamily: fontFamilies.bold, letterSpacing: 0, fontSize: 22, lineHeight: 28 },
    titleMedium: { fontFamily: fontFamilies.medium, letterSpacing: 0.15, fontSize: 16, lineHeight: 24 },
    titleSmall: { fontFamily: fontFamilies.regular, letterSpacing: 0.1, fontSize: 14, lineHeight: 20 },
    labelLarge: { fontFamily: fontFamilies.semibold, letterSpacing: 0.1, fontSize: 14, lineHeight: 20 },
    labelMedium: { fontFamily: fontFamilies.medium, letterSpacing: 0.5, fontSize: 12, lineHeight: 16 },
    labelSmall: { fontFamily: fontFamilies.regular, letterSpacing: 0.5, fontSize: 11, lineHeight: 16 },
    bodyLarge: { fontFamily: fontFamilies.regular, letterSpacing: 0.15, fontSize: 16, lineHeight: 24 },
    bodyMedium: { fontFamily: fontFamilies.regular, letterSpacing: 0.25, fontSize: 14, lineHeight: 20 },
    bodySmall: { fontFamily: fontFamilies.regular, letterSpacing: 0.4, fontSize: 12, lineHeight: 16 },
  },
});

// Brand palette sampled from the Health mobile design. Tune these five and the
// whole app follows — screens read from `theme.colors`, never a hardcoded hex.
export const AppLightTheme = {
  ...MD3LightTheme,
  fonts: customFonts,
  roundness: 10, // design uses ~10px corners on inputs, chips and buttons
  colors: {
    ...MD3LightTheme.colors,
    primary: '#2F45E5', // header, primary buttons, selected chips
    onPrimary: '#FFFFFF',
    primaryContainer: '#E9EDFD', // icon tiles, "SERIAL #n" badge
    onPrimaryContainer: '#2F45E5',
    secondary: '#151E4F', // floating bottom tab bar
    onSecondary: '#FFFFFF',
    background: '#F3F5FB',
    surface: '#FFFFFF',
    surfaceVariant: '#EFF1F6',
    onSurface: '#12172B',
    onSurfaceVariant: '#8A90A6',
    outlineVariant: '#EDEFF5',
    error: '#B3261E',
    // AI Assist — its dark console, and the cyan glow that marks what is AI's.
    aiGlow: '#22D3EE',
    aiConsole: '#0B1235',
    aiConsoleRaised: '#18235C',
    onAiConsole: '#E8ECFF',
    onAiConsoleMuted: '#8F9AD0',
  },
};

export const AppDarkTheme = {
  ...MD3DarkTheme,
  fonts: customFonts,
  roundness: 10,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#9FB0FF',
    onPrimary: '#0B1030',
    primaryContainer: '#242D5E',
    onPrimaryContainer: '#C7D0FF',
    secondary: '#0F1533',
    onSecondary: '#FFFFFF',
    background: '#0E1120',
    surface: '#181C2E',
    surfaceVariant: '#242938',
    onSurface: '#E6E8F0',
    onSurfaceVariant: '#9AA0B5',
    outlineVariant: '#2A3042',
    error: '#F2B8B5',
    aiGlow: '#67E8F9',
    aiConsole: '#070B1F',
    aiConsoleRaised: '#141C45',
    onAiConsole: '#E8ECFF',
    onAiConsoleMuted: '#8390C6',
  },
};

/** The app's theme, including the colours Paper does not name. */
export type AppTheme = typeof AppLightTheme;

/** `useTheme` typed with the app's own colours — `theme.colors.aiGlow` and the like. */
export const useAppTheme = () => useTheme<AppTheme>();

export const NavigationLightTheme = {
  ...NavLightTheme,
  colors: {
    ...NavLightTheme.colors,
    primary: '#2F45E5',
    background: '#F3F5FB',
    card: '#FFFFFF',
    text: '#12172B',
    border: '#EDEFF5',
    notification: '#B3261E',
  },
};

export const NavigationDarkTheme = {
  ...NavDarkTheme,
  colors: {
    ...NavDarkTheme.colors,
    primary: '#9FB0FF',
    background: '#0E1120',
    card: '#181C2E',
    text: '#E6E8F0',
    border: '#2A3042',
    notification: '#F2B8B5',
  },
};
