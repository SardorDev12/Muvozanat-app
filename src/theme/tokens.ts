export type ColorScheme = 'light' | 'dark';

export type Palette = {
  bg: string;
  bgElevated: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  borderStrong: string;
  text: string;
  textMuted: string;
  textFaint: string;
  accent: string;
  accentText: string;
  accentSoft: string;
  danger: string;
  success: string;
  warning: string;
  overlay: string;
  /** Wheel grid rings and spokes. */
  grid: string;
};

const light: Palette = {
  bg: '#F6F7F9',
  bgElevated: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceAlt: '#EFF1F5',
  border: '#E3E6EC',
  borderStrong: '#CDD3DD',
  text: '#0E1116',
  textMuted: '#5B6472',
  textFaint: '#8B94A3',
  accent: '#4F46E5',
  accentText: '#FFFFFF',
  accentSoft: '#EEF0FF',
  danger: '#DC2626',
  success: '#059669',
  warning: '#D97706',
  overlay: 'rgba(14, 17, 22, 0.45)',
  grid: '#DDE2EA',
};

const dark: Palette = {
  bg: '#0E1116',
  bgElevated: '#161B22',
  surface: '#161B22',
  surfaceAlt: '#1E242E',
  border: '#272E3A',
  borderStrong: '#3A4350',
  text: '#EDF0F5',
  textMuted: '#9AA4B2',
  textFaint: '#6B7585',
  accent: '#818CF8',
  accentText: '#0E1116',
  accentSoft: '#1E2140',
  danger: '#F87171',
  success: '#34D399',
  warning: '#FBBF24',
  overlay: 'rgba(0, 0, 0, 0.6)',
  grid: '#2B3341',
};

export const palettes: Record<ColorScheme, Palette> = { light, dark };

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

export const typography = {
  display: { fontSize: 30, fontWeight: '700' },
  title: { fontSize: 22, fontWeight: '700' },
  heading: { fontSize: 17, fontWeight: '600' },
  body: { fontSize: 15, fontWeight: '400' },
  label: { fontSize: 13, fontWeight: '600' },
  caption: { fontSize: 12, fontWeight: '400' },
} as const;
