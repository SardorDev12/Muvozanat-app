import { useOpenNotifications, useProfile } from '@/features/profile/queries';
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
 * The app nudges from two directions: the profile's derived `next_reassess_at`
 * (so a user who opens the app before the nightly Worker run still sees it) and
 * any notification row the Worker has already written.
 */
export function useReassessment(): ReassessmentState {
  const profile = useProfile();
  const notifications = useOpenNotifications();
  const now = useNow();

  const row = profile.data;
  const lastAt = row?.last_assessment_at ?? null;
  const nextAt = row?.next_reassess_at ?? null;

  const daysSinceLast = lastAt ? daysBetween(toDateKey(new Date(lastAt)), todayKey()) : null;

  const intervalElapsed = nextAt ? new Date(nextAt).getTime() <= now : false;
  const workerFlagged = (notifications.data ?? []).some((n) => n.kind === 'reassessment_due');

  const snoozedUntil = row?.reassess_snoozed_until;
  const snoozed = snoozedUntil ? new Date(snoozedUntil).getTime() > now : false;

  return {
    neverAssessed: !!row && !lastAt,
    due: !!lastAt && !snoozed && (intervalElapsed || workerFlagged),
    daysSinceLast,
    nextDueLabelDate: nextAt,
    isLoading: profile.isLoading,
  };
}
