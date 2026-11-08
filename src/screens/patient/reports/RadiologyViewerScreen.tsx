import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Modal, Portal, Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { RouteProp, useRoute } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Canvas, Image as SkiaImage } from '@shopify/react-native-skia';
import { CT_WINDOW_PRESETS, RadiologySeries, WindowLevel, autoWindow, useStores } from '@app/core';
import { CustomButton, fontFamilies } from '@app/ui';
import ScreenHeader from '../../../components/ScreenHeader';
import { useFocusedStatusBar } from '../../../hooks/useFocusedStatusBar';
import { TAB_BAR_CLEARANCE } from '../../../navigation/tabBarLayout';
import DicomCanvas, { DicomTool, Measurement } from './DicomCanvas';
import { useRadiologyViewer } from './useRadiologyViewer';

export interface RadiologyViewerParams {
  /** The radiology test — its images are looked up afresh on every open. */
  billRowId: number;
  title?: string;
  subtitle?: string;
}

type RadiologyViewerRoute = RouteProp<{ RadiologyViewer: RadiologyViewerParams }, 'RadiologyViewer'>;

/** Text over the frame — white on black, whatever the app's theme. */
const ON_STAGE = '#FFF';
const STAGE_COLOR = '#000';

const TOOLS: { key: DicomTool; icon: string; labelKey: string; hintKey: string }[] = [
  { key: 'scroll', icon: 'layers-triple-outline', labelKey: 'reports.toolScroll', hintKey: 'reports.hintScroll' },
  { key: 'window', icon: 'contrast-box', labelKey: 'reports.toolWindow', hintKey: 'reports.hintWindow' },
  { key: 'measure', icon: 'ruler', labelKey: 'reports.toolMeasure', hintKey: 'reports.hintMeasure' },
];

/**
 * A radiology test's images as DICOM: the stored pixels windowed on the phone — drag for
 * contrast and brightness, presets for CT — Hounsfield units under a long press, lengths in
 * millimetres, invert, cine for a stack, and the DICOM attributes. The full PACS viewer
 * stays a tap away in the header.
 */
