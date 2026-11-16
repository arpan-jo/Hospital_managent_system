import React, { ReactNode, memo, useCallback, useMemo, useState } from 'react';
import { LayoutChangeEvent, PixelRatio, StyleSheet, View } from 'react-native';
import { code128Width, encodeCode128 } from './code128';

/** Blank modules each side, so a scanner finds where the code starts and ends. */
const QUIET_ZONE = 10;

interface Code128BarcodeProps {
  /** The code; anything but a string or a finite number has nothing to draw. */
  value: string | number | null | undefined;
  /** Bar height, in dp. */
  height?: number;
  /** The widest a module may get, in device pixels — a cap on how wide the code grows. */
  maxModulePx?: number;
  color?: string;
  accessibilityLabel?: string;
  /** Where the code sits in the width it is given. */
  align?: 'left' | 'center';
  /** Shown instead when the value cannot be drawn (empty, or a character CODE 128 has no bar for). */
  fallback?: ReactNode;
}

/**
 * A CODE 128 barcode drawn with plain views, as wide as its place allows. Each
 * module is a whole number of device pixels, so every bar edge lands on a pixel
 * and a scanner reads it straight off the screen. A value CODE 128 cannot
 * carry, or one too long for its place, shows `fallback` (nothing by default).
 */
export const Code128Barcode = memo<Code128BarcodeProps>(function Barcode({
  value,
  height = 40,
  maxModulePx = 4,
  color = '#000000',
  accessibilityLabel,
  align = 'left',
  fallback = null,
}) {
  const modules = useMemo(() => encodeCode128(value), [value]);
  const [width, setWidth] = useState(0);
  const barStyle = useMemo(() => ({ backgroundColor: color }), [color]);

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const measured = Number(event?.nativeEvent?.layout?.width);
    setWidth(Number.isFinite(measured) && measured > 0 ? measured : 0);
  }, []);

  if (!modules?.length) return <>{fallback}</>;

  const ratio = Number(PixelRatio.get()) > 0 ? Number(PixelRatio.get()) : 1;
  const total = code128Width(modules) + QUIET_ZONE * 2;
  const widest = Number.isFinite(maxModulePx) && maxModulePx >= 1 ? Math.floor(maxModulePx) : 1;
  const modulePx = Math.min(widest, Math.floor((width * ratio) / total));
  // Under one device pixel a module, the bars would run off the edge — and a
  // barcode cut short does not scan, so the text stands in.
  if (width > 0 && modulePx < 1) return <>{fallback}</>;
  const moduleDp = modulePx / ratio;

  return (
    <View
      style={styles.box}
      onLayout={onLayout}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel ?? (typeof value === 'string' ? value : String(value ?? ''))}
    >
      {width > 0 ? (
        <View
          style={[
            styles.code,
            align === 'center' ? styles.center : undefined,
            { height, paddingHorizontal: QUIET_ZONE * moduleDp },
          ]}
        >
          {modules.map((modulesWide, index) => (
            <View
              key={index}
              // Even places are bars, odd places the spaces between them.
              style={[{ width: modulesWide * moduleDp, height }, index % 2 === 0 ? barStyle : undefined]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  box: {
    alignSelf: 'stretch',
  },
  code: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
  },
  center: {
    alignSelf: 'center',
  },
});

export default Code128Barcode;
