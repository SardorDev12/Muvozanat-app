import React, { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

import { LIFE_AREAS, MAX_SCORE, type WheelScores } from '@/features/assessment/areas';
import { useTheme } from '@/theme/ThemeProvider';

const SECTOR_DEGREES = 360 / LIFE_AREAS.length;
/** One full turn. Slow enough to watch, fast enough not to feel stalled. */
const ROTATION_MS = 7000;
const DASH_WIDTH = 18;
const DASH_GAP = 14;
const DASH_PERIOD = DASH_WIDTH + DASH_GAP;

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function sectorPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  if (r <= 0.5) return '';
  const s = polar(cx, cy, r, startDeg);
  const e = polar(cx, cy, r, endDeg);
  return `M ${cx} ${cy} L ${s.x} ${s.y} A ${r} ${r} 0 0 1 ${e.x} ${e.y} Z`;
}

export type WheelRoadProps = {
  scores: WheelScores;
  /** Diameter a perfect 10-across wheel would have. */
  size: number;
  width: number;
};

/**
 * The life wheel as an actual wheel, rolling along a road.
 *
 * The bob is not decoration: the centre of a rolling wheel sits exactly as high
 * as its radius at the point touching the ground, so a wheel with a low-scoring
 * area really does drop as that part comes round. Even scores roll smoothly,
 * uneven ones lurch, and a wheel that is low all over rides close to the road.
 * It says in two seconds what the numbers underneath take a minute to say.
 */
export function WheelRoad({ scores, size, width }: WheelRoadProps) {
  const { colors } = useTheme();

  const radius = size / 2;
  const rotation = useSharedValue(0);
  const dashShift = useSharedValue(0);

  // Radius at the centre of each sector, which is where the samples sit.
  const radii = useMemo(
    () => LIFE_AREAS.map((area) => (scores[area.key] / MAX_SCORE) * radius),
    [scores, radius],
  );

  useEffect(() => {
    rotation.value = 0;
    rotation.value = withRepeat(
      withTiming(360, { duration: ROTATION_MS, easing: Easing.linear }),
      -1,
      false,
    );
  }, [rotation]);

  useEffect(() => {
    // Ground speed of a wheel of this size, so the road moves with the tread
    // rather than at some unrelated rate.
    const averageRadius = radii.reduce((a, b) => a + b, 0) / radii.length || radius;
    const pxPerMs = (2 * Math.PI * averageRadius) / ROTATION_MS;
    const dashMs = Math.max(200, DASH_PERIOD / pxPerMs);

    dashShift.value = 0;
    dashShift.value = withRepeat(
      withTiming(-DASH_PERIOD, { duration: dashMs, easing: Easing.linear }),
      -1,
      false,
    );
  }, [dashShift, radii, radius]);

  const wheelStyle = useAnimatedStyle(() => {
    // The wheel-local angle currently against the road. World "down" is 180deg,
    // and the wheel has turned by `rotation`, so the contact point is behind it.
    const contact = (((180 - rotation.value) % 360) + 360) % 360;

    // Sample points sit at sector centres, so shift by half a sector and
    // interpolate between neighbours — otherwise eight flat steps would read as
    // a stutter rather than a roll.
    const position = (contact - SECTOR_DEGREES / 2) / SECTOR_DEGREES;
    const lower = Math.floor(position);
    const blend = position - lower;
    const count = radii.length;
    const a = radii[((lower % count) + count) % count] ?? radius;
    const b = radii[(((lower + 1) % count) + count) % count] ?? radius;
    const height = a + (b - a) * blend;

    return {
      transform: [{ translateY: radius - height }, { rotate: `${rotation.value}deg` }],
    };
  });

  const dashStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: dashShift.value }],
  }));

  const dashCount = Math.ceil(width / DASH_PERIOD) + 2;

  return (
    <View style={[styles.stage, { width, height: size + 28 }]}>
      <Animated.View style={[styles.wheel, wheelStyle]}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {LIFE_AREAS.map((area) => {
            const start = area.index * SECTOR_DEGREES;
            return (
              <Path
                key={area.key}
                d={sectorPath(
                  radius,
                  radius,
                  (scores[area.key] / MAX_SCORE) * radius,
                  start,
                  start + SECTOR_DEGREES,
                )}
                fill={area.color}
                stroke={colors.surface}
                strokeWidth={1}
              />
            );
          })}
          <Circle cx={radius} cy={radius} r={Math.max(3, radius * 0.07)} fill={colors.surface} />
        </Svg>
      </Animated.View>

      <View style={[styles.road, { backgroundColor: colors.border }]} />
      <View style={styles.dashClip} pointerEvents="none">
        <Animated.View style={[styles.dashRow, dashStyle]}>
          {Array.from({ length: dashCount }, (_, i) => (
            <View
              key={i}
              style={{
                width: DASH_WIDTH,
                marginRight: DASH_GAP,
                height: 2,
                backgroundColor: colors.borderStrong,
              }}
            />
          ))}
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { justifyContent: 'flex-end', alignItems: 'center' },
  wheel: { alignItems: 'center', justifyContent: 'center' },
  road: { height: 2, alignSelf: 'stretch', marginTop: 10 },
  dashClip: { height: 16, alignSelf: 'stretch', overflow: 'hidden', paddingTop: 6 },
  dashRow: { flexDirection: 'row' },
});
