import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { Canvas, Circle, Line, Path, SkPath, Skia, vec } from '@shopify/react-native-skia';
import { VitalsRecord } from '@app/core';
import { fontFamilies } from '@app/ui';
import FilterPills, { FilterPill } from '../reports/FilterPills';
import { METRIC_LABEL_KEY, TREND_METRICS, VitalsMetric, hasTrend, metricTone, trendSeries } from './vitalsUi';

interface VitalsTrendCardProps {
  /** One patient's sittings, oldest first. */
  records: VitalsRecord[];
  months: string[];
}

const CHART_HEIGHT = 140;
/** Room inside the canvas so the end dots are not cut in half. */
const INSET = { x: 8, y: 10 };

/**
 * A line through the points, built as a Skia path rather than an SVG string —
 * Skia throws on a string it cannot read, and that would take the page down.
 * Null when there are not two points to join, or Skia is not there to draw.
 */
const toLinePath = (points: { x: number; y: number }[]): SkPath | null => {
  if ((points?.length ?? 0) < 2) return null;
  try {
    const builder = Skia?.PathBuilder?.Make?.();
    if (!builder) return null;
    points.forEach((point, index) => {
      if (index === 0) builder.moveTo(point.x, point.y);
      else builder.lineTo(point.x, point.y);
    });
    return builder.detach() ?? null;
  } catch (error: any) {
    console.log('vitals trend path error ==>', error?.message);
    return null;
  }
};

