/**
 * Dates in Muvozanat are calendar days, never instants: a task due "today" is
 * due on the user's local today regardless of timezone. So everything that
 * crosses the API boundary is a `YYYY-MM-DD` string ("date key") and every
 * Date object is a local-midnight Date.
 */

export type DateKey = string;

export function toDateKey(date: Date): DateKey {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Parses `YYYY-MM-DD` into a Date at local midnight (not UTC midnight). */
export function fromDateKey(key: DateKey): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

export function todayKey(): DateKey {
  return toDateKey(new Date());
}

export function addDays(key: DateKey, days: number): DateKey {
  const date = fromDateKey(key);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

export function addMonths(key: DateKey, months: number): DateKey {
  const date = fromDateKey(key);
  const targetDay = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + months);
  // Clamp rather than roll over: "the 31st, monthly" lands on the 30th in
  // April instead of skipping to 1 May.
  const lastDay = daysInMonth(date.getFullYear(), date.getMonth());
  date.setDate(Math.min(targetDay, lastDay));
  return toDateKey(date);
}

export function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

export function daysBetween(from: DateKey, to: DateKey): number {
  const a = fromDateKey(from);
  const b = fromDateKey(to);
  // Normalise through UTC so DST transitions cannot produce a 23- or 25-hour
  // day and round the division to the wrong integer.
  const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((utcB - utcA) / 86_400_000);
}

export function monthsBetween(from: DateKey, to: DateKey): number {
  const a = fromDateKey(from);
  const b = fromDateKey(to);
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

/** 0 = Sunday … 6 = Saturday. */
export function weekday(key: DateKey): number {
  return fromDateKey(key).getDay();
}

/** Date key of the Sunday that starts the week containing `key`. */
export function startOfWeekKey(key: DateKey): DateKey {
  return addDays(key, -weekday(key));
}

export function compareDateKeys(a: DateKey, b: DateKey): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function isBeforeKey(a: DateKey, b: DateKey): boolean {
  return a < b;
}

export function isSameOrAfterKey(a: DateKey, b: DateKey): boolean {
  return a >= b;
}

/** Inclusive list of date keys from `from` to `to`. Empty if `to` < `from`. */
export function eachDayInRange(from: DateKey, to: DateKey): DateKey[] {
  const out: DateKey[] = [];
  let cursor = from;
  while (cursor <= to) {
    out.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return out;
}

export function formatDate(
  key: DateKey,
  locale: string,
  opts?: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat(locale, opts ?? { day: 'numeric', month: 'short' }).format(
    fromDateKey(key),
  );
}

export function formatLongDate(key: DateKey, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(fromDateKey(key));
}

export function formatTimestamp(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}
