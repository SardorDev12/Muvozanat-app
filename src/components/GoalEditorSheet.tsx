import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { LIFE_AREAS, type LifeAreaKey } from '@/features/assessment/areas';
import { useCreateGoal, useUpdateGoal } from '@/features/goals/queries';
import { intlLocale } from '@/i18n';
import { useTheme } from '@/theme/ThemeProvider';
import type { GoalRow } from '@/types/database';
import { formatDate, type DateKey } from '@/utils/date';

import { DatePicker } from './DatePicker';
import { Button } from './ui/Button';
import { Chip } from './ui/Chip';
import { Input } from './ui/Input';
import { Sheet } from './ui/Sheet';
import { Text } from './ui/Text';

export type GoalEditorSheetProps = {
  visible: boolean;
  onClose: () => void;
  goal?: GoalRow | null;
  /** Pre-selects the life area, e.g. the weakest one from the latest wheel. */
  defaultArea?: LifeAreaKey | null;
  onCreated?: (goal: GoalRow) => void;
};

export function GoalEditorSheet({
  visible,
  onClose,
  goal = null,
  defaultArea = null,
  onCreated,
}: GoalEditorSheetProps) {
  const { t, i18n } = useTranslation();
  const { colors, spacing } = useTheme();
  const locale = intlLocale(i18n.language);

  const createGoal = useCreateGoal();
  const updateGoal = useUpdateGoal();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [area, setArea] = useState<LifeAreaKey>('health');
  const [targetDate, setTargetDate] = useState<DateKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDate, setShowDate] = useState(false);

  // See TaskEditorSheet: reset during render on identity change rather than in
  // an effect, so the sheet never shows the previous goal's values first.
  const formKey = visible ? (goal?.id ?? `new:${defaultArea ?? ''}`) : null;
  const [lastFormKey, setLastFormKey] = useState<string | null>(null);

  if (formKey !== lastFormKey) {
    setLastFormKey(formKey);
    if (formKey !== null) {
      setTitle(goal?.title ?? '');
      setDescription(goal?.description ?? '');
      setArea(goal?.area ?? defaultArea ?? 'health');
      setTargetDate(goal?.target_date ?? null);
      setError(null);
    }
  }

  const saving = createGoal.isPending || updateGoal.isPending;

  async function handleSave() {
    const trimmed = title.trim();
    if (!trimmed) {
      setError(t('goals.goalTitle'));
      return;
    }
    setError(null);

    try {
      if (goal) {
        await updateGoal.mutateAsync({
          id: goal.id,
          patch: {
            title: trimmed,
            description: description.trim() || null,
            area,
            target_date: targetDate,
          },
        });
      } else {
        const created = await createGoal.mutateAsync({
          title: trimmed,
          description: description.trim() || null,
          area,
          target_date: targetDate,
        });
        onCreated?.(created);
      }
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('errors.saveFailed'));
    }
  }

  return (
    <>
      <Sheet
        visible={visible}
        onClose={onClose}
        title={goal ? t('goals.editGoal') : t('goals.newGoal')}
        footer={<Button title={t('common.save')} full loading={saving} onPress={handleSave} />}
      >
        <Input
          label={t('goals.goalTitle')}
          placeholder={t('goals.goalTitlePlaceholder')}
          value={title}
          onChangeText={setTitle}
          autoFocus
          error={error}
        />

        <Input
          label={t('goals.goalDescription')}
          placeholder={t('goals.goalDescriptionPlaceholder')}
          value={description}
          onChangeText={setDescription}
          multiline
        />

        <View style={{ gap: spacing.sm }}>
          <Text variant="label" tone="muted">
            {t('goals.lifeArea')}
          </Text>
          <View style={styles.chipRow}>
            {LIFE_AREAS.map((option) => (
              <Chip
                key={option.key}
                label={`${option.emoji} ${t(`areas.${option.key}.name`)}`}
                color={option.color}
                selected={area === option.key}
                onPress={() => setArea(option.key)}
              />
            ))}
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => setShowDate(true)}
          style={[styles.field, { borderColor: colors.border }]}
        >
          <Text variant="label" tone="muted">
            {t('goals.targetDate')}
          </Text>
          <Text variant="body" tone="accent">
            {targetDate
              ? formatDate(targetDate, locale, { dateStyle: 'medium' })
              : t('goals.noTargetDate')}
          </Text>
        </Pressable>
      </Sheet>

      <DatePicker
        visible={showDate}
        value={targetDate}
        title={t('goals.targetDate')}
        onClose={() => setShowDate(false)}
        onChange={setTargetDate}
      />
    </>
  );
}

const styles = StyleSheet.create({
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  field: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
