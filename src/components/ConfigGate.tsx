import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { supabaseConfigError } from '@/lib/supabase';

/**
 * Stands in front of the whole app when required build-time configuration is
 * missing, instead of letting things fail downstream in confusing ways (an
 * auth provider that can never reach a server, screens stuck loading forever,
 * or — before this existed — a native crash before React even mounted, with
 * no clue why).
 *
 * Deliberately styled with plain React Native primitives, not this app's
 * theme or i18n: if configuration is broken enough to need this screen, it
 * should not also depend on providers that sit further down the tree.
 */
export function ConfigGate({ children }: { children: React.ReactNode }) {
  if (!supabaseConfigError) return <>{children}</>;

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Configuration missing</Text>
        <Text style={styles.body}>{supabaseConfigError}</Text>
        <Text style={styles.hint}>
          This build was created without EXPO_PUBLIC_SUPABASE_URL and
          EXPO_PUBLIC_SUPABASE_ANON_KEY. For an EAS build (not a local Expo Go
          run), these have to be registered as EAS &quot;Environment
          Variables&quot; for the build profile used — a GitHub Actions secret
          of the same name is
          a separate thing and does not reach the EAS builder on its own.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0E1116' },
  content: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 16 },
  title: { color: '#FFFFFF', fontSize: 22, fontWeight: '700' },
  body: { color: '#EDF0F5', fontSize: 15, lineHeight: 22 },
  hint: { color: '#9AA4B2', fontSize: 13, lineHeight: 20 },
});
