import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

export type ThemePreference = 'system' | 'light' | 'dark';

export const THEME_PREFERENCES: readonly ThemePreference[] = ['light', 'dark', 'system'];

const STORAGE_KEY = 'muvozanat.theme';

/**
 * Light is the default, rather than following the device. A phone left in dark
 * mode should still open Muvozanat light unless its owner asks for dark, and
 * `system` stays available for people who want it to follow along.
 */
const DEFAULT_PREFERENCE: ThemePreference = 'light';

// A tiny store rather than React state: the preference is read during render by
// every themed component, and useSyncExternalStore is how React wants a mutable
// external value read without tearing.
let current: ThemePreference = DEFAULT_PREFERENCE;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

function getSnapshot(): ThemePreference {
  return current;
}

function isPreference(value: string | null): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

export function useThemePreference(): ThemePreference {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Applies a previously chosen theme. Runs after the first paint, like i18n. */
export async function hydrateStoredTheme(): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (isPreference(stored) && stored !== current) {
      current = stored;
      emit();
    }
  } catch {
    // Storage unavailable (private browsing, cleared site data): the default
    // stands, which is a reasonable outcome.
  }
}

export async function setThemePreference(next: ThemePreference): Promise<void> {
  current = next;
  emit();
  try {
    await AsyncStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Non-fatal: the choice still applies for this session.
  }
}
