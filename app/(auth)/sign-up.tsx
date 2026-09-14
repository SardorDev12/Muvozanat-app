import { Link, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { Divider } from '@/components/ui/Divider';
import { Input } from '@/components/ui/Input';
import { Text } from '@/components/ui/Text';
import { useAuth } from '@/features/auth/AuthProvider';
import { AuthShell, authErrorMessage } from '@/features/auth/AuthShell';
import { signInWithGoogle } from '@/features/auth/google';
import { useTheme } from '@/theme/ThemeProvider';

export default function SignUp() {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const router = useRouter();
  const { signUpWithPassword } = useAuth();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<'password' | 'google' | null>(null);

  async function handleSignUp() {
    setError(null);
    setNotice(null);

    if (!email.includes('@')) {
      setError(t('auth.invalidEmail'));
      return;
    }
    if (password.length < 8) {
      setError(t('auth.passwordTooShort'));
      return;
    }

    setBusy('password');
    try {
      const { needsEmailConfirmation } = await signUpWithPassword(
        email,
        password,
        displayName.trim() || undefined,
      );
      if (needsEmailConfirmation) {
        setNotice(t('auth.confirmEmail', { email: email.trim() }));
      } else {
        router.replace('/assessment');
      }
    } catch (e) {
      setError(authErrorMessage(e, t('errors.signUpFailed')) || t('errors.network'));
    } finally {
      setBusy(null);
    }
  }

  return (
    <AuthShell title={t('auth.signUp')} subtitle={t('auth.welcomeSubtitle')}>
      <View style={{ gap: spacing.md }}>
        <Button
          title={t('auth.continueWithGoogle')}
          variant="secondary"
          full
          loading={busy === 'google'}
          onPress={async () => {
            setBusy('google');
            try {
              await signInWithGoogle();
            } catch {
              setError(t('errors.googleFailed'));
            } finally {
              setBusy(null);
            }
          }}
        />

        <Divider label={t('auth.orDivider')} />

        <Input
          label={t('auth.displayName')}
          placeholder={t('auth.displayNamePlaceholder')}
          value={displayName}
          onChangeText={setDisplayName}
          autoComplete="name"
        />
        <Input
          label={t('auth.email')}
          placeholder={t('auth.emailPlaceholder')}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
        />
        <Input
          label={t('auth.password')}
          placeholder={t('auth.passwordPlaceholder')}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="new-password"
          error={error}
        />

        {notice ? (
          <Text variant="caption" tone="success">
            {notice}
          </Text>
        ) : null}

        <Button
          title={t('auth.signUp')}
          full
          loading={busy === 'password'}
          onPress={handleSignUp}
        />

        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
          <Text variant="label" tone="muted">
            {t('auth.haveAccount')}
          </Text>
          <Link href="/sign-in" asChild>
            <Text variant="label" tone="accent" accessibilityRole="link">
              {t('auth.signIn')}
            </Text>
          </Link>
        </View>
      </View>
    </AuthShell>
  );
}
