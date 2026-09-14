import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { CompletionScope } from '@/features/tasks/queries';
import { useTheme } from '@/theme/ThemeProvider';

import { Sheet } from './ui/Sheet';
import { Text } from './ui/Text';

function Choice({
  title,
  hint,
  onPress,
  emphasis,
}: {
  title: string;
  hint: string;
  onPress: () => void;
  emphasis?: boolean;
}) {
  const { colors, radius, spacing } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={hint}
      onPress={onPress}
      style={({ pressed }) => [
        styles.choice,
        {
          borderColor: emphasis ? colors.accent : colors.border,
          backgroundColor: emphasis ? colors.accentSoft : colors.surface,
          borderRadius: radius.md,
          padding: spacing.lg,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <Text variant="heading" tone={emphasis ? 'accent' : 'default'}>
        {title}
      </Text>
      <Text variant="caption" tone="muted">
        {hint}
      </Text>
    </Pressable>
  );
}

export type TaskCompletionSheetProps = {
  visible: boolean;
  taskTitle: string;
  onClose: () => void;
  onChoose: (scope: CompletionScope) => void;
};

/**
 * Asked only when a task repeats. Ticking off today's run and declaring the
 * whole task finished are different intentions, and only the second one rolls
 * the component — and then the goal — up to complete. For a one-off task the
 * two coincide, so the caller completes it outright without showing this.
 */
export function TaskCompletionSheet({
  visible,
  taskTitle,
  onClose,
  onChoose,
}: TaskCompletionSheetProps) {
  const { t } = useTranslation();
  const { spacing } = useTheme();

  return (
    <Sheet visible={visible} onClose={onClose} title={t('tasks.completionTitle')}>
      <View style={{ gap: spacing.xs }}>
        <Text variant="heading">{taskTitle}</Text>
        <Text variant="caption" tone="muted">
          {t('tasks.completionBody')}
        </Text>
      </View>

      <View style={{ gap: spacing.sm }}>
        <Choice
          title={t('tasks.doneForToday')}
          hint={t('tasks.doneForTodayHint')}
          onPress={() => onChoose('occurrence')}
          emphasis
        />
        <Choice
          title={t('tasks.doneCompletely')}
          hint={t('tasks.doneCompletelyHint')}
          onPress={() => onChoose('task')}
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  choice: { borderWidth: 1, gap: 4 },
});
