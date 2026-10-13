import React, { memo, useEffect, useRef } from 'react';
import { StyleSheet, View, StyleProp, ViewStyle } from 'react-native';
import { Button, ProgressBar, Text, useTheme, Surface } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useDownload, type DownloadConfig } from '@app/core';
import { fontFamilies } from '../theme/typography';

interface CustomDownloadButtonProps {
  /** Direct download URL */
  url: string;
  /** Saved filename including extension, e.g. "report.pdf" */
  filename: string;
  /** Button label shown in idle state */
  label?: string;
  /** Storage location: 'documents' (default, app-private) or 'cache' */
  destination?: DownloadConfig['destination'];
  /** Optional HTTP headers forwarded to the download request */
  headers?: Record<string, string>;
  /** Called once when the file is saved. Receives the local file path. */
  onSuccess?: (filePath: string) => void;
  /** Called if the download fails. Receives the error message. */
  onError?: (error: string) => void;
  style?: StyleProp<ViewStyle>;
}

const formatBytes = (bytes: number): string => {
  if (bytes <= 0) { return '0 B'; }
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
};

export const CustomDownloadButton = memo<CustomDownloadButtonProps>(function CustomDownloadButton({
  url,
  filename,
  label = 'Download',
  destination = 'documents',
  headers,
  onSuccess,
  onError,
  style,
}) {
  const theme = useTheme();
  const {
    download,
    cancel,
    openDownloadedFile,
    reset,
    isDownloading,
    progress,
    bytesReceived,
    totalBytes,
    filePath,
    error,
  } = useDownload();

  // Stable refs so effects don't re-run when callbacks change identity
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  useEffect(() => { onSuccessRef.current = onSuccess; });
  useEffect(() => { onErrorRef.current = onError; });

  useEffect(() => {
    if (filePath) { onSuccessRef.current?.(filePath); }
  }, [filePath]);

  useEffect(() => {
    if (error) { onErrorRef.current?.(error); }
  }, [error]);

  const handleDownload = () => {
    download({ url, filename, destination, headers });
  };

  // ── Downloading ──────────────────────────────────────────────────────────
  if (isDownloading) {
    const indeterminate = totalBytes === 0;
    const sizeLabel = indeterminate
      ? formatBytes(bytesReceived)
      : `${formatBytes(bytesReceived)} / ${formatBytes(totalBytes)}`;

    return (
      <Surface
        style={[styles.card, { backgroundColor: theme.colors.surfaceVariant }, style]}
        elevation={0}
      >
        <View style={styles.row}>
          <View style={styles.rowLeft}>
            <Icon name="download" size={18} color={theme.colors.primary} />
            <Text style={[styles.label, { color: theme.colors.onSurfaceVariant }]}>
              Downloading...
            </Text>
          </View>
          <View style={styles.rowRight}>
            {!indeterminate && (
              <Text style={[styles.percent, { color: theme.colors.primary }]}>
                {Math.round(progress * 100)}%
              </Text>
            )}
            <Button
              mode="text"
              compact
              textColor={theme.colors.error}
              onPress={cancel}
              style={styles.cancelBtn}
            >
              Cancel
            </Button>
          </View>
        </View>

        <ProgressBar
          progress={indeterminate ? undefined : progress}
          indeterminate={indeterminate}
          color={theme.colors.primary}
          style={styles.bar}
        />

        <Text style={[styles.bytes, { color: theme.colors.onSurfaceVariant }]}>
          {sizeLabel}
        </Text>
      </Surface>
    );
  }

  // ── Success ───────────────────────────────────────────────────────────────
  if (filePath) {
    return (
      <Surface
        style={[styles.card, { backgroundColor: theme.colors.secondaryContainer }, style]}
        elevation={0}
      >
        <View style={[styles.row, styles.statusRow]}>
          <Icon name="check-circle-outline" size={20} color={theme.colors.secondary} />
          <Text style={[styles.statusText, { color: theme.colors.onSecondaryContainer }]}>
            Download complete
          </Text>
        </View>
        <View style={styles.buttonRow}>
          <Button
            mode="contained-tonal"
            icon="open-in-app"
            onPress={() => openDownloadedFile(filename)}
            style={styles.halfBtn}
            compact
          >
            Open
          </Button>
          <Button
            mode="text"
            icon="refresh"
            onPress={reset}
            style={styles.halfBtn}
            compact
          >
            Re-download
          </Button>
        </View>
      </Surface>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <Surface
        style={[styles.card, { backgroundColor: theme.colors.errorContainer }, style]}
        elevation={0}
      >
        <View style={[styles.row, styles.statusRow]}>
          <Icon name="alert-circle-outline" size={20} color={theme.colors.error} />
          <Text
            style={[styles.statusText, { color: theme.colors.onErrorContainer }]}
            numberOfLines={2}
          >
            {error}
          </Text>
        </View>
        <Button
          mode="contained-tonal"
          icon="refresh"
          onPress={handleDownload}
          buttonColor={theme.colors.errorContainer}
          textColor={theme.colors.error}
          style={styles.retryBtn}
        >
          Retry
        </Button>
      </Surface>
    );
  }

  // ── Idle ─────────────────────────────────────────────────────────────────
  return (
    <Button mode="outlined" icon="download" onPress={handleDownload} style={style}>
      {label}
    </Button>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  label: {
    fontFamily: fontFamilies.semibold,
    fontSize: 14,
  },
  percent: {
    fontFamily: fontFamilies.bold,
    fontSize: 14,
  },
  cancelBtn: {
    marginRight: -8,
  },
  bar: {
    height: 6,
    borderRadius: 3,
  },
  bytes: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
    marginTop: 6,
  },
  statusRow: {
    gap: 8,
    justifyContent: 'flex-start',
  },
  statusText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 14,
    flex: 1,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  halfBtn: {
    flex: 1,
  },
  retryBtn: {
    alignSelf: 'flex-start',
  },
});
