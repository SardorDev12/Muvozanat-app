import * as Haptics from 'expo-haptics';
import React, { useCallback, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import {
  AREA_BY_KEY,
  MAX_SCORE,
  MIN_SCORE,
  bandForScore,
  type LifeAreaKey,
} from '@/features/assessment/areas';
import { useTheme } from '@/theme/ThemeProvider';

import { Text } from './ui/Text';

const STEPS = Array.from({ length: MAX_SCORE }, (_, i) => i + 1);

export type ScoreInputProps = {
  area: LifeAreaKey;
  value: number;
  onChange: (score: number) => void;
  onFocusArea?: (area: LifeAreaKey | null) => void;
};

export function ScoreInput({ area, value, onChange, onFocusArea }: ScoreInputProps) {
  const { colors, radius, spacing } = useTheme();
  const { t } = useTranslation();
  const [trackWidth, setTrackWidth] = useState(0);

  const meta = AREA_BY_KEY[area];

  // Dragging fires many events per second; comparing against the current value
  // keeps a single haptic tick per step instead of one per event.
  const commit = useCallback(
    (next: number) => {
      const clamped = Math.min(MAX_SCORE, Math.max(MIN_SCORE, next));
      if (clamped === value) return;
      if (Platform.OS !== 'web') {
        Haptics.selectionAsync().catch(() => {});
      }
      onChange(clamped);
    },
    [value, onChange],
  );

  const scoreFromX = useCallback(
    (x: number) => {
      if (trackWidth <= 0) return value;
      const ratio = x / trackWidth;
      return Math.min(MAX_SCORE, Math.max(MIN_SCORE, Math.ceil(ratio * MAX_SCORE)));
    },
    [trackWidth, value],
  );

  const handleAt = useCallback(
    (x: number) => {
      commit(scoreFromX(x));
    },
    [commit, scoreFromX],
  );

  const focus = useCallback(
    (next: LifeAreaKey | null) => {
      onFocusArea?.(next);
    },
    [onFocusArea],
  );

  // minDistance(0) makes a plain tap land on onBegin, so the same gesture
  // handles both tapping a segment and dragging across the scale.
  const pan = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => {
      runOnJS(focus)(area);
      runOnJS(handleAt)(e.x);
    })
    .onUpdate((e) => {
      runOnJS(handleAt)(e.x);
    })
    .onFinalize(() => {
      runOnJS(focus)(null);
    });

  const bandKey = `bands.${area}.${bandForScore(value)}` as const;

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={styles.headerRow}>
        <View style={styles.titleGroup}>
          <Text variant="heading">{meta.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text variant="heading">{t(`areas.${area}.name`)}</Text>
            <Text variant="caption" tone="faint">
              {t(`areas.${area}.short`)}
            </Text>
          </View>
        </View>
        <View
          style={[
            styles.badge,
            { backgroundColor: meta.color, borderRadius: radius.sm, minWidth: 38 },
          ]}
        >
          <Text variant="label" style={{ color: '#0E1116' }}>
            {value}
          </Text>
        </View>
      </View>

      <GestureDetector gesture={pan}>
        <View
          accessibilityRole="adjustable"
          accessibilityLabel={t(`areas.${area}.name`)}
          accessibilityValue={{ min: MIN_SCORE, max: MAX_SCORE, now: value }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(event) => {
            if (event.nativeEvent.actionName === 'increment') commit(value + 1);
            if (event.nativeEvent.actionName === 'decrement') commit(value - 1);
          }}
          onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
          style={[styles.track, { gap: 3 }]}
        >
          {STEPS.map((step) => (
            <View
              key={step}
              style={[
                styles.step,
                {
                  backgroundColor: step <= value ? meta.color : colors.surfaceAlt,
                  borderRadius: step === 1 || step === MAX_SCORE ? radius.sm : 2,
                },
              ]}
            />
          ))}
        </View>
      </GestureDetector>

      <Text variant="caption" tone="muted">
        {t(bandKey)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  titleGroup: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  track: { flexDirection: 'row', alignItems: 'center', height: 40 },
  step: { flex: 1, height: 26 },
});
