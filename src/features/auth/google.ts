import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

// Required so the auth popup can hand control back on web.
WebBrowser.maybeCompleteAuthSession();

/** Where the OAuth provider sends the user back to. */
export function authRedirectUri(): string {
  if (Platform.OS === 'web') {
    // `window` exists here because Platform.OS is only 'web' in the browser.
    return `${window.location.origin}/auth/callback`;
  }
  return AuthSession.makeRedirectUri({ scheme: 'muvozanat', path: 'auth/callback' });
}

/**
 * Google sign-in through Supabase.
 *
 * Web relies on a full-page redirect and Supabase's own `detectSessionInUrl`.
 * Native opens a system auth session, then exchanges the PKCE code we get back
 * on the deep link for a session.
 */
export async function signInWithGoogle(): Promise<void> {
  const redirectTo = authRedirectUri();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: Platform.OS !== 'web',
      queryParams: { access_type: 'offline', prompt: 'consent' },
    },
  });

  if (error) throw error;
  if (Platform.OS === 'web') return; // The browser is already navigating away.
  if (!data.url) throw new Error('Supabase did not return an authorization URL');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') {
    // 'cancel' and 'dismiss' are the user backing out, not a failure worth
    // surfacing as an error.
    if (result.type === 'cancel' || result.type === 'dismiss') return;
    throw new Error(`Google sign-in failed: ${result.type}`);
  }

  const code = new URL(result.url).searchParams.get('code');
  if (!code) throw new Error('No authorization code in the callback URL');

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) throw exchangeError;
}
