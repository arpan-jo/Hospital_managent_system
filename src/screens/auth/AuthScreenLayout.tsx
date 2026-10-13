import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Image,
  LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text, ThemeProvider } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  AppLightTheme,
  CustomThemeToggler,
  fontFamilies,
  useAppTheme,
} from '@app/ui';
import { images } from '../../assets/images';
import { useFocusedStatusBar } from '../../hooks/useFocusedStatusBar';
import { useKeyboardHeight } from '../../hooks/useKeyboardHeight';

/** How far the form sheet rides up over the hero. */
const SHEET_OVERLAP = 28;

interface AuthScreenLayoutProps {
  title: string;
  subtitle?: string;
  /** Shows a back arrow in the hero. Left out on Login, the stack's first screen. */
  onBack?: () => void;
  /** What a screen reader says for that arrow. */
  backLabel?: string;
  /** The form: everything on the sheet below the hero. */
  children: React.ReactNode;
}

/**
 * The shell every sign-in and sign-up screen shares: a brand-coloured hero
 * carrying the logo and the screen's title, and the form on a sheet that rides
 * up over it.
 */
export const AuthScreenLayout = ({
  title,
  subtitle,
  onBack,
  backLabel,
  children,
}: AuthScreenLayoutProps) => {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();
  const scrollRef = useRef<ScrollView>(null);
  const heroHeight = useRef(0);
  // The hero is a dark block in both themes, so the status bar is always light.
  useFocusedStatusBar('light-content');

  // Brand blue in light; in dark `primary` turns pale, so its container tone
  // carries the hero instead.
  const heroColor = theme.dark
    ? theme.colors.primaryContainer
    : theme.colors.primary;
  const heroInk = theme.dark
    ? theme.colors.onPrimaryContainer
    : theme.colors.onPrimary;

  /**
   * On a short screen the hero would leave the lower fields and the button
   * under the keyboard, so it scrolls away while typing and the sheet takes
   * the top of the screen.
   */
  useEffect(() => {
    if (keyboardHeight > 0) {
      scrollRef.current?.scrollTo({
        y: Math.max(heroHeight.current - SHEET_OVERLAP - insets.top - 8, 0),
        animated: true,
      });
    }
  }, [keyboardHeight, insets.top]);

  const handleHeroLayout = useCallback((event: LayoutChangeEvent) => {
    heroHeight.current = event?.nativeEvent?.layout?.height ?? 0;
  }, []);

  /**
   * Paper paints an outlined field in `background`, which on the sheet leaves
   * a tinted patch behind each floating label. Everything on the sheet is
   * themed with the sheet's own colour as its background instead.
   */
  const sheetTheme = useMemo(
    () => ({
      ...theme,
      colors: { ...theme.colors, background: theme.colors.surface },
    }),
    [theme],
  );

  const containerStyle = useMemo(
    () => [styles.container, { backgroundColor: heroColor }],
    [heroColor],
  );

  const heroStyle = useMemo(
    () => [styles.hero, { paddingTop: insets.top + 4 }],
    [insets.top],
  );

  const ringLargeStyle = useMemo(
    () => [styles.ring, styles.ringLarge, { borderColor: heroInk }],
    [heroInk],
  );

  const ringSmallStyle = useMemo(
    () => [styles.ring, styles.ringSmall, { borderColor: heroInk }],
    [heroInk],
  );

  const glowStyle = useMemo(
    () => [styles.glow, { backgroundColor: heroInk }],
    [heroInk],
  );

  const titleStyle = useMemo(
    () => [styles.title, { color: heroInk }],
    [heroInk],
  );

  const subtitleStyle = useMemo(
    () => [styles.subtitle, { color: heroInk }],
    [heroInk],
  );

  const sheetStyle = useMemo(
    () => [
      styles.sheet,
      {
        backgroundColor: theme.colors.surface,
        paddingBottom: (keyboardHeight || insets.bottom) + 24,
      },
    ],
    [theme.colors.surface, keyboardHeight, insets.bottom],
  );

  return (
    <View style={containerStyle}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={false}
        overScrollMode="never"
      >
        <View style={heroStyle} onLayout={handleHeroLayout}>
          <View pointerEvents="none" style={ringLargeStyle} />
          <View pointerEvents="none" style={ringSmallStyle} />
          <View pointerEvents="none" style={glowStyle} />

          <View style={styles.headerActions}>
            {onBack ? (
              <Pressable
                onPress={onBack}
                hitSlop={8}
                style={styles.backButton}
                accessibilityRole="button"
                accessibilityLabel={backLabel}
              >
                <Icon name="arrow-left" size={22} color={heroInk} />
              </Pressable>
            ) : (
              <View />
            )}
            <CustomThemeToggler iconColor={heroInk} />
          </View>

          <View style={styles.logoPlate}>
            <Image
              source={images.logo}
              style={styles.logo}
              resizeMode="contain"
              accessibilityRole="image"
              accessibilityLabel="Hospital Management System"
            />
          </View>

          <Text style={titleStyle} accessibilityRole="header">
            {title}
          </Text>
          {subtitle ? <Text style={subtitleStyle}>{subtitle}</Text> : null}
        </View>

        <ThemeProvider theme={sheetTheme}>
          <View style={sheetStyle}>{children}</View>
        </ThemeProvider>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  hero: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: SHEET_OVERLAP + 32,
    overflow: 'hidden',
  },
  // Echo of the rings behind the web's sign-in card.
  ring: {
    position: 'absolute',
    borderWidth: 1.5,
  },
  ringLarge: {
    width: 340,
    height: 340,
    borderRadius: 170,
    top: -130,
    right: -130,
    opacity: 0.16,
  },
  ringSmall: {
    width: 220,
    height: 220,
    borderRadius: 110,
    bottom: -70,
    left: -90,
    opacity: 0.12,
  },
  glow: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    top: -50,
    left: -70,
    opacity: 0.07,
  },
  headerActions: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The wordmark is drawn for a white ground (navy tagline, a cut-out cross),
  // so its plate is the light surface in both themes.
  logoPlate: {
    backgroundColor: AppLightTheme.colors.surface,
    borderRadius: 18,
    paddingHorizontal: 20,
    paddingVertical: 14,
    marginTop: 8,
  },
  logo: {
    width: 200,
    height: 36,
  },
  title: {
    fontFamily: fontFamilies.bold,
    fontSize: 26,
    textAlign: 'center',
    marginTop: 24,
  },
  subtitle: {
    fontFamily: fontFamilies.regular,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
    opacity: 0.85,
  },
  sheet: {
    flexGrow: 1,
    marginTop: -SHEET_OVERLAP,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 28,
  },
});

export default AuthScreenLayout;
