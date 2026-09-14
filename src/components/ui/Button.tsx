import * as Haptics from 'expo-haptics';
import React from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

import { Text } from './Text';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

export type ButtonProps = {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
  full?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  accessibilityLabel?: string;
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled,
  loading,
  full,
  icon,
  style,
  accessibilityLabel,
}: ButtonProps) {
  const { colors, radius, spacing } = useTheme();
  const isDisabled = disabled || loading;

  const heights: Record<Size, number> = { sm: 36, md: 46, lg: 54 };
  const paddings: Record<Size, number> = { sm: spacing.md, md: spacing.lg, lg: spacing.xl };

  const surface: Record<Variant, ViewStyle> = {
    primary: { backgroundColor: colors.accent },
    secondary: { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border },
    ghost: { backgroundColor: 'transparent' },
    danger: { backgroundColor: colors.danger },
  };

  const textTone = variant === 'primary' || variant === 'danger' ? 'inverse' : 'default';

  function handlePress() {
    if (isDisabled) return;
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync().catch(() => {});
    }
    onPress?.();
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      onPress={handlePress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        surface[variant],
        {
          height: heights[size],
          paddingHorizontal: paddings[size],
          borderRadius: radius.md,
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
        },
        full && styles.full,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textTone === 'inverse' ? colors.accentText : colors.text} />
      ) : (
        <View style={styles.content}>
          {icon ? <View style={{ marginRight: spacing.sm }}>{icon}</View> : null}
          <Text
            variant={size === 'sm' ? 'label' : 'heading'}
            tone={variant === 'danger' ? 'inverse' : textTone}
          >
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  full: { alignSelf: 'stretch', width: '100%' },
  content: { flexDirection: 'row', alignItems: 'center' },
});
