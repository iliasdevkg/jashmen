// admin-api/contentStore.js
//
// Content is no longer hardcoded — this is the database. Same dual-backend
// pattern as db.js (Blob when BLOB_READ_WRITE_TOKEN is set — survives a
// serverless/ephemeral deploy — local disk otherwise), but for
// modules/lessons/leagues/achievements/shop/partners/prizes/limits/
// retentionRules instead of users. The admin panel mutates this through
// the functions below; GET /admin/api/public/content just serves whatever
// currently lives here. See db.js's top-of-file comment for the full
// rationale and the concurrent-write caveat — identical here.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { put, get } from '@vercel/blob';
import { SEED_CONTENT } from './content.seed.js';
import { SEED_LANDING } from './landing.seed.js';
import { LESSON_ICON_SLUGS } from '../shared/lessonIcons.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
const CONTENT_FILE = path.join(DATA_DIR, 'content.json');

const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN || null;
const CONTENT_BLOB_PATHNAME = 'content.json';

if (!BLOB_TOKEN) {
  console.warn(
    '[contentStore] BLOB_READ_WRITE_TOKEN is not set — content saves to\n' +
    '                local disk (admin-api/data/content.json), which does\n' +
    '                NOT survive a serverless/ephemeral deploy. Create a\n' +
    '                Blob store in the Vercel dashboard and set this in\n' +
    '                admin-api/.env before deploying this backend to\n' +
    '                production.'
  );
}

// Achievements from before the rule-engine existed (or any hand-edited
// content.json missing a `rule`) get backfilled with the rule their id used
// to hardcode — a one-time, idempotent migration on every load, same idea
// as db.js's gems→coins migration. New achievements always come with a
// rule already attached (the admin form requires one).
const LEGACY_ACHIEVEMENT_RULES = {
  first:   { type: 'lessons_completed', value: 1 },
  streak7: { type: 'streak_days', value: 7 },
  xp100:   { type: 'xp_total', value: 100 },
  xp1000:  { type: 'xp_total', value: 1000 },
  perfect: { type: 'perfect_lesson' },
  expert:  { type: 'all_lessons_completed' },
};

// Task 12 — shop items are effect-driven (see "Shop items" section below)
// rather than hardcoded-by-id. Content saved before `effect` existed only
// had these four fixed ids with hardcoded behavior in routes.js; withDefaults()
// backfills the matching effect once on load so existing purchases/behavior
// are unaffected by the migration. Declared here (not next to addShopItem
// further down) because withDefaults() below needs it at module-load time.
export const SHOP_EFFECTS = new Set(['energy_refill', 'streak_shield', 'xp_boost', 'vip_badge']);
const LEGACY_SHOP_EFFECTS = {
  energy_refill: 'energy_refill',
  streak_freeze: 'streak_shield',
  xp_boost: 'xp_boost',
  vip_badge: 'vip_badge',
};

// Badges used to be an `emoji` string; they're now an admin-uploaded image
// (`iconUrl`), with a vector fallback in the app when nothing is uploaded.
// Any content.json written before that change still carries `emoji`, so we
// drop it on load — same idempotent one-time-migration-on-every-load shape
// as the rule backfill above. Dropping rather than converting is deliberate:
// an emoji is not an image URL, and leaving it in would let a stale field
// quietly resurface in a future renderer.
function withoutEmoji(entity) {
  const { emoji: _legacy, ...rest } = entity;
  return { ...rest, iconUrl: rest.iconUrl ?? null };
}

// ── University league content (Module Г) ─────────────────────────────────
//
// The campuses and their contests. This used to be authored twice, in
// src/data/universities.js and mobile/lib/src/data/universities.dart, which
// meant a prize pool could only change by shipping both clients. It lives
// here now and rides along in /public/content like every other block, so an
// organiser's numbers are an admin edit.
//
// Seeded with exactly what those two files held, so the first load after
// this migration renders identically.
const SEED_UNIVERSITIES = [
  {
    id: 'kstu',
    // Label in the picker — the name students actually use out loud, which
    // is not always the legal name shown on the contest card.
    listName: 'ПОЛИТЕХ',
    name: {
      ky: 'И. Раззаков атындагы КГТУ',
      ru: 'КГТУ им. И. Раззакова',
      en: 'KSTU named after I. Razzakov',
    },
    shortName: { ky: 'КГТУ', ru: 'КГТУ', en: 'KSTU' },
    color: '#1E5FBF',
    logoUrl: null,
    contest: {
      organizerPhone: '+996700123123',
      address: {
        ky: 'Чыңгыз Айтматов көчөсү, 66',
        ru: 'Чынгыза Айтматова, 66',
        en: 'Chyngyz Aitmatov St., 66',
      },
      sponsorName: 'mbank',
      sponsorLogoUrl: null,
      prizePool: 120000,
      firstPrize: 70000,
      secondPrize: 30000,
      thirdPrize: 20000,
      giftsTopN: 10,
      startsAt: '2025-09-18',
      endsAt: '2025-10-18',
      rules: {
        ky: 'КГТУнун студенттери гана конкурска катыша алат жана белек ута алышат. XP чогултуп, университетиңди жеңишке жеткир!',
        ru: 'Только студенты КГТУ могут участвовать и побеждать. Собирай XP и приведи свой вуз к победе!',
        en: 'Only KSTU students can participate and win. Collect XP and lead your university to victory!',
      },
    },
  },
  {
    id: 'auca',
    listName: 'АУЦА',
    name: {
      ky: 'Борбор Азиядагы Америка университети',
      ru: 'Американский университет в Центральной Азии',
      en: 'American University of Central Asia',
    },
    shortName: { ky: 'АУЦА', ru: 'АУЦА', en: 'AUCA' },
    color: '#F5B301',
    logoUrl: null,
    contest: null,
  },
  {
    id: 'salymbekov',
    listName: 'САЛЫМБЕКОВ УНИВЕРСИТЕТ',
    name: {
      ky: 'Салымбеков университети',
      ru: 'Университет Салымбекова',
      en: 'Salymbekov University',
    },
    shortName: { ky: 'Салымбеков', ru: 'Салымбеков', en: 'Salymbekov' },
    color: '#1D4ED8',
    logoUrl: null,
    contest: null,
  },
  {
    id: 'alatoo',
    listName: 'АЛА-ТОО УНИВЕРСИТЕТИ',
    name: {
      ky: 'Ала-Тоо эл аралык университети',
      ru: 'Международный университет Ала-Тоо',
      en: 'Ala-Too International University',
    },
    shortName: { ky: 'Ала-Тоо', ru: 'Ала-Тоо', en: 'Ala-Too' },
    color: '#C0392B',
    logoUrl: null,
    contest: null,
  },
  {
    id: 'krsu',
    listName: 'КРСУ',
    name: {
      ky: 'Б. Н. Ельцин атындагы Кыргыз-Орус Славян университети',
      ru: 'Кыргызско-Российский Славянский университет им. Б. Н. Ельцина',
      en: 'Kyrgyz-Russian Slavic University',
    },
    shortName: { ky: 'КРСУ', ru: 'КРСУ', en: 'KRSU' },
    color: '#2563EB',
    logoUrl: null,
    contest: null,
  },
  {
    id: 'knu',
    listName: 'КНУ',
    name: {
      ky: 'Ж. Баласагын атындагы Кыргыз улуттук университети',
      ru: 'Кыргызский национальный университет им. Ж. Баласагына',
      en: 'Kyrgyz National University',
    },
    shortName: { ky: 'КНУ', ru: 'КНУ', en: 'KNU' },
    color: '#1D6FB8',
    logoUrl: null,
    contest: null,
  },
];

