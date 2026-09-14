import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { useAuth } from '@/features/auth/AuthProvider';
import { useProfile, useUpdateProfile } from '@/features/profile/queries';
import { SUPPORTED_LANGUAGES, intlLocale, setLanguage, type LanguageCode } from '@/i18n';
import { useTheme } from '@/theme/ThemeProvider';
import { formatTimestamp } from '@/utils/date';
import { useNow } from '@/utils/useNow';

type IntervalKey =
  'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'semiannual' | 'yearly' | 'off';

/** Reminder cadences offered in settings. `null` turns reminders off. */
const INTERVALS: { key: IntervalKey; days: number | null }[] = [
  { key: 'weekly', days: 7 },
  { key: 'biweekly', days: 14 },
  { key: 'monthly', days: 30 },
  { key: 'quarterly', days: 90 },
  { key: 'semiannual', days: 182 },
  { key: 'yearly', days: 365 },
  { key: 'off', days: null },
];

const LOOKBACKS = [3, 7, 14, 30];

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const { spacing } = useTheme();
  const router = useRouter();
  const { user, signOut } = useAuth();

  const profile = useProfile();
  const updateProfile = useUpdateProfile();
  const now = useNow();
  const [signingOut, setSigningOut] = useState(false);

  const locale = intlLocale(i18n.language);
  const currentInterval = profile.data?.reassess_interval_days ?? null;
  const currentLookback = profile.data?.missed_lookback_days ?? 14;

  async function changeLanguage(code: LanguageCode) {
    await setLanguage(code);
    // Mirrored onto the profile so the reminder emails/pushes a Worker sends
    // later can use the same language as the app.
    updateProfile.mutate({ locale: code });
  }

  return (
    <Screen>
      <View style={{ gap: spacing.lg, paddingBottom: spacing.xl }}>
        <Text variant="display">{t('settings.title')}</Text>

        <Card style={{ gap: spacing.sm }}>
          <Text variant="heading">{t('settings.account')}</Text>
          <Text tone="muted">{profile.data?.display_name ?? user?.email ?? ''}</Text>
          {profile.data?.display_name && user?.email ? (
            <Text variant="caption" tone="faint">
              {user.email}
            </Text>
          ) : null}
        </Card>

        <Card style={{ gap: spacing.md }}>
          <Text variant="heading">{t('settings.language')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {SUPPORTED_LANGUAGES.map((language) => (
              <Chip
                key={language.code}
                label={language.label}
                selected={i18n.language === language.code}
                onPress={() => changeLanguage(language.code)}
              />
            ))}
          </View>
        </Card>

        <Card style={{ gap: spacing.md }}>
          <View style={{ gap: spacing.xs }}>
            <Text variant="heading">{t('settings.reassessment')}</Text>
            <Text variant="caption" tone="faint">
              {t('settings.reassessmentHint')}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {INTERVALS.map((option) => (
              <Chip
                key={option.key}
                label={t(`settings.interval.${option.key}`)}
                selected={currentInterval === option.days}
                onPress={() =>
                  updateProfile.mutate({
                    reassess_interval_days: option.days,
                    // Changing the cadence is an explicit decision, so any
                    // outstanding snooze no longer applies.
                    reassess_snoozed_until: null,
                  })
                }
              />
            ))}
          </View>

          {profile.data?.next_reassess_at ? (
            <Text variant="caption" tone="muted">
              {new Date(profile.data.next_reassess_at).getTime() <= now
                ? t('settings.nextReassessmentDue')
                : t('settings.nextReassessment', {
                    date: formatTimestamp(profile.data.next_reassess_at, locale),
                  })}
            </Text>
          ) : null}

          <Button
            title={t('onboarding.reassessNow')}
            variant="secondary"
            onPress={() => router.push('/assessment')}
          />
        </Card>

        <Card style={{ gap: spacing.md }}>
          <Text variant="heading">{t('settings.missedLookback')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {LOOKBACKS.map((days) => (
              <Chip
                key={days}
                label={t('settings.missedLookbackDays', { count: days })}
                selected={currentLookback === days}
                onPress={() => updateProfile.mutate({ missed_lookback_days: days })}
              />
            ))}
          </View>
        </Card>

        <Button
          title={t('auth.signOut')}
          variant="secondary"
          full
          loading={signingOut}
          onPress={async () => {
            setSigningOut(true);
            try {
              await signOut();
              router.replace('/sign-in');
            } finally {
              setSigningOut(false);
            }
          }}
        />
      </View>
    </Screen>
  );
}
