import { Platform } from 'react-native';

export const fontSizes = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const fontWeights = {
  regular: 'normal' as const,
  medium: Platform.OS === 'ios' ? '500' as const : 'normal' as const,
  semibold: Platform.OS === 'ios' ? '600' as const : 'normal' as const,
  bold: 'bold' as const,
};

export const fontFamilies = {
  regular: 'Inter-Regular',
  medium: 'Inter-Medium',
  semibold: 'Inter-SemiBold',
  bold: 'Inter-Bold',
};

export const typography = {
  sizes: fontSizes,
  weights: fontWeights,
  families: fontFamilies,
};
