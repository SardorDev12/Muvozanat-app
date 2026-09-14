import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { LifePieChart } from '@/components/LifePieChart';
import { LifeWheel } from '@/components/LifeWheel';
import { WheelHistoryChart } from '@/components/WheelHistoryChart';
import { WheelRoad } from '@/components/WheelRoad';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { CONTENT_MAX_WIDTH, Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { AREA_BY_KEY, LIFE_AREAS, averageScore, defaultScores } from '@/features/assessment/areas';
import { useAssessmentHistory, useLatestAssessment } from '@/features/assessment/queries';
import { useProfile } from '@/features/profile/queries';
import { intlLocale } from '@/i18n';
import { useTheme } from '@/theme/ThemeProvider';
import { formatTimestamp } from '@/utils/date';

export default function MyLifeScreen() {
  const { t, i18n } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const locale = intlLocale(i18n.language);

  const profile = useProfile();
  const history = useAssessmentHistory();
  const latest = useLatestAssessment();

  const scores = latest.data?.scores ?? defaultScores();
  const previous = latest.previous;
  const chartSize = Math.min(width - 48, CONTENT_MAX_WIDTH - 32, 340);
  const contentWidth = Math.min(width - 80, CONTENT_MAX_WIDTH - 64);
  const average = useMemo(() => averageScore(scores), [scores]);

  const hasAssessment = !!latest.data;

  return (
    <Screen>
      <View style={{ gap: spacing.xl, paddingBottom: spacing.xl }}>
        <View style={{ gap: spacing.xs }}>
          <Text variant="display">{t('tabs.myLife')}</Text>
          <Text variant="caption" tone="faint">
            {latest.data
              ? t('assessment.lastAssessed', {
                  date: formatTimestamp(latest.data.takenAt, locale),
                })
              : t('assessment.neverAssessed')}
          </Text>
        </View>

        {!hasAssessment ? (
          <Card style={{ gap: spacing.md }}>
            <Text variant="heading">{t('onboarding.notAssessedTitle')}</Text>
            <Text tone="muted">{t('onboarding.notAssessedBody')}</Text>
            <Button
              title={t('onboarding.startAssessment')}
              onPress={() => router.push('/assessment')}
            />
          </Card>
        ) : (
          <>
            <Card style={{ gap: spacing.sm }}>
              <Text variant="heading">{t('assessment.rideTitle')}</Text>
              <WheelRoad scores={scores} size={chartSize * 0.52} width={contentWidth} />
              <Text variant="caption" tone="muted">
                {t('assessment.rideCaption')}
              </Text>
            </Card>

            <View style={{ alignItems: 'center', gap: spacing.lg }}>
              <LifeWheel scores={scores} size={chartSize} runKey={history.dataUpdatedAt} />
              <LifePieChart
                scores={scores}
                size={chartSize * 0.62}
                centerLabel={average.toFixed(1)}
                centerCaption={t('assessment.average')}
              />
              <Text variant="caption" tone="faint" center>
                {t('assessment.averageHint')}
              </Text>
            </View>

            <Card style={{ gap: spacing.md }}>
              {LIFE_AREAS.map((area) => {
                const score = scores[area.key];
                const delta = previous ? score - previous.scores[area.key] : 0;

                return (
                  <View key={area.key} style={{ gap: 6 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                      <Text variant="body">{area.emoji}</Text>
                      <Text variant="body" style={{ flex: 1 }} numberOfLines={1}>
                        {t(`areas.${area.key}.name`)}
                      </Text>
                      {previous ? (
                        <Text
                          variant="caption"
                          tone={delta > 0 ? 'success' : delta < 0 ? 'danger' : 'faint'}
                        >
                          {delta > 0 ? `+${delta}` : delta < 0 ? `${delta}` : '·'}
                        </Text>
                      ) : null}
                      <Text variant="label" style={{ color: AREA_BY_KEY[area.key].color }}>
                        {score}
                      </Text>
                    </View>
                    <View
                      style={{
                        height: 6,
                        borderRadius: radius.sm,
                        backgroundColor: colors.surfaceAlt,
                        overflow: 'hidden',
                      }}
                    >
                      <View
                        style={{
                          width: `${(score / 10) * 100}%`,
                          height: '100%',
                          backgroundColor: area.color,
                        }}
                      />
                    </View>
                  </View>
                );
              })}
            </Card>

            <Card style={{ gap: spacing.md }}>
              <Text variant="heading">{t('assessment.historyTitle')}</Text>
              <WheelHistoryChart snapshots={history.data ?? []} width={contentWidth} />
            </Card>

            <View style={{ gap: spacing.sm }}>
              <Button
                title={t('onboarding.reassessNow')}
                full
                onPress={() => router.push('/assessment')}
              />
              {profile.data?.next_reassess_at ? (
                <Text variant="caption" tone="faint" center>
                  {t('settings.nextReassessment', {
                    date: formatTimestamp(profile.data.next_reassess_at, locale),
                  })}
                </Text>
              ) : null}
            </View>
          </>
        )}
      </View>
    </Screen>
  );
}