export const RadiologyViewerScreen = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const { toastStore } = useStores();
  const route = useRoute<RadiologyViewerRoute>();
  const { billRowId = 0, title = '', subtitle = '' } = route.params ?? {};
  const insets = useSafeAreaInsets();
  const viewer = useRadiologyViewer(billRowId);
  const { current, frame, loaded, baseWindow, sliceIndex, sliceCount } = viewer;
  useFocusedStatusBar(theme.dark ? 'light-content' : 'dark-content');

  const canWindowFrame = Boolean(loaded?.isWindowed);
  const [tool, setTool] = useState<DicomTool>('scroll');
  const [invert, setInvert] = useState(false);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [fitRequest, setFitRequest] = useState(0);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [presetKey, setPresetKey] = useState('default');

  /** The window the canvas shows — set by a preset, or reported back when a drag ends. */
  const [windowShown, setWindowShown] = useState<WindowLevel | null>(null);

  const applyWindow = useCallback((next: WindowLevel, key: string) => {
    setWindowShown(next);
    setPresetKey(key);
  }, []);

  // A series opens with its own window, its first tool, and nothing measured.
  const openedSeriesRef = useRef('');
  useEffect(() => {
    if (!current?.uid || !baseWindow || openedSeriesRef.current === current.uid) return;
    openedSeriesRef.current = current.uid;
    applyWindow(baseWindow, 'default');
  }, [current?.uid, baseWindow, applyWindow]);
  useEffect(() => {
    setTool(sliceCount > 1 ? 'scroll' : 'window');
    setInvert(false);
  }, [current?.uid, sliceCount]);
  // A length belongs to the frame it was drawn on.
  useEffect(() => setMeasurements([]), [current?.uid, sliceIndex]);
  // A colour frame has no window to set.
  useEffect(() => {
    if (loaded && !canWindowFrame && tool === 'window') setTool(sliceCount > 1 ? 'scroll' : 'measure');
  }, [loaded, canWindowFrame, tool, sliceCount]);

  const presets = [
    { key: 'default', labelKey: 'reports.presetDefault', window: baseWindow },
    { key: 'auto', labelKey: 'reports.presetAuto', window: loaded?.range ? autoWindow(loaded.range) : null },
    ...(current?.modality === 'CT'
      ? CT_WINDOW_PRESETS.map(preset => ({
          key: preset.key,
          labelKey: `reports.preset_${preset.key}`,
          window: { center: preset.center, width: preset.width },
        }))
      : []),
  ];

  const onWindowChanged = useCallback((next: WindowLevel) => {
    setWindowShown(next);
    setPresetKey('');
  }, []);
  const onMeasured = useCallback((line: Measurement) => setMeasurements(list => [...list, line]), []);

  const handleOpenInBrowser = useCallback(async () => {
    try {
      await viewer.openInBrowser();
    } catch (error: any) {
      console.log('radiology browser viewer error ==>', error?.message);
      toastStore.show(t('reports.imagesFailed'), 'error');
    }
  }, [viewer, toastStore, t]);

  const tools = TOOLS.filter(
    item => (item.key !== 'scroll' || sliceCount > 1) && (item.key !== 'window' || canWindowFrame),
  );
  const activeHint = TOOLS.find(item => item.key === tool)?.hintKey;

  const renderSeries = useCallback(
    ({ item, index }: { item: RadiologySeries; index: number }) => {
      const isSelected = index === viewer.seriesIndex;
      const thumbnail = viewer.thumbnailOf(item);
      return (
        <Pressable
          onPress={() => viewer.selectSeries(index)}
          accessibilityRole="button"
          accessibilityState={{ selected: isSelected }}
          accessibilityLabel={item?.description || item?.modality || t('reports.series')}
          style={[styles.thumb, isSelected ? { borderColor: theme.colors.primary } : null]}
        >
          {thumbnail ? (
            <Canvas style={styles.thumbImage}>
              <SkiaImage image={thumbnail} x={0} y={0} width={68} height={68} fit="cover" />
            </Canvas>
          ) : null}
          <View style={styles.thumbLabel}>
            <Text style={styles.thumbText} numberOfLines={1}>
              {[item?.modality, item?.frames?.length].filter(Boolean).join(' · ')}
            </Text>
          </View>
        </Pressable>
      );
    },
    [viewer, theme.colors.primary, t],
  );

  const renderBody = () => {
    if (viewer.status === 'loading') {
      return (
        <View style={styles.center}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
        </View>
      );
    }

    if (viewer.status !== 'ready' || !current) {
      const hasFailed = viewer.status === 'failed';
      return (
        <View style={styles.center}>
          <View style={[styles.fallbackIcon, { backgroundColor: theme.colors.primaryContainer }]}>
            <Icon name={hasFailed ? 'image-broken-variant' : 'image-off-outline'} size={24} color={theme.colors.primary} />
          </View>
          <Text style={[styles.fallbackTitle, { color: theme.colors.onSurface }]}>
            {viewer.message || t(hasFailed ? 'reports.imagesFailed' : 'reports.noImages')}
          </Text>
          {hasFailed ? (
            <CustomButton mode="outlined" icon="refresh" onPress={viewer.load}>
              {t('common.retry')}
            </CustomButton>
          ) : null}
        </View>
      );
    }

    return (
      <>
        <DicomCanvas
          loaded={loaded}
          info={frame?.info ?? null}
          probe={viewer.probeValue}
          windowLevel={windowShown}
          windowSpan={loaded?.range ? Math.max(loaded.range.max - loaded.range.min, 1) : 1}
          onWindowChanged={onWindowChanged}
          invert={invert}
          tool={tool}
          sliceIndex={sliceIndex}
          sliceCount={sliceCount}
          onScrollTo={viewer.goToSlice}
          measurements={measurements}
          onMeasured={onMeasured}
          resetKey={current?.uid ?? ''}
          fitRequest={fitRequest}
        >
          <View style={styles.overlayTop} pointerEvents="none">
            <Text style={styles.overlayText} numberOfLines={1}>
              {[current?.modality, current?.description].filter(Boolean).join(' · ')}
            </Text>
            {sliceCount > 1 ? <Text style={styles.overlayText}>{`${sliceIndex + 1} / ${sliceCount}`}</Text> : null}
          </View>
          <View style={styles.overlayBottom} pointerEvents="none">
            {canWindowFrame && windowShown ? (
              <Text style={styles.overlayText}>
                {t('reports.windowLabel', {
                  width: Math.round(windowShown.width),
                  center: Math.round(windowShown.center),
                })}
              </Text>
            ) : null}
          </View>
          {!loaded ? (
            <View style={styles.stageSpinner} pointerEvents="none">
              <ActivityIndicator size="small" color={ON_STAGE} />
            </View>
          ) : null}
        </DicomCanvas>

        {canWindowFrame ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.presets}
            style={styles.presetStrip}
          >
            {presets.map(preset => {
              const isSelected = preset.key === presetKey;
              return (
                <Pressable
                  key={preset.key}
                  disabled={!preset.window}
                  onPress={() => preset.window && applyWindow(preset.window, preset.key)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected, disabled: !preset.window }}
                  style={[
                    styles.preset,
                    { backgroundColor: isSelected ? theme.colors.primary : theme.colors.surfaceVariant },
                  ]}
                >
                  <Text
                    style={[
                      styles.presetText,
                      { color: isSelected ? theme.colors.onPrimary : theme.colors.onSurfaceVariant },
                    ]}
                  >
                    {t(preset.labelKey)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        <View style={styles.toolbar}>
          {tools.map(item => (
            <ToolButton
              key={item.key}
              icon={item.icon}
              label={t(item.labelKey)}
              isActive={tool === item.key}
              onPress={() => setTool(item.key)}
            />
          ))}
          <View style={[styles.divider, { backgroundColor: theme.colors.outlineVariant }]} />
          {canWindowFrame ? (
            <ToolButton icon="invert-colors" label={t('reports.invert')} isActive={invert} onPress={() => setInvert(on => !on)} />
          ) : null}
          <ToolButton icon="fit-to-screen-outline" label={t('reports.resetZoom')} onPress={() => setFitRequest(n => n + 1)} />
          {measurements.length ? (
            <ToolButton icon="eraser" label={t('reports.clearMeasurements')} onPress={() => setMeasurements([])} />
          ) : null}
          {sliceCount > 1 ? (
            <ToolButton
              icon={viewer.isPlaying ? 'pause' : 'play'}
              label={t(viewer.isPlaying ? 'reports.pause' : 'reports.play')}
              isActive={viewer.isPlaying}
              onPress={viewer.togglePlay}
            />
          ) : null}
        </View>

        {activeHint ? (
          <Text style={[styles.hint, { color: theme.colors.onSurfaceVariant }]}>{t(activeHint)}</Text>
        ) : null}

        {viewer.series.length > 1 ? (
          <FlatList
            horizontal
            data={viewer.series}
            keyExtractor={item => item?.uid}
            renderItem={renderSeries}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.seriesList}
            style={styles.seriesStrip}
          />
        ) : null}
      </>
    );
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScreenHeader
        title={title || t('reports.viewImages')}
        subtitle={subtitle || undefined}
        leading="back"
        right={
          <View style={styles.headerActions}>
            {current?.tags?.length ? (
              <HeaderButton icon="information-outline" label={t('reports.dicomInfo')} onPress={() => setIsInfoOpen(true)} />
            ) : null}
            <HeaderButton icon="open-in-new" label={t('reports.openFullViewer')} onPress={handleOpenInBrowser} />
          </View>
        }
      />
      {/* The tab bar floats over the screen's foot — the controls sit above it. */}
      <View style={[styles.fill, { paddingBottom: insets.bottom + TAB_BAR_CLEARANCE }]}>{renderBody()}</View>

      <Portal>
        <Modal
          visible={isInfoOpen}
          onDismiss={() => setIsInfoOpen(false)}
          contentContainerStyle={[styles.sheet, { backgroundColor: theme.colors.surface }]}
        >
          <Text style={[styles.sheetTitle, { color: theme.colors.onSurface }]}>{t('reports.dicomInfo')}</Text>
          <ScrollView>
            {(current?.tags ?? []).map(line => (
              <View key={line.keyword} style={[styles.tagRow, { borderBottomColor: theme.colors.outlineVariant }]}>
                <Text style={[styles.tagKey, { color: theme.colors.onSurfaceVariant }]}>{line.keyword}</Text>
                <Text style={[styles.tagValue, { color: theme.colors.onSurface }]} selectable>
                  {line.value}
                </Text>
              </View>
            ))}
          </ScrollView>
        </Modal>
      </Portal>
    </SafeAreaView>
  );
};

const HeaderButton = ({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) => {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.headerButton, { backgroundColor: theme.colors.primaryContainer }]}
    >
      <Icon name={icon} size={20} color={theme.colors.primary} />
    </Pressable>
  );
};

