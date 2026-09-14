import assert from 'node:assert/strict';
import test from 'node:test';

import type { Recurrence } from './recurrence';
import {
  buildTodayLists,
  missedOccurrences,
  occurrencesForDay,
  type CompletionLike,
} from './today';

// 2026-09-14 is a Monday.
const TODAY = '2026-09-14';

type T = {
  id: string;
  due_date: string | null;
  starts_on: string | null;
  recurrence: Recurrence | null;
};

const oneOff = (id: string, due: string): T => ({
  id,
  due_date: due,
  starts_on: null,
  recurrence: null,
});

const daily = (id: string, starts: string): T => ({
  id,
  due_date: null,
  starts_on: starts,
  recurrence: { freq: 'daily', interval: 1 },
});

test('a one-off due today is pending until completed', () => {
  const tasks = [oneOff('a', TODAY)];
  assert.deepStrictEqual(occurrencesForDay(tasks, [], TODAY), [
    { task: tasks[0], date: TODAY, status: 'pending' },
  ]);
});

test('a completion moves the occurrence out of pending', () => {
  const tasks = [oneOff('a', TODAY)];
  const done: CompletionLike[] = [{ task_id: 'a', occurrence_date: TODAY, status: 'done' }];
  const lists = buildTodayLists(tasks, done, TODAY, 14);
  assert.equal(lists.pending.length, 0);
  assert.equal(lists.completed.length, 1);
  assert.equal(lists.completed[0]?.status, 'done');
});

test('a skip also counts as handled, not missed', () => {
  const tasks = [oneOff('a', '2026-09-12')];
  const skipped: CompletionLike[] = [
    { task_id: 'a', occurrence_date: '2026-09-12', status: 'skipped' },
  ];
  assert.deepStrictEqual(missedOccurrences(tasks, skipped, TODAY, 14), []);
});

test('an untouched past one-off shows as missed', () => {
  const tasks = [oneOff('a', '2026-09-12')];
  const missed = missedOccurrences(tasks, [], TODAY, 14);
  assert.equal(missed.length, 1);
  assert.equal(missed[0]?.date, '2026-09-12');
});

test('today is never counted as missed', () => {
  const tasks = [oneOff('a', TODAY)];
  assert.deepStrictEqual(missedOccurrences(tasks, [], TODAY, 14), []);
});

test('a daily task misses one row per skipped day, newest first', () => {
  const tasks = [daily('d', '2026-09-10')];
  const completions: CompletionLike[] = [
    { task_id: 'd', occurrence_date: '2026-09-11', status: 'done' },
  ];
  const missed = missedOccurrences(tasks, completions, TODAY, 14);
  assert.deepStrictEqual(
    missed.map((m) => m.date),
    ['2026-09-13', '2026-09-12', '2026-09-10'],
  );
});

test('the lookback window bounds how far back missed rows go', () => {
  const tasks = [daily('d', '2020-01-01')];
  const missed = missedOccurrences(tasks, [], TODAY, 3);
  assert.deepStrictEqual(
    missed.map((m) => m.date),
    ['2026-09-13', '2026-09-12', '2026-09-11'],
  );
});

test('a recurring task due today appears once, not once per past day', () => {
  const tasks = [daily('d', '2026-09-01')];
  const lists = buildTodayLists(tasks, [], TODAY, 5);
  assert.equal(lists.pending.length, 1);
  assert.equal(lists.pending[0]?.date, TODAY);
});

test('a task that does not recur today is absent from both lists', () => {
  const weekly: T = {
    id: 'w',
    due_date: null,
    starts_on: '2026-09-15',
    recurrence: { freq: 'weekly', interval: 1, byWeekday: [2] },
  };
  const lists = buildTodayLists([weekly], [], TODAY, 14);
  assert.equal(lists.pending.length, 0);
  assert.equal(lists.missed.length, 0);
});
