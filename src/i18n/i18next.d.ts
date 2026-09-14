import 'i18next';

import type { Translations } from './locales/en';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: Translations };
    returnNull: false;
  }
}