// ── Landing page (the public marketing site) ─────────────────────────────
//
// One declarative table drives all three consumers: this sanitizer, the
// seed's shape (landing.seed.js) and the admin editor's field list
// (admin-src/pages/LandingModule.jsx). Adding a field means adding it here
// and nowhere else in the backend.
//
//   text  — trilingual {ky, ru?, en?}; blank is allowed (the client just
//           omits the element), unlike a module title which must exist
//   plain — a raw short string (an email address)
//   url   — http(s) or a site-relative path, same rule as an icon URL
//   list  — a repeatable group; `icon: true` adds a lessonIcons.js slug
//
// Declared ABOVE withDefaults() on purpose: withDefaults runs during module
// evaluation, so a `const` declared further down would still be in its
// temporal dead zone by the time the store loads.
const LANDING_SECTIONS = {
  hero:         { text: ['eyebrow', 'title', 'subtitle', 'primaryCta', 'secondaryCta', 'badgeLabel'], enum: ['badgeStat'] },
  ribbon:       { list: { key: 'items', max: 10, text: ['text'] } },
  stats:        { text: ['title', 'subtitle', 'learnersLabel', 'lessonsLabel', 'universitiesLabel', 'xpLabel'] },
  features:     { text: ['title', 'subtitle'], list: { key: 'items', max: 12, icon: true, text: ['title', 'text'] } },
  steps:        { text: ['title', 'subtitle'], list: { key: 'items', max: 8,  icon: true, text: ['title', 'text'] } },
  uni:          { text: ['title', 'subtitle', 'cta', 'prizeLabel'] },
  partners:     { text: ['title'] },
  gamification: { text: ['title', 'subtitle'], list: { key: 'items', max: 12, icon: true, text: ['title', 'text'] } },
  testimonials: { text: ['title', 'subtitle'], list: { key: 'items', max: 12, text: ['role', 'text'], plain: ['name'], url: ['avatarUrl'] } },
  download:     { text: ['title', 'subtitle', 'apkLabel', 'note', 'webCta'], url: ['apkUrl'] },
  faq:          { text: ['title', 'subtitle'], list: { key: 'items', max: 20, text: ['q', 'a'] } },
  footer:       { text: ['tagline', 'rights'], url: ['instagram'], plain: ['email'] },
};

export const LANDING_SECTION_KEYS = Object.keys(LANDING_SECTIONS);

const LANDING_ITEM_ID_RE = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,39}$/;

// Item ids are React keys on the site and the admin editor's row identity.
// A caller that sends none (or a duplicate) gets a positional one rather
// than an error — losing a row to a validation failure over an id nobody
// types by hand would be a worse trade than quietly assigning one.
function landingItemId(raw, index, taken) {
  let id = LANDING_ITEM_ID_RE.test(String(raw ?? '')) ? String(raw) : `item-${index + 1}`;
  let n = 2;
  while (taken.has(id)) id = `${id}-${n++}`;
  taken.add(id);
  return id;
}

function landingUrl(value) {
  return sanitizeIconUrl(value) || '';
}

// The set a landing `enum` field may hold. Keyed by field name because
// there is exactly one such field; a second would join it here rather than
// growing a per-section option table.
const LANDING_ENUMS = {
  // Which counter from GET /public/stats the hero's diamond badge shows.
  // 'none' hides the badge entirely.
  badgeStat: ['none', 'learners', 'lessons', 'universities', 'xp'],
};

function sanitizeLandingEnum(field, value, fallback) {
  const allowed = LANDING_ENUMS[field] || [];
  const v = String(value ?? '').trim();
  if (allowed.includes(v)) return v;
  return allowed.includes(fallback) ? fallback : allowed[0];
}

