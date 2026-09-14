import React from 'react';
import { View, type ViewProps } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

export type CardProps = ViewProps & {
  padded?: boolean;
  tone?: 'surface' | 'alt';
};

export function Card({ padded = true, tone = 'surface', style, ...rest }: CardProps) {
  const { colors, radius, spacing } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: tone === 'alt' ? colors.surfaceAlt : colors.surface,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          padding: padded ? spacing.lg : 0,
        },
        style,
      ]}
      {...rest}
    />
  );
}
