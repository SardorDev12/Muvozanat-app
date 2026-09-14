import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AREA_BY_KEY } from '@/features/assessment/areas';
import { useRecurrenceLabel } from '@/features/tasks/describe';
import type { Occurrence } from '@/features/tasks/today';
import { intlLocale } from '@/i18n';
import { useTheme } from '@/theme/ThemeProvider';
import type { GoalRow, TaskRow } from '@/types/database';
import { formatDate, type DateKey } from '@/utils/date';

import { Checkbox } from './ui/Checkbox';
import { Text } from './ui/Text';

export type TaskItemProps = {
  occurrence: Occurrence<TaskRow>;
  goal?: GoalRow;
  onToggleDone: () => void;
  onPress?: () => void;
  /** Shows the occurrence's own date — used in the missed list. */
  showDate?: boolean;
};

export function TaskItem({ occurrence, goal, onToggleDone, onPress, showDate }: TaskItemProps) {
  const { colors, radius, spacing } = useTheme();
  const { t, i18n } = useTranslation();
  const describeRecurrence = useRecurrenceLabel();

  const { task, status, date } = occurrence;
  const done = status === 'done';
  const skipped = status === 'skipped';
  const accent = goal ? AREA_BY_KEY[goal.area].color : colors.textFaint;

  const subtitleParts: string[] = [];
  if (goal) subtitleParts.push(goal.title);
  if (task.recurrence) subtitleParts.push(describeRecurrence(task.recurrence, task.starts_on));
  if (showDate) subtitleParts.push(formatDate(date as DateKey, intlLocale(i18n.language)));

  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: radius.md,
          padding: spacing.md,
          gap: spacing.md,
          opacity: pressed && onPress ? 0.8 : 1,
        },
      ]}
    >
      <Checkbox
        checked={done}
        onToggle={onToggleDone}
        color={accent}
        accessibilityLabel={done ? t('tasks.markUndone') : t('tasks.markDone')}
      />

      <View style={styles.body}>
        <Text
          variant="body"
          tone={done || skipped ? 'faint' : 'default'}
          style={done || skipped ? styles.struck : undefined}
          numberOfLines={2}
        >
          {task.title}
        </Text>
        {subtitleParts.length > 0 ? (
          <Text variant="caption" tone="faint" numberOfLines={1}>
            {subtitleParts.join(' · ')}
          </Text>
        ) : null}
      </View>

      {skipped ? (
        <Text variant="caption" tone="faint">
          {t('tasks.skipped')}
        </Text>
      ) : goal ? (
        <View style={[styles.dot, { backgroundColor: accent }]} />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', borderWidth: 1 },
  body: { flex: 1, gap: 2 },
  struck: { textDecorationLine: 'line-through' },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
