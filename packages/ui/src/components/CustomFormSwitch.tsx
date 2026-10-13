import React from 'react';
import { Controller, Control, FieldPath, FieldValues, RegisterOptions } from 'react-hook-form';
import { ViewStyle } from 'react-native';
import { CustomSwitch } from './CustomSwitch';

export interface CustomFormSwitchProps<TFieldValues extends FieldValues = FieldValues> {
  name: FieldPath<TFieldValues>;
  control: Control<TFieldValues>;
  rules?: Omit<
    RegisterOptions<TFieldValues, FieldPath<TFieldValues>>,
    'valueAsNumber' | 'valueAsDate' | 'setValueAs' | 'disabled'
  >;
  defaultValue?: boolean;
  label: string;
  style?: ViewStyle;
  disabled?: boolean;
}

export const CustomFormSwitch = <TFieldValues extends FieldValues = FieldValues>({
  name,
  control,
  rules,
  defaultValue = false,
  ...switchProps
}: CustomFormSwitchProps<TFieldValues>) => {
  return (
    <Controller
      control={control}
      name={name}
      rules={rules}
      defaultValue={defaultValue as any}
      render={({ field: { onChange, value } }) => (
        <CustomSwitch
          value={value}
          onValueChange={onChange}
          {...switchProps}
        />
      )}
    />
  );
};

export default CustomFormSwitch;
