import React from 'react';
import { View } from 'react-native';

import { BrandMark } from '@/components/BrandMark';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/ThemeProvider';

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const { spacing } = useTheme();

  return (
    <Screen contentStyle={{ justifyContent: 'center' }}>
      <View style={{ gap: spacing.xl, paddingVertical: spacing.xxl }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <BrandMark size={32} />
          <Text variant="heading">Muvozanat</Text>
        </View>
        <View style={{ gap: spacing.sm }}>
          <Text variant="display">{title}</Text>
          {subtitle ? <Text tone="muted">{subtitle}</Text> : null}
        </View>
        {children}
      </View>
    </Screen>
  );
}

/** Translates Supabase auth errors into something a person can act on. */
export function authErrorMessage(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : '';
  if (/invalid login credentials/i.test(message)) return fallback;
  if (/email not confirmed/i.test(message)) return message;
  if (/already registered/i.test(message)) return message;
  if (/fetch|network/i.test(message)) return '';
  return message || fallback;
}