function sanitizeLandingItem(spec, raw, index, taken) {
  const item = { id: landingItemId(raw?.id, index, taken) };
  if (spec.icon) item.icon = sanitizeIconSlug(raw?.icon);
  for (const field of spec.text || []) item[field] = normalizeTrilingualOptional(raw?.[field]);
  // A person's name is not translated into three languages, and a photo is
  // an uploaded URL rather than an icon slug — both only exist on the
  // testimonial rows, hence optional here.
  for (const field of spec.plain || []) item[field] = String(raw?.[field] ?? '').trim().slice(0, 200);
  for (const field of spec.url || []) item[field] = landingUrl(raw?.[field]);
  return item;
}

// Merges `patch` over `current` section by section. A section absent from
// the patch is carried over untouched, which is what lets the admin editor
// PUT one section at a time and what lets a new seed section appear for a
// store that predates it.
function sanitizeLanding(patch, current) {
  const src = patch && typeof patch === 'object' ? patch : {};
  const base = current && typeof current === 'object' ? current : {};
  const out = {};

  for (const [key, spec] of Object.entries(LANDING_SECTIONS)) {
    const raw = src[key] && typeof src[key] === 'object' ? src[key] : {};
    const prev = base[key] && typeof base[key] === 'object' ? base[key] : {};
    const seed = SEED_LANDING[key] || {};
    const section = {
      enabled: typeof raw.enabled === 'boolean' ? raw.enabled
        : typeof prev.enabled === 'boolean' ? prev.enabled
        : seed.enabled !== false,
    };

    for (const field of spec.text || []) {
      const value = field in raw ? raw[field] : (field in prev ? prev[field] : seed[field]);
      section[field] = normalizeTrilingualOptional(value);
    }
    for (const field of spec.url || []) {
      const value = field in raw ? raw[field] : (field in prev ? prev[field] : seed[field]);
      section[field] = landingUrl(value);
    }
    for (const field of spec.plain || []) {
      const value = field in raw ? raw[field] : (field in prev ? prev[field] : seed[field]);
      section[field] = String(value ?? '').trim().slice(0, 200);
    }
    for (const field of spec.enum || []) {
      const value = field in raw ? raw[field] : (field in prev ? prev[field] : seed[field]);
      section[field] = sanitizeLandingEnum(field, value, seed[field]);
    }
    if (spec.list) {
      const { key: listKey, max } = spec.list;
      const rawList = Array.isArray(raw[listKey]) ? raw[listKey]
        : Array.isArray(prev[listKey]) ? prev[listKey]
        : (seed[listKey] || []);
      const taken = new Set();
      section[listKey] = rawList.slice(0, max)
        .map((item, i) => sanitizeLandingItem(spec.list, item, i, taken));
    }
    out[key] = section;
  }

  return out;
}

function withDefaults(c) {
  const achievements = (c.achievements || [])
    .map(a => (a.rule ? a : { ...a, rule: LEGACY_ACHIEVEMENT_RULES[a.id] || { type: 'lessons_completed', value: 1 } }))
    .map(withoutEmoji);
  // Task 12: shop items are now effect-driven (see addShopItem) rather than
  // hardcoded-by-id — content written before `effect` existed gets it
  // backfilled from the fixed id→effect map the code used to hardcode, so
  // existing purchases/behavior are unaffected by the migration.
  const shop_items = (c.shop_items || [])
    .map(withoutEmoji)
    .map(i => (i.effect ? i : { ...i, effect: LEGACY_SHOP_EFFECTS[i.id] || 'xp_boost' }));
  return {
    modules: c.modules || [],
    leagues: (c.leagues || []).map(withoutEmoji),
    achievements,
    shop_items,
    partners: c.partners || [],
    prizes: c.prizes || [],
    retentionRules: c.retentionRules || [],
    // Absent (a store written before Module Г) → seeded, so the league keeps
    // rendering what the clients used to carry. An admin who deletes every
    // campus gets an empty array back, not the seed again.
    universities: c.universities || SEED_UNIVERSITIES,
    // The public marketing page (landing.seed.js). Merged rather than
    // defaulted so a store written before the landing existed — or one
    // missing a section added in a later release — picks up the new copy
    // instead of rendering a hole on the site's front door.
    landing: sanitizeLanding(c.landing || {}, SEED_LANDING),
    // Task 12 — every previously-hardcoded gameplay/economy constant now
    // lives here, fully admin-editable. Defaults reproduce the exact
    // numbers routes.js/energy.js used to hardcode, so an existing deploy's
    // behavior is byte-identical until an admin actually changes something.
    limits: {
      dailyFreeLessons: 3,
      dailyPrizeCap: 5,
      maxBonusEnergyPerDay: 3,
      xpPerQuestion: 10,
      xpMistakePenalty: 3,
      xpMinFloorPct: 40,      // floor = xpPerQuestion*questions*this%, even with many mistakes
      xpPerfectBonusPct: 20,  // bonus added on a mistake-free lesson
      xpBoostMultiplierPct: 125, // applied on top when the learner owns the xp_boost effect
      coinsPerfectLesson: 10,
      coinsNormalLesson: 5,
      // How often the energy allowance refills, in hours (energy.js#currentPeriod).
      // 24 = the original calendar-day behaviour; set 8 for three refills a day.
      energyRefillHours: 24,
      // University league: how much energy one viewer hands a student per gift
      // (routes.js#/u/university/support). One gift per viewer per period.
      supportEnergyAmount: 5,
      ...(c.limits || {}),
    },
  };
}

