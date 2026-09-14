import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { intlLocale } from '@/i18n';
import { useWeekdays } from '@/i18n/useWeekdays';
import { useTheme } from '@/theme/ThemeProvider';
import {
  daysInMonth,
  formatDate,
  fromDateKey,
  todayKey,
  toDateKey,
  type DateKey,
} from '@/utils/date';

import { Button } from './ui/Button';
import { Sheet } from './ui/Sheet';
import { Text } from './ui/Text';

/**
 * A hand-rolled month grid rather than a native picker: the community picker
 * has no usable web implementation, and this keeps the same interaction on all
 * three platforms.
 */
function MonthGrid({
  cursor,
  selected,
  onSelect,
}: {
  cursor: Date;
  selected: DateKey | null;
  onSelect: (key: DateKey) => void;
}) {
  const { colors, radius } = useTheme();
  const weekdays = useWeekdays();
  const today = todayKey();

  const cells = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const leading = new Date(year, month, 1).getDay();
    const total = daysInMonth(year, month);

    const out: (DateKey | null)[] = Array.from({ length: leading }, () => null);
    for (let day = 1; day <= total; day++) {
      out.push(toDateKey(new Date(year, month, day)));
    }
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [cursor]);

  return (
    <View style={{ gap: 4 }}>
      <View style={styles.weekRow}>
        {weekdays.short.map((label, i) => (
          <View key={`${label}-${i}`} style={styles.cell}>
            <Text variant="caption" tone="faint" center>
              {label}
            </Text>
          </View>
        ))}
      </View>

      {Array.from({ length: cells.length / 7 }, (_, week) => (
        <View key={`week-${week}`} style={styles.weekRow}>
          {cells.slice(week * 7, week * 7 + 7).map((key, i) => {
            if (!key) return <View key={`blank-${week}-${i}`} style={styles.cell} />;
            const isSelected = key === selected;
            const isToday = key === today;
            return (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                onPress={() => onSelect(key)}
                style={[
                  styles.cell,
                  styles.dayCell,
                  {
                    backgroundColor: isSelected ? colors.accent : 'transparent',
                    borderRadius: radius.sm,
                    borderWidth: isToday && !isSelected ? 1 : 0,
                    borderColor: colors.borderStrong,
                  },
                ]}
              >
                <Text
                  variant="body"
                  center
                  style={{ color: isSelected ? colors.accentText : colors.text }}
                >
                  {fromDateKey(key).getDate()}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

export type DatePickerProps = {
  visible: boolean;
  value: DateKey | null;
  title?: string;
  onClose: () => void;
  onChange: (value: DateKey | null) => void;
  allowClear?: boolean;
};

export function DatePicker({
  visible,
  value,
  title,
  onClose,
  onChange,
  allowClear = true,
}: DatePickerProps) {
  const { t, i18n } = useTranslation();
  const { colors, spacing } = useTheme();
  const locale = intlLocale(i18n.language);
  const [cursor, setCursor] = useState(() => fromDateKey(value ?? todayKey()));

  const monthLabel = new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
  }).format(cursor);

  function shiftMonth(delta: number) {
    setCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  }

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={title ?? t('tasks.dueDate')}
      footer={
        <View style={{ gap: spacing.sm }}>
          {allowClear ? (
            <Button
              title={t('tasks.noDueDate')}
              variant="secondary"
              full
              onPress={() => {
                onChange(null);
                onClose();
              }}
            />
          ) : null}
          <Button title={t('common.done')} full onPress={onClose} />
        </View>
      }
    >
      <View style={{ gap: spacing.md }}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            onPress={() => shiftMonth(-1)}
            hitSlop={12}
          >
            <Text variant="title" tone="accent">
              ‹
            </Text>
          </Pressable>
          <Text variant="heading">{monthLabel}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.next')}
            onPress={() => shiftMonth(1)}
            hitSlop={12}
          >
            <Text variant="title" tone="accent">
              ›
            </Text>
          </Pressable>
        </View>

        <MonthGrid
          cursor={cursor}
          selected={value}
          onSelect={(key) => {
            onChange(key);
            onClose();
          }}
        />

        <Pressable
          accessibilityRole="button"
          onPress={() => {
            const key = todayKey();
            setCursor(fromDateKey(key));
            onChange(key);
            onClose();
          }}
        >
          <Text variant="label" tone="accent" center>
            {t('common.today')}
          </Text>
        </Pressable>
      </View>
      <View style={{ height: 1, backgroundColor: colors.border }} />
      <Text variant="caption" tone="faint" center>
        {value ? formatDate(value, locale, { dateStyle: 'full' }) : t('tasks.noDueDate')}
      </Text>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  weekRow: { flexDirection: 'row', gap: 4 },
  cell: { flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  dayCell: { minHeight: 34 },
});
