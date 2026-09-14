import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AREA_BY_KEY } from '@/features/assessment/areas';
import type { GoalProgressRow, GoalRow } from '@/types/database';
import { useTheme } from '@/theme/ThemeProvider';

import { ProgressRing } from './ProgressRing';
import { Text } from './ui/Text';

export type GoalStripProps = {
  goals: GoalRow[];
  progress: Record<string, GoalProgressRow>;
};

/**
 * The horizontal row of long-term goals pinned under the Today header. Goals
 * are the reason the day's tasks exist, so they stay visible every day without
 * competing with the task list for vertical space.
 */
export function GoalStrip({ goals, progress }: GoalStripProps) {
  const { colors, radius, spacing } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

  if (goals.length === 0) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/goals')}
        style={({ pressed }) => [
          styles.emptyCard,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderRadius: radius.lg,
            padding: spacing.lg,
            opacity: pressed ? 0.8 : 1,
          },
        ]}
      >
        <Text variant="label" tone="accent">
          + {t('today.noGoalsStrip')}
        </Text>
      </Pressable>
    );
  }

  return (
    <View style={{ gap: spacing.sm }}>
      <Text variant="label" tone="muted">
        {t('today.yourGoals')}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing.sm, paddingRight: spacing.lg }}
      >
        {goals.map((goal) => {
          const area = AREA_BY_KEY[goal.area];
          const stats = progress[goal.id];
          const ratio = stats && stats.total_tasks > 0 ? stats.done_tasks / stats.total_tasks : 0;

          return (
            <Pressable
              key={goal.id}
              accessibilityRole="button"
              accessibilityLabel={`${goal.title}, ${Math.round(ratio * 100)}%`}
              onPress={() => router.push(`/goals/${goal.id}`)}
              style={({ pressed }) => [
                styles.card,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderRadius: radius.lg,
                  padding: spacing.md,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <ProgressRing progress={ratio} color={area.color} />
              <View style={styles.cardText}>
                <Text variant="label" numberOfLines={2}>
                  {goal.title}
                </Text>
                <Text variant="caption" tone="faint">
                  {area.emoji} {Math.round(ratio * 100)}%
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    width: 190,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cardText: { flex: 1, gap: 2 },
  emptyCard: { borderWidth: 1, borderStyle: 'dashed', alignItems: 'center' },
});
