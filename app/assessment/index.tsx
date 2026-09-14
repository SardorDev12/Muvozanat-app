import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { LifePieChart } from '@/components/LifePieChart';
import { LifeWheel } from '@/components/LifeWheel';
import { ScoreInput } from '@/components/ScoreInput';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { CONTENT_MAX_WIDTH, Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import {
  LIFE_AREAS,
  averageScore,
  defaultScores,
  type LifeAreaKey,
  type WheelScores,
} from '@/features/assessment/areas';
import { useLatestAssessment, useSaveAssessment } from '@/features/assessment/queries';
import { useTheme } from '@/theme/ThemeProvider';

export default function AssessmentScreen() {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();

  const latest = useLatestAssessment();
  const saveAssessment = useSaveAssessment();

  // Everything starts at the midpoint; a returning user starts from where they
  // last were, which makes "what changed" the question rather than "what is it".
  const [scores, setScores] = useState<WheelScores>(defaultScores);
  const [seeded, setSeeded] = useState(false);
  const [activeArea, setActiveArea] = useState<LifeAreaKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!seeded && !latest.isLoading) {
    // Seed during render, not in an effect: an effect would paint one frame of
    // all-fives before swapping in the real scores.
    if (latest.data) setScores(latest.data.scores);
    setSeeded(true);
  }

  const chartSize = Math.min(width - 48, CONTENT_MAX_WIDTH - 32, 340);
  const average = useMemo(() => averageScore(scores), [scores]);

  async function handleSave() {
    setError(null);
    try {
      await saveAssessment.mutateAsync({ scores });
      router.replace({
        pathname: '/assessment/results',
        params: { scores: JSON.stringify(scores) },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : t('errors.saveFailed'));
    }
  }

  return (
    <Screen>
      <View style={{ gap: spacing.xl, paddingBottom: spacing.xl }}>
        <View style={{ gap: spacing.xs }}>
          <Text variant="display">{t('assessment.title')}</Text>
          <Text tone="muted">{t('assessment.subtitle')}</Text>
        </View>

        <View style={{ alignItems: 'center', gap: spacing.lg }}>
          <LifeWheel
            scores={scores}
            size={chartSize}
            activeArea={activeArea}
            animateIn={seeded}
            runKey={seeded ? 1 : 0}
          />

          <View style={{ alignItems: 'center', gap: spacing.xs }}>
            <LifePieChart
              scores={scores}
              size={chartSize * 0.62}
              activeArea={activeArea}
              centerLabel={average.toFixed(1)}
              centerCaption={t('assessment.average')}
            />
            <Text variant="caption" tone="faint" center>
              {t('assessment.distribution')}
            </Text>
          </View>
        </View>

        <Card style={{ gap: spacing.xl }}>
          <Text variant="caption" tone="faint">
            {t('assessment.scaleHint')}
          </Text>

          {LIFE_AREAS.map((area) => (
            <ScoreInput
              key={area.key}
              area={area.key}
              value={scores[area.key]}
              onFocusArea={setActiveArea}
              onChange={(score) => setScores((prev) => ({ ...prev, [area.key]: score }))}
            />
          ))}
        </Card>

        {error ? (
          <Text tone="danger" center>
            {error}
          </Text>
        ) : null}

        <View style={{ gap: spacing.sm }}>
          <Button
            title={t('assessment.saveAssessment')}
            full
            loading={saveAssessment.isPending}
            onPress={handleSave}
          />
          <Button title={t('common.cancel')} variant="ghost" full onPress={() => router.back()} />
        </View>
      </View>
    </Screen>
  );
}
