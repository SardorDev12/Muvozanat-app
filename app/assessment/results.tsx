import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { LifeWheel } from '@/components/LifeWheel';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { CONTENT_MAX_WIDTH, Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import {
  ATTENTION_THRESHOLD,
  AREA_BY_KEY,
  areasNeedingAttention,
  defaultScores,
  type WheelScores,
} from '@/features/assessment/areas';
import { useLatestAssessment } from '@/features/assessment/queries';
import { useTheme } from '@/theme/ThemeProvider';

function parseScores(raw: string | string[] | undefined): WheelScores | null {
  if (typeof raw !== 'string') return null;
  try {
    const parsed = JSON.parse(raw) as Partial<WheelScores>;
    return { ...defaultScores(), ...parsed };
  } catch {
    return null;
  }
}

export default function AssessmentResults() {
  const { t } = useTranslation();
  const { spacing, colors } = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{ scores?: string }>();

  const latest = useLatestAssessment();
  // The scores are passed through navigation so the results appear instantly,
  // with the freshly-saved assessment as the fallback on a reload.
  const scores = parseScores(params.scores) ?? latest.data?.scores ?? defaultScores();

  const attention = useMemo(() => areasNeedingAttention(scores), [scores]);
  const chartSize = Math.min(width - 48, CONTENT_MAX_WIDTH - 32, 300);

  return (
    <Screen>
      <View style={{ gap: spacing.xl, paddingBottom: spacing.xl }}>
        <View style={{ gap: spacing.xs }}>
          <Text variant="caption" tone="success">
            {t('assessment.assessmentSaved')}
          </Text>
          <Text variant="display">{t('assessment.resultsTitle')}</Text>
          <Text tone="muted">
            {attention.length > 0
              ? t('assessment.resultsSubtitle')
              : t('assessment.resultsBalanced', { threshold: ATTENTION_THRESHOLD })}
          </Text>
        </View>

        <View style={{ alignItems: 'center' }}>
          <LifeWheel scores={scores} size={chartSize} runKey={2} />
        </View>

        {attention.length > 0 ? (
          <View style={{ gap: spacing.sm }}>
            {attention.map((key) => {
              const area = AREA_BY_KEY[key];
              return (
                <Card key={key} style={{ gap: spacing.xs }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    <Text variant="heading">{area.emoji}</Text>
                    <Text variant="heading" style={{ flex: 1 }}>
                      {t(`areas.${key}.name`)}
                    </Text>
                    <View
                      style={{
                        backgroundColor: area.color,
                        borderRadius: 8,
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                      }}
                    >
                      <Text variant="label" style={{ color: '#0E1116' }}>
                        {scores[key]}
                      </Text>
                    </View>
                  </View>
                  <Text variant="caption" tone="muted">
                    {t(`areas.${key}.question`)}
                  </Text>
                </Card>
              );
            })}
          </View>
        ) : null}

        <View style={{ gap: spacing.sm }}>
          <Button
            title={t('assessment.setGoals')}
            full
            onPress={() =>
              router.replace({
                pathname: '/goals',
                params: attention[0] ? { suggestArea: attention[0] } : undefined,
              })
            }
          />
          <Button
            title={t('assessment.later')}
            variant="ghost"
            full
            onPress={() => router.replace('/today')}
          />
        </View>

        <Text variant="caption" tone="faint" center style={{ color: colors.textFaint }}>
          {t('assessment.average')}:{' '}
          {(
            Object.values(scores).reduce((a, b) => a + b, 0) / Object.values(scores).length
          ).toFixed(1)}{' '}
          / 10
        </Text>
      </View>
    </Screen>
  );
}
