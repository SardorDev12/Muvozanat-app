import { useRouter } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useReassessment } from '@/features/assessment/useReassessment';
import {
  useDismissNotification,
  useOpenNotifications,
  useUpdateProfile,
} from '@/features/profile/queries';
import { useTheme } from '@/theme/ThemeProvider';

import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Text } from './ui/Text';

/** How long "remind me later" quiets the nudge for. */
const SNOOZE_DAYS = 7;

/**
 * The first-run prompt and the periodic re-assessment nudge are the same
 * banner with different copy — both send the user to the same flow.
 */
export function ReassessBanner() {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const router = useRouter();
  const state = useReassessment();
  const notifications = useOpenNotifications();
  const dismiss = useDismissNotification();
  const updateProfile = useUpdateProfile();

  if (state.isLoading) return null;
  if (!state.neverAssessed && !state.due) return null;

  const first = state.neverAssessed;
  const open = (notifications.data ?? []).filter((n) => n.kind === 'reassessment_due');

  return (
    <Card tone="alt" style={{ gap: spacing.md }}>
      <View style={{ gap: spacing.xs }}>
        <Text variant="heading">
          {first ? t('onboarding.notAssessedTitle') : t('onboarding.reassessTitle')}
        </Text>
        <Text variant="body" tone="muted">
          {first
            ? t('onboarding.notAssessedBody')
            : t('onboarding.reassessBody', { days: state.daysSinceLast ?? 0 })}
        </Text>
      </View>

      <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
        <Button
          title={first ? t('onboarding.startAssessment') : t('onboarding.reassessNow')}
          onPress={() => router.push('/assessment')}
        />
        {!first ? (
          <Button
            title={t('onboarding.remindLater')}
            variant="ghost"
            onPress={() => {
              // Dismissing only the notification row would leave the derived
              // due date in the past, so the banner would return on the next
              // render. Snoozing the profile is what actually quiets it.
              open.forEach((n) => dismiss.mutate(n.id));
              updateProfile.mutate({
                reassess_snoozed_until: new Date(
                  Date.now() + SNOOZE_DAYS * 86_400_000,
                ).toISOString(),
              });
            }}
          />
        ) : null}
      </View>
    </Card>
  );
}
