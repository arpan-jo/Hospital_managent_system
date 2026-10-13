import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { SegmentedButtons, useTheme } from 'react-native-paper';
import { observer } from 'mobx-react-lite';
import { useStores } from '@app/core';

export const CustomLanguageToggler: React.FC = observer(() => {
  const { languageStore } = useStores();
  const theme = useTheme();

  // Paper tints the chosen segment with `secondaryContainer`, which the app
  // theme leaves at Paper's own lilac — the brand's container tone goes in.
  const segmentedTheme = useMemo(
    () => ({
      colors: {
        secondaryContainer: theme.colors.primaryContainer,
        onSecondaryContainer: theme.colors.onPrimaryContainer,
      },
    }),
    [theme.colors.primaryContainer, theme.colors.onPrimaryContainer],
  );

  return (
    <View style={styles.container}>
      <SegmentedButtons
        value={languageStore.language}
        onValueChange={(val) => languageStore.setLanguage(val as 'en' | 'bn')}
        buttons={[
          {
            value: 'en',
            label: 'English',
          },
          {
            value: 'bn',
            label: 'বাংলা',
          },
        ]}
        style={styles.segmented}
        theme={segmentedTheme}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
    width: '100%',
    maxWidth: 240,
    alignSelf: 'center',
  },
  segmented: {
    height: 40,
  },
});
