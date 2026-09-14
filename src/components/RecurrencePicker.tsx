import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useRecurrenceLabel } from '@/features/tasks/describe';
import {
  DEFAULT_RECURRENCE,
  presetForRecurrence,
  recurrenceForPreset,
  type Frequency,
  type Recurrence,
  type RecurrencePresetId,
} from '@/features/tasks/recurrence';
import { intlLocale } from '@/i18n';
import { useWeekdays } from '@/i18n/useWeekdays';
import { useTheme } from '@/theme/ThemeProvider';
import { addDays, formatDate, fromDateKey, weekday, type DateKey } from '@/utils/date';

import { DatePicker } from './DatePicker';
import { Button } from './ui/Button';
import { Chip } from './ui/Chip';
import { Sheet } from './ui/Sheet';
import { Text } from './ui/Text';

const PRESETS: RecurrencePresetId[] = ['none', 'daily', 'weekly', 'monthly', 'yearly', 'custom'];
const FREQUENCIES: Frequency[] = ['daily', 'weekly', 'monthly', 'yearly'];

function Stepper({
  value,
  onChange,
  min = 1,
  max = 99,
  label,
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  label: string;
}) {
  const { colors, radius, spacing } = useTheme();

  return (
    <View
      style={[
        styles.stepper,
        { borderColor: colors.border, borderRadius: radius.md, gap: spacing.md },
      ]}
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min, max, now: value }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="-"
        hitSlop={8}
        onPress={() => onChange(Math.max(min, value - 1))}
      >
        <Text variant="title" tone={value <= min ? 'faint' : 'accent'}>
          −
        </Text>
      </Pressable>
      <Text variant="heading">{value}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="+"
        hitSlop={8}
        onPress={() => onChange(Math.min(max, value + 1))}
      >
        <Text variant="title" tone={value >= max ? 'faint' : 'accent'}>
          +
        </Text>
      </Pressable>
    </View>
  );
}

export type RecurrencePickerProps = {
  visible: boolean;
  onClose: () => void;
  /** Current rule, or null for "does not repeat". */
  value: Recurrence | null;
  /** The task's start date; a repeating task always has one. */
  startsOn: DateKey;
  onChange: (next: { recurrence: Recurrence | null; startsOn: DateKey }) => void;
};

