import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ComponentEditorSheet } from '@/components/ComponentEditorSheet';
import { GoalEditorSheet } from '@/components/GoalEditorSheet';
import { ProgressRing } from '@/components/ProgressRing';
import { TaskEditorSheet } from '@/components/TaskEditorSheet';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/Checkbox';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { AREA_BY_KEY } from '@/features/assessment/areas';
import {
  useComponents,
  useCreateComponent,
  useDeleteGoal,
  useGoal,
  useGoalProgress,
  useUpdateComponent,
  useUpdateGoal,
} from '@/features/goals/queries';
import { useRecurrenceLabel } from '@/features/tasks/describe';
import { useTasksForGoal, useUpdateTask } from '@/features/tasks/queries';
import { nextOccurrence } from '@/features/tasks/recurrence';
import { intlLocale } from '@/i18n';
import { useTheme } from '@/theme/ThemeProvider';
import type { GoalComponentRow, TaskRow } from '@/types/database';
import { formatDate } from '@/utils/date';
import { useTodayKey } from '@/utils/useNow';

function confirmDestructive(title: string, message: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: onConfirm },
  ]);
}

/**
 * One task row inside a goal. The checkbox here means "is this task finished",
 * not "did I do it today" — finishing the last task in a component is what
 * rolls the component, and then the goal, up to complete.
 */
function GoalTaskRow({
  task,
  accent,
  onPress,
}: {
  task: TaskRow;
  accent: string;
  onPress: () => void;
}) {
  const { colors, radius, spacing } = useTheme();
  const { t, i18n } = useTranslation();
  const describe = useRecurrenceLabel();
  const updateTask = useUpdateTask();
  const locale = intlLocale(i18n.language);
  const today = useTodayKey();

  const finished = !!task.completed_at;
  const next = nextOccurrence(task, today);
  const subtitle = task.recurrence
    ? describe(task.recurrence, task.starts_on)
    : task.due_date
      ? formatDate(task.due_date, locale, { dateStyle: 'medium' })
      : t('tasks.noDueDate');

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.taskRow,
        {
          borderColor: colors.border,
          borderRadius: radius.md,
          padding: spacing.md,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <Checkbox
        checked={finished}
        color={accent}
        accessibilityLabel={finished ? t('tasks.reopenTask') : t('tasks.doneCompletely')}
        onToggle={() =>
          updateTask.mutate({
            id: task.id,
            patch: { completed_at: finished ? null : new Date().toISOString() },
          })
        }
      />
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          variant="body"
          tone={finished ? 'faint' : 'default'}
          style={finished ? styles.struck : undefined}
        >
          {task.title}
        </Text>
        <Text variant="caption" tone="faint">
          {subtitle}
          {next && task.recurrence && !finished ? ` · ${formatDate(next, locale)}` : ''}
        </Text>
      </View>
      <Text variant="body" tone="faint">
        ›
      </Text>
    </Pressable>
  );
}

