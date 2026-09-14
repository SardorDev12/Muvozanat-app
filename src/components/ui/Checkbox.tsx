import * as Haptics from 'expo-haptics';
import React from 'react';
import { Platform, Pressable } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useTheme } from '@/theme/ThemeProvider';

export type CheckboxProps = {
  checked: boolean;
  onToggle: () => void;
  color?: string;
  size?: number;
  accessibilityLabel: string;
  disabled?: boolean;
};

export function Checkbox({
  checked,
  onToggle,
  color,
  size = 24,
  accessibilityLabel,
  disabled,
}: CheckboxProps) {
  const { colors } = useTheme();
  const tint = color ?? colors.accent;

  function handlePress() {
    if (disabled) return;
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    onToggle();
  }

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled: !!disabled }}
      accessibilityLabel={accessibilityLabel}
      onPress={handlePress}
      disabled={disabled}
      hitSlop={10}
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
    >
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path
          d="M5 3.5h14a1.5 1.5 0 0 1 1.5 1.5v14a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19V5A1.5 1.5 0 0 1 5 3.5Z"
          fill={checked ? tint : 'transparent'}
          stroke={checked ? tint : colors.borderStrong}
          strokeWidth={1.8}
        />
        {checked ? (
          <Path
            d="m7.5 12.2 3.1 3.1 5.9-6.4"
            fill="none"
            stroke={colors.bgElevated}
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}
      </Svg>
    </Pressable>
  );
}
