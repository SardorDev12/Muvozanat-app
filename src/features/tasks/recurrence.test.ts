import assert from 'node:assert/strict';
import test from 'node:test';

import {
  nextOccurrence,
  occurrenceIndex,
  occurrencesBetween,
  occursOn,
  type Recurrence,
} from './recurrence';

/**
 * Run with `npm test`. These are pure-function tests over the recurrence rules;
 * every fixture date is written out in full so a failure names a real calendar
 * day rather than an offset.
 *
 * 2026-09-14 is a Monday. 2028 is a leap year.
 */
function check(label: string, got: unknown, want: unknown): void {
  test(label, () => {
    assert.deepStrictEqual(got, want);
  });
}

const t = (r: Recurrence | null, starts: string | null, due: string | null = null) => ({
  recurrence: r,
  starts_on: starts,
  due_date: due,
});

// 2026-09-14 is a Monday.
// --- one-off
check('one-off hits', occursOn(t(null, null, '2026-09-14'), '2026-09-14'), true);
check('one-off misses', occursOn(t(null, null, '2026-09-14'), '2026-09-15'), false);

// --- daily every 3 from Mon 14 Sep
const d3 = t({ freq: 'daily', interval: 3 }, '2026-09-14');
check('daily/3 d0', occursOn(d3, '2026-09-14'), true);
check('daily/3 d1', occursOn(d3, '2026-09-15'), false);
check('daily/3 d3', occursOn(d3, '2026-09-17'), true);
check('daily/3 before start', occursOn(d3, '2026-09-11'), false);
check('daily/3 window', occurrencesBetween(d3, '2026-09-14', '2026-09-24'), [
  '2026-09-14',
  '2026-09-17',
  '2026-09-20',
  '2026-09-23',
]);

// --- daily ends after 3
const d3end = t({ freq: 'daily', interval: 1, end: { type: 'after', count: 3 } }, '2026-09-14');
check('after-3 window', occurrencesBetween(d3end, '2026-09-14', '2026-09-30'), [
  '2026-09-14',
  '2026-09-15',
  '2026-09-16',
]);

// --- daily ends on date
const dOn = t(
  { freq: 'daily', interval: 1, end: { type: 'on', date: '2026-09-16' } },
  '2026-09-14',
);
check('ends-on window', occurrencesBetween(dOn, '2026-09-14', '2026-09-30'), [
  '2026-09-14',
  '2026-09-15',
  '2026-09-16',
]);

// --- weekly Mon+Wed+Fri every 1 week, starting Mon 14 Sep
const w1 = t({ freq: 'weekly', interval: 1, byWeekday: [1, 3, 5] }, '2026-09-14');
check('weekly MWF', occurrencesBetween(w1, '2026-09-14', '2026-09-27'), [
  '2026-09-14',
  '2026-09-16',
  '2026-09-18',
  '2026-09-21',
  '2026-09-23',
  '2026-09-25',
]);
check('weekly index d0', occurrenceIndex(w1.recurrence!, '2026-09-14', '2026-09-14'), 0);
check('weekly index Fri wk0', occurrenceIndex(w1.recurrence!, '2026-09-14', '2026-09-18'), 2);
check('weekly index Mon wk1', occurrenceIndex(w1.recurrence!, '2026-09-14', '2026-09-21'), 3);

// --- weekly starting mid-set: start Wed 16 Sep, days Mon+Wed+Fri
const wMid = t({ freq: 'weekly', interval: 1, byWeekday: [1, 3, 5] }, '2026-09-16');
check('weekly partial first week', occurrencesBetween(wMid, '2026-09-13', '2026-09-22'), [
  '2026-09-16',
  '2026-09-18',
  '2026-09-21',
]);
check('weekly partial idx Wed', occurrenceIndex(wMid.recurrence!, '2026-09-16', '2026-09-16'), 0);
check('weekly partial idx Fri', occurrenceIndex(wMid.recurrence!, '2026-09-16', '2026-09-18'), 1);
check(
  'weekly partial idx next Mon',
  occurrenceIndex(wMid.recurrence!, '2026-09-16', '2026-09-21'),
  2,
);

// --- biweekly Tue, start Tue 15 Sep
const w2 = t({ freq: 'weekly', interval: 2, byWeekday: [2] }, '2026-09-15');
check('biweekly Tue', occurrencesBetween(w2, '2026-09-15', '2026-10-20'), [
  '2026-09-15',
  '2026-09-29',
  '2026-10-13',
]);

// --- weekly with end after 4
const w4 = t(
  { freq: 'weekly', interval: 1, byWeekday: [1, 5], end: { type: 'after', count: 4 } },
  '2026-09-14',
);
check('weekly after-4', occurrencesBetween(w4, '2026-09-14', '2026-10-30'), [
  '2026-09-14',
  '2026-09-18',
  '2026-09-21',
  '2026-09-25',
]);

// --- monthly on the 31st, clamped
const m31 = t({ freq: 'monthly', interval: 1, monthlyMode: 'dayOfMonth' }, '2026-01-31');
check('monthly 31 jan', occursOn(m31, '2026-01-31'), true);
check('monthly 31 feb clamps to 28', occursOn(m31, '2026-02-28'), true);
check('monthly 31 feb 27 no', occursOn(m31, '2026-02-27'), false);
check('monthly 31 apr clamps to 30', occursOn(m31, '2026-04-30'), true);
check('monthly 31 mar', occursOn(m31, '2026-03-31'), true);

// --- monthly nth weekday: 2nd Monday (14 Sep 2026 is the 2nd Monday)
const mNth = t({ freq: 'monthly', interval: 1, monthlyMode: 'nthWeekday' }, '2026-09-14');
check('nth weekday oct', occurrencesBetween(mNth, '2026-10-01', '2026-10-31'), ['2026-10-12']);
check('nth weekday nov', occurrencesBetween(mNth, '2026-11-01', '2026-11-30'), ['2026-11-09']);

// --- quarterly
const mQ = t({ freq: 'monthly', interval: 3, monthlyMode: 'dayOfMonth' }, '2026-09-14');
check('quarterly', occurrencesBetween(mQ, '2026-09-01', '2027-06-30'), [
  '2026-09-14',
  '2026-12-14',
  '2027-03-14',
  '2027-06-14',
]);

// --- yearly leap day
const yLeap = t({ freq: 'yearly', interval: 1 }, '2028-02-29');
check('leap 2028', occursOn(yLeap, '2028-02-29'), true);
check('leap 2029 clamps', occursOn(yLeap, '2029-02-28'), true);
check('leap 2032', occursOn(yLeap, '2032-02-29'), true);

// --- nextOccurrence
check('next daily', nextOccurrence(d3, '2026-09-18'), '2026-09-20');
check('next weekly', nextOccurrence(w1, '2026-09-19'), '2026-09-21');
check('next monthly', nextOccurrence(mQ, '2026-09-15'), '2026-12-14');
check('next exhausted', nextOccurrence(d3end, '2026-09-20'), null);
check('next one-off past', nextOccurrence(t(null, null, '2026-09-10'), '2026-09-14'), null);
