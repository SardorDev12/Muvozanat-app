import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { intlLocale } from '@/i18n';
import { useWeekdays } from '@/i18n/useWeekdays';
import { formatDate, fromDateKey, weekday, type DateKey } from '@/utils/date';

import type { Recurrence } from './recurrence';

/**
 * Renders a rule as the one-line summary shown under the repeat field, e.g.
 * "Every 2 weeks on Mon, Fri, until 3 Dec".
 */
export function useRecurrenceLabel() {
  const { t, i18n } = useTranslation();
  const weekdays = useWeekdays();
  const locale = intlLocale(i18n.language);

  return useCallback(
    (rule: Recurrence | null, startsOn: DateKey | null): string => {
      if (!rule || !startsOn) return t('recurrence.none');

      const count = Math.max(1, Math.trunc(rule.interval));
      const unit =
        rule.freq === 'daily'
          ? 'day'
          : rule.freq === 'weekly'
            ? 'week'
            : rule.freq === 'monthly'
              ? 'month'
              : 'year';

      let base: string;
      if (count === 1) {
        base = t(`recurrence.${rule.freq}`);
      } else {
        base = t(`recurrence.everyN.${unit}`, { count });
      }

      if (rule.freq === 'weekly') {
        const days = rule.byWeekday?.length ? rule.byWeekday : [weekday(startsOn)];
        const names = [...days]
          .sort((a, b) => a - b)
          .map((d) => weekdays.short[d] ?? '')
          .filter(Boolean)
          .join(', ');
        if (names) base = t('recurrence.summaryWeekdays', { base, days: names });
      }

      if (rule.freq === 'monthly' && rule.monthlyMode !== 'nthWeekday') {
        base = `${base} · ${t('recurrence.monthlyOnDay', { day: fromDateKey(startsOn).getDate() })}`;
      }

      if (rule.end?.type === 'on') {
        return t('recurrence.summaryUntil', { base, date: formatDate(rule.end.date, locale) });
      }
      if (rule.end?.type === 'after') {
        return t('recurrence.summaryCount', { base, count: rule.end.count });
      }
      return base;
    },
    [t, weekdays, locale],
  );
}