export function RecurrencePicker({
  visible,
  onClose,
  value,
  startsOn,
  onChange,
}: RecurrencePickerProps) {
  const { t, i18n } = useTranslation();
  const { colors, spacing } = useTheme();
  const weekdays = useWeekdays();
  const describe = useRecurrenceLabel();
  const locale = intlLocale(i18n.language);

  const [draft, setDraft] = useState<Recurrence | null>(value);
  const [draftStart, setDraftStart] = useState<DateKey>(startsOn);
  const [preset, setPreset] = useState<RecurrencePresetId>(() =>
    presetForRecurrence(value, startsOn),
  );
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  function choosePreset(next: RecurrencePresetId) {
    setPreset(next);
    if (next === 'none') {
      setDraft(null);
    } else if (next === 'custom') {
      setDraft(draft ?? { ...DEFAULT_RECURRENCE, byWeekday: [weekday(draftStart)] });
    } else {
      setDraft(recurrenceForPreset(next, draftStart));
    }
  }

  function patch(changes: Partial<Recurrence>) {
    setDraft((prev) => ({ ...(prev ?? DEFAULT_RECURRENCE), ...changes }));
    setPreset('custom');
  }

  function toggleWeekday(day: number) {
    const current = draft?.byWeekday ?? [weekday(draftStart)];
    const next = current.includes(day) ? current.filter((d) => d !== day) : [...current, day];
    // Never let the set empty out — an empty weekly rule would never fire.
    patch({ byWeekday: next.length > 0 ? next.sort((a, b) => a - b) : current });
  }

  const isCustom = preset === 'custom';
  const end = draft?.end ?? { type: 'never' as const };

  return (
    <>
      <Sheet
        visible={visible}
        onClose={onClose}
        title={t('recurrence.label')}
        footer={
          <Button
            title={t('common.done')}
            full
            onPress={() => {
              onChange({ recurrence: draft, startsOn: draftStart });
              onClose();
            }}
          />
        }
      >
        <View style={styles.chipRow}>
          {PRESETS.map((id) => (
            <Chip
              key={id}
              label={t(`recurrence.${id === 'none' ? 'none' : id}`)}
              selected={preset === id}
              onPress={() => choosePreset(id)}
            />
          ))}
        </View>

        {draft ? (
          <>
            <Pressable
              accessibilityRole="button"
              onPress={() => setShowStartPicker(true)}
              style={[styles.field, { borderColor: colors.border }]}
            >
              <Text variant="label" tone="muted">
                {t('recurrence.startsOn')}
              </Text>
              <Text variant="body" tone="accent">
                {formatDate(draftStart, locale, { dateStyle: 'medium' })}
              </Text>
            </Pressable>

            {isCustom ? (
              <View style={{ gap: spacing.md }}>
                <Text variant="label" tone="muted">
                  {t('recurrence.repeatEvery')}
                </Text>
                <View style={styles.inlineRow}>
                  <Stepper
                    value={draft.interval}
                    onChange={(interval) => patch({ interval })}
                    label={t('recurrence.repeatEvery')}
                  />
                  <View style={styles.chipRow}>
                    {FREQUENCIES.map((freq) => {
                      const unit =
                        freq === 'daily'
                          ? 'day'
                          : freq === 'weekly'
                            ? 'week'
                            : freq === 'monthly'
                              ? 'month'
                              : 'year';
                      return (
                        <Chip
                          key={freq}
                          label={t(`recurrence.unit.${unit}`)}
                          selected={draft.freq === freq}
                          onPress={() => patch({ freq })}
                        />
                      );
                    })}
                  </View>
                </View>
              </View>
            ) : null}

            {draft.freq === 'weekly' ? (
              <View style={{ gap: spacing.sm }}>
                <Text variant="label" tone="muted">
                  {t('recurrence.onDays')}
                </Text>
                <View style={styles.chipRow}>
                  {weekdays.short.map((label, day) => (
                    <Chip
                      key={`${label}-${day}`}
                      label={label}
                      selected={(draft.byWeekday ?? [weekday(draftStart)]).includes(day)}
                      onPress={() => toggleWeekday(day)}
                    />
                  ))}
                </View>
              </View>
            ) : null}

            {draft.freq === 'monthly' ? (
              <View style={styles.chipRow}>
                <Chip
                  label={t('recurrence.monthlyOnDay', { day: fromDateKey(draftStart).getDate() })}
                  selected={draft.monthlyMode !== 'nthWeekday'}
                  onPress={() => patch({ monthlyMode: 'dayOfMonth' })}
                />
                <Chip
                  label={`${weekdays.long[weekday(draftStart)] ?? ''} #${Math.ceil(
                    fromDateKey(draftStart).getDate() / 7,
                  )}`}
                  selected={draft.monthlyMode === 'nthWeekday'}
                  onPress={() => patch({ monthlyMode: 'nthWeekday' })}
                />
              </View>
            ) : null}

            <View style={{ gap: spacing.sm }}>
              <Text variant="label" tone="muted">
                {t('recurrence.endsLabel')}
              </Text>
              <View style={styles.chipRow}>
                <Chip
                  label={t('recurrence.endsNever')}
                  selected={end.type === 'never'}
                  onPress={() => patch({ end: { type: 'never' } })}
                />
                <Chip
                  label={
                    end.type === 'on'
                      ? formatDate(end.date, locale, { dateStyle: 'medium' })
                      : t('recurrence.endsOn')
                  }
                  selected={end.type === 'on'}
                  onPress={() => {
                    if (end.type !== 'on') {
                      patch({ end: { type: 'on', date: addDays(draftStart, 30) } });
                    }
                    setShowEndPicker(true);
                  }}
                />
                <Chip
                  label={
                    end.type === 'after'
                      ? t('recurrence.occurrences', { count: end.count })
                      : t('recurrence.endsAfter')
                  }
                  selected={end.type === 'after'}
                  onPress={() => patch({ end: { type: 'after', count: 10 } })}
                />
              </View>

              {end.type === 'after' ? (
                <Stepper
                  value={end.count}
                  min={1}
                  max={999}
                  onChange={(count) => patch({ end: { type: 'after', count } })}
                  label={t('recurrence.endsAfter')}
                />
              ) : null}
            </View>

            <Text variant="caption" tone="muted">
              {describe(draft, draftStart)}
            </Text>
          </>
        ) : null}
      </Sheet>

      <DatePicker
        visible={showStartPicker}
        value={draftStart}
        title={t('recurrence.startsOn')}
        allowClear={false}
        onClose={() => setShowStartPicker(false)}
        onChange={(next) => {
          if (!next) return;
          setDraftStart(next);
          // A weekly rule anchored to the old start day would silently keep
          // firing on the wrong weekday, so re-anchor it.
          if (draft?.freq === 'weekly' && preset !== 'custom') {
            setDraft({ ...draft, byWeekday: [weekday(next)] });
          }
        }}
      />

      <DatePicker
        visible={showEndPicker}
        value={end.type === 'on' ? end.date : null}
        title={t('recurrence.endsOn')}
        allowClear={false}
        onClose={() => setShowEndPicker(false)}
        onChange={(next) => {
          if (next) patch({ end: { type: 'on', date: next } });
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  inlineRow: { gap: 12 },
  field: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepper: {
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
});
