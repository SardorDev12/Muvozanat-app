import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { useDeleteComponent, useUpdateComponent } from '@/features/goals/queries';
import type { GoalComponentRow } from '@/types/database';
import { useTheme } from '@/theme/ThemeProvider';

import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Sheet } from './ui/Sheet';

export type ComponentEditorSheetProps = {
  visible: boolean;
  onClose: () => void;
  component: GoalComponentRow | null;
  /** Runs after a successful delete, so the caller can navigate if needed. */
  onDeleted?: () => void;
  /** Confirms destructively before deleting — shared with the goal/task sheets
   * so the prompt looks the same everywhere in the app. */
  confirmDelete: (title: string, message: string, onConfirm: () => void) => void;
};

/**
 * Renames or deletes a component (a "subgoal" — the milestones a goal breaks
 * into). Goals and tasks already had this; components were create-and-toggle
 * only, with no way to fix a typo or remove one you no longer want.
 */
export function ComponentEditorSheet({
  visible,
  onClose,
  component,
  onDeleted,
  confirmDelete,
}: ComponentEditorSheetProps) {
  const { t } = useTranslation();
  const { spacing } = useTheme();

  const updateComponent = useUpdateComponent();
  const deleteComponent = useDeleteComponent();

  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Reset during render on identity change, matching TaskEditorSheet and
  // GoalEditorSheet: an effect would paint one frame of the previous
  // component's title before swapping in the real one.
  const formKey = visible ? (component?.id ?? null) : null;
  const [lastFormKey, setLastFormKey] = useState<string | null>(null);
  if (formKey !== lastFormKey) {
    setLastFormKey(formKey);
    if (formKey !== null) {
      setTitle(component?.title ?? '');
      setError(null);
    }
  }

  async function handleSave() {
    if (!component) return;
    const trimmed = title.trim();
    if (!trimmed) {
      setError(t('goals.componentTitle'));
      return;
    }
    setError(null);
    try {
      await updateComponent.mutateAsync({ id: component.id, patch: { title: trimmed } });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('errors.saveFailed'));
    }
  }

  function handleDelete() {
    if (!component) return;
    confirmDelete(t('goals.deleteComponent'), t('goals.deleteComponentConfirm'), async () => {
      await deleteComponent.mutateAsync({ id: component.id, goalId: component.goal_id });
      onClose();
      onDeleted?.();
    });
  }

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={t('goals.editComponent')}
      footer={
        <View style={{ gap: spacing.sm }}>
          <Button
            title={t('common.save')}
            full
            loading={updateComponent.isPending}
            onPress={handleSave}
          />
          <Button
            title={t('goals.deleteComponent')}
            variant="ghost"
            full
            loading={deleteComponent.isPending}
            onPress={handleDelete}
            style={{ opacity: 0.9 }}
          />
        </View>
      }
    >
      <Input
        label={t('goals.componentTitle')}
        placeholder={t('goals.componentTitlePlaceholder')}
        value={title}
        onChangeText={setTitle}
        autoFocus
        error={error}
        returnKeyType="done"
        onSubmitEditing={handleSave}
      />
    </Sheet>
  );
}
