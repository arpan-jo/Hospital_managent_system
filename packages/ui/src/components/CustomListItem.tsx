import React, { memo, useCallback } from 'react';
import { StyleSheet } from 'react-native';
import { List, Switch, Badge } from 'react-native-paper';
import { fontFamilies } from '../theme/typography';

interface CustomListItemProps {
  title: string;
  description?: string;
  leftIcon?: string;
  rightType?: 'arrow' | 'switch' | 'badge' | 'none';
  switchValue?: boolean;
  onSwitchChange?: (val: boolean) => void;
  badgeValue?: string | number;
  onPress?: () => void;
}

export const CustomListItem = memo<CustomListItemProps>(function CustomListItem({
  title,
  description,
  leftIcon,
  rightType = 'none',
  switchValue = false,
  onSwitchChange,
  badgeValue,
  onPress,
}) {
  const getLeftIcon = useCallback(
    (props: any) => (leftIcon ? <List.Icon {...props} icon={leftIcon} /> : null),
    [leftIcon],
  );

  const getRightIcon = useCallback(
    (props: any) => {
      switch (rightType) {
        case 'arrow':
          return <List.Icon {...props} icon="chevron-right" />;
        case 'switch':
          return (
            <Switch
              value={switchValue}
              onValueChange={onSwitchChange}
              style={styles.switch}
            />
          );
        case 'badge':
          return badgeValue !== undefined ? (
            <Badge style={styles.badge}>{badgeValue}</Badge>
          ) : null;
        default:
          return null;
      }
    },
    [rightType, switchValue, onSwitchChange, badgeValue],
  );

  return (
    <List.Item
      title={title}
      description={description}
      left={leftIcon ? getLeftIcon : undefined}
      right={rightType !== 'none' ? getRightIcon : undefined}
      onPress={onPress}
      titleStyle={styles.title}
      descriptionStyle={styles.description}
    />
  );
});

const styles = StyleSheet.create({
  title: {
    fontFamily: fontFamilies.semibold,
    fontSize: 16,
  },
  description: {
    fontFamily: fontFamilies.regular,
    fontSize: 13,
  },
  switch: {
    alignSelf: 'center',
  },
  badge: {
    alignSelf: 'center',
    marginRight: 8,
  },
});
