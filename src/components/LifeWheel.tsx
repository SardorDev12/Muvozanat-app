import React, { useEffect, useMemo } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, G, Line, Path, Text as SvgText } from 'react-native-svg';

import {
  AREA_BY_KEY,
  LIFE_AREAS,
  MAX_SCORE,
  type LifeAreaKey,
  type WheelScores,
} from '@/features/assessment/areas';
import { useTheme } from '@/theme/ThemeProvider';

const AnimatedPath = Animated.createAnimatedComponent(Path);

const SECTOR_DEGREES = 360 / LIFE_AREAS.length;
/** Hairline gap between neighbouring sectors so the eight areas read separately. */
const SECTOR_GAP = 1.2;

function polar(cx: number, cy: number, r: number, deg: number) {
  'worklet';
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function sectorPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  'worklet';
  if (r <= 0.5) return '';
  const s = polar(cx, cy, r, startDeg);
  const e = polar(cx, cy, r, endDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y} Z`;
}

type SectorProps = {
  cx: number;
  cy: number;
  maxRadius: number;
  startDeg: number;
  endDeg: number;
  score: number;
  color: string;
  order: number;
  active: boolean;
  animateIn: boolean;
};

function Sector({
  cx,
  cy,
  maxRadius,
  startDeg,
  endDeg,
  score,
  color,
  order,
  active,
  animateIn,
}: SectorProps) {
  const fill = useSharedValue(animateIn ? 0 : score / MAX_SCORE);

  useEffect(() => {
    const target = score / MAX_SCORE;
    // Staggering by sector order is what makes the wheel appear to "walk"
    // around the eight directions instead of popping into place at once.
    fill.value = withDelay(
      animateIn ? order * 80 : 0,
      withSpring(target, { damping: 15, stiffness: 110, mass: 0.9 }),
    );
  }, [score, order, animateIn, fill]);

  const animatedProps = useAnimatedProps(() => ({
    d: sectorPath(cx, cy, fill.value * maxRadius, startDeg, endDeg),
  }));

  return (
    <AnimatedPath
      animatedProps={animatedProps}
      fill={color}
      fillOpacity={active ? 1 : 0.82}
      stroke={color}
      strokeWidth={active ? 2 : 0}
    />
  );
}

type SweepProps = {
  cx: number;
  cy: number;
  radius: number;
  color: string;
  runKey: number;
};

/** A needle that travels once around the wheel, then fades out. */
function Sweep({ cx, cy, radius, color, runKey }: SweepProps) {
  const angle = useSharedValue(0);

  useEffect(() => {
    angle.value = 0;
    angle.value = withTiming(360, { duration: 1400, easing: Easing.inOut(Easing.cubic) });
  }, [runKey, angle]);

  const animatedProps = useAnimatedProps(() => {
    const tip = polar(cx, cy, radius, angle.value);
    const t = angle.value / 360;
    const opacity = t < 0.85 ? 0.45 : 0.45 * (1 - (t - 0.85) / 0.15);
    return {
      d: `M ${cx} ${cy} L ${tip.x} ${tip.y}`,
      opacity,
    };
  });

  return (
    <AnimatedPath
      animatedProps={animatedProps}
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      fill="none"
    />
  );
}

export type LifeWheelProps = {
  scores: WheelScores;
  size: number;
  /** Area currently being edited — drawn slightly brighter. */
  activeArea?: LifeAreaKey | null;
  /** Replay the intro sweep by bumping this. */
  runKey?: number;
  animateIn?: boolean;
  showLabels?: boolean;
};

export function LifeWheel({
  scores,
  size,
  activeArea,
  runKey = 0,
  animateIn = true,
  showLabels = true,
}: LifeWheelProps) {
  const { colors } = useTheme();

  const labelPad = showLabels ? 26 : 6;
  const cx = size / 2;
  const cy = size / 2;
  const maxRadius = size / 2 - labelPad;

  const rings = useMemo(
    () => [2, 4, 6, 8, 10].map((step) => (step / MAX_SCORE) * maxRadius),
    [maxRadius],
  );

  const spokes = useMemo(
    () =>
      LIFE_AREAS.map((area) => {
        const deg = area.index * SECTOR_DEGREES;
        const outer = polar(cx, cy, maxRadius, deg);
        return { key: area.key, x: outer.x, y: outer.y };
      }),
    [cx, cy, maxRadius],
  );

  const labels = useMemo(
    () =>
      LIFE_AREAS.map((area) => {
        const deg = area.index * SECTOR_DEGREES + SECTOR_DEGREES / 2;
        const point = polar(cx, cy, maxRadius + 14, deg);
        return { key: area.key, emoji: area.emoji, x: point.x, y: point.y };
      }),
    [cx, cy, maxRadius],
  );

  return (
    <View accessibilityRole="image" accessibilityLabel="Life wheel">
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Grid: concentric rings at 2/4/6/8/10 plus one spoke per area. */}
        <G>
          {rings.map((r, i) => (
            <Circle
              key={`ring-${i}`}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={colors.grid}
              strokeWidth={i === rings.length - 1 ? 1.5 : 1}
            />
          ))}
          {spokes.map((spoke) => (
            <Line
              key={`spoke-${spoke.key}`}
              x1={cx}
              y1={cy}
              x2={spoke.x}
              y2={spoke.y}
              stroke={colors.grid}
              strokeWidth={1}
            />
          ))}
        </G>

        {LIFE_AREAS.map((area) => {
          const start = area.index * SECTOR_DEGREES + SECTOR_GAP / 2;
          const end = start + SECTOR_DEGREES - SECTOR_GAP;
          return (
            <Sector
              key={area.key}
              cx={cx}
              cy={cy}
              maxRadius={maxRadius}
              startDeg={start}
              endDeg={end}
              score={scores[area.key]}
              color={area.color}
              order={area.index}
              active={activeArea === area.key}
              animateIn={animateIn}
            />
          );
        })}

        <Sweep cx={cx} cy={cy} radius={maxRadius + 4} color={colors.text} runKey={runKey} />

        <Circle cx={cx} cy={cy} r={3} fill={colors.grid} />

        {showLabels
          ? labels.map((label) => (
              <SvgText
                key={`label-${label.key}`}
                x={label.x}
                y={label.y + 5}
                fontSize={15}
                textAnchor="middle"
                fill={AREA_BY_KEY[label.key].color}
              >
                {label.emoji}
              </SvgText>
            ))
          : null}
      </Svg>
    </View>
  );
}
