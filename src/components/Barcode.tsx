import React, { useMemo } from 'react';
import { PixelRatio, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { code128Widths } from '@app/core';
import { fontFamilies } from '@app/ui';

interface BarcodeProps {
  value?: string | null;
  /** The widest it may draw; bars narrow to fit. */
  maxWidth: number;
  height?: number;
}

/**
 * A CODE128 barcode with its value printed under it — the accession number on
 * an imaging report, as the portal prints it. Black on white whatever the
 * theme, so a scanner can read it. Nothing at all for an empty value.
 */
export const Barcode = ({ value, maxWidth, height = 36 }: BarcodeProps) => {
  const widths = useMemo(() => code128Widths(value), [value]);
  const modules = widths.reduce((sum, width) => sum + width, 0);
  if (!modules) return null;

  // The portal draws 1.3px a module; narrower only when the code would not fit.
  const module = Math.min(1.3, maxWidth / modules);
  let x = 0;
  const bars = widths.flatMap((width, index) => {
    const left = PixelRatio.roundToNearestPixel(x * module);
    x += width;
    if (index % 2 === 1) return [];
    const right = PixelRatio.roundToNearestPixel(x * module);
    return [{ left, width: Math.max(right - left, StyleSheet.hairlineWidth) }];
  });

  return (
    <View style={styles.wrap}>
      <View style={{ width: PixelRatio.roundToNearestPixel(modules * module), height }}>
        {bars.map(bar => (
          <View key={bar.left} style={[styles.bar, { left: bar.left, width: bar.width, height }]} />
        ))}
      </View>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'flex-start',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingTop: 6,
    paddingBottom: 4,
  },
  bar: {
    position: 'absolute',
    top: 0,
    backgroundColor: '#000000',
  },
  value: {
    fontFamily: fontFamilies.regular,
    fontSize: 10,
    color: '#000000',
    marginTop: 2,
  },
});

export default Barcode;
