import React, { useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useComponents } from '@/features/goals/queries';
import { useRecurrenceLabel } from '@/features/tasks/describe';
import {
  useCreateTask,
  useDeleteTask,
  useUpdateTask,
  type TaskInput,
} from '@/features/tasks/queries';
import type { Recurrence } from '@/features/tasks/recurrence';
import { intlLocale } from '@/i18n';
import { useTheme } from '@/theme/ThemeProvider';
import type { TaskRow } from '@/types/database';
import { formatDate, todayKey, type DateKey } from '@/utils/date';

import { DatePicker } from './DatePicker';
import { RecurrencePicker } from './RecurrencePicker';
import { Button } from './ui/Button';
import { Chip } from './ui/Chip';
import { Input } from './ui/Input';
import { Sheet } from './ui/Sheet';
import { Text } from './ui/Text';

function confirm(title: string, message: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: onConfirm },
  ]);
}

export type TaskEditorSheetProps = {
  visible: boolean;
  onClose: () => void;
  /** Editing an existing task, or null to create one. */
  task?: TaskRow | null;
  /** Pre-attach a new task to this goal. */
  goalId?: string | null;
  componentId?: string | null;
  defaultDate?: DateKey | null;
};

export function TaskEditorSheet({
  visible,
  onClose,
  task = null,
  goalId = null,
  componentId = null,
  defaultDate,
}: TaskEditorSheetProps) {
  const { t, i18n } = useTranslation();
  const { colors, spacing } = useTheme();
  const locale = intlLocale(i18n.language);
  const describe = useRecurrenceLabel();

  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const components = useComponents(goalId ?? task?.goal_id ?? undefined);

  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [dueDate, setDueDate] = useState<DateKey | null>(null);
  const [recurrence, setRecurrence] = useState<Recurrence | null>(null);
  const [startsOn, setStartsOn] = useState<DateKey>(todayKey());
  const [selectedComponent, setSelectedComponent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDate, setShowDate] = useState(false);
  const [showRepeat, setShowRepeat] = useState(false);

  // Reset the form whenever the sheet opens on a different task, so a previous
  // edit never leaks in. This is React's "adjust state when props change"
  // pattern rather than an effect: it runs during the same render, so the
  // sheet never paints one frame of stale values.
  const formKey = visible ? (task?.id ?? `new:${componentId ?? ''}:${defaultDate ?? ''}`) : null;
  const [lastFormKey, setLastFormKey] = useState<string | null>(null);

  if (formKey !== lastFormKey) {
    setLastFormKey(formKey);
    if (formKey !== null) {
      setTitle(task?.title ?? '');
      setNotes(task?.notes ?? '');
      setDueDate(task?.due_date ?? defaultDate ?? null);
      setRecurrence(task?.recurrence ?? null);
      setStartsOn(task?.starts_on ?? defaultDate ?? todayKey());
      setSelectedComponent(task?.component_id ?? componentId);
      setError(null);
    }
  }

  const effectiveGoalId = task?.goal_id ?? goalId;
  const saving = createTask.isPending || updateTask.isPending;

  async function handleSave() {
    const trimmed = title.trim();
    if (!trimmed) {
      setError(t('tasks.taskTitle'));
      return;
    }
    setError(null);

    const payload: TaskInput = {
      title: trimmed,
      notes: notes.trim() || null,
      goal_id: effectiveGoalId ?? null,
      component_id: effectiveGoalId ? selectedComponent : null,
      due_date: recurrence ? null : dueDate,
      starts_on: recurrence ? startsOn : null,
      recurrence,
    };

    try {
      if (task) {
        await updateTask.mutateAsync({ id: task.id, patch: payload as Partial<TaskRow> });
      } else {
        await createTask.mutateAsync(payload);
      }
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('errors.saveFailed'));
    }
  }

  function handleDelete() {
    if (!task) return;
    confirm(t('tasks.deleteTask'), t('tasks.deleteTaskConfirm'), async () => {
      await deleteTask.mutateAsync({ id: task.id, goalId: task.goal_id });
      onClose();
    });
  }

  return (
    <>
      <Sheet
        visible={visible}
        onClose={onClose}
        title={task ? t('tasks.editTask') : t('tasks.newTask')}
        footer={
          <View style={{ gap: spacing.sm }}>
            <Button title={t('common.save')} full loading={saving} onPress={handleSave} />
            {task ? (
              <Button
                title={t('tasks.deleteTask')}
                variant="ghost"
                full
                onPress={handleDelete}
                style={{ opacity: 0.9 }}
              />
            ) : null}
          </View>
        }
      >
        <Input
          label={t('tasks.taskTitle')}
          placeholder={t('tasks.taskTitlePlaceholder')}
          value={title}
          onChangeText={setTitle}
          autoFocus
          error={error}
          returnKeyType="done"
          onSubmitEditing={handleSave}
        />

        <Input
          label={t('tasks.notes')}
          placeholder={t('tasks.notesPlaceholder')}
          value={notes}
          onChangeText={setNotes}
          multiline
        />

        <Pressable
          accessibilityRole="button"
          onPress={() => setShowDate(true)}
          disabled={!!recurrence}
          style={[styles.field, { borderColor: colors.border, opacity: recurrence ? 0.5 : 1 }]}
        >
          <Text variant="label" tone="muted">
            {t('tasks.dueDate')}
          </Text>
          <Text variant="body" tone="accent">
            {recurrence
              ? formatDate(startsOn, locale, { dateStyle: 'medium' })
              : dueDate
                ? formatDate(dueDate, locale, { dateStyle: 'medium' })
                : t('tasks.noDueDate')}
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={() => setShowRepeat(true)}
          style={[styles.field, { borderColor: colors.border }]}
        >
          <Text variant="label" tone="muted">
            {t('tasks.repeat')}
          </Text>
          <Text variant="body" tone="accent" numberOfLines={1} style={styles.fieldValue}>
            {describe(recurrence, startsOn)}
          </Text>
        </Pressable>

        {effectiveGoalId && (components.data ?? []).length > 0 ? (
          <View style={{ gap: spacing.sm }}>
            <Text variant="label" tone="muted">
              {t('tasks.attachTo')}
            </Text>
            <View style={styles.chipRow}>
              <Chip
                label={t('goals.directTasks')}
                selected={!selectedComponent}
                onPress={() => setSelectedComponent(null)}
              />
              {(components.data ?? []).map((component) => (
                <Chip
                  key={component.id}
                  label={component.title}
                  selected={selectedComponent === component.id}
                  onPress={() => setSelectedComponent(component.id)}
                />
              ))}
            </View>
          </View>
        ) : null}
      </Sheet>

      <DatePicker
        visible={showDate}
        value={dueDate}
        onClose={() => setShowDate(false)}
        onChange={setDueDate}
      />

      <RecurrencePicker
        visible={showRepeat}
        value={recurrence}
        startsOn={startsOn}
        onClose={() => setShowRepeat(false)}
        onChange={({ recurrence: next, startsOn: nextStart }) => {
          setRecurrence(next);
          setStartsOn(nextStart);
          // A repeating task is scheduled by its rule, so a one-off due date
          // would be dead data.
          if (next) setDueDate(null);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  fieldValue: { flexShrink: 1, textAlign: 'right' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
