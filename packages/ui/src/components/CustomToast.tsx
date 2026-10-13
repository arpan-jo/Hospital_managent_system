import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Snackbar, useTheme } from 'react-native-paper';
import { observer } from 'mobx-react-lite';
import { useStores } from '@app/core';
import { fontFamilies } from '../theme/typography';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export const CustomToast = memo(
  observer(function CustomToast() {
    const theme = useTheme();
    const { toastStore } = useStores();

    const getBackgroundColor = () => {
      const type = toastStore?.type || 'info';
      switch (type) {
        case 'success':
          return '#4CAF50';
        case 'error':
          return theme.colors?.error || '#D32F2F';
        case 'warning':
          return '#FF9800';
        case 'info':
        default:
          return theme.dark ? '#323232' : '#2196F3';
      }
    };

    const getIconName = () => {
      const type = toastStore?.type || 'info';
      switch (type) {
        case 'success':
          return 'check-circle-outline';
        case 'error':
          return 'alert-circle-outline';
        case 'warning':
          return 'alert-outline';
        case 'info':
        default:
          return 'information-outline';
      }
    };

    const visible = toastStore?.visible ?? false;
    const duration = toastStore?.duration ?? 3000;
    const message = toastStore?.message || '';

    return (
      <Snackbar
        visible={visible}
        onDismiss={() => toastStore?.hide()}
        duration={duration}
        style={[styles.snackbar, { backgroundColor: getBackgroundColor() }]}
        wrapperStyle={styles.wrapper}
      >
        <View style={styles.content}>
          <Icon name={getIconName()} size={20} color="#ffffff" style={styles.icon} />
          <Text style={styles.messageText}>{message}</Text>
        </View>
      </Snackbar>
    );
  })
);

const styles = StyleSheet.create({
  wrapper: {
    bottom: 50,
  },
  snackbar: {
    borderRadius: 8,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: 8,
  },
  messageText: {
    fontFamily: fontFamilies.medium,
    fontSize: 14,
    color: '#ffffff',
    flexShrink: 1,
  },
});

export default CustomToast;