const ToolButton = ({
  icon,
  label,
  onPress,
  isActive,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  isActive?: boolean;
}) => {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!isActive }}
      style={[styles.tool, { backgroundColor: isActive ? theme.colors.primary : theme.colors.surfaceVariant }]}
    >
      <Icon name={icon} size={21} color={isActive ? theme.colors.onPrimary : theme.colors.onSurfaceVariant} />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  fill: {
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
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
  overlayTop: {
    position: 'absolute',
    top: 10,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  overlayBottom: {
    position: 'absolute',
    right: 12,
    bottom: 10,
  },
  overlayText: {
    flexShrink: 1,
    color: ON_STAGE,
    fontFamily: fontFamilies.semibold,
    fontSize: 12,
    textShadowColor: STAGE_COLOR,
    textShadowRadius: 3,
  },
  stageSpinner: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetStrip: {
    flexGrow: 0,
  },
  presets: {
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  preset: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
  },
  presetText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 12,
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    paddingTop: 10,
  },
  tool: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    width: 1,
    height: 24,
  },
  hint: {
    textAlign: 'center',
    fontFamily: fontFamilies.regular,
    fontSize: 12,
    paddingTop: 8,
    paddingHorizontal: 16,
  },
  seriesStrip: {
    flexGrow: 0,
  },
  seriesList: {
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
    overflow: 'hidden',
    backgroundColor: STAGE_COLOR,
  },
  thumbImage: {
    ...StyleSheet.absoluteFill,
  },
  thumbLabel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 4,
    paddingVertical: 2,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  thumbText: {
    color: ON_STAGE,
    fontFamily: fontFamilies.semibold,
    fontSize: 10,
    textAlign: 'center',
  },
  sheet: {
    margin: 20,
    maxHeight: '75%',
    borderRadius: 16,
    padding: 18,
  },
  sheetTitle: {
    fontFamily: fontFamilies.semibold,
    fontSize: 16,
    marginBottom: 10,
  },
  tagRow: {
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tagKey: {
    fontFamily: fontFamilies.regular,
    fontSize: 11,
  },
  tagValue: {
    fontFamily: fontFamilies.semibold,
    fontSize: 13,
  },
});

export default RadiologyViewerScreen;
