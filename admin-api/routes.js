// admin-api/routes.js — the actual /admin/api/* endpoint handlers.
//
// Contract is dictated by src/api.js — every response shape here (plain
// user vs. {user}, {user, reward}, etc.) matches what src/store.jsx and the
// pages expect back, verbatim.

import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { hashPassword, verifyPassword, signToken, requireAuth } from './auth.js';
import * as db from './db.js';
import { CONTENT, findLesson, findShopItem, checkNewAchievements, TOTAL_LESSONS } from './content.js';
import { computeLiveHearts, setHearts, MAX_HEARTS } from './hearts.js';

const router = Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(isoA, isoB) {
  const a = Date.UTC(...isoA.split('-').map(Number));
  const b = Date.UTC(...isoB.split('-').map(Number));
  return Math.round((b - a) / 86_400_000);
}

function defaultState() {
  return {
    xp: 0,
    gems: 50, // starter balance
    streak: 0,
    hearts: MAX_HEARTS,
    heartsRefilledAt: Date.now(),
    completedLessons: [],
    achievements: [],
    ownedShop: [],
    settings: { sound: true, animations: true },
    lastActiveDate: null,
    hasStreakShield: false,
    hasXpBoost: false,
    vipBadge: false,
  };
}

// Never leak the password hash or internal bookkeeping fields to the client.
function toPublicUser(user) {
  const { passwordHash, _lastReward, ...rest } = user;
  return rest;
}

// ── Public content & leaderboard ────────────────────────────────────────────

router.get('/public/content', (req, res) => {
  res.json(CONTENT);
});

router.get('/u/leaderboard', (req, res) => {
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
  const rows = db.listUsers()
    .map(u => ({ id: u.id, name: u.name, avatar: u.avatar, xp: u.state.xp || 0, streak: u.state.streak || 0 }))
    .sort((a, b) => b.xp - a.xp)
    .slice(0, limit);
  res.json(rows);
});

// ── Auth ─────────────────────────────────────────────────────────────────────

router.post('/u/signup', async (req, res, next) => {
  try {
    const { name, email, password, avatar } = req.body || {};
    if (!name?.trim() || !email?.trim() || !password) {
      return res.status(400).json({ error: 'Бардык талааларды толтуруңуз' });
    }
    if (!EMAIL_RE.test(email.trim())) {
      return res.status(400).json({ error: 'Email туура эмес' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Сырсөз жок дегенде 6 белгиден турушу керек' });
    }
    if (db.findUserByEmail(email)) {
      return res.status(409).json({ error: 'Бул email мурунтан катталган' });
    }

    const user = {
      id: randomUUID(),
      name: name.trim().slice(0, 60),
      email: email.trim().toLowerCase(),
      avatar: avatar || '🦅',
      passwordHash: await hashPassword(password),
      state: defaultState(),
    };
    await db.insertUser(user);
    res.status(201).json({ token: signToken(user.id), user: toPublicUser(user) });
  } catch (err) { next(err); }
});

router.post('/u/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email?.trim() || !password) {
      return res.status(400).json({ error: 'Бардык талааларды толтуруңуз' });
    }
    const user = db.findUserByEmail(email);
    const ok = user && await verifyPassword(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: 'Email же сырсөз туура эмес' });
    }
    res.json({ token: signToken(user.id), user: toPublicUser(user) });
  } catch (err) { next(err); }
});

router.get('/u/me', requireAuth, (req, res) => {
  const user = db.findUserById(req.userId);
  if (!user) return res.status(401).json({ error: 'Колдонуучу табылган жок' });
  res.json(toPublicUser(user));
});

// ── Daily streak claim ───────────────────────────────────────────────────────

router.post('/u/me/daily', requireAuth, async (req, res, next) => {
  try {
    const user = db.findUserById(req.userId);
    if (!user) return res.status(401).json({ error: 'Колдонуучу табылган жок' });

    const today = todayUTC();
    const { state } = user;
    if (state.lastActiveDate !== today) {
      if (!state.lastActiveDate) {
        state.streak = 1;
      } else {
        const gap = daysBetween(state.lastActiveDate, today);
        if (gap === 1) {
          state.streak = (state.streak || 0) + 1;
        } else if (gap > 1) {
          // A permanent streak shield (bought in the shop) absorbs missed days.
          state.streak = state.hasStreakShield ? Math.max(1, state.streak || 0) : 1;
        }
      }
      state.gems = (state.gems || 0) + 5; // small daily login bonus
      if (state.streak > 0 && state.streak % 7 === 0) state.gems += 10; // weekly milestone bonus
      state.lastActiveDate = today;
      await db.saveUser(user);
    }

    res.json({ user: toPublicUser(user) });
  } catch (err) { next(err); }
});

// ── Lesson completion ────────────────────────────────────────────────────────

