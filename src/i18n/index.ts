/* eslint-disable import/no-named-as-default-member -- the i18next default export is the
   configured singleton; its named exports act on a different instance. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en';
import ru from './locales/ru';
import uz from './locales/uz';

export const SUPPORTED_LANGUAGES = [
  { code: 'uz', label: "O'zbekcha" },
  { code: 'ru', label: 'Русский' },
  { code: 'en', label: 'English' },
] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]['code'];

const LANGUAGE_STORAGE_KEY = 'muvozanat.language';
const FALLBACK: LanguageCode = 'uz';

export const resources = {
  en: { translation: en },
  ru: { translation: ru },
  uz: { translation: uz },
} as const;

function isSupported(code: string | null | undefined): code is LanguageCode {
  return code === 'uz' || code === 'ru' || code === 'en';
}

function detectDeviceLanguage(): LanguageCode {
  try {
    for (const locale of Localization.getLocales()) {
      if (isSupported(locale.languageCode)) return locale.languageCode;
    }
  } catch {
    // Static web prerendering runs this in Node, where there is no device
    // locale to read. The fallback is correct there and the real language is
    // applied as soon as the page hydrates.
  }
  return FALLBACK;
}

/**
 * Translations are bundled, so i18next initialises synchronously at import.
 *
 * This matters beyond tidiness: gating the whole app on an async init meant a
 * blank first frame on every launch, and it made static web rendering emit
 * empty HTML — no title, no content — because effects never run during a
 * prerender.
 */
i18n.use(initReactI18next).init({
  resources,
  lng: detectDeviceLanguage(),
  fallbackLng: 'en',
  defaultNS: 'translation',
  interpolation: { escapeValue: false },
  returnNull: false,
  compatibilityJSON: 'v4',
  initImmediate: false,
});

/**
 * Applies a previously chosen language. Runs after the first paint: reading it
 * is async, and the device language is a good enough guess to render with in
 * the meantime.
 */
export async function hydrateStoredLanguage(): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (isSupported(stored) && stored !== i18n.language) {
      await i18n.changeLanguage(stored);
    }
  } catch {
    // Storage unavailable (private browsing, cleared site data). The detected
    // language stays in force, which is a reasonable outcome.
  }
}

export async function setLanguage(code: LanguageCode): Promise<void> {
  await i18n.changeLanguage(code);
  try {
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, code);
  } catch {
    // Non-fatal: the language still applies for this session.
  }
}

/** Locale tag used for Intl date/number formatting. */
export function intlLocale(code: string): string {
  switch (code) {
    case 'uz':
      return 'uz-UZ';
    case 'ru':
      return 'ru-RU';
    default:
      return 'en-US';
  }
}

export default i18n;