function loadFromDisk() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(CONTENT_FILE)) {
    fs.writeFileSync(CONTENT_FILE, JSON.stringify(withDefaults(SEED_CONTENT), null, 2));
  }
  try {
    return withDefaults(JSON.parse(fs.readFileSync(CONTENT_FILE, 'utf8')));
  } catch (err) {
    console.error('[contentStore] content.json is corrupt, falling back to seed:', err.message);
    return withDefaults(SEED_CONTENT);
  }
}

// `access: 'private'` + no catch-and-fall-back-to-seed on a thrown error —
// see db.js's identical loadFromBlobStore for the full reason (a thrown
// error is NOT the same as "nothing written yet", and silently treating
// it that way risks a subsequent persist() overwriting real content with
// the seed). `get()` returning `null` (not throwing) is the genuine
// "not found" signal, which correctly falls back to SEED_CONTENT.
async function loadFromBlobStore() {
  const result = await get(CONTENT_BLOB_PATHNAME, { access: 'private', useCache: false, token: BLOB_TOKEN });
  if (!result) return withDefaults(SEED_CONTENT); // nothing written yet — first boot of a fresh store
  const text = await new Response(result.stream).text();
  return withDefaults(JSON.parse(text));
}

const state = BLOB_TOKEN ? await loadFromBlobStore() : loadFromDisk();

function persistToDisk() {
  return new Promise((resolve, reject) => {
    const tmp = `${CONTENT_FILE}.tmp`;
    fs.writeFile(tmp, JSON.stringify(state, null, 2), err => {
      if (err) return reject(err);
      fs.rename(tmp, CONTENT_FILE, err2 => (err2 ? reject(err2) : resolve()));
    });
  });
}

function persistToBlob() {
  return put(CONTENT_BLOB_PATHNAME, JSON.stringify(state, null, 2), {
    access: 'private',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
    token: BLOB_TOKEN,
  });
}

let writeChain = Promise.resolve();

// See db.js's identical persist() for the full reasoning — writeChain
// (used only to serialize writes) always swallows its own rejection so
// one failure can't permanently break every persist() call after it, but
// the promise returned to the CALLER preserves the real rejection.
function persist() {
  const task = writeChain.then(() => (BLOB_TOKEN ? persistToBlob() : persistToDisk()));
  writeChain = task.catch(err => console.error('[contentStore] failed to persist content.json:', err));
  return task;
}

// ── Trilingual text (Task 13) ───────────────────────────────────────────
//
// Every admin-authored name/title/description across the content model —
// module/lesson titles, partner names, prize copy, league names,
// achievement copy, shop item copy, retention push copy — is a trilingual
// `{ky, ru?, en?}` value (ky required, ru/en optional), the same shape
// lesson-card text already used for ky/ru. `en` is simply one more optional
// key in that same shape. A plain string is legacy content written before
// this existed and is passed through unchanged — src/i18n.jsx#localizedText
// and mobile's localizedContent() already read both shapes, falling back
// ky → ru → en → any non-empty value, so nothing needs a data migration.
function trimStr(v) {
  return typeof v === 'string' ? v.trim() : '';
}

// The one required language, whichever shape `value` arrives in — used both
// to validate ("is this field non-empty?") and, before this change existed,
// as the sole read path for a plain-string field.
export function kyOf(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  return trimStr(value.ky);
}

// Normalizes a raw admin-submitted value into storage shape: always an
// object once any translation is provided, with blank ru/en OMITTED rather
// than stored as empty strings (keeps content.json readable and matches the
// `explanation` convention from Task 2). Returns null if `ky` ends up empty
// after trimming — callers that require the field treat null as invalid.
export function normalizeTrilingual(value) {
  const ky = kyOf(value);
  if (!ky) return null;
  const ru = typeof value === 'object' ? trimStr(value?.ru) : '';
  const en = typeof value === 'object' ? trimStr(value?.en) : '';
  const out = { ky };
  if (ru) out.ru = ru;
  if (en) out.en = en;
  return out;
}

// Same as normalizeTrilingual but for an OPTIONAL field (descriptions,
// captions) — empty input is valid and stored as '', matching the previous
// plain-string default rather than being rejected.
export function normalizeTrilingualOptional(value) {
  return normalizeTrilingual(value) ?? '';
}

function slugify(s) {
  const base = String(s || '').toLowerCase().trim()
    .replace(/[^a-z0-9а-яёіңөүһ]+/gi, '-')
    .replace(/^-+|-+$/g, '');
  return (base || 'item').slice(0, 40);
}

// ── Reads ────────────────────────────────────────────────────────────────

export function getContent() {
  return state;
}

export function findLesson(lessonId) {
  for (const mod of state.modules) {
    const lesson = mod.lessons.find(l => l.id === lessonId);
    if (lesson) return { lesson, module: mod };
  }
  return null;
}

export function findShopItem(itemId) {
  return state.shop_items.find(i => i.id === itemId) || null;
}

export function findPartner(partnerId) {
  return state.partners.find(p => p.id === partnerId) || null;
}

export function findPrize(prizeId) {
  return state.prizes.find(p => p.id === prizeId) || null;
}

export function getLimits() {
  return state.limits;
}

export function totalLessons() {
  return state.modules.reduce((sum, m) => sum + m.lessons.length, 0);
}

// The achievement rule engine — this (plus a title/emoji/xp) is ALL an
// achievement is. Admin can create as many as they want from these five
// rule types without touching code. Mirrored exactly in
// src/utils.js#evaluateAchievementRule — keep both in lockstep.
export function evaluateAchievementRule(rule, ctx) {
  switch (rule?.type) {
    case 'lessons_completed':     return ctx.completedCount >= (rule.value || 0);
    case 'streak_days':           return ctx.streak >= (rule.value || 0);
    case 'xp_total':              return ctx.xp >= (rule.value || 0);
    case 'perfect_lesson':        return ctx.reward?.perfect === true && !ctx.reward?.isReview;
    case 'all_lessons_completed': return ctx.totalLessons > 0 && ctx.completedCount >= ctx.totalLessons;
    default: return false;
  }
}

