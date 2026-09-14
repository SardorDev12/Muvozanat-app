/**
 * Recurrence, modelled on Google Tasks: pick a frequency, an interval, an
 * optional weekday set, and an optional end condition.
 *
 * Occurrences are never stored. `occursOn` answers "does this task fall on
 * this day" in O(1) from the rule plus the task's start date, so a task that
 * repeats every weekday forever stays one database row. Only deviations —
 * completions and skips — become rows.
 */
import {
  addDays,
  addMonths,
  daysBetween,
  daysInMonth,
  eachDayInRange,
  fromDateKey,
  monthsBetween,
  startOfWeekKey,
  weekday,
  type DateKey,
} from '../../utils/date';

export type Frequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export type RecurrenceEnd =
  { type: 'never' } | { type: 'on'; date: DateKey } | { type: 'after'; count: number };

export type Recurrence = {
  freq: Frequency;
  /** Repeat every N units. Always >= 1. */
  interval: number;
  /** Weekly only. 0 = Sunday … 6 = Saturday. Empty/absent means "the weekday of startsOn". */
  byWeekday?: number[];
  /**
   * Monthly only. `dayOfMonth` repeats on the same date each month (clamped in
   * short months); `nthWeekday` repeats on e.g. "the second Tuesday", derived
   * from startsOn.
   */
  monthlyMode?: 'dayOfMonth' | 'nthWeekday';
  end?: RecurrenceEnd;
};

export const DEFAULT_RECURRENCE: Recurrence = {
  freq: 'daily',
  interval: 1,
  end: { type: 'never' },
};

/** A task as far as scheduling is concerned. */
export type Schedulable = {
  due_date: DateKey | null;
  starts_on: DateKey | null;
  recurrence: Recurrence | null;
};

export function isRecurring(task: Schedulable): boolean {
  return task.recurrence != null && task.starts_on != null;
}

function effectiveWeekdays(rule: Recurrence, startsOn: DateKey): number[] {
  const days = rule.byWeekday && rule.byWeekday.length > 0 ? rule.byWeekday : [weekday(startsOn)];
  return [...new Set(days)].sort((a, b) => a - b);
}

/** Which occurrence in the sequence `date` is, or -1 if the pattern misses it. */
export function occurrenceIndex(rule: Recurrence, startsOn: DateKey, date: DateKey): number {
  if (date < startsOn) return -1;
  const interval = Math.max(1, Math.trunc(rule.interval));

  switch (rule.freq) {
    case 'daily': {
      const diff = daysBetween(startsOn, date);
      return diff % interval === 0 ? diff / interval : -1;
    }

    case 'weekly': {
      const days = effectiveWeekdays(rule, startsOn);
      const dow = weekday(date);
      if (!days.includes(dow)) return -1;

      const weeksDiff = daysBetween(startOfWeekKey(startsOn), startOfWeekKey(date)) / 7;
      if (weeksDiff % interval !== 0) return -1;
      const activeWeek = weeksDiff / interval;

      // The first week is partial: days before startsOn's weekday don't count.
      const startDow = weekday(startsOn);
      const firstWeekDays = days.filter((d) => d >= startDow);

      if (activeWeek === 0) {
        const pos = firstWeekDays.indexOf(dow);
        return pos === -1 ? -1 : pos;
      }
      return firstWeekDays.length + (activeWeek - 1) * days.length + days.indexOf(dow);
    }

    case 'monthly': {
      const months = monthsBetween(startsOn, date);
      if (months < 0 || months % interval !== 0) return -1;

      if (rule.monthlyMode === 'nthWeekday') {
        const start = fromDateKey(startsOn);
        const nth = Math.ceil(start.getDate() / 7);
        const target = fromDateKey(date);
        if (target.getDay() !== start.getDay()) return -1;
        if (Math.ceil(target.getDate() / 7) !== nth) return -1;
      } else {
        // Same day of month, clamped so the 31st still fires in 30-day months.
        const target = fromDateKey(date);
        const wanted = fromDateKey(startsOn).getDate();
        const clamped = Math.min(wanted, daysInMonth(target.getFullYear(), target.getMonth()));
        if (target.getDate() !== clamped) return -1;
      }
      return months / interval;
    }

    case 'yearly': {
      const start = fromDateKey(startsOn);
      const target = fromDateKey(date);
      const years = target.getFullYear() - start.getFullYear();
      if (years < 0 || years % interval !== 0) return -1;
      if (target.getMonth() !== start.getMonth()) return -1;
      const clamped = Math.min(
        start.getDate(),
        daysInMonth(target.getFullYear(), target.getMonth()),
      );
      if (target.getDate() !== clamped) return -1;
      return years / interval;
    }

    default:
      return -1;
  }
}

