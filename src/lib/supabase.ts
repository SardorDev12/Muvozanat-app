import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

import type { Database } from '@/types/database';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Set when the build is missing its Supabase configuration. Read by
 * ConfigGate (app/_layout.tsx) to show a diagnosable in-app screen instead of
 * letting the app crash on the very first line of JS.
 *
 * This is not just defensive: it already happened. A native build's
 * EXPO_PUBLIC_* values come from EAS's own "Environment Variables" for that
 * build profile, which are separate from — and were not populated by — the
 * GitHub Actions secrets of the same name. A throw here at module-evaluation
 * time, before React ever mounts, surfaces on device as a bare "keeps
 * stopping" dialog with no indication of why.
 */
export const supabaseConfigError: string | null =
  !supabaseUrl || !supabaseAnonKey
    ? 'Missing Supabase configuration: EXPO_PUBLIC_SUPABASE_URL and ' +
      'EXPO_PUBLIC_SUPABASE_ANON_KEY were not set when this build was created.'
    : null;

const isWeb = Platform.OS === 'web';

// A placeholder client when config is missing, so every other module that
// imports `supabase` can still load without a second null-check at every call
// site. ConfigGate keeps the app from ever rendering a screen that would
// actually use it.
export const supabase: SupabaseClient<Database> = createClient<Database>(
  supabaseUrl || 'https://placeholder.invalid',
  supabaseAnonKey || 'placeholder-anon-key',
  {
    auth: {
      // On web the default localStorage adapter is correct and also lets the
      // OAuth redirect land in the same storage the page reads from.
      storage: isWeb ? undefined : AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      // Native apps never see a URL fragment; we parse the deep link ourselves.
      detectSessionInUrl: isWeb,
      flowType: 'pkce',
    },
  },
);