// Runs server-side against persisted state — the client's own copy (same
// rule engine, see src/utils.js) is only used to render the "new
// achievement" screen immediately; the server re-derives independently and
// is the only side that actually grants the XP bonus.
export function checkNewAchievements(userState, reward, totalLessonsCount = totalLessons()) {
  const earned = new Set(userState?.achievements || []);
  const ctx = {
    // The lifetime total, not the general league's counter: an
    // achievement already earned must never become unearnable because the
    // learner joined a campus board (routes.js#awardXp).
    xp: userState?.lifetimeXp || 0,
    streak: userState?.streak || 0,
    completedCount: (userState?.completedLessons || []).length,
    totalLessons: totalLessonsCount,
    reward,
  };

  const newlyEarned = [];
  for (const ach of state.achievements) {
    if (earned.has(ach.id)) continue;
    if (evaluateAchievementRule(ach.rule, ctx)) newlyEarned.push(ach.id);
  }
  return newlyEarned;
}

// ── Module A: modules/lessons ───────────────────────────────────────────

export async function addModule({ title, color, iconUrl, icon }) {
  const name = normalizeTrilingual(title);
  if (!name) throw new Error('Модулдун аталышы керек');
  const mod = { id: `${slugify(kyOf(title))}-${randomUUID().slice(0, 4)}`, title: name, color: color || '#1CB0F6', partnerId: null, iconUrl: iconUrl || null, icon: sanitizeIconSlug(icon), lessons: [] };
  state.modules.push(mod);
  await persist();
  return mod;
}

export async function updateModule(id, patch) {
  const mod = state.modules.find(m => m.id === id);
  if (!mod) throw new Error('Модуль табылган жок');
  const { id: _drop, lessons: _drop2, ...safe } = patch || {};
  if ('title' in safe) {
    const name = normalizeTrilingual(safe.title);
    if (!name) throw new Error('Модулдун аталышы керек');
    safe.title = name;
  }
  if ('icon' in safe) safe.icon = sanitizeIconSlug(safe.icon);
  Object.assign(mod, safe);
  await persist();
  return mod;
}

export async function deleteModule(id) {
  state.modules = state.modules.filter(m => m.id !== id);
  await persist();
}

// A lesson's authoritative content is `cards` (theory/media/quiz, in
// order) — `questions` is derived from the quiz-type cards so the existing
// scoring code (LessonPage, routes.js#/u/me/lesson) never has to know
// cards exist at all.
//
// `explanation` (bilingual {ky, ru}) is the optional "why this answer is
// right / why yours was wrong" note the app reveals after the learner
// commits to an answer. It's carried through here so legacy lessons that
// only ship a flat `questions` array (see utils.js#cardsOf / the mobile
// Lesson.fromJson fallback) still surface it — but only when actually
// filled in, so content.json isn't littered with empty `{ky:'',ru:''}`.
function hasBilingualText(v) {
  if (v == null) return false;
  if (typeof v === 'string') return v.trim() !== '';
  return String(v.ky || '').trim() !== '' || String(v.ru || '').trim() !== '';
}

function questionsFromCards(cards) {
  return (cards || [])
    .filter(c => c.type === 'quiz')
    .map(c => ({
      q: c.q,
      opts: c.opts,
      a: c.a,
      ...(hasBilingualText(c.explanation) ? { explanation: c.explanation } : {}),
    }));
}

export async function addLesson(moduleId, { title, cards, iconUrl, icon }) {
  const mod = state.modules.find(m => m.id === moduleId);
  if (!mod) throw new Error('Модуль табылган жок');
  const name = normalizeTrilingual(title);
  if (!name) throw new Error('Сабактын аталышы керек');
  const lesson = {
    id: `${moduleId}-l${mod.lessons.length + 1}-${randomUUID().slice(0, 4)}`,
    title: name,
    // Per-lesson icon, uploaded from the admin panel. null → the app falls
    // back to its own vector icon for the lesson node, same convention as
    // modules/leagues/achievements.
    iconUrl: sanitizeIconUrl(iconUrl),
    // Built-in icon slug — takes precedence over iconUrl on every client, so
    // picking from the set replaces a previously uploaded image without
    // having to clear it first.
    icon: sanitizeIconSlug(icon),
    cards: cards || [],
    questions: questionsFromCards(cards),
  };
  mod.lessons.push(lesson);
  await persist();
  return lesson;
}

export async function updateLesson(lessonId, patch) {
  const found = findLesson(lessonId);
  if (!found) throw new Error('Сабак табылган жок');
  const { id: _drop, ...safe } = patch || {};
  if ('title' in safe) {
    const name = normalizeTrilingual(safe.title);
    if (!name) throw new Error('Сабактын аталышы керек');
    safe.title = name;
  }
  // Same guard as leagues/achievements: never let an arbitrary string through
  // as an image source — only a site-relative path or an http(s) URL.
  if ('iconUrl' in safe) safe.iconUrl = sanitizeIconUrl(safe.iconUrl);
  if ('icon' in safe) safe.icon = sanitizeIconSlug(safe.icon);
  Object.assign(found.lesson, safe);
  if (safe.cards) found.lesson.questions = questionsFromCards(safe.cards);
  await persist();
  return found.lesson;
}

