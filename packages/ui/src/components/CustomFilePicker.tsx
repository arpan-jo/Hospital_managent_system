import React, { memo, useState, useCallback, useMemo } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { List, IconButton, useTheme, Button, HelperText } from 'react-native-paper';
import { pick, errorCodes, isErrorWithCode } from '@react-native-documents/picker';
import { fontFamilies } from '../theme/typography';

interface PickedFile {
  uri: string;
  name: string;
  size?: number | null;
  type?: string | null;
}

interface CustomFilePickerProps {
  onFilePicked: (files: PickedFile[]) => void;
  allowMultiSelection?: boolean;
  allowedTypes?: string[];
  label?: string;
  style?: ViewStyle;
  /**
   * The files the owner kept, when it decides that — the list shows these
   * rather than the last pick, so a pick the owner refused (too large, a type
   * it does not take) never shows as if it were the file to be sent.
   */
  value?: PickedFile[] | null;
}

const formatSize = (bytes?: number | null): string => {
  if (!bytes) { return 'Unknown size'; }
  const kb = bytes / 1024;
  if (kb < 1024) { return `${kb.toFixed(1)} KB`; }
  return `${(kb / 1024).toFixed(1)} MB`;
};

export const CustomFilePicker = memo<CustomFilePickerProps>(function CustomFilePicker({
  onFilePicked,
  allowMultiSelection = false,
  allowedTypes,
  label = 'Pick File',
  style,
  value,
}) {
  const theme = useTheme();
  const [selectedFiles, setSelectedFiles] = useState<PickedFile[]>([]);
  const shownFiles = value ?? selectedFiles;
  const [pickError, setPickError] = useState<string | null>(null);

  const handlePickFile = useCallback(async () => {
    setPickError(null);
    try {
      const results = await pick({
        allowMultiSelection,
        type: allowedTypes,
        mode: 'import',
      });

      const formatted: PickedFile[] = results.map((file: any) => ({
        uri: file.uri,
        name: file.name || 'Unnamed file',
        size: file.size || null,
        type: file.type || null,
      }));

      setSelectedFiles(formatted);
      onFilePicked(formatted);
    } catch (err) {
      if (isErrorWithCode(err) && err.code === errorCodes.OPERATION_CANCELED) { return; }
      if (__DEV__) { console.warn('[CustomFilePicker] File pick failed:', err); }
      setPickError('Failed to pick file. Please try again.');
    }
  }, [allowMultiSelection, allowedTypes, onFilePicked]);

  const handleRemoveFile = useCallback(
    (index: number) => {
      const updated = (shownFiles ?? []).filter((_, i) => i !== index);
      setSelectedFiles(updated);
      onFilePicked(updated);
    },
    [shownFiles, onFilePicked],
  );

  const listStyle = useMemo(
    () => [styles.list, { backgroundColor: theme.colors.surfaceVariant }],
    [theme.colors.surfaceVariant],
  );

  return (
    <View style={[styles.container, style]}>
      <Button
        mode="outlined"
        icon="file-upload-outline"
        onPress={handlePickFile}
        style={styles.pickerButton}
        labelStyle={styles.btnLabel}
      >
        {label}
      </Button>
      <HelperText type="error" visible={!!pickError}>
        {pickError}
      </HelperText>

      {(shownFiles?.length ?? 0) > 0 && (
        <View style={listStyle}>
          {shownFiles.map((file, index) => (
            <List.Item
              key={index}
              title={file?.name}
              description={formatSize(file?.size)}
              left={(props) => <List.Icon {...props} icon="file-document-outline" />}
              right={(props) => (
                <IconButton
                  {...props}
                  icon="close-circle-outline"
                  iconColor={theme.colors.error}
                  onPress={() => handleRemoveFile(index)}
                />
              )}
              titleStyle={styles.fileTitle}
              descriptionStyle={styles.fileDesc}
            />
          ))}
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
    width: '100%',
  },
  pickerButton: {
    borderRadius: 8,
    borderStyle: 'dashed',
    borderWidth: 1.5,
  },
  btnLabel: {
    fontFamily: fontFamilies.semibold,
  },
  list: {
    marginTop: 8,
    borderRadius: 8,
    overflow: 'hidden',
  },
  fileTitle: {
    fontFamily: fontFamilies.semibold,
    fontSize: 14,
  },
  fileDesc: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
  },
});

export default CustomFilePicker;
