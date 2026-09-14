import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import {
  AREA_BY_KEY,
  MAX_SCORE,
  MIN_SCORE,
  type LifeAreaKey,
} from '@/features/assessment/areas';
import { useTheme } from '@/theme/ThemeProvider';

import { Sheet } from './ui/Sheet';
import { Text } from './ui/Text';

/**
 * Written out rather than generated, so the type is the literal union 1..10.
 * That is what lets the i18n types check `levels.<area>.l<score>` at compile
 * time: a plain `number` would widen the key and silently allow a typo.
 */
const SCORES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
type ScoreValue = (typeof SCORES)[number];

/** Scores arrive from the database as plain numbers; the column is 1-10. */
function asScore(value: number): ScoreValue {
  const clamped = Math.min(MAX_SCORE, Math.max(MIN_SCORE, Math.round(value)));
  return clamped as ScoreValue;
}

export type ScoreSelectProps = {
  area: LifeAreaKey;
  value: number;
  onChange: (score: number) => void;
  onFocusArea?: (area: LifeAreaKey | null) => void;
};

/**
 * Picks a score by reading what each one means, rather than by dragging a bar
 * and guessing. Choosing 4 over 6 is a judgement about your own life, and the
 * only way to make it honestly is to see the two descriptions side by side.
 */
export function ScoreSelect({ area, value, onChange, onFocusArea }: ScoreSelectProps) {
  const { colors, radius, spacing } = useTheme();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const meta = AREA_BY_KEY[area];
  const describe = (score: number) => t(`levels.${area}.l${asScore(score)}`);

  function choose(score: number) {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync().catch(() => {});
    }
    onChange(score);
    setOpen(false);
    onFocusArea?.(null);
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t(`areas.${area}.name`)}, ${value} / ${MAX_SCORE}`}
        accessibilityHint={describe(value)}
        onPress={() => {
          onFocusArea?.(area);
          setOpen(true);
        }}
        style={({ pressed }) => [
          styles.row,
          {
            borderColor: colors.border,
            borderRadius: radius.md,
            padding: spacing.md,
            gap: spacing.sm,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        <View style={styles.header}>
          <Text variant="heading">{meta.emoji}</Text>
          <Text variant="heading" style={styles.grow} numberOfLines={1}>
            {t(`areas.${area}.name`)}
          </Text>
          <View
            style={[
              styles.badge,
              { backgroundColor: meta.color, borderRadius: radius.sm, minWidth: 38 },
            ]}
          >
            <Text variant="label" style={styles.onColor}>
              {value}
            </Text>
          </View>
          <Text variant="body" tone="faint">
            ›
          </Text>
        </View>
        <Text variant="caption" tone="muted">
          {describe(value)}
        </Text>
      </Pressable>

      <Sheet
        visible={open}
        onClose={() => {
          setOpen(false);
          onFocusArea?.(null);
        }}
        title={`${meta.emoji}  ${t(`areas.${area}.name`)}`}
      >
        <Text variant="body" tone="muted">
          {t(`areas.${area}.question`)}
        </Text>

        <View style={{ gap: spacing.sm }}>
          {SCORES.map((score) => {
            const selected = score === value;
            return (
              <Pressable
                key={score}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => choose(score)}
                style={({ pressed }) => [
                  styles.option,
                  {
                    borderColor: selected ? meta.color : colors.border,
                    backgroundColor: selected ? colors.surfaceAlt : colors.surface,
                    borderRadius: radius.md,
                    padding: spacing.md,
                    gap: spacing.md,
                    borderWidth: selected ? 2 : 1,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <View
                  style={[
                    styles.optionBadge,
                    {
                      backgroundColor: selected ? meta.color : colors.surfaceAlt,
                      borderRadius: radius.sm,
                    },
                  ]}
                >
                  <Text
                    variant="heading"
                    style={selected ? styles.onColor : undefined}
                    tone={selected ? undefined : 'muted'}
                  >
                    {score}
                  </Text>
                </View>
                <Text variant="body" style={styles.grow}>
                  {describe(score)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  row: { borderWidth: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  grow: { flex: 1 },
  badge: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, paddingVertical: 3 },
  option: { flexDirection: 'row', alignItems: 'center' },
  optionBadge: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  onColor: { color: '#0E1116' },
});
