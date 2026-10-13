import React, { memo, useCallback } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { PermissionsAndroid } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  Asset,
  ImageLibraryOptions,
  launchCamera,
  launchImageLibrary,
} from 'react-native-image-picker';
import { UploadFile } from '@app/core';
import { CustomBottomSheet, fontFamilies } from '@app/ui';

interface PhotoPickerSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Called with the picked image, ready for `FileRepository.upload`. */
  onPicked: (file: UploadFile) => void;
  /** Shown as a third option when there is a photo to clear. */
  onRemove?: () => void;
}

/**
 * Server-side storage and mobile data both prefer a modest image, and a profile
 * avatar is never rendered larger than a couple hundred points.
 */
const PICKER_OPTIONS: ImageLibraryOptions = {
  mediaType: 'photo',
  maxWidth: 1024,
  maxHeight: 1024,
  quality: 0.8,
  includeBase64: false,
};

const toUploadFile = (asset?: Asset): UploadFile | null => {
  if (!asset?.uri) return null;
  return {
    uri: asset.uri,
    name: asset?.fileName ?? `photo-${asset?.timestamp ?? 'upload'}.jpg`,
    type: asset?.type ?? 'image/jpeg',
    size: asset?.fileSize ?? null,
  };
};

/** Android needs the runtime grant before the camera intent, iOS asks itself. */
const ensureCameraPermission = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') return true;
  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
  return result === PermissionsAndroid.RESULTS.GRANTED;
};

/** Camera / gallery / remove — the choice behind every avatar tap. */
export const PhotoPickerSheet = memo<PhotoPickerSheetProps>(function PhotoPickerSheet({
  visible,
  onClose,
  onPicked,
  onRemove,
}) {
  const theme = useTheme();
  const { t } = useTranslation();

  const handlePicked = useCallback(
    (asset?: Asset) => {
      const file = toUploadFile(asset);
      if (file) onPicked(file);
    },
    [onPicked],
  );

  const handleCamera = useCallback(async () => {
    onClose();
    if (!(await ensureCameraPermission())) return;

    const result = await launchCamera({ ...PICKER_OPTIONS, saveToPhotos: false });
    if (result?.didCancel || result?.errorCode) return;
    handlePicked(result?.assets?.[0]);
  }, [onClose, handlePicked]);

  const handleGallery = useCallback(async () => {
    onClose();

    const result = await launchImageLibrary({ ...PICKER_OPTIONS, selectionLimit: 1 });
    if (result?.didCancel || result?.errorCode) return;
    handlePicked(result?.assets?.[0]);
  }, [onClose, handlePicked]);

  const handleRemove = useCallback(() => {
    onClose();
    onRemove?.();
  }, [onClose, onRemove]);

  return (
    <CustomBottomSheet visible={visible} onClose={onClose}>
      <Text style={[styles.title, { color: theme.colors.onSurface }]}>
        {t('photoPicker.title')}
      </Text>

      <Option
        icon="camera-outline"
        label={t('photoPicker.camera')}
        onPress={handleCamera}
      />
      <Option
        icon="image-outline"
        label={t('photoPicker.gallery')}
        onPress={handleGallery}
      />
      {onRemove ? (
        <Option
          icon="trash-can-outline"
          label={t('photoPicker.remove')}
          onPress={handleRemove}
          destructive
        />
      ) : null}
    </CustomBottomSheet>
  );
});

const Option = memo<{
  icon: string;
  label: string;
  onPress: () => void;
  destructive?: boolean;
}>(function Option({ icon, label, onPress, destructive }) {
  const theme = useTheme();
  const color = destructive ? theme.colors.error : theme.colors.onSurface;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={[styles.option, { borderColor: theme.colors.outlineVariant }]}
    >
      <View
        style={[
          styles.optionIcon,
          {
            backgroundColor: destructive
              ? theme.colors.errorContainer
              : theme.colors.primaryContainer,
          },
        ]}
      >
        <Icon name={icon} size={18} color={destructive ? theme.colors.error : theme.colors.primary} />
      </View>
      <Text style={[styles.optionText, { color }]}>{label}</Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  title: {
    fontFamily: fontFamilies.bold,
    fontSize: 16,
    marginBottom: 12,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  optionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 14,
  },
});

export default PhotoPickerSheet;
