import { useTranslation } from 'react-i18next';

import { resources } from './index';

type Lang = keyof typeof resources;

function langOf(code: string): Lang {
  return code === 'ru' || code === 'en' ? code : 'uz';
}

/**
 * Weekday names come straight from the resource bundle rather than through
 * `t()`, because they are arrays and `t()` is typed for strings.
 */
export function useWeekdays() {
  const { i18n } = useTranslation();
  const bundle = resources[langOf(i18n.language)].translation.weekdays;
  return { short: bundle.short, long: bundle.long };
}
