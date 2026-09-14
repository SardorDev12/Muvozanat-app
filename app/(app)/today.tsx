import React, { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { GoalStrip } from '@/components/GoalStrip';
import { ReassessBanner } from '@/components/ReassessBanner';
import { TaskCompletionSheet } from '@/components/TaskCompletionSheet';
import { TaskEditorSheet } from '@/components/TaskEditorSheet';
import { TaskItem } from '@/components/TaskItem';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { CONTENT_MAX_WIDTH } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { useGoalProgress, useGoals } from '@/features/goals/queries';
import {
  useSetOccurrenceStatus,
  useTodayLists,
  type CompletionScope,
} from '@/features/tasks/queries';
import { isRecurring } from '@/features/tasks/recurrence';
import type { Occurrence } from '@/features/tasks/today';
import { useProfile } from '@/features/profile/queries';
import { intlLocale } from '@/i18n';
import { useTheme } from '@/theme/ThemeProvider';
import type { TaskRow } from '@/types/database';
import { formatLongDate } from '@/utils/date';
import { useTodayKey } from '@/utils/useNow';

function greetingKey(): 'greetingMorning' | 'greetingAfternoon' | 'greetingEvening' {
  const hour = new Date().getHours();
  if (hour < 12) return 'greetingMorning';
  if (hour < 18) return 'greetingAfternoon';
  return 'greetingEvening';
}

export default function TodayScreen() {
  const { t, i18n } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const locale = intlLocale(i18n.language);

  const profile = useProfile();
  const goals = useGoals(['active']);
  const goalProgress = useGoalProgress();
  const lookback = profile.data?.missed_lookback_days ?? 14;
  const today = useTodayKey();
  const { lists, isLoading, refetch } = useTodayLists(lookback, today);
  const setStatus = useSetOccurrenceStatus();

  const [missedOpen, setMissedOpen] = useState(false);
  const [completedOpen, setCompletedOpen] = useState(false);
  const [completionPrompt, setCompletionPrompt] = useState<Occurrence<TaskRow> | null>(null);
  const [editorTask, setEditorTask] = useState<TaskRow | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const goalsById = useMemo(
    () => Object.fromEntries((goals.data ?? []).map((g) => [g.id, g])),
    [goals.data],
  );

  function complete(occurrence: Occurrence<TaskRow>, scope: CompletionScope) {
    setStatus.mutate({
      taskId: occurrence.task.id,
      date: occurrence.date,
      status: 'done',
      scope,
    });
  }

  function toggle(occurrence: Occurrence<TaskRow>) {
    if (occurrence.status === 'done') {
      // Unticking is never ambiguous: it clears the occurrence and, if the
      // task had been retired, brings it back.
      setStatus.mutate({ taskId: occurrence.task.id, date: occurrence.date, status: null });
      return;
    }

    // A one-off task has only one thing it could mean, so don't ask.
    if (!isRecurring(occurrence.task)) {
      complete(occurrence, 'task');
      return;
    }

    setCompletionPrompt(occurrence);
  }

  function openEditor(task: TaskRow | null) {
    setEditorTask(task);
    setEditorOpen(true);
  }

  async function handleRefresh() {
    setRefreshing(true);
    await Promise.all([refetch(), goals.refetch(), goalProgress.refetch(), profile.refetch()]);
    setRefreshing(false);
  }

  const nothingToday = lists.pending.length === 0 && lists.completed.length === 0;
  const everythingDone = lists.pending.length === 0 && lists.completed.length > 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + spacing.md,
            paddingBottom: insets.bottom + 96,
            paddingHorizontal: spacing.lg,
          },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.textMuted}
          />
        }
      >
        <View style={[styles.column, { maxWidth: CONTENT_MAX_WIDTH, gap: spacing.lg }]}>
          <View>
            <Text variant="caption" tone="faint">
              {formatLongDate(today, locale)}
            </Text>
            <Text variant="display">
              {t(`today.${greetingKey()}`)}
              {profile.data?.display_name ? `, ${profile.data.display_name}` : ''}
            </Text>
          </View>

          <ReassessBanner />

          {/*
            Long-term goals sit directly under the header: they are the reason
            today's tasks exist, so they stay in view every day without pushing
            the task list below the fold.
          */}
          <GoalStrip goals={goals.data ?? []} progress={goalProgress.data ?? {}} />

          <View style={{ gap: spacing.sm }}>
            <Text variant="label" tone="muted">
              {t('today.title')}
            </Text>

            {isLoading ? (
              <Card>
                <Text tone="muted">{t('common.loading')}</Text>
              </Card>
            ) : nothingToday ? (
              <Card style={{ gap: spacing.sm }}>
                <Text variant="heading">{t('today.noTasks')}</Text>
                <Text tone="muted">{t('today.noTasksBody')}</Text>
              </Card>
            ) : everythingDone ? (
              <Card style={{ gap: spacing.xs }}>
                <Text variant="heading">{t('today.allDone')}</Text>
                <Text tone="muted">{t('today.allDoneBody')}</Text>
              </Card>
            ) : (
              <View style={{ gap: spacing.sm }}>
                {lists.pending.map((occurrence) => (
                  <TaskItem
                    key={`${occurrence.task.id}-${occurrence.date}`}
                    occurrence={occurrence}
                    goal={occurrence.task.goal_id ? goalsById[occurrence.task.goal_id] : undefined}
                    onToggleDone={() => toggle(occurrence)}
                    onPress={() => openEditor(occurrence.task)}
                  />
                ))}
              </View>
            )}
          </View>

          {lists.missed.length > 0 ? (
            <View style={{ gap: spacing.sm }}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: missedOpen }}
                onPress={() => setMissedOpen((open) => !open)}
                style={[
                  styles.toggle,
                  { borderColor: colors.border, borderRadius: radius.md, padding: spacing.md },
                ]}
              >
                <Text variant="label" tone="muted">
                  {missedOpen ? '▾' : '▸'} {t('today.missedCount', { count: lists.missed.length })}
                </Text>
              </Pressable>

              {missedOpen
                ? lists.missed.map((occurrence) => (
                    <TaskItem
                      key={`missed-${occurrence.task.id}-${occurrence.date}`}
                      occurrence={occurrence}
                      goal={
                        occurrence.task.goal_id ? goalsById[occurrence.task.goal_id] : undefined
                      }
                      showDate
                      onToggleDone={() => toggle(occurrence)}
                      onPress={() => openEditor(occurrence.task)}
                    />
                  ))
                : null}
            </View>
          ) : null}

          {lists.completed.length > 0 ? (
            <View style={{ gap: spacing.sm }}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: completedOpen }}
                onPress={() => setCompletedOpen((open) => !open)}
                style={[
                  styles.toggle,
                  { borderColor: colors.border, borderRadius: radius.md, padding: spacing.md },
                ]}
              >
                <Text variant="label" tone="muted">
                  {completedOpen ? '▾' : '▸'}{' '}
                  {t('today.completedSection', { count: lists.completed.length })}
                </Text>
              </Pressable>

              {completedOpen
                ? lists.completed.map((occurrence) => (
                    <TaskItem
                      key={`done-${occurrence.task.id}-${occurrence.date}`}
                      occurrence={occurrence}
                      goal={
                        occurrence.task.goal_id ? goalsById[occurrence.task.goal_id] : undefined
                      }
                      onToggleDone={() => toggle(occurrence)}
                      onPress={() => openEditor(occurrence.task)}
                    />
                  ))
                : null}
            </View>
          ) : null}
        </View>
      </ScrollView>

      <View
        style={[
          styles.fab,
          { bottom: insets.bottom + spacing.lg, right: spacing.lg, left: spacing.lg },
        ]}
        pointerEvents="box-none"
      >
        <Button
          title={`+  ${t('today.addQuickTask')}`}
          onPress={() => openEditor(null)}
          style={{ alignSelf: 'center', minWidth: 200 }}
        />
      </View>

      <TaskCompletionSheet
        visible={!!completionPrompt}
        taskTitle={completionPrompt?.task.title ?? ''}
        onClose={() => setCompletionPrompt(null)}
        onChoose={(scope) => {
          if (completionPrompt) complete(completionPrompt, scope);
          setCompletionPrompt(null);
        }}
      />

      <TaskEditorSheet
        visible={editorOpen}
        task={editorTask}
        defaultDate={today}
        onClose={() => {
          setEditorOpen(false);
          setEditorTask(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { alignItems: 'center', flexGrow: 1 },
  column: { width: '100%' },
  toggle: { borderWidth: 1, borderStyle: 'dashed' },
  fab: { position: 'absolute' },
});
