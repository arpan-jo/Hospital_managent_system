import React, { memo, useState, useCallback } from 'react';
import { StyleSheet, View, StyleProp, ViewStyle, TextStyle } from 'react-native';
import { TextInput, HelperText } from 'react-native-paper';
import { fontFamilies } from '../theme/typography';

interface CustomInputProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  onBlur?: () => void;
  /** Lets a screen scroll the field into view once the keyboard opens. */
  onFocus?: () => void;
  placeholder?: string;
  error?: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
  leftIcon?: string;
  rightIcon?: string;
  onRightIconPress?: () => void;
  /** Fires on the keyboard's return key — e.g. an add-box that commits on Enter. */
  onSubmitEditing?: () => void;
  /** What that return key reads as. */
  returnKeyType?: 'done' | 'go' | 'next' | 'search' | 'send';
  multiline?: boolean;
  numberOfLines?: number;
  style?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  disabled?: boolean;
  /**
   * Drops the blank line the error message normally reserves under the field.
   *
   * Default `false` — every existing form keeps that line so a field does not
   * jump when its error appears. Set it on dense grids of fields that carry no
   * validation, where eight reserved lines add a screenful of empty space.
   */
  compact?: boolean;
}

export const CustomInput = memo<CustomInputProps>(function CustomInput({
  label,
  value,
  onChangeText,
  onBlur,
  onFocus,
  placeholder,
  error,
  secureTextEntry = false,
  keyboardType = 'default',
  leftIcon,
  rightIcon,
  onRightIconPress,
  onSubmitEditing,
  returnKeyType,
  multiline = false,
  numberOfLines,
  style,
  inputStyle,
  disabled = false,
  compact = false,
}) {
  const [passwordVisible, setPasswordVisible] = useState(!secureTextEntry);

  const togglePasswordVisibility = useCallback(
    () => setPasswordVisible(prev => !prev),
    [],
  );

  const rightAdornment = useCallback(() => {
    if (secureTextEntry) {
      return (
        <TextInput.Icon
          icon={passwordVisible ? 'eye-off' : 'eye'}
          onPress={togglePasswordVisibility}
        />
      );
    }
    if (rightIcon) {
      return <TextInput.Icon icon={rightIcon} onPress={onRightIconPress} />;
    }
    return null;
  }, [secureTextEntry, passwordVisible, rightIcon, onRightIconPress, togglePasswordVisibility]);

  const leftAdornment = useCallback(
    () => (leftIcon ? <TextInput.Icon icon={leftIcon} /> : null),
    [leftIcon],
  );

  return (
    <View style={[styles.container, compact && styles.compact, style]}>
      <TextInput
        label={label}
        value={value}
        onChangeText={onChangeText}
        onBlur={onBlur}
        onFocus={onFocus}
        onSubmitEditing={onSubmitEditing}
        returnKeyType={returnKeyType}
        placeholder={placeholder}
        secureTextEntry={secureTextEntry && !passwordVisible}
        // A password goes in exactly as typed: left to its default, Android
        // capitalises the first letter and a correct password is refused.
        autoCapitalize={secureTextEntry ? 'none' : undefined}
        keyboardType={keyboardType}
        disabled={disabled}
        multiline={multiline}
        numberOfLines={numberOfLines}
        mode="outlined"
        error={!!error}
        left={leftIcon ? leftAdornment() : null}
        right={rightAdornment()}
        style={[styles.input, inputStyle]}
      />
      {compact && !error ? null : (
        <HelperText type="error" visible={!!error} style={styles.errorText}>
          {error}
        </HelperText>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
    width: '100%',
  },
  compact: {
    marginVertical: 3,
  },
  input: {
    fontFamily: fontFamilies.regular,
    fontSize: 16,
  },
  errorText: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
  },
});