/** "8 Nov" — the day and month a sitting fell on, for the axis under the chart. */
const shortDate = (value: string, months: string[]): string => {
  const date = new Date(String(value ?? '').trim());
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getDate()} ${months?.[date.getMonth()] ?? ''}`.trim();
};

/**
 * The portal's trend chart for a phone: one measure at a time, picked from a
 * chip row — blood pressure (upper and lower as two lines), pulse, SpO₂ or
 * temperature — over every sitting it was taken at.
 */
export const VitalsTrendCard = memo<VitalsTrendCardProps>(function VitalsTrendCard({ records, months }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [width, setWidth] = useState(0);

  const available = useMemo(() => TREND_METRICS.filter(metric => hasTrend(records, metric)), [records]);
  const [chosen, setChosen] = useState<VitalsMetric>('bp');
  // Another family member may not have the chosen measure — fall back to one they have.
  const metric: VitalsMetric = available.includes(chosen) ? chosen : available[0] ?? 'bp';
  useEffect(() => {
    if (available.length && !available.includes(chosen)) setChosen(available[0]);
  }, [available, chosen]);

  const tone = metricTone(metric, theme.dark);
  const lineColors = [tone.color, `${tone.color}80`];

  const chart = useMemo(() => {
    const { lines, dates } = trendSeries(records, metric);
    // Only the sittings that took this measure are spaced along the line.
    const taken = dates.map((_, index) => index).filter(index => lines.some(line => line?.[index] !== null));
    const values = lines.flatMap(line => taken.map(index => line?.[index])).filter(
      (value): value is number => value !== null && value !== undefined,
    );
    if (!taken.length || !values.length || width <= 0) return null;

    const pad = Math.max((Math.max(...values) - Math.min(...values)) * 0.2, metric === 'temp' ? 0.5 : 3);
    const min = Math.max(0, Math.min(...values) - pad);
    const max = Math.max(...values) + pad;
    const innerW = Math.max(width - INSET.x * 2, 1);
    const innerH = CHART_HEIGHT - INSET.y * 2;
    // A single reading sits in the middle — a dot, with no line to draw yet.
    const x = (position: number) =>
      taken.length === 1 ? INSET.x + innerW / 2 : INSET.x + (position / (taken.length - 1)) * innerW;
    const y = (value: number) => INSET.y + innerH - ((value - min) / Math.max(max - min, 1e-6)) * innerH;

    const series = lines.map(line => {
      const points = taken
        .map((index, position) => {
          const value = line?.[index];
          return value === null || value === undefined ? null : { x: x(position), y: y(value) };
        })
        // A point that is not a number cannot be drawn — leave it out rather than break the line.
        .filter(
          (point): point is { x: number; y: number } =>
            point !== null && Number.isFinite(point.x) && Number.isFinite(point.y),
        );
      return { points, path: toLinePath(points) };
    });

    const digits = metric === 'temp' ? 1 : 0;
    return {
      series,
      grid: [0, 0.5, 1].map(step => INSET.y + innerH * step),
      axis: [max, (max + min) / 2, min].map(value => value.toFixed(digits)),
      firstDate: shortDate(dates[taken[0]], months),
      lastDate: shortDate(dates[taken[taken.length - 1]], months),
      isSingle: taken.length === 1,
    };
  }, [records, metric, width, months]);

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const next = Math.round(event?.nativeEvent?.layout?.width ?? 0);
    setWidth(current => (current === next ? current : next));
  }, []);

  const pills: FilterPill[] = useMemo(
    () => available.map(key => ({ key, label: t(METRIC_LABEL_KEY[key]) })),
    [available, t],
  );

  if (!available.length) return null;

  const muted = theme.colors.onSurfaceVariant;

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
      <Text style={[styles.title, { color: theme.colors.onSurface }]}>{t('vitals.trend')}</Text>
      {pills.length > 1 ? (
        <View style={styles.pills}>
          <FilterPills items={pills} selected={metric} onSelect={key => setChosen(key as VitalsMetric)} />
        </View>
      ) : null}

      <View style={styles.chartRow}>
        <View style={styles.axis}>
          {(chart?.axis ?? []).map((label, index) => (
            <Text key={`${index}-${label}`} style={[styles.axisText, { color: muted }]}>
              {label}
            </Text>
          ))}
        </View>
        <View style={styles.plot} onLayout={onLayout}>
          {chart ? (
            <Canvas style={styles.canvas}>
              {chart.grid.map(gridY => (
                <Line
                  key={gridY}
                  p1={vec(0, gridY)}
                  p2={vec(width, gridY)}
                  color={theme.colors.outlineVariant}
                  strokeWidth={StyleSheet.hairlineWidth * 2}
                />
              ))}
              {chart.series.map((line, index) =>
                line.path ? (
                  <Path
                    key={`line-${index}`}
                    path={line.path}
                    style="stroke"
                    strokeWidth={2.5}
                    strokeJoin="round"
                    strokeCap="round"
                    color={lineColors[index] ?? tone.color}
                  />
                ) : null,
              )}
              {chart.series.map((line, index) =>
                line.points.map((point, at) => (
                  <Circle
                    key={`dot-${index}-${at}`}
                    cx={point.x}
                    cy={point.y}
                    r={at === line.points.length - 1 ? 5 : 3.5}
                    color={lineColors[index] ?? tone.color}
                  />
                )),
              )}
            </Canvas>
          ) : null}
        </View>
      </View>

      {/* One reading: its date under the dot. More: the first and the last. */}
      <View style={[styles.dates, chart?.isSingle && styles.datesSingle]}>
        <Text style={[styles.axisText, { color: muted }]}>{chart?.firstDate ?? ''}</Text>
        {chart?.isSingle ? null : (
          <Text style={[styles.axisText, { color: muted }]}>{chart?.lastDate ?? ''}</Text>
        )}
      </View>

      {metric === 'bp' ? (
        <View style={styles.legend}>
          {[t('vitals.systolic'), t('vitals.diastolic')].map((label, index) => (
            <View key={label} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: lineColors[index] }]} />
              <Text style={[styles.legendText, { color: muted }]}>{label}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    elevation: 1,
    shadowColor: '#0B1030',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  title: {
    fontFamily: fontFamilies.bold,
    fontSize: 16,
    marginBottom: 10,
  },
  pills: {
    marginHorizontal: -16,
    marginBottom: 6,
  },
  chartRow: {
    flexDirection: 'row',
    height: CHART_HEIGHT,
  },
  axis: {
    width: 34,
    justifyContent: 'space-between',
    paddingVertical: INSET.y - 7,
  },
  axisText: {
    fontFamily: fontFamilies.regular,
    fontSize: 10.5,
  },
  plot: {
    flex: 1,
  },
  canvas: {
    flex: 1,
  },
  dates: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginLeft: 34,
    marginTop: 4,
  },
  datesSingle: {
    justifyContent: 'center',
  },
  legend: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 10,
    marginLeft: 34,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
  },
});

export default VitalsTrendCard;
