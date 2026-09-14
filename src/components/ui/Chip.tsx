import React from 'react';
import { Pressable, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

import { Text } from './Text';

export type ChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  color?: string;
  disabled?: boolean;
  style?: ViewStyle;
};

export function Chip({ label, selected, onPress, color, disabled, style }: ChipProps) {
  const { colors, radius, spacing } = useTheme();
  const tint = color ?? colors.accent;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected, disabled: !!disabled }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        {
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          borderRadius: radius.pill,
          borderWidth: 1,
          borderColor: selected ? tint : colors.border,
          backgroundColor: selected ? tint : colors.surface,
          opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
        },
        style,
      ]}
    >
      <Text variant="label" style={{ color: selected ? colors.accentText : colors.textMuted }}>
        {label}
      </Text>
    </Pressable>
  );
}