router.post('/u/me/lesson', requireAuth, async (req, res, next) => {
  try {
    const user = db.findUserById(req.userId);
    if (!user) return res.status(401).json({ error: 'Колдонуучу табылган жок' });

    const { lessonId, mistakes: rawMistakes } = req.body || {};
    let isReview = !!req.body?.isReview;
    const found = findLesson(lessonId);
    if (!found) return res.status(404).json({ error: 'Сабак табылган жок' });

    const { state } = user;
    const alreadyDone = (state.completedLessons || []).includes(lessonId);
    // A lesson already marked complete can only ever be replayed as a review —
    // don't let a tampered `isReview:false` farm XP off a finished lesson.
    if (alreadyDone) isReview = true;

    const mistakes = Math.max(0, Math.min(50, parseInt(rawMistakes, 10) || 0));
    const questionCount = found.lesson.questions.length;

    let reward;
    if (isReview) {
      reward = { xp: 0, gems: 0, perfect: false, isReview: true };
    } else {
      const baseXp = questionCount * 10;
      const perfect = mistakes === 0;
      let xp = Math.max(Math.round(baseXp * 0.4), baseXp - mistakes * 3);
      if (perfect) xp += Math.round(baseXp * 0.2);
      if (state.hasXpBoost) xp = Math.round(xp * 1.25);
      const gems = perfect ? 10 : 5;
      reward = { xp, gems, perfect, isReview: false };

      state.completedLessons = [...(state.completedLessons || []), lessonId];
      state.xp = (state.xp || 0) + xp;
      state.gems = (state.gems || 0) + gems;
    }

    // Hearts only take live damage on a genuine (non-review) attempt.
    const live = computeLiveHearts(state);
    setHearts(state, isReview ? live.hearts : live.hearts - mistakes);

    user._lastReward = reward; // consumed by PATCH /u/me/state right after this
    await db.saveUser(user);

    res.json({ user: toPublicUser(user), reward });
  } catch (err) { next(err); }
});

// ── Shop ─────────────────────────────────────────────────────────────────────

router.post('/u/me/buy', requireAuth, async (req, res, next) => {
  try {
    const user = db.findUserById(req.userId);
    if (!user) return res.status(401).json({ error: 'Колдонуучу табылган жок' });

    const { itemId } = req.body || {};
    const item = findShopItem(itemId);
    if (!item) return res.status(404).json({ error: 'Товар табылган жок' });

    const { state } = user;
    const isHeart = item.id === 'hearts';
    if (!isHeart && (state.ownedShop || []).includes(item.id)) {
      return res.status(400).json({ error: 'Бул товар мурунтан сатылып алынган' });
    }
    // Price is always looked up server-side — never trust what the client sent.
    if ((state.gems || 0) < item.price) {
      return res.status(400).json({ error: 'Гем жетишсиз' });
    }

    state.gems -= item.price;
    if (isHeart) {
      setHearts(state, MAX_HEARTS);
    } else {
      state.ownedShop = [...(state.ownedShop || []), item.id];
      if (item.id === 'streak_freeze') state.hasStreakShield = true;
      if (item.id === 'xp_boost') state.hasXpBoost = true;
      if (item.id === 'vip_badge') state.vipBadge = true;
    }

    await db.saveUser(user);
    res.json(toPublicUser(user));
  } catch (err) { next(err); }
});

// ── Settings / achievement-bonus patch ─────────────────────────────────────

router.patch('/u/me/state', requireAuth, async (req, res, next) => {
  try {
    const user = db.findUserById(req.userId);
    if (!user) return res.status(401).json({ error: 'Колдонуучу табылган жок' });

    const body = req.body || {};
    const { state } = user;
    let changed = false;

    if (body.settings && typeof body.settings === 'object') {
      state.settings = {
        sound: typeof body.settings.sound === 'boolean' ? body.settings.sound : state.settings.sound !== false,
        animations: typeof body.settings.animations === 'boolean' ? body.settings.animations : state.settings.animations !== false,
      };
      changed = true;
    }

    // The client proposes achievement ids (computed from the reward it just
    // received); the server independently re-derives which ones actually
    // qualify and only grants the intersection. The client's `xp` field is
    // never trusted directly — the bonus is always summed from CONTENT.
    if (Array.isArray(body.achievements)) {
      const qualifying = checkNewAchievements(state, user._lastReward, TOTAL_LESSONS)
        .filter(id => body.achievements.includes(id));
      if (qualifying.length) {
        state.achievements = [...new Set([...(state.achievements || []), ...qualifying])];
        const bonus = qualifying.reduce((sum, id) => sum + (CONTENT.achievements.find(a => a.id === id)?.xp || 0), 0);
        state.xp = (state.xp || 0) + bonus;
        changed = true;
      }
    }

    if (changed) await db.saveUser(user);
    res.json(toPublicUser(user));
  } catch (err) { next(err); }
});

export default router;
