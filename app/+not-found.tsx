import { useRouter } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Screen } from '@/components/ui/Screen';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';

export default function NotFound() {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <Screen scroll={false}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <Text variant="title">{t('errors.notFound')}</Text>
        <Text tone="muted" center>
          {t('errors.notFoundBody')}
        </Text>
        <Button title={t('errors.goHome')} onPress={() => router.replace('/today')} />
      </View>
    </Screen>
  );
}
