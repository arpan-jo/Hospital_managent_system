import React, { memo, useCallback, useRef } from 'react';
import {
  NativeSyntheticEvent,
  StyleSheet,
  TextInput,
  TextInputKeyPressEventData,
  View,
} from 'react-native';
import { useTheme } from 'react-native-paper';
import { fontFamilies } from '@app/ui';

interface OtpCodeInputProps {
  digits: string[];
  onChangeDigit: (index: number, value: string) => void;
}

/**
 * Six single-digit boxes with auto-advance-on-type and backspace-to-previous.
 * A whole code pasted into any box fills them all — the code arrives by email,
 * so copying it across is the usual way in.
 */
export const OtpCodeInput = memo<OtpCodeInputProps>(function OtpCodeInput({
  digits,
  onChangeDigit,
}) {
  const theme = useTheme();
  const inputRefs = useRef<Array<TextInput | null>>([]);

  const handleChangeText = useCallback(
    (index: number, text: string) => {
      const typed = text.replace(/[^0-9]/g, '');
      const length = digits?.length ?? 0;

      // A paste: the boxes take no length limit, so the whole code lands here.
      // Past the code's length the box's own old digit is in front of it.
      if (typed.length >= length) {
        typed
          .slice(-length)
          .split('')
          .forEach((digit, position) => onChangeDigit(position, digit));
        inputRefs.current[length - 1]?.focus();
        return;
      }

      const digit = typed.slice(-1);
      onChangeDigit(index, digit);
      if (digit && index < length - 1) {
        inputRefs.current[index + 1]?.focus();
      }
    },
    [digits?.length, onChangeDigit],
  );

  const handleKeyPress = useCallback(
    (index: number, e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
      const key = e?.nativeEvent?.key;
      if (key === 'Backspace' && !digits?.[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
        return;
      }
      // Retyping the digit a box already holds changes no text, so no change
      // event fires — the move to the next box has to come from the key press.
      if (key && key === digits?.[index] && index < (digits?.length ?? 0) - 1) {
        inputRefs.current[index + 1]?.focus();
      }
    },
    [digits],
  );

  return (
    <View style={styles.row}>
      {digits?.map((digit, index) => (
        <TextInput
          key={index}
          ref={ref => {
            inputRefs.current[index] = ref;
          }}
          value={digit}
          onChangeText={text => handleChangeText(index, text)}
          onKeyPress={e => handleKeyPress(index, e)}
          keyboardType="number-pad"
          selectTextOnFocus
          style={[
            styles.box,
            {
              borderColor: digit ? theme.colors.primary : theme.colors.outline,
              color: theme.colors.onSurface,
              backgroundColor: theme.colors.background,
            },
          ]}
        />
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  box: {
    width: 46,
    height: 54,
    borderWidth: 1.5,
    borderRadius: 10,
    textAlign: 'center',
    fontFamily: fontFamilies.semibold,
    fontSize: 20,
  },
});

export default OtpCodeInput;
