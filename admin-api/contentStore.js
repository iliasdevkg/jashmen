// admin-api/contentStore.js
//
// Content is no longer hardcoded — this is the database. Same JSON-file
// pattern as db.js (tmp-file + rename writes, seeded once), but for
// modules/lessons/leagues/achievements/shop/partners/prizes/limits instead
// of users. The admin panel mutates this through the functions below;
// GET /admin/api/public/content just serves whatever's currently here.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { SEED_CONTENT } from './content.seed.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
const CONTENT_FILE = path.join(DATA_DIR, 'content.json');

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

function withDefaults(c) {
  const achievements = (c.achievements || []).map(a =>
    a.rule ? a : { ...a, rule: LEGACY_ACHIEVEMENT_RULES[a.id] || { type: 'lessons_completed', value: 1 } }
  );
  return {
    modules: c.modules || [],
    leagues: c.leagues || [],
    achievements,
    shop_items: c.shop_items || [],
    partners: c.partners || [],
    prizes: c.prizes || [],
    limits: { dailyFreeLessons: 3, dailyPrizeCap: 5, ...(c.limits || {}) },
  };
}

function loadSync() {
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

const state = loadSync();
let writeChain = Promise.resolve();

function persist() {
  writeChain = writeChain.then(() => new Promise((resolve, reject) => {
    const tmp = `${CONTENT_FILE}.tmp`;
    fs.writeFile(tmp, JSON.stringify(state, null, 2), err => {
      if (err) return reject(err);
      fs.rename(tmp, CONTENT_FILE, err2 => (err2 ? reject(err2) : resolve()));
    });
  })).catch(err => console.error('[contentStore] failed to persist content.json:', err));
  return writeChain;
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

export async function addModule({ title, color }) {
  const mod = { id: `${slugify(title)}-${randomUUID().slice(0, 4)}`, title, color: color || '#1CB0F6', partnerId: null, lessons: [] };
  state.modules.push(mod);
  await persist();
  return mod;
}

export async function updateModule(id, patch) {
  const mod = state.modules.find(m => m.id === id);
  if (!mod) throw new Error('Модуль табылган жок');
  const { id: _drop, lessons: _drop2, ...safe } = patch || {};
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
function questionsFromCards(cards) {
  return (cards || [])
    .filter(c => c.type === 'quiz')
    .map(c => ({ q: c.q, opts: c.opts, a: c.a }));
}

export async function addLesson(moduleId, { title, cards }) {
  const mod = state.modules.find(m => m.id === moduleId);
  if (!mod) throw new Error('Модуль табылган жок');
  const lesson = {
    id: `${moduleId}-l${mod.lessons.length + 1}-${randomUUID().slice(0, 4)}`,
    title,
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
  const partner = { id: randomUUID(), name, logoUrl: logoUrl || null };
  state.partners.push(partner);
  await persist();
  return partner;
}

export async function updatePartner(id, patch) {
  const partner = findPartner(id);
  if (!partner) throw new Error('Партнёр табылган жок');
  const { id: _drop, ...safe } = patch || {};
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
  const prize = {
    id: randomUUID(),
    partnerId,
    title,
    description: description || '',
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
  if (safe.priceCoins != null) safe.priceCoins = Math.max(0, parseInt(safe.priceCoins, 10) || 0);
  Object.assign(prize, safe);
  await persist();
  return prize;
}

export async function deletePrize(id) {
  state.prizes = state.prizes.filter(p => p.id !== id);
  await persist();
}

// ── Module В: daily limits ──────────────────────────────────────────────

export async function setLimits(patch) {
  state.limits = { ...state.limits, ...patch };
  await persist();
  return state.limits;
}

// ── Leagues — unlimited, admin-defined ──────────────────────────────────

export async function addLeague({ name, emoji, color, minXp }) {
  const league = {
    id: randomUUID(),
    name,
    emoji: emoji || '🏅',
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
  const { id: _drop, ...safe } = patch || {};
  if (safe.minXp != null) safe.minXp = Math.max(0, parseInt(safe.minXp, 10) || 0);
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

export async function addAchievement({ emoji, title, desc, xp, rule }) {
  const achievement = {
    id: randomUUID(),
    emoji: emoji || '🏅',
    title,
    desc: desc || '',
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
  const { id: _drop, ...safe } = patch || {};
  if (safe.xp != null) safe.xp = Math.max(0, parseInt(safe.xp, 10) || 0);
  if (safe.rule) safe.rule = sanitizeRule(safe.rule);
  Object.assign(achievement, safe);
  await persist();
  return achievement;
}

export async function deleteAchievement(id) {
  state.achievements = state.achievements.filter(a => a.id !== id);
  await persist();
}