export function occursOn(task: Schedulable, date: DateKey): boolean {
  if (!task.recurrence || !task.starts_on) {
    return task.due_date === date;
  }

  const rule = task.recurrence;
  if (rule.end?.type === 'on' && date > rule.end.date) return false;

  const index = occurrenceIndex(rule, task.starts_on, date);
  if (index < 0) return false;
  if (rule.end?.type === 'after' && index >= rule.end.count) return false;
  return true;
}

/**
 * Every date in [from, to] on which `task` is due. The window is always small
 * (one day for Today, at most the missed-lookback for the missed list), so a
 * day-by-day scan is both simple and cheap.
 */
export function occurrencesBetween(task: Schedulable, from: DateKey, to: DateKey): DateKey[] {
  if (to < from) return [];

  if (!task.recurrence || !task.starts_on) {
    return task.due_date && task.due_date >= from && task.due_date <= to ? [task.due_date] : [];
  }

  const windowStart = from > task.starts_on ? from : task.starts_on;
  let windowEnd = to;
  if (task.recurrence.end?.type === 'on' && task.recurrence.end.date < windowEnd) {
    windowEnd = task.recurrence.end.date;
  }
  if (windowEnd < windowStart) return [];

  return eachDayInRange(windowStart, windowEnd).filter((day) => occursOn(task, day));
}

// ------------------------------------------------------------- presets ----

export type RecurrencePresetId = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';

/**
 * Maps a rule back to the preset chip it came from, so reopening a task shows
 * "Weekly" rather than always dropping the user into the custom editor.
 */
export function presetForRecurrence(
  rule: Recurrence | null,
  startsOn: DateKey | null,
): RecurrencePresetId {
  if (!rule) return 'none';
  if (rule.interval !== 1) return 'custom';
  if (rule.end && rule.end.type !== 'never') return 'custom';

  switch (rule.freq) {
    case 'daily':
      return 'daily';
    case 'weekly': {
      if (!startsOn) return 'custom';
      const days = effectiveWeekdays(rule, startsOn);
      return days.length === 1 && days[0] === weekday(startsOn) ? 'weekly' : 'custom';
    }
    case 'monthly':
      return rule.monthlyMode === 'nthWeekday' ? 'custom' : 'monthly';
    case 'yearly':
      return 'yearly';
    default:
      return 'custom';
  }
}

export function recurrenceForPreset(
  preset: Exclude<RecurrencePresetId, 'none' | 'custom'>,
  startsOn: DateKey,
): Recurrence {
  switch (preset) {
    case 'daily':
      return { freq: 'daily', interval: 1, end: { type: 'never' } };
    case 'weekly':
      return {
        freq: 'weekly',
        interval: 1,
        byWeekday: [weekday(startsOn)],
        end: { type: 'never' },
      };
    case 'monthly':
      return { freq: 'monthly', interval: 1, monthlyMode: 'dayOfMonth', end: { type: 'never' } };
    case 'yearly':
      return { freq: 'yearly', interval: 1, end: { type: 'never' } };
  }
}

/** Next due date on or after `from`, or null if the rule has run out. */
export function nextOccurrence(
  task: Schedulable,
  from: DateKey,
  horizonDays = 400,
): DateKey | null {
  if (!task.recurrence || !task.starts_on) {
    return task.due_date && task.due_date >= from ? task.due_date : null;
  }

  const cursor = from > task.starts_on ? from : task.starts_on;

  // Monthly and yearly rules are sparse, so step a month at a time rather than
  // scanning hundreds of days that can never match.
  if (task.recurrence.freq === 'monthly' || task.recurrence.freq === 'yearly') {
    let windowStart = cursor;
    for (let i = 0; i < 120; i++) {
      const windowEnd = addMonths(windowStart, 1);
      const found = occurrencesBetween(task, windowStart, windowEnd);
      if (found.length > 0) return found[0] ?? null;
      windowStart = windowEnd;
    }
    return null;
  }

  const found = occurrencesBetween(task, cursor, addDays(cursor, horizonDays));
  return found[0] ?? null;
}