export async function deleteLesson(lessonId) {
  for (const mod of state.modules) {
    const idx = mod.lessons.findIndex(l => l.id === lessonId);
    if (idx >= 0) { mod.lessons.splice(idx, 1); break; }
  }
  await persist();
}

// ── Module Б: B2B partners + their prize catalog ───────────────────────

export async function addPartner({ name, logoUrl }) {
  const label = normalizeTrilingual(name);
  if (!label) throw new Error('Партнёрдун аты керек');
  const partner = { id: randomUUID(), name: label, logoUrl: logoUrl || null };
  state.partners.push(partner);
  await persist();
  return partner;
}

export async function updatePartner(id, patch) {
  const partner = findPartner(id);
  if (!partner) throw new Error('Партнёр табылган жок');
  const { id: _drop, ...safe } = patch || {};
  if ('name' in safe) {
    const label = normalizeTrilingual(safe.name);
    if (!label) throw new Error('Партнёрдун аты керек');
    safe.name = label;
  }
  Object.assign(partner, safe);
  await persist();
  return partner;
}

// Deleting a partner deliberately cascades — its prizes vanish from the
// marketplace immediately, and any module branded with it reverts to
// unbranded, exactly as the manifest specifies ("его призы исчезают у
// пользователей").
export async function deletePartner(id) {
  state.partners = state.partners.filter(p => p.id !== id);
  state.prizes = state.prizes.filter(p => p.partnerId !== id);
  for (const mod of state.modules) if (mod.partnerId === id) mod.partnerId = null;
  await persist();
}

// ── Module Г: universities & their contests ─────────────────────────────

export function getUniversities() {
  return state.universities;
}

