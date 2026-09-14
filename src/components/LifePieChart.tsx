import React, { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';

import { LIFE_AREAS, type LifeAreaKey, type WheelScores } from '@/features/assessment/areas';
import { useTheme } from '@/theme/ThemeProvider';

import { Text } from './ui/Text';

/**
 * A true pie: each area's slice angle is its share of the total score, which
 * answers a different question from the wheel. The wheel shows how high each
 * area scores; the pie shows how lopsided the whole picture is.
 */
function slicePath(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  from: number,
  to: number,
) {
  const toXY = (r: number, deg: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };
  const large = to - from > 180 ? 1 : 0;
  const o1 = toXY(rOuter, from);
  const o2 = toXY(rOuter, to);
  const i2 = toXY(rInner, to);
  const i1 = toXY(rInner, from);
  return [
    `M ${o1.x} ${o1.y}`,
    `A ${rOuter} ${rOuter} 0 ${large} 1 ${o2.x} ${o2.y}`,
    `L ${i2.x} ${i2.y}`,
    `A ${rInner} ${rInner} 0 ${large} 0 ${i1.x} ${i1.y}`,
    'Z',
  ].join(' ');
}

export type LifePieChartProps = {
  scores: WheelScores;
  size: number;
  activeArea?: LifeAreaKey | null;
  centerLabel?: string;
  centerCaption?: string;
};

export function LifePieChart({
  scores,
  size,
  activeArea,
  centerLabel,
  centerCaption,
}: LifePieChartProps) {
  const { colors } = useTheme();

  const cx = size / 2;
  const cy = size / 2;
  const rOuter = size / 2 - 2;
  const rInner = rOuter * 0.58;

  const slices = useMemo(() => {
    const total = LIFE_AREAS.reduce((sum, area) => sum + scores[area.key], 0);
    if (total <= 0) return [];

    let cursor = 0;
    return LIFE_AREAS.map((area) => {
      const share = scores[area.key] / total;
      const from = cursor;
      // Leave a sliver of a gap so adjacent slices of similar colour separate.
      const to = cursor + share * 360;
      cursor = to;
      return {
        key: area.key,
        color: area.color,
        percent: Math.round(share * 100),
        d: slicePath(cx, cy, rOuter, rInner, from + 0.6, Math.max(from + 0.6, to - 0.6)),
      };
    });
  }, [scores, cx, cy, rOuter, rInner]);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ position: 'absolute' }}
      >
        <G>
          {slices.map((slice) => (
            <Path
              key={slice.key}
              d={slice.d}
              fill={slice.color}
              fillOpacity={!activeArea || activeArea === slice.key ? 1 : 0.4}
            />
          ))}
        </G>
        <Circle cx={cx} cy={cy} r={rInner - 1} fill={colors.surface} />
      </Svg>

      {centerLabel ? (
        <View style={{ alignItems: 'center' }} pointerEvents="none">
          <Text variant="title">{centerLabel}</Text>
          {centerCaption ? (
            <Text variant="caption" tone="muted">
              {centerCaption}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
