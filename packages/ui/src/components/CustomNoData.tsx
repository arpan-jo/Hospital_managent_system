import React, { memo, useMemo } from 'react';
import { StyleSheet, TextStyle, View, ViewStyle } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { fontFamilies } from '../theme/typography';

interface CustomNoDataProps {
  /** Defaults to the shared `common.noDataFound` copy. */
  message?: string;
  /** `false` drops the icon for tight rows like a chip strip. */
  showIcon?: boolean;
  iconName?: string;
  iconSize?: number;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const CustomNoData = memo<CustomNoDataProps>(function CustomNoData({
  message,
  showIcon = true,
  iconName = 'database-off-outline',
  iconSize = 28,
  style,
  textStyle,
}) {
  const theme = useTheme();
  const { t } = useTranslation();

  const containerStyle = useMemo(() => [styles.container, style], [style]);

  return (
    <View style={containerStyle}>
      {showIcon ? (
        <Icon
          name={iconName}
          size={iconSize}
          color={theme.colors?.onSurfaceVariant}
        />
      ) : null}
      <Text
        style={[
          styles.text,
          { color: theme.colors?.onSurfaceVariant },
          textStyle,
        ]}
      >
        {message ?? t('common.noDataFound')}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 16,
  },
  text: {
    fontFamily: fontFamilies.regular,
    fontSize: 13,
    textAlign: 'center',
  },
});

export default CustomNoData;
