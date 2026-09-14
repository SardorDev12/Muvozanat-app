import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

/**
 * The app mark: a four-point sparkle, a small plus, and a ring, on a rounded
 * teal square. Kept as vector paths (not a bitmap) so it stays crisp at any
 * size on any density, and matches app.json's icon/splash assets exactly —
 * those are rasterised from this same geometry, see scripts in git history
 * for the generator, or regenerate from these paths directly if they ever
 * need to move.
 */
const SPARKLE_PATH =
  'M 42.66 26.23 Q 49.73 45.05 69.77 46.66 Q 50.95 53.73 49.34 73.77 Q 42.27 54.95 22.23 53.34 Q 41.05 46.27 42.66 26.23 Z';
const PLUS_PATH =
  'M 68.6 17 h 6.8 v 6.6 h 6.6 v 6.8 h -6.6 v 6.6 h -6.8 v -6.6 h -6.6 v -6.8 h 6.6 Z';
const RING = { cx: 27, cy: 76, r: 6.2, strokeWidth: 2.5 };
export const BRAND_TEAL = '#0F7A63';

export type BrandMarkProps = {
  size?: number;
  /** Draws the rounded teal square behind the mark. Off when the mark sits on
   * a surface that already has its own background (a dark header, a card). */
  withBackground?: boolean;
  markColor?: string;
};

export function BrandMark({
  size = 32,
  withBackground = true,
  markColor = '#FFFFFF',
}: BrandMarkProps) {
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        {withBackground ? (
          <Rect x={0} y={0} width={100} height={100} rx={22} ry={22} fill={BRAND_TEAL} />
        ) : null}
        <Path d={SPARKLE_PATH} fill={markColor} />
        <Path d={PLUS_PATH} fill={markColor} />
        <Circle
          cx={RING.cx}
          cy={RING.cy}
          r={RING.r}
          fill="none"
          stroke={markColor}
          strokeWidth={RING.strokeWidth}
        />
      </Svg>
    </View>
  );
}
