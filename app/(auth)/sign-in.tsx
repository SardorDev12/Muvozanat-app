import { Link, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { Divider } from '@/components/ui/Divider';
import { Input } from '@/components/ui/Input';
import { Text } from '@/components/ui/Text';
import { AuthShell, authErrorMessage } from '@/features/auth/AuthShell';
import { useAuth } from '@/features/auth/AuthProvider';
import { signInWithGoogle } from '@/features/auth/google';
import { useTheme } from '@/theme/ThemeProvider';

export default function SignIn() {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const router = useRouter();
  const { signInWithPassword } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'password' | 'google' | null>(null);

  async function handlePasswordSignIn() {
    setError(null);
    if (!email.includes('@')) {
      setError(t('auth.invalidEmail'));
      return;
    }
    setBusy('password');
    try {
      await signInWithPassword(email, password);
      router.replace('/today');
    } catch (e) {
      setError(authErrorMessage(e, t('errors.signInFailed')) || t('errors.network'));
    } finally {
      setBusy(null);
    }
  }

  async function handleGoogle() {
    setError(null);
    setBusy('google');
    try {
      await signInWithGoogle();
    } catch {
      setError(t('errors.googleFailed'));
    } finally {
      setBusy(null);
    }
  }

  return (
    <AuthShell title={t('auth.welcomeTitle')} subtitle={t('auth.welcomeSubtitle')}>
      <View style={{ gap: spacing.md }}>
        <Button
          title={t('auth.continueWithGoogle')}
          variant="secondary"
          full
          loading={busy === 'google'}
          onPress={handleGoogle}
        />

        <Divider label={t('auth.orDivider')} />

        <Input
          label={t('auth.email')}
          placeholder={t('auth.emailPlaceholder')}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
        />
        <Input
          label={t('auth.password')}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="current-password"
          textContentType="password"
          onSubmitEditing={handlePasswordSignIn}
          returnKeyType="go"
          error={error}
        />

        <Button
          title={t('auth.signIn')}
          full
          loading={busy === 'password'}
          onPress={handlePasswordSignIn}
        />

        <Link href="/forgot-password" asChild>
          <Text variant="label" tone="accent" center accessibilityRole="link">
            {t('auth.forgotPassword')}
          </Text>
        </Link>

        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
          <Text variant="label" tone="muted">
            {t('auth.noAccount')}
          </Text>
          <Link href="/sign-up" asChild>
            <Text variant="label" tone="accent" accessibilityRole="link">
              {t('auth.signUp')}
            </Text>
          </Link>
        </View>
      </View>
    </AuthShell>
  );
}
