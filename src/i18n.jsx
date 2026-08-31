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
  return value[locale] || value.ky || value.ru || value.en || '';
}

// ── Locale-aware formatting ────────────────────────────────────────────────
//
// The web twin of mobile/lib/src/core/i18n.dart's helpers. Hand-rolled for
// the same reason: the university league needs exactly three shapes
// (grouped integers, a som amount, a long date) in exactly three locales,
// and `toLocaleString` has no Kyrgyz data to work from — it would silently
// render Russian month names under a Kyrgyz interface.

// Kyrgyz vowels grouped by the harmony class that decides a suffix's vowel.
// `ё/ю/я` appear in Russian loanwords and abbreviations, so they map onto
// their nearest native class.
const KY_VOWEL_CLASS = {
  а: 'ы', ы: 'ы', я: 'ы',
  о: 'у', у: 'у', ю: 'у', ё: 'у',
  э: 'и', е: 'и', и: 'и',
  ө: 'ү', ү: 'ү',
};

const KY_VOICELESS = new Set(['к', 'п', 'с', 'т', 'ф', 'х', 'ц', 'ч', 'ш', 'щ']);

// Kyrgyz genitive: "КГТУ" → "КГТУНУН", "АУЦА" → "АУЦАНЫН",
// "САЛЫМБЕКОВ" → "САЛЫМБЕКОВДУН".
//
// Headings like "КГТУНУН ТОП 10 СТУДЕНТИ" are built from a university name
// that varies, so one fixed suffix would be wrong for most of them. Vowel
// harmony picks the suffix vowel; the final letter picks the consonant
// (-н- after a vowel, -т- after a voiceless consonant, -д- otherwise).
export function kyGenitive(word) {
  const trimmed = String(word ?? '').trim();
  if (!trimmed) return trimmed;

  const lower = trimmed.toLowerCase();
  const isUpper = trimmed === trimmed.toUpperCase();

  let vowel = 'ы';
  for (let i = lower.length - 1; i >= 0; i--) {
    const v = KY_VOWEL_CLASS[lower[i]];
    if (v) { vowel = v; break; }
  }

  const last = lower[lower.length - 1];
  const lead = KY_VOWEL_CLASS[last] ? 'н' : (KY_VOICELESS.has(last) ? 'т' : 'д');

  const suffix = `${lead}${vowel}н`;
  return trimmed + (isUpper ? suffix.toUpperCase() : suffix);
}

// 1248560 → "1 248 560". The separator is a non-breaking space so an XP
// figure never wraps across two lines mid-number.
export function formatGrouped(value) {
  const n = Math.trunc(Number(value) || 0);
  const digits = String(Math.abs(n));
  let out = '';
  for (let i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 === 0) out += ' ';
    out += digits[i];
  }
  return (n < 0 ? '-' : '') + out;
}

// "120 000 сом" / "120 000 KGS" — the currency is written out in Kyrgyz and
// Russian, and given as the ISO code in English where "som" would not read.
// Non-breaking throughout: an amount that wraps between its digits and its
// currency reads as two separate facts.
export function formatSom(amount, locale) {
  return `${formatGrouped(amount)} ${locale === 'en' ? 'KGS' : 'сом'}`;
}

const MONTHS_KY = ['ЯНВАРЬ', 'ФЕВРАЛЬ', 'МАРТ', 'АПРЕЛЬ', 'МАЙ', 'ИЮНЬ',
  'ИЮЛЬ', 'АВГУСТ', 'СЕНТЯБРЬ', 'ОКТЯБРЬ', 'НОЯБРЬ', 'ДЕКАБРЬ'];

// Russian dates take the genitive month ("18 сентября"), a different word
// from the nominative Kyrgyz uses.
const MONTHS_RU = ['ЯНВАРЯ', 'ФЕВРАЛЯ', 'МАРТА', 'АПРЕЛЯ', 'МАЯ', 'ИЮНЯ',
  'ИЮЛЯ', 'АВГУСТА', 'СЕНТЯБРЯ', 'ОКТЯБРЯ', 'НОЯБРЯ', 'ДЕКАБРЯ'];

const MONTHS_EN = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];

// "18 СЕНТЯБРЬ 2025" / "18 СЕНТЯБРЯ 2025" / "SEPTEMBER 18, 2025".
// Upper-case because every date in the design sits in a label slot.
// Accepts a "YYYY-MM-DD" string and parses it as a plain calendar date —
// `new Date('2025-09-18')` is UTC midnight, which is the 17th in any
// negative-offset timezone.
export function formatLongDate(value, locale) {
  const [y, m, d] = String(value).split('-').map(Number);
  if (!y || !m || !d) return '';
  if (locale === 'ru') return `${d} ${MONTHS_RU[m - 1]} ${y}`;
  if (locale === 'en') return `${MONTHS_EN[m - 1]} ${d}, ${y}`;
  return `${d} ${MONTHS_KY[m - 1]} ${y}`;
}
