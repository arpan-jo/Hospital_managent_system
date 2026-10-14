import React, { useCallback, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { RouteProp, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Pdf from 'react-native-pdf';
import { fileExtensionLabel, getFileHeaders, useDownload, useStores } from '@app/core';
import { fontFamilies } from '@app/ui';
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
  /** A second line under the title. */
  subtitle?: string;
  /** Offer a download button in the header. */
  canDownload?: boolean;
  /** Read the file afresh each time — it is drawn on request and can change. */
  fresh?: boolean;
}

type FileViewerRoute = RouteProp<{ FileViewer: FileViewerParams }, 'FileViewer'>;

const IMAGE_EXTENSIONS = ['JPG', 'JPEG', 'PNG', 'GIF', 'WEBP', 'BMP', 'HEIC'];

/**
 * A file is rendered in the app when it is something the app can draw — a PDF
 * or an image. Anything else (a Word file, a spreadsheet) gets a message, and
 * the download button where the screen offers one.
 */
const toFileKind = (name: string): 'pdf' | 'image' | 'other' => {
  const extension = fileExtensionLabel(name);
  if (extension === 'PDF') return 'pdf';
  return IMAGE_EXTENSIONS.includes(extension) ? 'image' : 'other';
};

/**
 * Opens one file — a PDF or an image — in the app. One that cannot be shown,
 * or fails to load, gets a message on the screen; it is never handed to
 * another app.
 */
export const FileViewerScreen = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const route = useRoute<FileViewerRoute>();
  // Params are read defensively: a deep link can land here without them.
  const {
    url = '',
    filename = '',
    title = '',
    subtitle = '',
    canDownload = false,
    fresh = false,
  }: Partial<FileViewerParams> = route.params ?? {};
  const { download, isDownloading } = useDownload();
  const { toastStore } = useStores();
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

  const canRender = Boolean(url) && kind !== 'other' && !hasFailed;

  const handleDownload = useCallback(async () => {
    if (!url || isDownloading) return;
    const { filePath, serverMessage } = await download({ url, filename: filename || 'file' });
    toastStore.show(
      filePath ? t('fileViewer.downloaded') : serverMessage || t('fileViewer.downloadFailed'),
      filePath ? 'success' : 'error',
    );
  }, [url, filename, isDownloading, download, toastStore, t]);

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <ScreenHeader
        title={title || filename || t('fileViewer.title')}
        subtitle={subtitle || undefined}
        leading="back"
        right={
          // A file that would not load would not download either.
          canDownload && url && !hasFailed ? (
            <Pressable
              onPress={handleDownload}
              disabled={isDownloading}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('fileViewer.download')}
              style={[styles.download, { backgroundColor: theme.colors.primaryContainer }]}
            >
              {isDownloading ? (
                <ActivityIndicator size={16} color={theme.colors.primary} />
              ) : (
                <Icon name="download-outline" size={20} color={theme.colors.primary} />
              )}
            </Pressable>
          ) : undefined
        }
      />

      <View style={[styles.stage, { backgroundColor: theme.colors.surfaceVariant }]}>
        {canRender ? (
          <>
            {kind === 'pdf' ? (
              <Pdf
                // Stored files are authenticated — see `getFileHeaders`.
                source={{ uri: url, cache: !fresh, headers: getFileHeaders(url) }}
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

            <Text style={[styles.fallbackTitle, { color: theme.colors.onSurface }]}>
              {t(hasFailed ? 'fileViewer.failed' : 'fileViewer.unsupported')}
            </Text>
            <Text style={[styles.fallbackText, { color: theme.colors.onSurfaceVariant }]}>
              {hasFailed
                ? t('fileViewer.failedHint')
                : t('fileViewer.unsupportedHint', {
                    type: fileExtensionLabel(filename || url) || t('fileViewer.thisFile'),
                  })}
            </Text>
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
  download: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
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
  fallbackTitle: {
    fontFamily: fontFamilies.semibold,
    fontSize: 15,
    textAlign: 'center',
  },
  fallbackText: {
    fontFamily: fontFamilies.regular,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
});

export default FileViewerScreen;
