import React, { memo } from 'react';
import { StyleSheet, View, TextStyle } from 'react-native';
import { Appbar, Text } from 'react-native-paper';
import { fontFamilies } from '../theme/typography';

interface CustomHeaderProps {
  title: string;
  subtitle?: string;
  onBackPress?: () => void;
  onMenuPress?: () => void;
  actions?: Array<{ icon: string; onPress: () => void }>;
  titleStyle?: TextStyle;
}

export const CustomHeader = memo<CustomHeaderProps>(function CustomHeader({
  title,
  subtitle,
  onBackPress,
  onMenuPress,
  actions,
  titleStyle,
}) {
  return (
    <Appbar.Header style={styles.header}>
      {onBackPress && <Appbar.BackAction onPress={onBackPress} />}
      {onMenuPress && <Appbar.Action icon="menu" onPress={onMenuPress} />}
      {subtitle ? (
        <Appbar.Content
          title={
            <View>
              <Text style={[styles.title, titleStyle]}>{title}</Text>
              <Text style={styles.subtitle}>{subtitle}</Text>
            </View>
          }
        />
      ) : (
        <Appbar.Content
          title={title}
          titleStyle={[styles.title, titleStyle]}
        />
      )}
      {actions?.map((action, index) => (
        <Appbar.Action key={index} icon={action.icon} onPress={action.onPress} />
      ))}
    </Appbar.Header>
  );
});

const styles = StyleSheet.create({
  header: {
    elevation: 4,
  },
  title: {
    fontFamily: fontFamilies.bold,
    fontSize: 20,
  },
  subtitle: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
  },
});
