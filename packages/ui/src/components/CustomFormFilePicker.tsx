import React from 'react';
import { Controller, Control, FieldPath, FieldValues, RegisterOptions } from 'react-hook-form';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { HelperText } from 'react-native-paper';
import { CustomFilePicker } from './CustomFilePicker';
import { fontFamilies } from '../theme/typography';

export interface CustomFormFilePickerProps<TFieldValues extends FieldValues = FieldValues> {
  name: FieldPath<TFieldValues>;
  control: Control<TFieldValues>;
  rules?: Omit<
    RegisterOptions<TFieldValues, FieldPath<TFieldValues>>,
    'valueAsNumber' | 'valueAsDate' | 'setValueAs' | 'disabled'
  >;
  defaultValue?: any;
  allowMultiSelection?: boolean;
  allowedTypes?: string[];
  label?: string;
  style?: ViewStyle;
}

export const CustomFormFilePicker = <TFieldValues extends FieldValues = FieldValues>({
  name,
  control,
  rules,
  defaultValue = [],
  style,
  ...pickerProps
}: CustomFormFilePickerProps<TFieldValues>) => {
  return (
    <Controller
      control={control}
      name={name}
      rules={rules}
      defaultValue={defaultValue}
      render={({ field: { onChange }, fieldState: { error } }) => (
        <View style={[styles.container, style]}>
          <CustomFilePicker
            onFilePicked={onChange}
            {...pickerProps}
          />
          <HelperText type="error" visible={!!error} style={styles.errorText}>
            {error?.message}
          </HelperText>
        </View>
      )}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  errorText: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
  },
});

export default CustomFormFilePicker;
