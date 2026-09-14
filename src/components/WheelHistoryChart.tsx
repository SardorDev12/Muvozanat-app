import React, { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import {
  AREA_BY_KEY,
  LIFE_AREAS,
  MAX_SCORE,
  MIN_SCORE,
  type LifeAreaKey,
} from '@/features/assessment/areas';
import type { AssessmentSnapshot } from '@/features/assessment/queries';
import { intlLocale } from '@/i18n';
import { useTheme } from '@/theme/ThemeProvider';
import { formatTimestamp } from '@/utils/date';

import { Chip } from './ui/Chip';
import { Text } from './ui/Text';

export type WheelHistoryChartProps = {
  snapshots: AssessmentSnapshot[];
  width: number;
};

/**
 * One line per selected life area across every assessment. Areas are opt-in
 * chips rather than all eight at once — eight overlapping lines on a phone is
 * a colour test, not a chart.
 */
export function WheelHistoryChart({ snapshots, width }: WheelHistoryChartProps) {
  const { colors, spacing } = useTheme();
  const { t, i18n } = useTranslation();
  const locale = intlLocale(i18n.language);

  const [selected, setSelected] = useState<LifeAreaKey[]>(() =>
    LIFE_AREAS.slice(0, 3).map((a) => a.key),
  );

  const height = 180;
  const padLeft = 26;
  const padBottom = 22;
  const padTop = 10;
  const plotWidth = Math.max(40, width - padLeft - 8);
  const plotHeight = height - padTop - padBottom;

  const points = useMemo(() => {
    if (snapshots.length === 0) return {} as Record<LifeAreaKey, string>;

    const stepX = snapshots.length === 1 ? 0 : plotWidth / (snapshots.length - 1);
    const scaleY = (score: number) =>
      padTop + plotHeight - ((score - MIN_SCORE) / (MAX_SCORE - MIN_SCORE)) * plotHeight;

    const out = {} as Record<LifeAreaKey, string>;
    for (const area of LIFE_AREAS) {
      out[area.key] = snapshots
        .map((snap, i) => `${padLeft + i * stepX},${scaleY(snap.scores[area.key])}`)
        .join(' ');
    }
    return out;
  }, [snapshots, plotWidth, plotHeight]);

  if (snapshots.length < 2) {
    return (
      <Text variant="caption" tone="faint">
        {t('assessment.historyEmpty')}
      </Text>
    );
  }

  const gridScores = [2, 4, 6, 8, 10];

  return (
    <View style={{ gap: spacing.md }}>
      <Svg width={width} height={height}>
        {gridScores.map((score) => {
          const y =
            padTop + plotHeight - ((score - MIN_SCORE) / (MAX_SCORE - MIN_SCORE)) * plotHeight;
          return (
            <Line
              key={score}
              x1={padLeft}
              y1={y}
              x2={padLeft + plotWidth}
              y2={y}
              stroke={colors.grid}
              strokeWidth={1}
            />
          );
        })}

        {selected.map((key) => (
          <Polyline
            key={key}
            points={points[key]}
            fill="none"
            stroke={AREA_BY_KEY[key].color}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}

        {selected.map((key) =>
          snapshots.map((snap, i) => {
            const stepX = snapshots.length === 1 ? 0 : plotWidth / (snapshots.length - 1);
            const y =
              padTop +
              plotHeight -
              ((snap.scores[key] - MIN_SCORE) / (MAX_SCORE - MIN_SCORE)) * plotHeight;
            return (
              <Circle
                key={`${key}-${snap.id}`}
                cx={padLeft + i * stepX}
                cy={y}
                r={2.5}
                fill={AREA_BY_KEY[key].color}
              />
            );
          }),
        )}
      </Svg>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text variant="caption" tone="faint">
          {formatTimestamp(snapshots[0]!.takenAt, locale)}
        </Text>
        <Text variant="caption" tone="faint">
          {formatTimestamp(snapshots[snapshots.length - 1]!.takenAt, locale)}
        </Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {LIFE_AREAS.map((area) => (
            <Chip
              key={area.key}
              label={`${area.emoji} ${t(`areas.${area.key}.name`)}`}
              color={area.color}
              selected={selected.includes(area.key)}
              onPress={() =>
                setSelected((prev) =>
                  prev.includes(area.key)
                    ? prev.filter((k) => k !== area.key)
                    : [...prev, area.key],
                )
              }
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
