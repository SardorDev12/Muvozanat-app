import React from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/ThemeProvider';

export type ScreenProps = {
  children: React.ReactNode;
  scroll?: boolean;
  /** Extra bottom padding, e.g. to clear a floating action button. */
  bottomInset?: number;
  contentStyle?: ViewStyle;
  edges?: { top?: boolean; bottom?: boolean };
};

/**
 * Constrains content to a readable column so the web build does not stretch
 * form fields across a 2560px monitor.
 */
export const CONTENT_MAX_WIDTH = 620;

export function Screen({
  children,
  scroll = true,
  bottomInset = 0,
  contentStyle,
  edges,
}: ScreenProps) {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();

  const padding: ViewStyle = {
    paddingTop: edges?.top === false ? 0 : insets.top + spacing.sm,
    paddingBottom: (edges?.bottom === false ? 0 : insets.bottom) + spacing.lg + bottomInset,
    paddingHorizontal: spacing.lg,
  };

  const inner = (
    <View style={[styles.column, { maxWidth: CONTENT_MAX_WIDTH }, contentStyle]}>{children}</View>
  );

  if (!scroll) {
    return <View style={[styles.root, { backgroundColor: colors.bg }, padding]}>{inner}</View>;
  }

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.bg }]}
      contentContainerStyle={[styles.scrollContent, padding]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {inner}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrollContent: { alignItems: 'center', flexGrow: 1 },
  column: { width: '100%', alignSelf: 'center', flex: 1 },
});
