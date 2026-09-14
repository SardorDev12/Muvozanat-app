import { Redirect, Stack } from 'expo-router';
import React from 'react';

import { useAuth } from '@/features/auth/AuthProvider';
import { useTheme } from '@/theme/ThemeProvider';

export default function AssessmentLayout() {
  const { session, initializing } = useAuth();
  const { colors } = useTheme();

  if (initializing) return null;
  if (!session) return <Redirect href="/sign-in" />;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
  );
}
