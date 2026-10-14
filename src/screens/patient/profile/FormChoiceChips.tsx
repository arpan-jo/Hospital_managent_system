import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { HelperText, Text, useTheme } from 'react-native-paper';
import { Control, Controller, FieldValues, Path, RegisterOptions } from 'react-hook-form';
import { fontFamilies } from '@app/ui';

interface FormChoiceChipsProps<T extends FieldValues> {
  name: Path<T>;
  control: Control<T>;
  label: string;
  /** Each value is what is saved; the label is what the patient reads. */
  options: { label: string; value: string }[];
  rules?: Omit<RegisterOptions<T, Path<T>>, 'valueAsNumber' | 'valueAsDate' | 'setValueAs' | 'disabled'>;
}

/** A short single choice — gender, an ID type — laid out as chips instead of a dropdown. */
export const FormChoiceChips = <T extends FieldValues>({
  name,
  control,
  label,
  options,
  rules,
}: FormChoiceChipsProps<T>) => {
  const theme = useTheme();

  return (
    <Controller
      control={control}
      name={name}
      rules={rules}
      render={({ field: { onChange, value }, fieldState: { error } }) => (
        <View style={styles.wrap}>
          <Text style={[styles.label, { color: theme.colors.onSurfaceVariant }]}>{label}</Text>
          <View style={styles.row} accessibilityRole="radiogroup">
            {options?.map(option => {
              const selected = option?.value === value;
              return (
                <Pressable
                  key={option?.value}
                  onPress={() => onChange(option?.value)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: selected ? theme.colors.primary : theme.colors.surface,
                      borderColor: selected
                        ? theme.colors.primary
                        : error
                        ? theme.colors.error
                        : theme.colors.outlineVariant,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: selected ? theme.colors.onPrimary : theme.colors.onSurface },
                    ]}
                  >
                    {option?.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {error?.message ? (
            <HelperText type="error" visible style={styles.helper}>
              {error.message}
            </HelperText>
          ) : null}
        </View>
      )}
    />
  );
};

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 12,
  },
  label: {
    fontFamily: fontFamilies.medium,
    fontSize: 12.5,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 12.5,
  },
  helper: {
    paddingHorizontal: 0,
  },
});

export default FormChoiceChips;
