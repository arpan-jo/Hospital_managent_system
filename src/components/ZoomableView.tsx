import React, { memo, useCallback } from 'react';
import { LayoutChangeEvent, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import {
  GestureDetector,
  GestureHandlerRootView,
  usePanGesture,
  usePinchGesture,
  useSimultaneousGestures,
  useTapGesture,
} from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDecay,
  withTiming,
} from 'react-native-reanimated';
import { axisBounds, clampAxis, clampScale, zoomAround } from './zoomMath';

const MIN_SCALE = 1;

interface ZoomableViewProps {
  children: React.ReactNode;
  /** How far a pinch may go in. */
  maxScale?: number;
  /** Where a double tap goes in to; a second one comes back out. */
  doubleTapScale?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Something to read closely — a sheet of paper, say — that pinches in around the
 * fingers, double-taps in and back out, and is dragged around once it is larger
 * than the screen. At its normal size it is as wide as the view; a taller one
 * scrolls, a flick carrying on and stopping at the edge.
 */
export const ZoomableView = memo<ZoomableViewProps>(function Zoomable({
  children,
  maxScale = 4,
  doubleTapScale = 2.5,
  style,
}) {
  const viewport = useSharedValue({ width: 0, height: 0 });
  const content = useSharedValue({ width: 0, height: 0 });
  const scale = useSharedValue(MIN_SCALE);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  /** Where the pinch began — its scale, offset and the fingers' midpoint. */
  const pinchStart = useSharedValue({ scale: MIN_SCALE, x: 0, y: 0, focalX: 0, focalY: 0 });
  const isPinching = useSharedValue(false);
  /** The pan's running total at its last update; the step since is what moves. */
  const lastPan = useSharedValue({ x: 0, y: 0 });

  const stopMotion = useCallback(() => {
    'worklet';
    cancelAnimation(translateX);
    cancelAnimation(translateY);
    cancelAnimation(scale);
  }, [translateX, translateY, scale]);

  const clampTo = useCallback(
    (nextScale: number) => {
      'worklet';
      translateX.value = clampAxis(translateX.value, viewport.value.width, content.value.width, nextScale, true);
      translateY.value = clampAxis(translateY.value, viewport.value.height, content.value.height, nextScale, false);
    },
    [translateX, translateY, viewport, content],
  );

  const pinch = usePinchGesture({
    onActivate: event => {
      'worklet';
      stopMotion();
      isPinching.value = true;
      pinchStart.value = {
        scale: scale.value,
        x: translateX.value,
        y: translateY.value,
        focalX: event?.focalX ?? 0,
        focalY: event?.focalY ?? 0,
      };
    },
    onUpdate: event => {
      'worklet';
      const start = pinchStart.value;
      const next = clampScale(start.scale * (event?.scale ?? 1), MIN_SCALE, maxScale);
      // The point first pinched follows the fingers, so two fingers also drag.
      const pointX = (start.focalX - start.x) / start.scale;
      const pointY = (start.focalY - start.y) / start.scale;
      scale.value = next;
      translateX.value = clampAxis(
        (event?.focalX ?? start.focalX) - pointX * next,
        viewport.value.width,
        content.value.width,
        next,
        true,
      );
      translateY.value = clampAxis(
        (event?.focalY ?? start.focalY) - pointY * next,
        viewport.value.height,
        content.value.height,
        next,
        false,
      );
    },
    onFinalize: () => {
      'worklet';
      isPinching.value = false;
    },
  });

  const pan = usePanGesture({
    maxPointers: 1,
    onActivate: event => {
      'worklet';
      stopMotion();
      lastPan.value = { x: event?.translationX ?? 0, y: event?.translationY ?? 0 };
    },
    onUpdate: event => {
      'worklet';
      const x = event?.translationX ?? 0;
      const y = event?.translationY ?? 0;
      const dx = x - lastPan.value.x;
      const dy = y - lastPan.value.y;
      lastPan.value = { x, y };
      if (isPinching.value) return;
      translateX.value = clampAxis(translateX.value + dx, viewport.value.width, content.value.width, scale.value, true);
      translateY.value = clampAxis(translateY.value + dy, viewport.value.height, content.value.height, scale.value, false);
    },
    onDeactivate: event => {
      'worklet';
      if (isPinching.value || event?.canceled) return;
      const boundsX = axisBounds(viewport.value.width, content.value.width, scale.value, true);
      const boundsY = axisBounds(viewport.value.height, content.value.height, scale.value, false);
      if (boundsX[0] < boundsX[1]) {
        translateX.value = withDecay({ velocity: event?.velocityX ?? 0, clamp: boundsX });
      }
      if (boundsY[0] < boundsY[1]) {
        translateY.value = withDecay({ velocity: event?.velocityY ?? 0, clamp: boundsY });
      }
    },
  });

  const doubleTap = useTapGesture({
    numberOfTaps: 2,
    onActivate: event => {
      'worklet';
      stopMotion();
      const from = scale.value;
      const to = from > MIN_SCALE + 0.01 ? MIN_SCALE : Math.min(doubleTapScale, maxScale);
      const x = clampAxis(
        zoomAround(event?.x ?? 0, translateX.value, from, to),
        viewport.value.width,
        content.value.width,
        to,
        true,
      );
      const y = clampAxis(
        zoomAround(event?.y ?? 0, translateY.value, from, to),
        viewport.value.height,
        content.value.height,
        to,
        false,
      );
      scale.value = withTiming(to);
      translateX.value = withTiming(x);
      translateY.value = withTiming(y);
    },
  });

  const gesture = useSimultaneousGestures(pinch, pan, doubleTap);

  const onViewportLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { width = 0, height = 0 } = event?.nativeEvent?.layout ?? {};
      viewport.value = { width, height };
      clampTo(scale.value);
    },
    [viewport, clampTo, scale],
  );

  const onContentLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { width = 0, height = 0 } = event?.nativeEvent?.layout ?? {};
      content.value = { width, height };
      clampTo(scale.value);
    },
    [content, clampTo, scale],
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureHandlerRootView style={[styles.root, style]}>
      <GestureDetector gesture={gesture}>
        <View style={styles.viewport} onLayout={onViewportLayout} collapsable={false}>
          <Animated.View style={[styles.content, animatedStyle]} onLayout={onContentLayout}>
            {children}
          </Animated.View>
        </View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  viewport: {
    flex: 1,
    overflow: 'hidden',
  },
  content: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    // Scale from the top-left corner: the content sits at translate + scale × point.
    transformOrigin: 'top left',
  },
});

export default ZoomableView;
