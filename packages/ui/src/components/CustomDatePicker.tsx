import React, { memo, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View, Pressable, Platform, StyleProp, ViewStyle, TextStyle } from 'react-native';
import { TextInput, HelperText, Portal, Dialog, Button, useTheme } from 'react-native-paper';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { formatShortDate } from '@app/core';
import { fontFamilies } from '../theme/typography';

export interface CustomDatePickerProps {
  label: string;
  value?: Date;
  onChange?: (date: Date) => void;
  mode?: 'date' | 'time' | 'datetime';
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  minimumDate?: Date;
  maximumDate?: Date;
  formatString?: (date: Date) => string;
  /** Open the picker as soon as the field mounts — for fields revealed by a
   *  "pick a date" action, where a second tap to open would be a dead step. */
  autoOpen?: boolean;
  /** Offers a ✕ in place of the calendar icon while a date is set, to take it
   *  away again. Without it a date, once picked, can only be changed. */
  onClear?: () => void;
  /** What a screen reader calls the ✕. */
  clearLabel?: string;
  style?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
}

export const CustomDatePicker = memo<CustomDatePickerProps>(function CustomDatePicker({
  label,
  value,
  onChange,
  mode = 'date',
  placeholder,
  error,
  disabled = false,
  minimumDate,
  maximumDate,
  formatString,
  autoOpen = false,
  onClear,
  clearLabel = 'Clear',
  style,
  inputStyle,
}) {
  const theme = useTheme();
  const [showAndroidPicker, setShowAndroidPicker] = useState(false);
  const [showIosDialog, setShowIosDialog] = useState(false);
  const [tempDate, setTempDate] = useState<Date | null>(null);

  const formattedValue = useMemo(() => {
    if (!value) return '';
    if (formatString) return formatString(value);

    // Day first, as every other date in the app reads. `toLocaleDateString`
    // follows the engine's locale, which prints an American "10/21/2026".
    if (mode === 'date') {
      return formatShortDate(value);
    } else if (mode === 'time') {
      return value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
      return `${formatShortDate(value)} ${value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
  }, [value, mode, formatString]);

  const handlePress = useCallback(() => {
    if (disabled) return;
    if (Platform.OS === 'android') {
      setShowAndroidPicker(true);
    } else {
      setTempDate(value || new Date());
      setShowIosDialog(true);
    }
  }, [disabled, value]);

  const handleAndroidChange = useCallback(
    (event: DateTimePickerEvent, selectedDate?: Date) => {
      setShowAndroidPicker(false);
      if (event.type === 'set' && selectedDate) {
        onChange?.(selectedDate);
      }
    },
    [onChange]
  );

  const handleIosChange = useCallback((_event: DateTimePickerEvent, selectedDate?: Date) => {
    if (selectedDate) {
      setTempDate(selectedDate);
    }
  }, []);

  const handleIosConfirm = useCallback(() => {
    if (tempDate) {
      onChange?.(tempDate);
    }
    setShowIosDialog(false);
  }, [tempDate, onChange]);

  const handleIosCancel = useCallback(() => {
    setShowIosDialog(false);
  }, []);

  // Fires once: reopening on every re-render would trap the user in the picker.
  const hasAutoOpened = useRef(false);
  useEffect(() => {
    if (!autoOpen || hasAutoOpened.current || disabled) return;
    hasAutoOpened.current = true;
    handlePress();
  }, [autoOpen, disabled, handlePress]);

  const canClear = Boolean(onClear && value && !disabled);
  const rightIconName = canClear ? 'close-circle' : mode === 'time' ? 'clock-outline' : 'calendar';

  return (
    <View style={[styles.container, style]}>
      <View>
        <Pressable onPress={handlePress} disabled={disabled}>
          <View pointerEvents="none">
            <TextInput
              label={label}
              value={formattedValue}
              placeholder={placeholder}
              mode="outlined"
              error={!!error}
              disabled={disabled}
              right={<TextInput.Icon icon={rightIconName} />}
              style={[styles.input, inputStyle]}
            />
          </View>
        </Pressable>
        {/* Over the icon, so a tap there clears rather than opening the picker. */}
        {canClear ? (
          <Pressable
            onPress={onClear}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={clearLabel}
            style={styles.clear}
          />
        ) : null}
      </View>

      <HelperText type="error" visible={!!error} style={styles.errorText}>
        {error}
      </HelperText>

      {/* Android Picker */}
      {Platform.OS === 'android' && showAndroidPicker && (
        <DateTimePicker
          value={value || new Date()}
          mode={mode}
          display="default"
          onChange={handleAndroidChange}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
        />
      )}

      {/* iOS Picker Dialog */}
      {Platform.OS === 'ios' && (
        <Portal>
          <Dialog visible={showIosDialog} onDismiss={handleIosCancel} style={[styles.dialog, { backgroundColor: theme.colors?.elevation?.level3 || theme.colors?.surface }]}>
            <Dialog.Title style={styles.dialogTitle}>{label}</Dialog.Title>
            <Dialog.Content style={styles.dialogContent}>
              <DateTimePicker
                value={tempDate || new Date()}
                mode={mode}
                display="spinner"
                onChange={handleIosChange}
                minimumDate={minimumDate}
                maximumDate={maximumDate}
                textColor={theme.colors?.onSurface}
              />
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={handleIosCancel}>Cancel</Button>
              <Button onPress={handleIosConfirm}>Confirm</Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
    width: '100%',
  },
  input: {
    fontFamily: fontFamilies.regular,
    fontSize: 16,
  },
  clear: {
    position: 'absolute',
    top: 6,
    right: 0,
    bottom: 0,
    width: 52,
  },
  errorText: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
  },
  dialog: {
    borderRadius: 8,
  },
  dialogTitle: {
    fontFamily: fontFamilies.semibold,
    textAlign: 'center',
    fontSize: 18,
  },
  dialogContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default CustomDatePicker;
