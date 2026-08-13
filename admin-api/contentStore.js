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
    xp: userState?.xp || 0,
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

export async function addModule({ title, color, iconUrl }) {
  const name = normalizeTrilingual(title);
  if (!name) throw new Error('Модулдун аталышы керек');
  const mod = { id: `${slugify(kyOf(title))}-${randomUUID().slice(0, 4)}`, title: name, color: color || '#1CB0F6', partnerId: null, iconUrl: iconUrl || null, lessons: [] };
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

export async function addLesson(moduleId, { title, cards, iconUrl }) {
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

export async function addShopItem({ title, desc, price, effect, iconUrl }) {
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

// ── Leagues — unlimited, admin-defined ──────────────────────────────────

export async function addLeague({ name, iconUrl, color, minXp }) {
  const label = normalizeTrilingual(name);
  if (!label) throw new Error('Лиганын аты керек');
  const league = {
    id: randomUUID(),
    name: label,
    iconUrl: sanitizeIconUrl(iconUrl),
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

export async function addAchievement({ iconUrl, title, desc, xp, rule }) {
  const label = normalizeTrilingual(title);
  if (!label) throw new Error('Жетишкендиктин аты керек');
  const achievement = {
    id: randomUUID(),
    iconUrl: sanitizeIconUrl(iconUrl),
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
