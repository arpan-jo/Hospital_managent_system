import React from 'react';
import { Controller, Control, FieldPath, FieldValues, RegisterOptions } from 'react-hook-form';
import { ViewStyle } from 'react-native';
import { CustomDropdown, DropdownItem } from './CustomDropdown';

export interface CustomFormDropdownProps<TFieldValues extends FieldValues = FieldValues> {
  name: FieldPath<TFieldValues>;
  control: Control<TFieldValues>;
  rules?: Omit<
    RegisterOptions<TFieldValues, FieldPath<TFieldValues>>,
    'valueAsNumber' | 'valueAsDate' | 'setValueAs' | 'disabled'
  >;
  defaultValue?: string;
  label: string;
  items: DropdownItem[];
  placeholder?: string;
  disabled?: boolean;
  style?: ViewStyle;
}

export const CustomFormDropdown = <TFieldValues extends FieldValues = FieldValues>({
  name,
  control,
  rules,
  defaultValue = '',
  ...dropdownProps
}: CustomFormDropdownProps<TFieldValues>) => {
  return (
    <Controller
      control={control}
      name={name}
      rules={rules}
      defaultValue={defaultValue as any}
      render={({ field: { onChange, value }, fieldState: { error } }) => (
        <CustomDropdown
          value={value ?? ''}
          onValueChange={onChange}
          error={error?.message}
          {...dropdownProps}
        />
      )}
    />
  );
};

export default CustomFormDropdown;
