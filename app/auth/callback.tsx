import { Redirect } from 'expo-router';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';

import { useAuth } from '@/features/auth/AuthProvider';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * OAuth and email links land here. Supabase has already exchanged the code by
 * the time the session appears, so this screen only has to wait and forward.
 */
export default function AuthCallback() {
  const { session, initializing } = useAuth();
  const { colors } = useTheme();

  if (initializing) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.bg,
        }}
      >
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return <Redirect href={session ? '/today' : '/sign-in'} />;
}
