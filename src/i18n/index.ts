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

export const resources = {
  en: { translation: en },
  ru: { translation: ru },
  uz: { translation: uz },
} as const;

function detectDeviceLanguage(): LanguageCode {
  const tags = Localization.getLocales().map((l) => l.languageCode);
  for (const tag of tags) {
    if (tag === 'uz' || tag === 'ru' || tag === 'en') return tag;
  }
  return 'uz';
}

export async function initI18n(): Promise<LanguageCode> {
  let stored: LanguageCode | null = null;
  try {
    const raw = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (raw === 'uz' || raw === 'ru' || raw === 'en') stored = raw;
  } catch {
    // Storage is unavailable (private browsing, cleared site data) — fall back
    // to device detection rather than blocking startup.
  }

  const language = stored ?? detectDeviceLanguage();

  if (!i18n.isInitialized) {
    await i18n.use(initReactI18next).init({
      resources,
      lng: language,
      fallbackLng: 'en',
      defaultNS: 'translation',
      interpolation: { escapeValue: false },
      returnNull: false,
      compatibilityJSON: 'v4',
    });
  } else {
    await i18n.changeLanguage(language);
  }

  return language;
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
