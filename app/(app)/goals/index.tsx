import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { GoalEditorSheet } from '@/components/GoalEditorSheet';
import { ProgressRing } from '@/components/ProgressRing';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { AREA_BY_KEY, type LifeAreaKey } from '@/features/assessment/areas';
import { useLatestAssessment } from '@/features/assessment/queries';
import { useGoalProgress, useGoals } from '@/features/goals/queries';
import { intlLocale } from '@/i18n';
import { useTheme } from '@/theme/ThemeProvider';
import { formatDate } from '@/utils/date';

export default function GoalsScreen() {
  const { t, i18n } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const router = useRouter();
  const locale = intlLocale(i18n.language);
  const params = useLocalSearchParams<{ suggestArea?: string }>();

  const goals = useGoals(['active', 'paused']);
  const progress = useGoalProgress();
  const latest = useLatestAssessment();

  const [editorOpen, setEditorOpen] = useState(false);

  // Arriving from the assessment results with a weak area opens the editor
  // straight away, so "set goals" actually leads somewhere. Tracked by the
  // param value so navigating back with a different area re-opens it, while
  // closing the sheet manually does not immediately re-open it.
  const suggested = (params.suggestArea ?? null) as LifeAreaKey | null;
  const [handledSuggestion, setHandledSuggestion] = useState<LifeAreaKey | null>(null);

  if (suggested && suggested !== handledSuggestion) {
    setHandledSuggestion(suggested);
    setEditorOpen(true);
  }

  const suggestedScore = suggested ? latest.data?.scores[suggested] : undefined;

  return (
    <Screen>
      <View style={{ gap: spacing.lg, paddingBottom: spacing.xl }}>
        <View style={{ gap: spacing.xs }}>
          <Text variant="display">{t('goals.title')}</Text>
          {suggested && suggestedScore !== undefined ? (
            <Text variant="caption" tone="muted">
              {t('goals.suggestedBody', {
                area: t(`areas.${suggested}.name`),
                score: suggestedScore,
              })}
            </Text>
          ) : null}
        </View>

        {(goals.data ?? []).length === 0 ? (
          <Card style={{ gap: spacing.md }}>
            <Text variant="heading">{t('goals.empty')}</Text>
            <Text tone="muted">{t('goals.emptyBody')}</Text>
          </Card>
        ) : (
          <View style={{ gap: spacing.sm }}>
            {(goals.data ?? []).map((goal) => {
              const area = AREA_BY_KEY[goal.area];
              const stats = progress.data?.[goal.id];
              const ratio =
                stats && stats.total_tasks > 0 ? stats.done_tasks / stats.total_tasks : 0;

              return (
                <Pressable
                  key={goal.id}
                  accessibilityRole="button"
                  onPress={() => router.push(`/goals/${goal.id}`)}
                  style={({ pressed }) => [
                    styles.row,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      borderRadius: radius.lg,
                      padding: spacing.lg,
                      gap: spacing.md,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <ProgressRing progress={ratio} color={area.color} size={42} />
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text variant="heading" numberOfLines={2}>
                      {goal.title}
                    </Text>
                    <Text variant="caption" tone="faint">
                      {area.emoji} {t(`areas.${goal.area}.name`)}
                      {stats
                        ? ` · ${t('goals.progress', { done: stats.done_tasks, total: stats.total_tasks })}`
                        : ''}
                    </Text>
                    {goal.target_date ? (
                      <Text variant="caption" tone="muted">
                        {formatDate(goal.target_date, locale, { dateStyle: 'medium' })}
                      </Text>
                    ) : null}
                  </View>
                  <Text variant="title" tone="faint">
                    ›
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        <Button title={`+  ${t('goals.newGoal')}`} full onPress={() => setEditorOpen(true)} />
      </View>

      <GoalEditorSheet
        visible={editorOpen}
        defaultArea={suggested}
        onClose={() => setEditorOpen(false)}
        onCreated={(goal) => router.push(`/goals/${goal.id}`)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', borderWidth: 1 },
});
