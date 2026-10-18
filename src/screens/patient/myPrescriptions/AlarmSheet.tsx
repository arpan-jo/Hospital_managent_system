import React, { memo, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { IconButton, Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { ALARM_RING_MS } from '@app/core';
import {
  CustomBottomSheet,
  CustomButton,
  CustomDatePicker,
  CustomFormInput,
  fontFamilies,
} from '@app/ui';
import { useAlarmSheetViewModel } from './useAlarmSheetViewModel';

const MESSAGE_MAX_LENGTH = 100;

interface AlarmForm {
  message: string;
}

/** A few minutes ahead, so the default is a time that can still ring today. */
const defaultAlarmTime = () => new Date(Date.now() + 5 * 60 * 1000);

interface AlarmSheetProps {
  visible: boolean;
  onClose: () => void;
}

/** Sets one alarm: a time and the patient's own message, rung once at that time. */
export const AlarmSheet = memo<AlarmSheetProps>(function AlarmSheet({
  visible,
  onClose,
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const viewModel = useAlarmSheetViewModel();

  const { control, handleSubmit, reset } = useForm<AlarmForm>({
    defaultValues: { message: '' },
    mode: 'onBlur',
  });
  const [time, setTime] = useState<Date>(defaultAlarmTime);

  useEffect(() => {
    if (visible) {
      reset({ message: '' });
      setTime(defaultAlarmTime());
    }
  }, [visible, reset]);

  // The sheet stays open when the alarm could not be set, so nothing typed is lost.
  const handleSave = handleSubmit(async values => {
    const saved = await viewModel.save(time, values?.message?.trim() ?? '');
    if (saved) onClose();
  });

  return (
    <CustomBottomSheet visible={visible} onClose={onClose} style={styles.sheet}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.onSurface }]}>
          {t('alarm.title')}
        </Text>
        <IconButton
          icon="close"
          size={20}
          onPress={onClose}
          iconColor={theme.colors.onSurface}
        />
      </View>
      <Text style={[styles.hint, { color: theme.colors.onSurfaceVariant }]}>
        {t('alarm.hint', { seconds: ALARM_RING_MS / 1000 })}
      </Text>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <CustomDatePicker
          label={t('alarm.time')}
          mode="time"
          value={time}
          onChange={(date?: Date) => {
            if (date) setTime(date);
          }}
        />

        <CustomFormInput
          name="message"
          control={control}
          label={t('alarm.message')}
          placeholder={t('alarm.messagePlaceholder')}
          leftIcon="message-text-outline"
          rules={{
            validate: value =>
              value?.trim() ? true : t('alarm.messageRequired'),
            maxLength: {
              value: MESSAGE_MAX_LENGTH,
              message: t('alarm.messageTooLong', { count: MESSAGE_MAX_LENGTH }),
            },
          }}
        />
      </ScrollView>

      {/* No bottom padding here — CustomBottomSheet already applies the safe-area gap. */}
      <View style={styles.actions}>
        <CustomButton
          mode="outlined"
          onPress={onClose}
          style={[
            styles.actionButton,
            { borderColor: theme.colors.outlineVariant },
          ]}
          textColor={theme.colors.onSurface}
        >
          {t('common.cancel')}
        </CustomButton>
        <CustomButton
          mode="contained"
          icon="alarm-check"
          onPress={handleSave}
          loading={viewModel.isSaving}
          disabled={viewModel.isSaving}
          style={styles.actionButton}
        >
          {t('alarm.save')}
        </CustomButton>
      </View>
    </CustomBottomSheet>
  );
});

const styles = StyleSheet.create({
  sheet: {
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontFamily: fontFamilies.bold,
    fontSize: 17,
  },
  hint: {
    fontFamily: fontFamilies.regular,
    fontSize: 13,
    marginBottom: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  actionButton: {
    flex: 1,
    marginVertical: 0,
    paddingVertical: 2,
    borderRadius: 10,
  },
});

export default AlarmSheet;
