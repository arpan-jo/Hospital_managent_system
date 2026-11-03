import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { RouteProp, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Pdf from 'react-native-pdf';
import {
  fileExtensionLabel,
  fileKindOfType,
  fileNameForType,
  getFileHeaders,
  startDownload,
  useDownload,
  useStores,
} from '@app/core';
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
  /** A second line under the title. */
  subtitle?: string;
  /** Offer a download button in the header. */
  canDownload?: boolean;
  /** The uploader's note on the file, shown under it as on the web. */
  notes?: string;
  /** Read the file afresh each time — it is drawn on request and can change. */
  fresh?: boolean;
  /**
   * The server, not the name, says what the file is: a test report from its
   * ".../pdf" route can be an uploaded image. The file is fetched once, then
   * drawn — and named for download — by the type it came with.
   */
  typeFromServer?: boolean;
}

/** A fetched copy, and the type the server sent it as. */
interface ServedFile {
  path: string;
  contentType: string;
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
    notes = '',
    fresh = false,
    typeFromServer = false,
  }: Partial<FileViewerParams> = route.params ?? {};
  const noteText = String(notes ?? '').trim();
  const { download, isDownloading } = useDownload();
  const { toastStore } = useStores();
  const [isLoading, setLoading] = useState(true);
  const [hasFailed, setFailed] = useState(false);
  const [served, setServed] = useState<ServedFile | null>(null);
  useFocusedStatusBar(theme.dark ? 'light-content' : 'dark-content');

  const handleLoaded = useCallback(() => setLoading(false), []);

  const handleFailed = useCallback(() => {
    setLoading(false);
    setFailed(true);
  }, []);

  // Fetched into the cache, where the viewer reads it — always afresh, so a
  // re-drawn report is never an old copy.
  useEffect(() => {
    if (!typeFromServer || !url) return undefined;
    let isActive = true;
    const task = startDownload({ url, filename: filename || 'file', destination: 'cache' });
    task.promise
      .then(result => {
        if (isActive) {
          setServed({ path: result?.filePath ?? '', contentType: result?.contentType ?? '' });
        }
      })
      .catch((error: any) => {
        if (!isActive) return;
        console.log('file viewer fetch error ==>', error?.message);
        handleFailed();
      });
    return () => {
      isActive = false;
      task.cancel();
    };
  }, [typeFromServer, url, filename, handleFailed]);

  const isFetching = typeFromServer && !served && !hasFailed;

  // A type the server named decides; otherwise the name carries the
  // extension, and the URL is the fallback for rows sent without one, since
  // the blob name keeps it too.
  const kind = useMemo(() => {
    const byType = typeFromServer ? fileKindOfType(served?.contentType) : null;
    if (byType) return byType;
    const byName = toFileKind(filename);
    return byName === 'other' ? toFileKind(url) : byName;
  }, [typeFromServer, served, filename, url]);

  // Saved under what it really is — an image report as `.jpg`, not `.pdf`.
  const saveName = typeFromServer ? fileNameForType(filename || 'file', served?.contentType) : filename;

  const source = useMemo(() => {
    if (!typeFromServer) return { uri: url, headers: getFileHeaders(url) };
    const path = served?.path ?? '';
    if (!path) return null;
    return { uri: /^[a-z]+:\/\//i.test(path) ? path : `file://${path}` };
  }, [typeFromServer, served, url]);

  const canRender = Boolean(url) && Boolean(source) && kind !== 'other' && !hasFailed;
  // A file that would not load would not download either.
  const canSave = canDownload && Boolean(url) && !hasFailed && !isFetching;

  const handleDownload = useCallback(async () => {
    if (!url || isDownloading) return;
    const { filePath, serverMessage } = await download({ url, filename: saveName || 'file' });
    toastStore.show(
      filePath ? t('fileViewer.downloaded') : serverMessage || t('fileViewer.downloadFailed'),
      filePath ? 'success' : 'error',
    );
  }, [url, saveName, isDownloading, download, toastStore, t]);

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
          canSave ? (
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
        {isFetching ? (
          <View style={styles.overlay} pointerEvents="none">
            <ActivityIndicator size="small" color={theme.colors.primary} />
          </View>
        ) : canRender && source ? (
          <>
            {kind === 'pdf' ? (
              <Pdf
                // Stored files are authenticated — see `getFileHeaders`.
                source={{ ...source, cache: !fresh }}
                trustAllCerts={false}
                style={styles.viewer}
                onLoadComplete={handleLoaded}
                onError={handleFailed}
              />
            ) : (
              <Image
                source={source}
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
                    type: fileExtensionLabel(saveName || url) || t('fileViewer.thisFile'),
                  })}
            </Text>

            {/* A file the app can't draw (an SVG, a Word file) can still be saved. */}
            {canSave ? (
              <CustomButton
                mode="outlined"
                icon="download-outline"
                onPress={handleDownload}
                loading={isDownloading}
                style={styles.fallbackButton}
              >
                {t('fileViewer.download')}
              </CustomButton>
            ) : null}
          </View>
        )}
      </View>

      {noteText ? (
        <View style={[styles.notes, { backgroundColor: theme.colors.surfaceVariant }]}>
          <Text style={[styles.notesText, { color: theme.colors.onSurfaceVariant }]}>
            <Text style={[styles.notesLabel, { color: theme.colors.onSurface }]}>
              {t('fileViewer.notes')}
            </Text>
            {noteText}
          </Text>
        </View>
      ) : null}
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
  fallbackButton: {
    marginTop: 4,
  },
  notes: {
    marginHorizontal: 16,
    marginBottom: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
  },
  notesText: {
    fontFamily: fontFamilies.regular,
    fontSize: 13,
    lineHeight: 19,
  },
  notesLabel: {
    fontFamily: fontFamilies.semibold,
  },
});

export default FileViewerScreen;
