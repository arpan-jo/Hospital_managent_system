import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SegmentedButtons } from 'react-native-paper';
import { observer } from 'mobx-react-lite';
import { useStores } from '@app/core';

export const CustomLanguageToggler: React.FC = observer(() => {
  const { languageStore } = useStores();

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
