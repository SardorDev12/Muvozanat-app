/**
 * The eight life areas of the wheel. The `key` values are persisted in Postgres
 * (see the `life_area` enum in supabase/migrations) so they must never change
 * without a migration. All user-facing copy lives in src/i18n/locales.
 */
export const LIFE_AREA_KEYS = [
  'health',
  'career',
  'finance',
  'relationships',
  'family',
  'growth',
  'fun',
  'spirituality',
] as const;

export type LifeAreaKey = (typeof LIFE_AREA_KEYS)[number];

export type LifeArea = {
  key: LifeAreaKey;
  /** Order around the wheel, starting at 12 o'clock and going clockwise. */
  index: number;
  color: string;
  /** Slightly darker variant used for strokes and text on light surfaces. */
  colorDark: string;
  emoji: string;
};

export const LIFE_AREAS: readonly LifeArea[] = [
  { key: 'health', index: 0, color: '#34D399', colorDark: '#059669', emoji: '🌿' },
  { key: 'career', index: 1, color: '#60A5FA', colorDark: '#2563EB', emoji: '🎯' },
  { key: 'finance', index: 2, color: '#FBBF24', colorDark: '#D97706', emoji: '💰' },
  { key: 'relationships', index: 3, color: '#F472B6', colorDark: '#DB2777', emoji: '💞' },
  { key: 'family', index: 4, color: '#FB923C', colorDark: '#EA580C', emoji: '🏡' },
  { key: 'growth', index: 5, color: '#A78BFA', colorDark: '#7C3AED', emoji: '📚' },
  { key: 'fun', index: 6, color: '#22D3EE', colorDark: '#0891B2', emoji: '🎈' },
  { key: 'spirituality', index: 7, color: '#C4B5FD', colorDark: '#8B5CF6', emoji: '🕊️' },
] as const;

export const AREA_BY_KEY: Record<LifeAreaKey, LifeArea> = LIFE_AREAS.reduce(
  (acc, area) => {
    acc[area.key] = area;
    return acc;
  },
  {} as Record<LifeAreaKey, LifeArea>,
);

export const DEFAULT_SCORE = 5;
export const MIN_SCORE = 1;
export const MAX_SCORE = 10;

/** Scores at or below this are surfaced as "needs attention" after an assessment. */
export const ATTENTION_THRESHOLD = 5;

export type WheelScores = Record<LifeAreaKey, number>;

export function defaultScores(): WheelScores {
  return LIFE_AREA_KEYS.reduce((acc, key) => {
    acc[key] = DEFAULT_SCORE;
    return acc;
  }, {} as WheelScores);
}

export function averageScore(scores: WheelScores): number {
  const values = LIFE_AREA_KEYS.map((k) => scores[k]);
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Areas sorted worst-first, used for the "pay attention here" recommendation. */
export function areasNeedingAttention(scores: WheelScores, limit = 3): LifeAreaKey[] {
  return [...LIFE_AREA_KEYS]
    .filter((key) => scores[key] <= ATTENTION_THRESHOLD)
    .sort((a, b) => scores[a] - scores[b] || AREA_BY_KEY[a].index - AREA_BY_KEY[b].index)
    .slice(0, limit);
}
