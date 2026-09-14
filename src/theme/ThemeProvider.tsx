import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';

import { useThemePreference } from './preference';
import { ColorScheme, Palette, palettes, radius, spacing, typography } from './tokens';

type ThemeValue = {
  scheme: ColorScheme;
  colors: Palette;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
};

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const preference = useThemePreference();

  const scheme: ColorScheme =
    preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference;

  const value = useMemo<ThemeValue>(
    () => ({ scheme, colors: palettes[scheme], spacing, radius, typography }),
    [scheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
