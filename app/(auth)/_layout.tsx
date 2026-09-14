import { Redirect, Stack } from 'expo-router';
import React from 'react';

import { useAuth } from '@/features/auth/AuthProvider';
import { useTheme } from '@/theme/ThemeProvider';

export default function AuthLayout() {
  const { session, initializing } = useAuth();
  const { colors } = useTheme();

  if (initializing) return null;
  if (session) return <Redirect href="/today" />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    />
  );
}
