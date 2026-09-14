import { useProfile } from '@/features/profile/queries';
import { daysBetween, toDateKey, todayKey } from '@/utils/date';
import { useNow } from '@/utils/useNow';

export type ReassessmentState = {
  /** No assessment has ever been saved. */
  neverAssessed: boolean;
  /** An assessment exists but the configured interval has elapsed. */
  due: boolean;
  daysSinceLast: number | null;
  nextDueLabelDate: string | null;
  isLoading: boolean;
};

/**
 * Decides whether to prompt for a new life-wheel assessment.
 *
 * This is a plain comparison against the clock, done in the app: the profile's
 * derived `next_reassess_at` against now, unless a "remind me later" snooze is
 * still running. No server-side job is involved — one used to write nudge rows
 * on a nightly cron, but it only duplicated this check, since a reminder is
 * only ever seen when the app is open anyway.
 */
export function useReassessment(): ReassessmentState {
  const profile = useProfile();
  const now = useNow();

  const row = profile.data;
  const lastAt = row?.last_assessment_at ?? null;
  const nextAt = row?.next_reassess_at ?? null;

  const daysSinceLast = lastAt ? daysBetween(toDateKey(new Date(lastAt)), todayKey()) : null;

  const intervalElapsed = nextAt ? new Date(nextAt).getTime() <= now : false;

  const snoozedUntil = row?.reassess_snoozed_until;
  const snoozed = snoozedUntil ? new Date(snoozedUntil).getTime() > now : false;

  return {
    neverAssessed: !!row && !lastAt,
    due: !!lastAt && !snoozed && intervalElapsed,
    daysSinceLast,
    nextDueLabelDate: nextAt,
    isLoading: profile.isLoading,
  };
}
