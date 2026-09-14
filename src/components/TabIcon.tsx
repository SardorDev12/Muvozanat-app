import React from 'react';
import type { ColorValue } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

export type TabIconName = 'today' | 'wheel' | 'goals' | 'settings';

/**
 * Four inline icons rather than a font-based icon set: no extra dependency,
 * no font-loading step before the first paint, and they inherit theme colours.
 */
export function TabIcon({
  name,
  color,
  size = 24,
}: {
  name: TabIconName;
  color: ColorValue;
  size?: number;
}) {
  const stroke = {
    stroke: color,
    strokeWidth: 1.8,
    fill: 'none',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'today' ? (
        <>
          <Path
            d="M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v12a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5Z"
            {...stroke}
          />
          <Path d="M4 9.5h16M8 3v4M16 3v4" {...stroke} />
          <Path d="m9 14 2 2 4-4" {...stroke} />
        </>
      ) : null}

      {name === 'wheel' ? (
        <>
          <Circle cx={12} cy={12} r={8.2} {...stroke} />
          <Circle cx={12} cy={12} r={3.6} {...stroke} />
          <Path d="M12 3.8v4.6M12 15.6v4.6M3.8 12h4.6M15.6 12h4.6" {...stroke} />
        </>
      ) : null}

      {name === 'goals' ? (
        <>
          <Path
            d="M5 21V4.5a.5.5 0 0 1 .5-.5h11.2a.4.4 0 0 1 .32.64L14.6 8l2.42 3.36a.4.4 0 0 1-.32.64H5"
            {...stroke}
          />
        </>
      ) : null}

      {name === 'settings' ? (
        <>
          <Circle cx={12} cy={12} r={2.8} {...stroke} />
          <Path
            d="M12 3.5v2M12 18.5v2M4.9 7.8l1.7 1M17.4 15.2l1.7 1M4.9 16.2l1.7-1M17.4 8.8l1.7-1"
            {...stroke}
          />
        </>
      ) : null}
    </Svg>
  );
}
