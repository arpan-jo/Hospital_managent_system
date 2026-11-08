import React, { useCallback, useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import {
  Canvas,
  Circle,
  FilterMode,
  Group,
  Image as SkiaImage,
  ImageShader,
  Line,
  MipmapMode,
  Rect,
  Shader,
  Skia,
  SkRuntimeEffect,
} from '@shopify/react-native-skia';
import {
  GestureDetector,
  GestureHandlerRootView,
  useLongPressGesture,
  usePanGesture,
  usePinchGesture,
  useSimultaneousGestures,
  useTapGesture,
} from 'react-native-gesture-handler';
import { useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated';
import { DicomFrameInfo, WINDOW_SHADER, WindowLevel, distanceMm } from '@app/core';
import { fontFamilies } from '@app/ui';
import { LoadedFrame } from './useRadiologyViewer';

export type DicomTool = 'scroll' | 'window' | 'measure';

/** A length drawn on the frame, in its pixel coordinates. */
export interface Measurement {
  from: { x: number; y: number };
  to: { x: number; y: number };
}

interface DicomCanvasProps {
  loaded: LoadedFrame | null;
  info: DicomFrameInfo | null;
  /** The value under a frame pixel, for the long-press readout. */
  probe: (x: number, y: number) => number | null;
  /** The window to show; a new object applies it. A drag changes it here and reports it back. */
  windowLevel: WindowLevel | null;
  /** How far a full-width drag moves the window — the frame's value range. */
  windowSpan: number;
  onWindowChanged: (window: WindowLevel) => void;
  invert: boolean;
  tool: DicomTool;
  sliceIndex: number;
  sliceCount: number;
  onScrollTo: (index: number) => void;
  measurements: Measurement[];
  onMeasured: (measurement: Measurement) => void;
  /** Changes when the series does — the view goes back to fit. */
  resetKey: string;
  /** Bumped by the screen's "fit" button. */
  fitRequest: number;
  /** Corner text drawn over the frame. */
  children?: React.ReactNode;
}

/**
 * Compiled on first use, not at import: the app imports this screen while `@app/core` is
 * still loading, and the shader source would not be there yet.
 */
let windowEffect: SkRuntimeEffect | null = null;
const getWindowEffect = () => (windowEffect ??= Skia.RuntimeEffect.Make(WINDOW_SHADER));
const MAX_ZOOM = 10;
const DOUBLE_TAP_ZOOM = 2.5;
const STAGE_COLOR = '#000';
const MEASURE_COLOR = '#FFD54F';
/** Exact texels: a stored value is split across two channels, so they must never be blended. */
const NEAREST = { filter: FilterMode.Nearest, mipmap: MipmapMode.None };

/**
 * One DICOM frame on black. Two fingers always pinch and pan; one finger does the chosen
 * tool — scroll the stack, set the window (across: width, down: level), or measure. A long
 * press reads the value under the finger (Hounsfield units on CT); a double tap zooms.
 *
 * Gesture handlers are wrapped in useCallback and run on the JS thread: written inline, the
 * worklets plugin would copy everything they capture — a whole frame's pixels included.
 */
export const DicomCanvas = ({
  loaded,
  info,
  probe,
  windowLevel,
  windowSpan,
  onWindowChanged,
  invert,
  tool,
  sliceIndex,
  sliceCount,
  onScrollTo,
  measurements,
  onMeasured,
  resetKey,
  fitRequest,
  children,
}: DicomCanvasProps) => {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [drawing, setDrawing] = useState<Measurement | null>(null);
  const [readout, setReadout] = useState<{ x: number; y: number; text: string } | null>(null);

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);
  const dragStart = useSharedValue({ slice: 0, center: 0, width: 1 });
  // The window as shared values: a drag redraws on the UI thread, not through React.
  const windowCenter = useSharedValue(windowLevel?.center ?? 0);
  const windowWidth = useSharedValue(windowLevel?.width ?? 1);
  useEffect(() => {
    if (!windowLevel) return;
    windowCenter.value = windowLevel.center;
    windowWidth.value = Math.max(1, windowLevel.width);
  }, [windowLevel, windowCenter, windowWidth]);

  const imageWidth = loaded?.image?.width() ?? info?.columns ?? 1;
  const imageHeight = loaded?.image?.height() ?? info?.rows ?? 1;
  const fit = size.width && size.height ? Math.min(size.width / imageWidth, size.height / imageHeight) : 1;
  const offsetX = (size.width - imageWidth * fit) / 2;
  const offsetY = (size.height - imageHeight * fit) / 2;
  /** Stored pixels sit at the frame's size; a JPEG may be rendered at another. */
  const toFramePixels = info && loaded?.isWindowed ? 1 : info ? info.columns / imageWidth : 1;

  const resetView = useCallback(() => {
    scale.value = withTiming(1);
    translateX.value = withTiming(0);
    translateY.value = withTiming(0);
  }, [scale, translateX, translateY]);

  useEffect(() => {
    resetView();
    setReadout(null);
  }, [resetKey, fitRequest, resetView]);

  /**
   * What the gesture handlers read. They are made once and read this instead: a handler that
   * changed mid-drag (say, because the drag itself moved to another slice) would make the
   * gesture be configured again, which ends the drag.
   */
  const live = useRef({ tool, sliceIndex, sliceCount, size, fit, offsetX, offsetY, toFramePixels, windowSpan, info, probe });
  live.current = { tool, sliceIndex, sliceCount, size, fit, offsetX, offsetY, toFramePixels, windowSpan, info, probe };
  const callbacks = useRef({ onScrollTo, onWindowChanged, onMeasured });
  callbacks.current = { onScrollTo, onWindowChanged, onMeasured };
  /** The length being drawn — in a ref too, as the end of a drag comes before React renders it. */
  const drawingRef = useRef<Measurement | null>(null);
  const updateDrawing = useCallback((line: Measurement | null) => {
    drawingRef.current = line;
    setDrawing(line);
  }, []);

  // A screen point → the frame's pixel coordinates, undoing zoom, pan and fit.
  const toImage = useCallback(
    (x: number, y: number) => {
      const { size: box, fit: fitScale, offsetX: left, offsetY: top, toFramePixels: perPixel } = live.current;
      const cx = box.width / 2;
      const cy = box.height / 2;
      const zoomedX = (x - translateX.value - cx) / scale.value + cx;
      const zoomedY = (y - translateY.value - cy) / scale.value + cy;
      return { x: ((zoomedX - left) / fitScale) * perPixel, y: ((zoomedY - top) / fitScale) * perPixel };
    },
    [translateX, translateY, scale],
  );

  const transform = useDerivedValue(() => [
    { translateX: translateX.value + size.width / 2 },
    { translateY: translateY.value + size.height / 2 },
    { scale: scale.value },
    { translateX: offsetX - size.width / 2 },
    { translateY: offsetY - size.height / 2 },
    { scale: fit },
  ]);
  /** Measurements are drawn in frame pixels; their lines stay 2 points wide at any zoom. */
  const strokeWidth = useDerivedValue(() => 2 / (scale.value * fit * (1 / toFramePixels)));
  const handleRadius = useDerivedValue(() => 4 / (scale.value * fit * (1 / toFramePixels)));

  const uniforms = useDerivedValue(() => ({
    center: windowCenter.value,
    width: windowWidth.value,
    slope: info?.rescaleSlope ?? 1,
    intercept: info?.rescaleIntercept ?? 0,
    bitsStored: info?.bitsStored ?? 16,
    isSigned: info?.isSigned ? 1 : 0,
    // MONOCHROME1 stores white as low: drawn inverted, and the button flips it back.
    invert: (info?.photometric === 'MONOCHROME1') !== invert ? 1 : 0,
  }));

  // ── Pinch and two-finger pan: always the view ──────────────────────────────────────────
  const onPinchStart = useCallback(() => {
    savedScale.value = scale.value;
  }, [savedScale, scale]);
  const onPinch = useCallback(
    (event: { scale: number }) => {
      scale.value = Math.min(Math.max(savedScale.value * (event?.scale ?? 1), 1), MAX_ZOOM);
    },
    [scale, savedScale],
  );
  const onPinchEnd = useCallback(() => {
    if (scale.value <= 1.02) resetView();
  }, [scale, resetView]);

  const onMoveStart = useCallback(() => {
    savedX.value = translateX.value;
    savedY.value = translateY.value;
  }, [savedX, savedY, translateX, translateY]);
  const onMove = useCallback(
    (event: { translationX: number; translationY: number }) => {
      translateX.value = savedX.value + (event?.translationX ?? 0);
      translateY.value = savedY.value + (event?.translationY ?? 0);
    },
    [translateX, translateY, savedX, savedY],
  );

  // ── One finger: the tool ─────────────────────────────────────────────────────────────────
  const onToolStart = useCallback(
    (event: { x: number; y: number }) => {
      const { tool: active, sliceIndex: slice } = live.current;
      setReadout(null);
      dragStart.value = { slice, center: windowCenter.value, width: windowWidth.value };
      if (active === 'measure') {
        const point = toImage(event?.x ?? 0, event?.y ?? 0);
        updateDrawing({ from: point, to: point });
      } else if (active !== 'window' && scale.value > 1) {
        onMoveStart();
      }
    },
    [dragStart, windowCenter, windowWidth, toImage, updateDrawing, scale, onMoveStart],
  );
  const onTool = useCallback(
    (event: { x: number; y: number; translationX: number; translationY: number }) => {
      const { tool: active, size: box, windowSpan: span, sliceCount: count } = live.current;
      const dx = event?.translationX ?? 0;
      const dy = event?.translationY ?? 0;
      if (active === 'measure') {
        const from = drawingRef.current?.from;
        if (from) updateDrawing({ from, to: toImage(event?.x ?? 0, event?.y ?? 0) });
      } else if (active === 'window') {
        // Across the screen once moves the window by the frame's whole range.
        const perPoint = span / Math.max(box.width, 1);
        windowWidth.value = Math.max(1, dragStart.value.width + dx * perPoint);
        windowCenter.value = dragStart.value.center + dy * perPoint;
      } else if (scale.value > 1) {
        onMove(event);
      } else if (count > 1) {
        // Half the screen's height covers the whole stack; a short stack still needs a real drag.
        const perSlice = Math.min(Math.max((box.height * 0.5) / count, 4), 40);
        callbacks.current.onScrollTo(dragStart.value.slice + dy / perSlice);
      }
    },
    [toImage, updateDrawing, windowWidth, windowCenter, dragStart, scale, onMove],
  );
  const onToolEnd = useCallback(() => {
    const { tool: active } = live.current;
    if (active === 'window') {
      callbacks.current.onWindowChanged({ center: windowCenter.value, width: windowWidth.value });
    }
    const line = drawingRef.current;
    if (active === 'measure' && line) {
      // A tap is not a length.
      if (Math.hypot(line.to.x - line.from.x, line.to.y - line.from.y) > 2) callbacks.current.onMeasured(line);
      updateDrawing(null);
    }
  }, [windowCenter, windowWidth, updateDrawing]);

  const onProbe = useCallback(
    (event: { x: number; y: number }) => {
      const { info: frameInfo, probe: read } = live.current;
      if (!frameInfo) return;
      const point = toImage(event?.x ?? 0, event?.y ?? 0);
      const value = read(point.x, point.y);
      if (value === null) return;
      const rounded = Math.round(value * 10) / 10;
      // Rescale to HU is what CT's Slope/Intercept mean; elsewhere it is the modality's value.
      const isRescaled = frameInfo.rescaleIntercept !== 0 || frameInfo.rescaleSlope !== 1;
      setReadout({ x: event?.x ?? 0, y: event?.y ?? 0, text: isRescaled ? `${rounded} HU` : `${rounded}` });
    },
    [toImage],
  );

  const onDoubleTap = useCallback(() => {
    if (scale.value > 1) {
      resetView();
    } else {
      scale.value = withTiming(DOUBLE_TAP_ZOOM);
    }
  }, [scale, resetView]);

  const pinch = usePinchGesture({ runOnJS: true, disableReanimated: true, onActivate: onPinchStart, onUpdate: onPinch, onDeactivate: onPinchEnd });
  const twoFingerPan = usePanGesture({ runOnJS: true, disableReanimated: true, minPointers: 2, onActivate: onMoveStart, onUpdate: onMove });
  const oneFingerPan = usePanGesture({
    runOnJS: true,
    disableReanimated: true,
    maxPointers: 1,
    onActivate: onToolStart,
    onUpdate: onTool,
    onDeactivate: onToolEnd,
  });
  const longPress = useLongPressGesture({ runOnJS: true, disableReanimated: true, minDuration: 350, onActivate: onProbe });
  const doubleTap = useTapGesture({ runOnJS: true, disableReanimated: true, numberOfTaps: 2, onActivate: onDoubleTap });
  const gesture = useSimultaneousGestures(pinch, twoFingerPan, oneFingerPan, longPress, doubleTap);

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event?.nativeEvent?.layout ?? { width: 0, height: 0 };
    setSize({ width, height });
  }, []);

  const mmText = (line: Measurement) => {
    const mm = info ? distanceMm(info, line.from, line.to) : null;
    return mm === null ? `${Math.round(Math.hypot(line.to.x - line.from.x, line.to.y - line.from.y))} px` : `${mm.toFixed(1)} mm`;
  };
  const lines = drawing ? [...measurements, drawing] : measurements;
  const effect = loaded?.isWindowed ? getWindowEffect() : null;

  return (
    <GestureHandlerRootView style={styles.stage}>
      <GestureDetector gesture={gesture}>
        <View style={styles.fill} onLayout={onLayout} collapsable={false}>
          {loaded?.image && size.width ? (
            <Canvas style={styles.fill}>
              <Group transform={transform}>
                {loaded.isWindowed && effect ? (
                  <Rect x={0} y={0} width={imageWidth} height={imageHeight}>
                    <Shader source={effect} uniforms={uniforms}>
                      <ImageShader
                        image={loaded.image}
                        fit="none"
                        rect={{ x: 0, y: 0, width: imageWidth, height: imageHeight }}
                        sampling={NEAREST}
                      />
                    </Shader>
                  </Rect>
                ) : (
                  <SkiaImage image={loaded.image} x={0} y={0} width={imageWidth} height={imageHeight} fit="fill" />
                )}
                <Group transform={[{ scale: 1 / toFramePixels }]}>
                  {lines.map((line, index) => (
                    <Group key={index}>
                      <Line p1={line.from} p2={line.to} color={MEASURE_COLOR} strokeWidth={strokeWidth} />
                      <Circle c={line.from} r={handleRadius} color={MEASURE_COLOR} />
                      <Circle c={line.to} r={handleRadius} color={MEASURE_COLOR} />
                    </Group>
                  ))}
                </Group>
              </Group>
            </Canvas>
          ) : null}
        </View>
      </GestureDetector>

      {children}

      {lines.length ? (
        <View style={styles.measureList} pointerEvents="none">
          {lines.map((line, index) => (
            <Text key={index} style={styles.measureText}>{`${index + 1}. ${mmText(line)}`}</Text>
          ))}
        </View>
      ) : null}

      {readout ? (
        <View style={[styles.probe, { left: readout.x - 6, top: readout.y - 6 }]} pointerEvents="none">
          <View style={styles.probeDot} />
          <Text style={styles.probeText}>{readout.text}</Text>
        </View>
      ) : null}
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    marginHorizontal: 12,
    marginTop: 8,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: STAGE_COLOR,
  },
  fill: {
    flex: 1,
  },
  measureList: {
    position: 'absolute',
    left: 12,
    bottom: 34,
    gap: 2,
  },
  measureText: {
    color: MEASURE_COLOR,
    fontFamily: fontFamilies.semibold,
    fontSize: 12,
    textShadowColor: STAGE_COLOR,
    textShadowRadius: 3,
  },
  probe: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  probeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: MEASURE_COLOR,
  },
  probeText: {
    color: STAGE_COLOR,
    backgroundColor: MEASURE_COLOR,
    fontFamily: fontFamilies.semibold,
    fontSize: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
});

export default DicomCanvas;
