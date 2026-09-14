/**
 * Turns the stored task rows into the three lists the Today screen shows:
 * what is due today, what was missed, and what has already been done.
 *
 * Pure functions over plain data so the behaviour is testable without a
 * network or a renderer (see today.test.ts).
 */
import { addDays, type DateKey } from '../../utils/date';

import { occurrencesBetween, type Schedulable } from './recurrence';

export type OccurrenceStatus = 'pending' | 'done' | 'skipped';

export type TaskLike = Schedulable & {
  id: string;
  /** Set once the task itself is finished, not merely one of its occurrences. */
  completed_at?: string | null;
};

export type CompletionLike = {
  task_id: string;
  occurrence_date: DateKey;
  status: 'done' | 'skipped';
};

export type Occurrence<T extends TaskLike = TaskLike> = {
  task: T;
  date: DateKey;
  status: OccurrenceStatus;
};

function completionKey(taskId: string, date: DateKey): string {
  return `${taskId}|${date}`;
}

export function indexCompletions(
  completions: readonly CompletionLike[],
): Map<string, OccurrenceStatus> {
  const map = new Map<string, OccurrenceStatus>();
  for (const c of completions) {
    map.set(completionKey(c.task_id, c.occurrence_date), c.status);
  }
  return map;
}

/**
 * A task the user has finished outright is retired: its rule may still match
 * future dates, but the only occurrences that still count are the ones that
 * actually happened. That keeps a retired habit in the day it was closed out
 * without resurrecting it tomorrow or back-filling it as missed.
 */
function isRetired(task: TaskLike): boolean {
  return !!task.completed_at;
}

/** Everything due on `date`, whatever its completion state. */
export function occurrencesForDay<T extends TaskLike>(
  tasks: readonly T[],
  completions: readonly CompletionLike[],
  date: DateKey,
): Occurrence<T>[] {
  const index = indexCompletions(completions);

  return tasks
    .filter((task) => occurrencesBetween(task, date, date).length > 0)
    .map((task) => ({
      task,
      date,
      status: index.get(completionKey(task.id, date)) ?? 'pending',
    }))
    .filter((occurrence) => !isRetired(occurrence.task) || occurrence.status !== 'pending');
}

/**
 * Past-due occurrences with nothing recorded against them, newest first.
 *
 * `lookbackDays` bounds the scan: without it, a task that repeats daily and
 * was abandoned a year ago would bury the list under 365 rows.
 */
export function missedOccurrences<T extends TaskLike>(
  tasks: readonly T[],
  completions: readonly CompletionLike[],
  today: DateKey,
  lookbackDays: number,
): Occurrence<T>[] {
  const index = indexCompletions(completions);
  const from = addDays(today, -Math.max(1, lookbackDays));
  const until = addDays(today, -1);
  if (until < from) return [];

  const missed: Occurrence<T>[] = [];

  for (const task of tasks) {
    if (isRetired(task)) continue;
    for (const date of occurrencesBetween(task, from, until)) {
      if (index.has(completionKey(task.id, date))) continue;
      missed.push({ task, date, status: 'pending' });
    }
  }

  return missed.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

export type TodayLists<T extends TaskLike> = {
  pending: Occurrence<T>[];
  completed: Occurrence<T>[];
  missed: Occurrence<T>[];
};

export function buildTodayLists<T extends TaskLike>(
  tasks: readonly T[],
  completions: readonly CompletionLike[],
  today: DateKey,
  lookbackDays: number,
): TodayLists<T> {
  const forToday = occurrencesForDay(tasks, completions, today);

  return {
    pending: forToday.filter((o) => o.status === 'pending'),
    completed: forToday.filter((o) => o.status !== 'pending'),
    missed: missedOccurrences(tasks, completions, today, lookbackDays),
  };
}
