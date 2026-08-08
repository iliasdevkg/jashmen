// src/i18n.jsx — the app-interface localization the manifest asks for
// ("переключить весь интерфейс игры... на один из трех языков"). This
// covers UI chrome (buttons, labels, empty states, error copy) — it does
// NOT machine-translate the curriculum itself; lesson content gets its own
// per-card ky/ru fields in the admin panel (see LessonPage's card
// rendering), which a human actually writes rather than this file guessing.
import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { ky } from './locales/ky.js';
import { ru } from './locales/ru.js';
import { en } from './locales/en.js';

const DICTS = { ky, ru, en };
export const LANGUAGES = [
  { code: 'ky', label: 'Кыргызча', flag: '🇰🇬' },
  { code: 'ru', label: 'Русский', flag: '🇷🇺' },
  { code: 'en', label: 'English', flag: '🇺🇸' },
];

const LOCALE_KEY = 'fl_locale';
const LocaleCtx = createContext(null);

function interpolate(str, vars) {
  if (!vars) return str;
  return str.replace(/\{\{(\w+)\}\}/g, (_, k) => (vars[k] ?? `{{${k}}}`));
}

export function LocaleProvider({ children }) {
  const [locale, setLocaleRaw] = useState(() => localStorage.getItem(LOCALE_KEY) || 'ky');

  const setLocale = useCallback((code) => {
    if (!DICTS[code]) return;
    setLocaleRaw(code);
    localStorage.setItem(LOCALE_KEY, code);
  }, []);

  const t = useCallback((key, vars) => {
    const dict = DICTS[locale] || ky;
    const str = dict[key] ?? ky[key] ?? key; // fall back to Kyrgyz, then the raw key — never a blank UI
    return interpolate(str, vars);
  }, [locale]);

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <LocaleCtx.Provider value={value}>{children}</LocaleCtx.Provider>;
}

export function useI18n() {
  return useContext(LocaleCtx);
}

// Russian has three plural forms (1 день / 2 дня / 5 дней); Kyrgyz and
// English interface text don't need this, but ProfilePage/RightPanel/
// LessonPage all show a streak-day count, so it earns a shared helper
// instead of three copies of the same modulo logic.
export function formatDays(n, locale) {
  const count = Number(n) || 0;
  if (locale === 'ru') {
    const mod10 = count % 10, mod100 = count % 100;
    const word = mod10 === 1 && mod100 !== 11 ? 'день'
      : (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) ? 'дня'
      : 'дней';
    return `${count} ${word}`;
  }
  if (locale === 'en') return `${count} ${count === 1 ? 'day' : 'days'}`;
  return `${count} күн`;
}

// Lesson CONTENT (theory text, quiz questions/options) is a separate
// concern from the interface strings above — a human writes it in the
// admin panel, per the manifest's "на двух языках: КР/РУ" (Module A). A
// field is either a plain string (legacy/ky-only content, unaffected by
// this) or `{ky, ru}`; English isn't asked for here ("задел на будущее"),
// so ru falls back to ky, and any other interface locale falls back to ky
// too — content is never blank just because the interface is in English.
export function localizedText(value, locale) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  return value[locale] || value.ky || value.ru || '';
}
