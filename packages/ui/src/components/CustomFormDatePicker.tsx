import React from 'react';
import { Controller, Control, FieldPath, FieldValues, RegisterOptions } from 'react-hook-form';
import { ViewStyle, TextStyle } from 'react-native';
import { CustomDatePicker } from './CustomDatePicker';

export interface CustomFormDatePickerProps<TFieldValues extends FieldValues = FieldValues> {
  name: FieldPath<TFieldValues>;
  control: Control<TFieldValues>;
  rules?: Omit<
    RegisterOptions<TFieldValues, FieldPath<TFieldValues>>,
    'valueAsNumber' | 'valueAsDate' | 'setValueAs' | 'disabled'
  >;
  defaultValue?: Date;
  label: string;
  mode?: 'date' | 'time' | 'datetime';
  placeholder?: string;
  disabled?: boolean;
  minimumDate?: Date;
  maximumDate?: Date;
  formatString?: (date: Date) => string;
  style?: ViewStyle;
  inputStyle?: TextStyle;
}

export const CustomFormDatePicker = <TFieldValues extends FieldValues = FieldValues>({
  name,
  control,
  rules,
  defaultValue,
  ...datePickerProps
}: CustomFormDatePickerProps<TFieldValues>) => {
  return (
    <Controller
      control={control}
      name={name}
      rules={rules}
      defaultValue={defaultValue as any}
      render={({ field: { onChange, value }, fieldState: { error } }) => (
        <CustomDatePicker
          value={value}
          onChange={onChange}
          error={error?.message}
          {...datePickerProps}
        />
      )}
    />
  );
};

export default CustomFormDatePicker;
