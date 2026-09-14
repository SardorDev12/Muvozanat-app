import { Link } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Text } from '@/components/ui/Text';
import { useAuth } from '@/features/auth/AuthProvider';
import { AuthShell, authErrorMessage } from '@/features/auth/AuthShell';
import { useTheme } from '@/theme/ThemeProvider';

export default function ForgotPassword() {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const { sendPasswordReset } = useAuth();

  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSend() {
    setError(null);
    if (!email.includes('@')) {
      setError(t('auth.invalidEmail'));
      return;
    }
    setBusy(true);
    try {
      await sendPasswordReset(email);
      setSent(true);
    } catch (e) {
      setError(authErrorMessage(e, t('common.error')) || t('errors.network'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title={t('auth.resetPassword')}>
      <View style={{ gap: spacing.md }}>
        <Input
          label={t('auth.email')}
          placeholder={t('auth.emailPlaceholder')}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          error={error}
          editable={!sent}
        />

        {sent ? (
          <Text tone="success">{t('auth.resetSent')}</Text>
        ) : (
          <Button title={t('auth.sendResetLink')} full loading={busy} onPress={handleSend} />
        )}

        <Link href="/sign-in" asChild>
          <Text variant="label" tone="accent" center accessibilityRole="link">
            {t('auth.signIn')}
          </Text>
        </Link>
      </View>
    </AuthShell>
  );
}
