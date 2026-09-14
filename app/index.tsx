import { Redirect } from 'expo-router';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';

import { useAuth } from '@/features/auth/AuthProvider';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Entry gate. Everything past this point assumes a signed-in user, so the
 * routing decision lives in exactly one place.
 */
export default function Index() {
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

  return session ? <Redirect href="/today" /> : <Redirect href="/sign-in" />;
}
