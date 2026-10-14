import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { IconButton, Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { types as fileTypes } from '@react-native-documents/picker';
import {
  fileExtensionLabel,
  formatFileSize,
  REPORT_ALLOWED_EXTENSIONS,
  REPORT_MAX_FILE_BYTES,
} from '@app/core';
import {
  CustomBottomSheet,
  CustomButton,
  CustomDropdown,
  CustomFilePicker,
  CustomInput,
  DropdownItem,
  fontFamilies,
} from '@app/ui';

export interface PickedFile {
  uri: string;
  name: string;
  size?: number | null;
  type?: string | null;
}

export interface UploadFileResult<T extends string> {
  file: PickedFile;
  title: string;
  category: T;
  notes: string;
}

interface UploadFileSheetProps<T extends string> {
  visible: boolean;
  /** Sheet title — "Upload Document", "Upload Report", etc. */
  title: string;
  /** Small caption under the title — the record this attaches to, if any. */
  subtitle?: string;
  categoryItems: DropdownItem<T>[];
  defaultCategory: T;
  /** Ceiling the API enforces — shown in the hint and checked on pick, as the web does. */
  maxBytes?: number;
  /** Extensions the backend accepts, lowercase and without the dot. */
  allowedExtensions?: string[];
  onClose: () => void;
  /**
   * May work asynchronously: the sheet waits for it, showing the button as
   * busy, and stays open when it answers `false` so the failure can be fixed
   * without picking the file again.
   */
  onUpload: (result: UploadFileResult<T>) => void | boolean | Promise<void | boolean>;
}

/**
 * The file-plus-metadata form behind every "Upload"/"Add document" action in
 * this app: pick a file, name it, categorise it, add an optional note. Shared
 * by the prescription attachment sheet and the Reports screen so the form
 * exists once — each caller only supplies its own categories and result shape.
 *
 * Both callers store into the same documents endpoint, so the file rules
 * default to the ones that endpoint's web form enforces.
 */
export function UploadFileSheet<T extends string>({
  visible,
  title,
  subtitle,
  categoryItems,
  defaultCategory,
  maxBytes = REPORT_MAX_FILE_BYTES,
  allowedExtensions = REPORT_ALLOWED_EXTENSIONS,
  onClose,
  onUpload,
}: UploadFileSheetProps<T>) {
  const theme = useTheme();
  const { t } = useTranslation();

  const [file, setFile] = useState<PickedFile | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<T>(defaultCategory);
  const [notes, setNotes] = useState('');
  const [fileError, setFileError] = useState<string | null>(null);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      setFile(null);
      setName('');
      setCategory(defaultCategory);
      setNotes('');
      setFileError(null);
      setTitleError(null);
      setSubmitting(false);
    }
  }, [visible, defaultCategory]);

  /** "PDF, JPG, PNG, GIF, WEBP, SVG" — aliases of a listed type are left out. */
  const typeLabel = useMemo(
    () =>
      allowedExtensions
        .filter(extension => extension !== 'jpeg' || !allowedExtensions.includes('jpg'))
        .map(extension => extension.toUpperCase())
        .join(', '),
    [allowedExtensions],
  );

  /** "PDF, JPG, PNG, GIF, WEBP, SVG — max 5 MB". */
  const fileHint = useMemo(
    () => t('uploadFile.fileHint', { types: typeLabel, size: formatFileSize(maxBytes) }),
    [typeLabel, maxBytes, t],
  );

  /**
   * The type and the size are checked on pick, as the web's forms do — a file
   * picker on some Android providers ignores `allowedTypes`, and the server
   * turns away anything over the ceiling only after the whole upload.
   */
  const validateFile = useCallback(
    (picked: PickedFile): string | null => {
      const extension = fileExtensionLabel(picked?.name).toLowerCase();
      if (extension && !allowedExtensions.includes(extension)) {
        return t('uploadFile.typeNotAllowed', { types: typeLabel });
      }
      if ((picked?.size ?? 0) > maxBytes) {
        return t('uploadFile.fileTooLarge', { size: formatFileSize(maxBytes) });
      }
      return null;
    },
    [allowedExtensions, typeLabel, maxBytes, t],
  );

  const handleFilePicked = useCallback(
    (files: PickedFile[]) => {
      const picked = files[0] ?? null;
      if (!picked) {
        setFile(null);
        setFileError(null);
        return;
      }

      const error = validateFile(picked);
      setFileError(error);
      // A rejected file is not kept, so "Upload" cannot send it anyway.
      setFile(error ? null : picked);
      // An empty title takes the file's name, without its extension — as on the web.
      if (!error) {
        setName(prev => prev || String(picked?.name ?? '').replace(/\.[^.]+$/, ''));
        setTitleError(null);
      }
    },
    [validateFile],
  );

  const handleNameChange = useCallback((value: string) => {
    setName(value);
    setTitleError(null);
  }, []);

  const handleUpload = useCallback(async () => {
    if (!file) {
      setFileError(t('uploadFile.fileRequired'));
      return;
    }
    if (!name.trim()) {
      setTitleError(t('uploadFile.titleRequired'));
      return;
    }

    setSubmitting(true);
    try {
      const result = await onUpload({ file, title: name.trim(), category, notes: notes.trim() });
      if (result !== false) onClose();
    } finally {
      setSubmitting(false);
    }
  }, [file, name, category, notes, onUpload, onClose, t]);

  return (
    <CustomBottomSheet visible={visible} onClose={onClose} style={styles.sheet}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: theme.colors.onSurface }]}>{title}</Text>
          {subtitle ? (
            <Text
              numberOfLines={1}
              style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
        <IconButton icon="close" size={20} onPress={onClose} iconColor={theme.colors.onSurface} />
      </View>

      {/* The picker's own constants, not MIME strings: iOS reads each entry as a
          type identifier, and 'image/*' or 'application/pdf' is not one — the
          picker would offer nothing at all to choose. */}
      <CustomFilePicker
        label={file ? t('uploadFile.changeFile') : t('uploadFile.selectFile')}
        allowedTypes={[fileTypes.images, fileTypes.pdf]}
        onFilePicked={handleFilePicked}
      />
      <Text style={[styles.hint, { color: theme.colors.onSurfaceVariant }]}>{fileHint}</Text>
      {fileError ? (
        <Text style={[styles.error, { color: theme.colors.error }]}>{fileError}</Text>
      ) : null}

      <CustomInput
        label={`${t('uploadFile.documentTitle')} *`}
        value={name}
        onChangeText={handleNameChange}
        placeholder={t('uploadFile.documentTitlePlaceholder')}
        error={titleError ?? undefined}
      />

      <CustomDropdown<T>
        label={`${t('uploadFile.category')} *`}
        items={categoryItems}
        value={category}
        onValueChange={setCategory}
      />

      <CustomInput
        label={t('uploadFile.notesOptional')}
        value={notes}
        onChangeText={setNotes}
        placeholder={t('uploadFile.notesPlaceholder')}
        multiline
        numberOfLines={3}
        inputStyle={styles.textarea}
      />

      <CustomButton
        mode="contained"
        onPress={handleUpload}
        loading={isSubmitting}
        disabled={isSubmitting}
        style={styles.uploadButton}
      >
        {title}
      </CustomButton>
    </CustomBottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    maxHeight: '92%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontFamily: fontFamilies.bold,
    fontSize: 17,
  },
  subtitle: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
    marginTop: 2,
  },
  hint: {
    fontFamily: fontFamilies.regular,
    fontSize: 11,
    marginTop: -4,
  },
  error: {
    fontFamily: fontFamilies.medium,
    fontSize: 12,
    marginTop: 6,
  },
  textarea: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  uploadButton: {
    marginVertical: 0,
    marginTop: 18,
    borderRadius: 10,
  },
});

export default UploadFileSheet;