export default function GoalDetailScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const goal = useGoal(id);
  const components = useComponents(id);
  const tasks = useTasksForGoal(id);
  const progress = useGoalProgress();

  const createComponent = useCreateComponent();
  const updateComponent = useUpdateComponent();
  const updateGoal = useUpdateGoal();
  const deleteGoal = useDeleteGoal();

  const [newComponent, setNewComponent] = useState('');
  const [goalEditorOpen, setGoalEditorOpen] = useState(false);
  const [editingComponent, setEditingComponent] = useState<GoalComponentRow | null>(null);
  const [taskEditor, setTaskEditor] = useState<{
    open: boolean;
    task: TaskRow | null;
    componentId: string | null;
  }>({ open: false, task: null, componentId: null });

  const tasksByComponent = useMemo(() => {
    const map = new Map<string | null, TaskRow[]>();
    for (const task of tasks.data ?? []) {
      const key = task.component_id ?? null;
      map.set(key, [...(map.get(key) ?? []), task]);
    }
    return map;
  }, [tasks.data]);

  if (!goal.data) {
    return (
      <Screen>
        <Text tone="muted">{goal.isLoading ? t('common.loading') : t('errors.notFound')}</Text>
      </Screen>
    );
  }

  const row = goal.data;
  const area = AREA_BY_KEY[row.area];
  const stats = progress.data?.[row.id];
  const ratio = stats && stats.total_tasks > 0 ? stats.done_tasks / stats.total_tasks : 0;
  const directTasks = tasksByComponent.get(null) ?? [];

  function openTaskEditor(task: TaskRow | null, componentId: string | null) {
    setTaskEditor({ open: true, task, componentId });
  }

  return (
    <Screen>
      <View style={{ gap: spacing.lg, paddingBottom: spacing.xl }}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={8}>
          <Text variant="label" tone="accent">
            ‹ {t('goals.title')}
          </Text>
        </Pressable>

        <View style={{ gap: spacing.sm }}>
          <Text variant="caption" style={{ color: area.color }}>
            {area.emoji} {t(`areas.${row.area}.name`)}
          </Text>
          <Text variant="display">{row.title}</Text>
          {row.description ? <Text tone="muted">{row.description}</Text> : null}

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <ProgressRing progress={ratio} color={area.color} size={38} />
            <Text variant="label" tone="muted">
              {stats
                ? t('goals.progress', { done: stats.done_tasks, total: stats.total_tasks })
                : t('goals.progressPercent', { percent: 0 })}
            </Text>
          </View>
        </View>

        {/* Components: the milestones a long-term goal breaks into. */}
        <Card style={{ gap: spacing.md }}>
          <View style={{ gap: spacing.xs }}>
            <Text variant="heading">{t('goals.components')}</Text>
            <Text variant="caption" tone="faint">
              {t('goals.componentsHint')}
            </Text>
          </View>

          {(components.data ?? []).length === 0 ? (
            <Text variant="caption" tone="faint">
              {t('goals.noComponents')}
            </Text>
          ) : (
            (components.data ?? []).map((component) => {
              const componentTasks = tasksByComponent.get(component.id) ?? [];
              const componentDone = component.status === 'done';
              // Once a component has tasks its status is derived by the
              // database rollup — every task finished means the component is
              // finished. A manual toggle would just be overwritten by the next
              // task write, so the checkbox becomes a read-out. An empty
              // component has nothing to derive from and stays manual.
              const derived = componentTasks.length > 0;
              const finishedTasks = componentTasks.filter((task) => !!task.completed_at).length;

              return (
                <View key={component.id} style={{ gap: spacing.sm }}>
                  <View style={styles.componentHeader}>
                    <Checkbox
                      checked={componentDone}
                      color={area.color}
                      disabled={derived}
                      accessibilityLabel={component.title}
                      onToggle={() =>
                        updateComponent.mutate({
                          id: component.id,
                          patch: { status: componentDone ? 'active' : 'done' },
                        })
                      }
                    />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text
                        variant="heading"
                        style={componentDone ? styles.struck : undefined}
                        tone={componentDone ? 'faint' : 'default'}
                      >
                        {component.title}
                      </Text>
                      {derived ? (
                        <Text variant="caption" tone="faint">
                          {t('goals.progress', {
                            done: finishedTasks,
                            total: componentTasks.length,
                          })}{' '}
                          · {t('tasks.rollupHint')}
                        </Text>
                      ) : null}
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t('goals.editComponent')}
                      onPress={() => setEditingComponent(component)}
                      hitSlop={8}
                    >
                      <Text variant="body" tone="faint">
                        ✎
                      </Text>
                    </Pressable>
                  </View>

                  <View style={{ gap: spacing.sm, paddingLeft: spacing.xl }}>
                    {componentTasks.map((task) => (
                      <GoalTaskRow
                        key={task.id}
                        task={task}
                        accent={area.color}
                        onPress={() => openTaskEditor(task, component.id)}
                      />
                    ))}
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => openTaskEditor(null, component.id)}
                      hitSlop={6}
                    >
                      <Text variant="label" tone="accent">
                        + {t('goals.newTask')}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              );
            })
          )}

          <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-end' }}>
            <Input
              containerStyle={{ flex: 1 }}
              placeholder={t('goals.componentTitlePlaceholder')}
              value={newComponent}
              onChangeText={setNewComponent}
              returnKeyType="done"
              onSubmitEditing={() => {
                if (!newComponent.trim()) return;
                createComponent.mutate({ goalId: row.id, title: newComponent });
                setNewComponent('');
              }}
            />
            <Button
              title={t('common.add')}
              size="md"
              disabled={!newComponent.trim()}
              loading={createComponent.isPending}
              onPress={() => {
                if (!newComponent.trim()) return;
                createComponent.mutate({ goalId: row.id, title: newComponent });
                setNewComponent('');
              }}
            />
          </View>
        </Card>

        {/* Tasks hanging directly off the goal, with no component in between. */}
        <Card style={{ gap: spacing.md }}>
          <Text variant="heading">{t('goals.directTasks')}</Text>
          {directTasks.map((task) => (
            <GoalTaskRow
              key={task.id}
              task={task}
              accent={area.color}
              onPress={() => openTaskEditor(task, null)}
            />
          ))}
          <Pressable
            accessibilityRole="button"
            onPress={() => openTaskEditor(null, null)}
            hitSlop={6}
          >
            <Text variant="label" tone="accent">
              + {t('goals.newTask')}
            </Text>
          </Pressable>
        </Card>

        <View style={{ gap: spacing.sm }}>
          <Button
            title={row.status === 'done' ? t('goals.reopen') : t('goals.markDone')}
            variant="secondary"
            full
            onPress={() =>
              updateGoal.mutate({
                id: row.id,
                patch: { status: row.status === 'done' ? 'active' : 'done' },
              })
            }
          />
          <Button
            title={t('common.edit')}
            variant="ghost"
            full
            onPress={() => setGoalEditorOpen(true)}
          />
          <Button
            title={t('goals.deleteGoal')}
            variant="ghost"
            full
            style={{ opacity: 0.9 }}
            onPress={() =>
              confirmDestructive(t('goals.deleteGoal'), t('goals.deleteGoalConfirm'), async () => {
                await deleteGoal.mutateAsync(row.id);
                router.replace('/goals');
              })
            }
          />
          <Text variant="caption" tone="faint" center style={{ color: colors.textFaint }}>
            {t(`goals.status.${row.status}`)}
          </Text>
        </View>
      </View>

      <GoalEditorSheet
        visible={goalEditorOpen}
        goal={row}
        onClose={() => setGoalEditorOpen(false)}
      />

      <ComponentEditorSheet
        visible={!!editingComponent}
        component={editingComponent}
        onClose={() => setEditingComponent(null)}
        confirmDelete={confirmDestructive}
      />

      <TaskEditorSheet
        visible={taskEditor.open}
        task={taskEditor.task}
        goalId={row.id}
        componentId={taskEditor.componentId}
        onClose={() => setTaskEditor({ open: false, task: null, componentId: null })}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  taskRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, gap: 8 },
  componentHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  struck: { textDecorationLine: 'line-through' },
});
