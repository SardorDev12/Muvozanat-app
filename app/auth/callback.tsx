import { Redirect } from 'expo-router';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/ui/Text';
import { useAuth } from '@/features/auth/AuthProvider';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Where OAuth and email links land. Supabase exchanges the code as the client
 * starts up, so this screen only has to wait for the session and forward.
 *
 * The wait is worth labelling: signing in with Google is four full page
 * navigations plus a token exchange, and on a slow link that is several
 * seconds of staring at a screen that would otherwise look broken.
 */
export default function AuthCallback() {
  const { session, initializing } = useAuth();
  const { colors, spacing } = useTheme();
  const { t } = useTranslation();

  if (initializing) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.bg,
          gap: spacing.lg,
        }}
      >
        <ActivityIndicator color={colors.accent} />
        <Text tone="muted">{t('auth.signingIn')}</Text>
      </View>
    );
  }

  return <Redirect href={session ? '/today' : '/sign-in'} />;
}