export function findUniversity(id) {
  return state.universities.find(u => u.id === id) || null;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function sanitizeMoney(value) {
  return Math.max(0, parseInt(value, 10) || 0);
}

function sanitizeDate(value, field) {
  const s = String(value || '').trim();
  if (!DATE_RE.test(s)) throw new Error(`${field}: датаны ЖЖЖЖ-АА-КК түрүндө жазыңыз`);
  return s;
}

// A campus without a running contest is the normal state — only KSTU had one
// when this moved out of the clients. `null` is therefore a first-class
// value here, not a missing field, and the card renders its "no contest yet"
// panel for it.
function sanitizeContest(contest) {
  if (contest == null) return null;
  if (typeof contest !== 'object') throw new Error('Конкурс туура эмес');

  const rules = normalizeTrilingual(contest.rules);
  if (!rules) throw new Error('Конкурстун эрежелери керек');
  const address = normalizeTrilingual(contest.address);
  if (!address) throw new Error('Дареги керек');

  const phone = String(contest.organizerPhone || '').trim().slice(0, 32);
  if (!phone) throw new Error('Уюштуруучунун телефону керек');

  return {
    organizerPhone: phone,
    address,
    sponsorName: String(contest.sponsorName || '').trim().slice(0, 40) || null,
    sponsorLogoUrl: sanitizeIconUrl(contest.sponsorLogoUrl),
    prizePool: sanitizeMoney(contest.prizePool),
    firstPrize: sanitizeMoney(contest.firstPrize),
    secondPrize: sanitizeMoney(contest.secondPrize),
    thirdPrize: sanitizeMoney(contest.thirdPrize),
    // Everyone up to this rank gets a gift — the card's 4th prize column.
    giftsTopN: Math.max(1, parseInt(contest.giftsTopN, 10) || 10),
    startsAt: sanitizeDate(contest.startsAt, 'Башталышы'),
    endsAt: sanitizeDate(contest.endsAt, 'Бүтүшү'),
    rules,
  };
}

function sanitizeUniversityCore({ listName, name, shortName, color, logoUrl }) {
  const label = String(listName || '').trim().slice(0, 60);
  if (!label) throw new Error('Тизмедеги аты керек');
  const full = normalizeTrilingual(name);
  if (!full) throw new Error('Университеттин толук аты керек');
  const short = normalizeTrilingual(shortName);
  if (!short) throw new Error('Кыска аты керек');
  const tint = String(color || '').trim();
  return {
    listName: label,
    name: full,
    shortName: short,
    color: HEX_RE.test(tint) ? tint : '#1D4ED8',
    logoUrl: sanitizeIconUrl(logoUrl),
  };
}

export async function addUniversity(body) {
  const core = sanitizeUniversityCore(body || {});
  // A slug rather than a UUID: every enrolled learner stores this id on
  // their own record (state.uniId), so it wants to stay readable in the
  // database and in a support conversation.
  const base = slugify(core.listName) || 'uni';
  let id = base;
  for (let n = 2; findUniversity(id); n += 1) id = `${base}-${n}`;

  const university = { id, ...core, contest: sanitizeContest((body || {}).contest ?? null) };
  state.universities.push(university);
  await persist();
  return university;
}

export async function updateUniversity(id, patch) {
  const university = findUniversity(id);
  if (!university) throw new Error('Университет табылган жок');
  const { id: _drop, ...safe } = patch || {};

  if ('listName' in safe || 'name' in safe || 'shortName' in safe || 'color' in safe || 'logoUrl' in safe) {
    Object.assign(university, sanitizeUniversityCore({ ...university, ...safe }));
  }
  // `contest: null` is a real instruction ("this contest is over"), so it is
  // only touched when the key is actually present.
  if ('contest' in safe) university.contest = sanitizeContest(safe.contest);

  await persist();
  return university;
}

// Learners keep `state.uniId` pointing at a deleted campus; both clients
// resolve the id through the list and re-ask the enrolment questions when it
// no longer matches, so nothing has to be cleaned up here.
export async function deleteUniversity(id) {
  state.universities = state.universities.filter(u => u.id !== id);
  await persist();
}

export async function addPrize({ partnerId, title, description, photoUrl, priceCoins }) {
  const label = normalizeTrilingual(title);
  if (!label) throw new Error('Сыйлыктын аталышы керек');
  const prize = {
    id: randomUUID(),
    partnerId,
    title: label,
    description: normalizeTrilingualOptional(description),
    photoUrl: photoUrl || null,
    priceCoins: Math.max(0, parseInt(priceCoins, 10) || 0),
  };
  state.prizes.push(prize);
  await persist();
  return prize;
}

export async function updatePrize(id, patch) {
  const prize = findPrize(id);
  if (!prize) throw new Error('Сыйлык табылган жок');
  const { id: _drop, partnerId: _drop2, ...safe } = patch || {};
  if ('title' in safe) {
    const label = normalizeTrilingual(safe.title);
    if (!label) throw new Error('Сыйлыктын аталышы керек');
    safe.title = label;
  }
  if ('description' in safe) safe.description = normalizeTrilingualOptional(safe.description);
  if (safe.priceCoins != null) safe.priceCoins = Math.max(0, parseInt(safe.priceCoins, 10) || 0);
  Object.assign(prize, safe);
  await persist();
  return prize;
}

export async function deletePrize(id) {
  state.prizes = state.prizes.filter(p => p.id !== id);
  await persist();
}

// ── Shop items — unlimited, effect-driven ───────────────────────────────
//
// Same pattern as the achievement rule engine: an admin-created item isn't
// hardcoded by id, it declares one of a fixed set of `effect`s and
// routes.js#/u/me/buy dispatches on THAT, not on which specific item was
// bought. `energy_refill` is the one repeatable effect (consumable, not a
// permanent unlock) — see routes.js for the ownership-check exception.
// (SHOP_EFFECTS / LEGACY_SHOP_EFFECTS live near the top of the file,
// alongside LEGACY_ACHIEVEMENT_RULES — withDefaults() needs the legacy map
// at module-load time, before this section of the file is reached.)

export async function addShopItem({ title, desc, price, effect, iconUrl, icon }) {
  const label = normalizeTrilingual(title);
  if (!label) throw new Error('Товардын аталышы керек');
  if (!SHOP_EFFECTS.has(effect)) throw new Error('Эффекттин түрү туура эмес');
  const item = {
    id: `${slugify(kyOf(title))}-${randomUUID().slice(0, 4)}`,
    title: label,
    desc: normalizeTrilingualOptional(desc),
    price: Math.max(0, parseInt(price, 10) || 0),
    effect,
    iconUrl: sanitizeIconUrl(iconUrl),
    icon: sanitizeIconSlug(icon),
  };
  state.shop_items.push(item);
  await persist();
  return item;
}

export async function updateShopItem(id, patch) {
  const item = state.shop_items.find(i => i.id === id);
  if (!item) throw new Error('Товар табылган жок');
  const { id: _drop, ...safe } = patch || {};
  if ('title' in safe) {
    const label = normalizeTrilingual(safe.title);
    if (!label) throw new Error('Товардын аталышы керек');
    safe.title = label;
  }
  if ('desc' in safe) safe.desc = normalizeTrilingualOptional(safe.desc);
  if (safe.price != null) safe.price = Math.max(0, parseInt(safe.price, 10) || 0);
  if ('effect' in safe && !SHOP_EFFECTS.has(safe.effect)) throw new Error('Эффекттин түрү туура эмес');
  if ('iconUrl' in safe) safe.iconUrl = sanitizeIconUrl(safe.iconUrl);
  if ('icon' in safe) safe.icon = sanitizeIconSlug(safe.icon);
  Object.assign(item, safe);
  await persist();
  return item;
}

export async function deleteShopItem(id) {
  state.shop_items = state.shop_items.filter(i => i.id !== id);
  await persist();
}

// ── Module В: daily limits ──────────────────────────────────────────────

export async function setLimits(patch) {
  state.limits = { ...state.limits, ...patch };
  await persist();
  return state.limits;
}

// Badge art ends up in an <img src> (and an SVG <image href>) in the app,
// so only the two shapes saveUploadedFile actually produces are accepted:
// a site-relative /admin/api/uploads/… path, or an absolute http(s) Blob
// CDN URL. Everything else — javascript:, data:, protocol-relative — is
// dropped to null rather than rejected, so a bad paste costs the admin a
// missing image, not a failed save.
function sanitizeIconUrl(url) {
  if (url == null || url === '') return null;
  const s = String(url).trim();
  if (s.startsWith('/') && !s.startsWith('//')) return s.slice(0, 2048);
  if (/^https?:\/\//i.test(s)) return s.slice(0, 2048);
  return null;
}

// A glyph picked from the built-in set in shared/lessonIcons.js rather than
// uploaded — used by lessons, modules, leagues, achievements and shop
// items alike. Storing the slug (not an image URL) is what lets each client
// draw it as a real vector icon that follows the theme, and what makes an
// unknown slug harmless: it becomes null here, so the entity simply keeps
// the client's default glyph instead of persisting a value nothing can
// render.
//
// Every caller pairs this with sanitizeIconUrl and treats the two as
// mutually exclusive (`icon` wins) — see the admin panel's IconPicker.
function sanitizeIconSlug(slug) {
  if (slug == null || slug === '') return null;
  const s = String(slug).trim();
  return LESSON_ICON_SLUGS.has(s) ? s : null;
}

// ── Leagues — unlimited, admin-defined ──────────────────────────────────

export async function addLeague({ name, iconUrl, icon, color, minXp }) {
  const label = normalizeTrilingual(name);
  if (!label) throw new Error('Лиганын аты керек');
  const league = {
    id: randomUUID(),
    name: label,
    iconUrl: sanitizeIconUrl(iconUrl),
    icon: sanitizeIconSlug(icon),
    color: color || '#1CB0F6',
    minXp: Math.max(0, parseInt(minXp, 10) || 0),
  };
  state.leagues.push(league);
  state.leagues.sort((a, b) => a.minXp - b.minXp);
  await persist();
  return league;
}

export async function updateLeague(id, patch) {
  const league = state.leagues.find(l => l.id === id);
  if (!league) throw new Error('Лига табылган жок');
  const { id: _drop, emoji: _legacy, ...safe } = patch || {};
  if ('name' in safe) {
    const label = normalizeTrilingual(safe.name);
    if (!label) throw new Error('Лиганын аты керек');
    safe.name = label;
  }
  if (safe.minXp != null) safe.minXp = Math.max(0, parseInt(safe.minXp, 10) || 0);
  if ('iconUrl' in safe) safe.iconUrl = sanitizeIconUrl(safe.iconUrl);
  if ('icon' in safe) safe.icon = sanitizeIconSlug(safe.icon);
  Object.assign(league, safe);
  state.leagues.sort((a, b) => a.minXp - b.minXp);
  await persist();
  return league;
}

export async function deleteLeague(id) {
  state.leagues = state.leagues.filter(l => l.id !== id);
  await persist();
}

// ── Achievements — unlimited, rule-driven ───────────────────────────────

const ACHIEVEMENT_RULE_TYPES = new Set([
  'lessons_completed', 'streak_days', 'xp_total', 'perfect_lesson', 'all_lessons_completed',
]);

function sanitizeRule(rule) {
  if (!rule || !ACHIEVEMENT_RULE_TYPES.has(rule.type)) {
    throw new Error('Эреженин түрү туура эмес');
  }
  const needsValue = rule.type === 'lessons_completed' || rule.type === 'streak_days' || rule.type === 'xp_total';
  return needsValue
    ? { type: rule.type, value: Math.max(1, parseInt(rule.value, 10) || 1) }
    : { type: rule.type };
}

export async function addAchievement({ iconUrl, icon, title, desc, xp, rule }) {
  const label = normalizeTrilingual(title);
  if (!label) throw new Error('Жетишкендиктин аты керек');
  const achievement = {
    id: randomUUID(),
    iconUrl: sanitizeIconUrl(iconUrl),
    icon: sanitizeIconSlug(icon),
    title: label,
    desc: normalizeTrilingualOptional(desc),
    xp: Math.max(0, parseInt(xp, 10) || 0),
    rule: sanitizeRule(rule),
  };
  state.achievements.push(achievement);
  await persist();
  return achievement;
}

export async function updateAchievement(id, patch) {
  const achievement = state.achievements.find(a => a.id === id);
  if (!achievement) throw new Error('Жетишкендик табылган жок');
  const { id: _drop, emoji: _legacy, ...safe } = patch || {};
  if ('title' in safe) {
    const label = normalizeTrilingual(safe.title);
    if (!label) throw new Error('Жетишкендиктин аты керек');
    safe.title = label;
  }
  if ('desc' in safe) safe.desc = normalizeTrilingualOptional(safe.desc);
  if (safe.xp != null) safe.xp = Math.max(0, parseInt(safe.xp, 10) || 0);
  if (safe.rule) safe.rule = sanitizeRule(safe.rule);
  if ('iconUrl' in safe) safe.iconUrl = sanitizeIconUrl(safe.iconUrl);
  if ('icon' in safe) safe.icon = sanitizeIconSlug(safe.icon);
  Object.assign(achievement, safe);
  await persist();
  return achievement;
}

export async function deleteAchievement(id) {
  state.achievements = state.achievements.filter(a => a.id !== id);
  await persist();
}

// ── Retention — admin-configurable "come back" push campaigns ──────────
//
// A rule is just a day-threshold + message: "N days inactive → send this
// push". admin-api/push.js#sendRetentionReminders matches each user's
// *exact* current inactive-day count against these — a user re-opening
// the app resets lastActiveDate (and so their inactive-day count) back to
// 0, so a rule naturally fires at most once per inactive stretch with no
// separate "already sent" bookkeeping needed. Same shape as the
// achievement rule pattern above, deliberately simpler (one condition,
// not five) since "how many days since they left" is the only lever a
// re-engagement campaign needs.

function sanitizeRetentionRule({ daysInactive, title, body, enabled }) {
  return {
    daysInactive: Math.max(1, parseInt(daysInactive, 10) || 1),
    title: normalizeTrilingual(title) || { ky: 'JashMen' },
    body: normalizeTrilingualOptional(body),
    enabled: enabled !== false,
  };
}

export async function addRetentionRule(fields) {
  const rule = { id: randomUUID(), ...sanitizeRetentionRule(fields) };
  state.retentionRules.push(rule);
  await persist();
  return rule;
}

export async function updateRetentionRule(id, patch) {
  const rule = state.retentionRules.find(r => r.id === id);
  if (!rule) throw new Error('Эреже табылган жок');
  Object.assign(rule, sanitizeRetentionRule({ ...rule, ...patch }));
  await persist();
  return rule;
}

export async function deleteRetentionRule(id) {
  state.retentionRules = state.retentionRules.filter(r => r.id !== id);
  await persist();
}

export function listRetentionRules() {
  return state.retentionRules;
}

// ── Landing reads/writes ─────────────────────────────────────────────────

export function getLanding() {
  return state.landing;
}

export async function setLanding(patch) {
  state.landing = sanitizeLanding(patch, state.landing);
  await persist();
  return state.landing;
}
