import React, { useCallback, useMemo, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { RouteProp, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Pdf from 'react-native-pdf';
import { fileExtensionLabel, getFileHeaders, useDocumentViewer } from '@app/core';
import { CustomButton, fontFamilies } from '@app/ui';
import ScreenHeader from '../../../components/ScreenHeader';
import { useFocusedStatusBar } from '../../../hooks/useFocusedStatusBar';

/** What a screen needs to open one file — the same shape every stack passes. */
export interface FileViewerParams {
  /** The full download URL, already run through `getFileUrl`. */
  url: string;
  /** The file's own name — the extension on it decides how this renders. */
  filename?: string;
  /** Shown in the header; falls back to the filename. */
  title?: string;
}

type FileViewerRoute = RouteProp<{ FileViewer: FileViewerParams }, 'FileViewer'>;

const IMAGE_EXTENSIONS = ['JPG', 'JPEG', 'PNG', 'GIF', 'WEBP', 'BMP', 'HEIC'];

/**
 * A file is rendered in the app when it is something the app can draw — a PDF
 * or an image. Anything else (a Word file, a spreadsheet) is handed to the
 * phone's own viewer, which is the only thing that knows how to open it.
 */
const toFileKind = (name: string): 'pdf' | 'image' | 'other' => {
  const extension = fileExtensionLabel(name);
  if (extension === 'PDF') return 'pdf';
  return IMAGE_EXTENSIONS.includes(extension) ? 'image' : 'other';
};

/**
 * Opens one attached document. PDFs used to go out to whatever app the phone
 * had — and on a phone with none, nothing happened at all — so they are drawn
 * here instead, beside the images that already were.
 */
export const FileViewerScreen = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const route = useRoute<FileViewerRoute>();
  // Params are read defensively: a deep link can land here without them.
  const { url = '', filename = '', title = '' }: Partial<FileViewerParams> =
    route.params ?? {};
  const { view } = useDocumentViewer();
  const [isLoading, setLoading] = useState(true);
  const [hasFailed, setFailed] = useState(false);
  useFocusedStatusBar(theme.dark ? 'light-content' : 'dark-content');

  // The name carries the extension; the URL is the fallback for rows sent
  // without one, since the blob name keeps it too.
  const kind = useMemo(() => {
    const byName = toFileKind(filename);
    return byName === 'other' ? toFileKind(url) : byName;
  }, [filename, url]);

  const handleLoaded = useCallback(() => setLoading(false), []);

  const handleFailed = useCallback(() => {
    setLoading(false);
    setFailed(true);
  }, []);

  /** The phone's own viewer — the only way out for a file this screen cannot draw. */
  const handleOpenExternally = useCallback(
    () => view({ uri: url, filename: filename || undefined }),
    [view, url, filename],
  );

  const canRender = Boolean(url) && kind !== 'other' && !hasFailed;

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <ScreenHeader title={title || filename || t('fileViewer.title')} leading="back" />

      <View style={[styles.stage, { backgroundColor: theme.colors.surfaceVariant }]}>
        {canRender ? (
          <>
            {kind === 'pdf' ? (
              <Pdf
                // Stored files are authenticated — see `getFileHeaders`.
                source={{ uri: url, cache: true, headers: getFileHeaders(url) }}
                trustAllCerts={false}
                style={styles.viewer}
                onLoadComplete={handleLoaded}
                onError={handleFailed}
              />
            ) : (
              <Image
                source={{ uri: url, headers: getFileHeaders(url) }}
                resizeMode="contain"
                style={styles.viewer}
                onLoadEnd={handleLoaded}
                onError={handleFailed}
              />
            )}

            {isLoading ? (
              <View style={styles.overlay} pointerEvents="none">
                <ActivityIndicator size="small" color={theme.colors.primary} />
              </View>
            ) : null}
          </>
        ) : (
          <View style={styles.fallback}>
            <View style={[styles.fallbackIcon, { backgroundColor: theme.colors.primaryContainer }]}>
              <Icon name="file-question-outline" size={24} color={theme.colors.primary} />
            </View>

            <Text style={[styles.fallbackText, { color: theme.colors.onSurfaceVariant }]}>
              {t(hasFailed ? 'fileViewer.failed' : 'fileViewer.unsupported')}
            </Text>

            {url ? (
              <CustomButton mode="contained" icon="open-in-new" onPress={handleOpenExternally}>
                {t('fileViewer.openExternally')}
              </CustomButton>
            ) : null}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  stage: {
    flex: 1,
    margin: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  viewer: {
    flex: 1,
    // The stage already paints the ground; a viewer with its own would show
    // through the rounded corners.
    backgroundColor: 'transparent',
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 32,
  },
  fallbackIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackText: {
    fontFamily: fontFamilies.regular,
    fontSize: 13,
    textAlign: 'center',
  },
});

export default FileViewerScreen;
