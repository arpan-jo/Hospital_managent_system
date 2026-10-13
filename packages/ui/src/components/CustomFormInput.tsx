import React from 'react';
import { Controller, Control, FieldPath, FieldValues, RegisterOptions } from 'react-hook-form';
import { ViewStyle, TextStyle } from 'react-native';
import { CustomInput } from './CustomInput';

export interface CustomFormInputProps<TFieldValues extends FieldValues = FieldValues> {
  name: FieldPath<TFieldValues>;
  control: Control<TFieldValues>;
  rules?: Omit<
    RegisterOptions<TFieldValues, FieldPath<TFieldValues>>,
    'valueAsNumber' | 'valueAsDate' | 'setValueAs' | 'disabled'
  >;
  defaultValue?: any;
  label: string;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
  leftIcon?: string;
  rightIcon?: string;
  onRightIconPress?: () => void;
  /** Fires on the keyboard's return key — e.g. submitting from a form's last field. */
  onSubmitEditing?: () => void;
  /** What that return key reads as. */
  returnKeyType?: 'done' | 'go' | 'next' | 'search' | 'send';
  multiline?: boolean;
  numberOfLines?: number;
  style?: ViewStyle;
  inputStyle?: TextStyle;
  disabled?: boolean;
}

export const CustomFormInput = <TFieldValues extends FieldValues = FieldValues>({
  name,
  control,
  rules,
  defaultValue = '',
  ...inputProps
}: CustomFormInputProps<TFieldValues>) => {
  return (
    <Controller
      control={control}
      name={name}
      rules={rules}
      defaultValue={defaultValue}
      render={({ field: { onChange, onBlur, value }, fieldState: { error } }) => (
        <CustomInput
          value={value}
          onChangeText={onChange}
          onBlur={onBlur}
          error={error?.message}
          {...inputProps}
        />
      )}
    />
  );
};

export default CustomFormInput;
