// admin-api/routes.js — the actual /admin/api/* endpoint handlers.
//
// Contract is dictated by src/api.js — every response shape here (plain
// user vs. {user}, {user, reward}, etc.) matches what src/store.jsx and the
// pages expect back, verbatim.

import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import {
  hashPassword, verifyPassword, signAccessToken, requireAuth,
  issueRefreshToken, refreshAccessToken, revokeRefreshToken,
  REFRESH_TOKEN_TTL_MS, REFRESH_COOKIE_NAME,
} from './auth.js';
import { setRefreshCookie, clearRefreshCookie } from './cookies.js';
import { verifyGoogleIdToken, resolveGoogleUser, GoogleAuthError } from './googleAuth.js';
import { authLimiter, signupLimiter, uploadLimiter } from './rateLimit.js';
import * as db from './db.js';
import {
  getContent, findLesson, findShopItem, findPrize, findPartner,
  checkNewAchievements, totalLessons, getLimits,
} from './contentStore.js';
import { computeLiveEnergy, spendEnergy, grantBonusEnergy } from './energy.js';
import { logEvent } from './events.js';
import { getPublicKey } from './push.js';
import { upload, saveUploadedFile } from './uploads.js';

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
    coins: 50, // starter balance — "Jashmen Coins"
    streak: 0,
    lessonsToday: 0,
    energyDate: null,
    bonusEnergyToday: 0,
    completedLessons: [],
    achievements: [],
    ownedShop: [],
    settings: { sound: true, animations: true },
    lastActiveDate: null,
    hasStreakShield: false,
    hasXpBoost: false,
    vipBadge: false,
    pushSubscriptions: [],
  };
}

// Never leak the password hash or internal bookkeeping fields to the client.
function toPublicUser(user) {
  const { passwordHash, _lastReward, ...rest } = user;
  return rest;
}

// ── Public content & leaderboard ────────────────────────────────────────────

router.get('/public/content', (req, res) => {
  res.json(getContent());
});

// Public client config. The Google client ID is deliberately served at
// runtime rather than baked in as a VITE_* env var: the frontend is built
// inside the Docker image, where no production env exists, so a build-time
// variable would have to be a build arg baked into the image — meaning a new
// image for every config change. A client ID is public by design (it ships
// in the page anyway), so there is nothing to protect by hiding it.
//
// Empty googleClientId → the client hides the Google button entirely, and
// email/password sign-in carries on.
router.get('/public/config', (req, res) => {
  res.json({ googleClientId: process.env.GOOGLE_CLIENT_ID || null });
});

router.get('/public/push-key', (req, res) => {
  res.json({ publicKey: getPublicKey() });
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

router.post('/u/signup', signupLimiter, async (req, res, next) => {
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
    const refreshToken = await issueRefreshToken(user.id);
    setRefreshCookie(res, REFRESH_COOKIE_NAME, refreshToken, REFRESH_TOKEN_TTL_MS);
    res.status(201).json({ token: signAccessToken(user.id), user: toPublicUser(user) });
  } catch (err) { next(err); }
});

router.post('/u/login', authLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email?.trim() || !password) {
      return res.status(400).json({ error: 'Бардык талааларды толтуруңуз' });
    }
    const user = db.findUserByEmail(email);

    // Google-only accounts carry passwordHash: null (googleAuth.js). Guard
    // before verifyPassword — bcrypt.compare against a null hash is not a
    // meaningful "wrong password" check, and the message below is the one
    // that actually helps: the account exists, just not with a password.
    if (user && !user.passwordHash) {
      return res.status(401).json({
        error: 'Бул аккаунт Google аркылуу түзүлгөн — «Google менен кирүү» баскычын колдонуңуз',
      });
    }

    const ok = user && await verifyPassword(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: 'Email же сырсөз туура эмес' });
    }
    const refreshToken = await issueRefreshToken(user.id);
    setRefreshCookie(res, REFRESH_COOKIE_NAME, refreshToken, REFRESH_TOKEN_TTL_MS);
    res.json({ token: signAccessToken(user.id), user: toPublicUser(user) });
  } catch (err) { next(err); }
});

// "Sign in with Google". Google proves the email; from there this issues the
// *same* session as /u/login — same access JWT, same rotating refresh cookie
// — so nothing downstream has a second code path to reason about.
//
// Sits under /u/ rather than a top-level /auth/ so it shares the user
// namespace (and therefore the same cookie path) with login/signup/refresh.
// The id_token is verified and dropped; it is never persisted or logged.
router.post('/u/auth/google', authLimiter, async (req, res, next) => {
  try {
    const idToken = req.body?.idToken ?? req.body?.id_token;

    const claims = await verifyGoogleIdToken(idToken);
    const { user, created } = await resolveGoogleUser(claims, { defaultState });

    const refreshToken = await issueRefreshToken(user.id);
    setRefreshCookie(res, REFRESH_COOKIE_NAME, refreshToken, REFRESH_TOKEN_TTL_MS);
    res.status(created ? 201 : 200).json({
      token: signAccessToken(user.id),
      user: toPublicUser(user),
    });
  } catch (err) {
    if (err instanceof GoogleAuthError) {
      return res.status(err.status).json({ error: err.message });
    }
    next(err);
  }
});

// Silently exchanges the httpOnly refresh cookie for a fresh access token
// — called once on app load (so a page reload doesn't force a re-login)
// and periodically thereafter, well before the 15-minute access token
// expires. Rotates the refresh token on every call (see
// db.js#rotateSession); the response carries the current user so the
// client can restore its session without a separate /u/me round trip.
router.post('/u/refresh', async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
    if (!refreshToken) return res.status(401).json({ error: 'Сессия табылган жок' });

    const result = await refreshAccessToken(refreshToken);
    if (!result) {
      clearRefreshCookie(res, REFRESH_COOKIE_NAME);
      return res.status(401).json({ error: 'Сессиянын мөөнөтү бүттү, кайра кириңиз' });
    }

    const user = db.findUserById(result.userId);
    if (!user) {
      clearRefreshCookie(res, REFRESH_COOKIE_NAME);
      return res.status(401).json({ error: 'Колдонуучу табылган жок' });
    }

    setRefreshCookie(res, REFRESH_COOKIE_NAME, result.refreshToken, REFRESH_TOKEN_TTL_MS);
    res.json({ token: result.accessToken, user: toPublicUser(user) });
  } catch (err) { next(err); }
});

// Real, server-side logout — revokes the session backing the refresh
// cookie (so it can't be used again even if it leaked) and clears the
// cookie itself. Idempotent: no cookie / already-revoked session still
// returns 204, since the end state (logged out) is the same either way.
router.post('/u/logout', async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
    if (refreshToken) await revokeRefreshToken(refreshToken);
    clearRefreshCookie(res, REFRESH_COOKIE_NAME);
    res.status(204).end();
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
      state.coins = (state.coins || 0) + 5; // small daily login bonus
      if (state.streak > 0 && state.streak % 7 === 0) state.coins += 10; // weekly milestone bonus
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
      reward = { xp: 0, coins: 0, perfect: false, isReview: true };
    } else {
      // Daily energy gate — checked once per genuine attempt, not per
      // mistake. Re-verified server-side; the client only uses this to
      // decide whether to show the lesson's start button at all.
      const { dailyFreeLessons } = getLimits();
      const { remaining } = computeLiveEnergy(state, dailyFreeLessons);
      if (remaining <= 0) {
        return res.status(403).json({ error: 'Бүгүнкү акысыз сабактарың бүттү. Эртең кайра келиңиз же энергия сатып алыңыз.' });
      }

      // Task 12 — every constant here is admin-editable (Limits panel),
      // not hardcoded: points per question, the penalty per mistake, the
      // mistake-proof floor, the perfect-lesson bonus, the xp_boost
      // multiplier, and both coin payouts.
      const lim = getLimits();
      const baseXp = questionCount * (lim.xpPerQuestion ?? 10);
      const perfect = mistakes === 0;
      const floorPct = (lim.xpMinFloorPct ?? 40) / 100;
      let xp = Math.max(Math.round(baseXp * floorPct), baseXp - mistakes * (lim.xpMistakePenalty ?? 3));
      if (perfect) xp += Math.round(baseXp * ((lim.xpPerfectBonusPct ?? 20) / 100));
      if (state.hasXpBoost) xp = Math.round(xp * ((lim.xpBoostMultiplierPct ?? 125) / 100));
      const coins = perfect ? (lim.coinsPerfectLesson ?? 10) : (lim.coinsNormalLesson ?? 5);
      reward = { xp, coins, perfect, isReview: false };

      state.completedLessons = [...(state.completedLessons || []), lessonId];
      state.xp = (state.xp || 0) + xp;
      state.coins = (state.coins || 0) + coins;
      spendEnergy(state);
      logEvent('lesson_complete', { lessonId, userId: user.id }).catch(() => {});
    }

    user._lastReward = reward; // consumed by PATCH /u/me/state right after this
    await db.saveUser(user);

    res.json({ user: toPublicUser(user), reward });
  } catch (err) { next(err); }
});

// ── Analytics event logging (fire-and-forget from the client) ──────────────

router.post('/u/log-event', requireAuth, async (req, res) => {
  const { type, lessonId, questionIndex, correct } = req.body || {};
  // Never let telemetry block or fail the UI — best-effort, always 204.
  logEvent(type, { userId: req.userId, lessonId, questionIndex, correct }).catch(() => {});
  res.status(204).end();
});

// ── Shop / Marketplace ───────────────────────────────────────────────────────

router.post('/u/me/buy', requireAuth, async (req, res, next) => {
  try {
    const user = db.findUserById(req.userId);
    if (!user) return res.status(401).json({ error: 'Колдонуучу табылган жок' });

    const { itemId } = req.body || {};
    const item = findShopItem(itemId);
    if (!item) return res.status(404).json({ error: 'Товар табылган жок' });

    const { state } = user;
    // Task 12 — items are no longer recognized by a fixed set of hardcoded
    // ids; any admin-created item dispatches on its `effect`. `energy_refill`
    // is the one repeatable effect (consumable, not a permanent unlock) —
    // everything else is a one-time purchase per item id, same as before.
    const isEnergyRefill = item.effect === 'energy_refill';
    if (!isEnergyRefill && (state.ownedShop || []).includes(item.id)) {
      return res.status(400).json({ error: 'Бул товар мурунтан сатылып алынган' });
    }
    // Price is always looked up server-side — never trust what the client sent.
    if ((state.coins || 0) < item.price) {
      return res.status(400).json({ error: 'Монета жетишсиз' });
    }

    if (isEnergyRefill) {
      if (!grantBonusEnergy(state, getLimits().maxBonusEnergyPerDay)) {
        return res.status(400).json({ error: 'Бүгүн үчүн максимум энергия толтурулду' });
      }
      state.coins -= item.price;
    } else {
      state.coins -= item.price;
      state.ownedShop = [...(state.ownedShop || []), item.id];
      if (item.effect === 'streak_shield') state.hasStreakShield = true;
      if (item.effect === 'xp_boost') state.hasXpBoost = true;
      if (item.effect === 'vip_badge') state.vipBadge = true;
    }

    await db.saveUser(user);
    res.json(toPublicUser(user));
  } catch (err) { next(err); }
});

// Partner-sponsored prize redemption — Module Б's marketplace, gated by
// Module В's daily cap (see contentStore.js#getLimits().dailyPrizeCap).
router.post('/u/me/redeem', requireAuth, async (req, res, next) => {
  try {
    const user = db.findUserById(req.userId);
    if (!user) return res.status(401).json({ error: 'Колдонуучу табылган жок' });

    const { prizeId } = req.body || {};
    const prize = findPrize(prizeId);
    if (!prize) return res.status(404).json({ error: 'Сыйлык табылган жок' });

    const { state } = user;
    if ((state.coins || 0) < prize.priceCoins) {
      return res.status(400).json({ error: 'Монета жетишсиз' });
    }

    const { dailyPrizeCap } = getLimits();
    const today = todayUTC();
    const code = `JASHMEN-${randomUUID().slice(0, 8).toUpperCase()}`;
    // Cap-check + slot-reservation happen synchronously, back to back, with
    // no `await` in between (see db.js#reserveRedemptionSlot) — that's what
    // makes this atomic against concurrent requests.
    const reserved = db.reserveRedemptionSlot(
      { id: randomUUID(), userId: user.id, prizeId: prize.id, code, date: today, ts: Date.now() },
      dailyPrizeCap
    );
    if (!reserved) {
      return res.status(403).json({ error: 'Бардык сыйлыктар бүгүнкүгө бүттү. Эртең кайра келиңиз!' });
    }

    state.coins -= prize.priceCoins;
    await db.saveUser(user); // persists the coin deduction and the reservation above together

    res.status(201).json({ user: toPublicUser(user), code });
  } catch (err) { next(err); }
});

// The learner's own redemption history — proof they claimed a code, kept
// even after they close the dialog. Prize/partner details are joined at
// read time rather than snapshotted, so a prize the admin later deletes
// degrades gracefully to just the code + date instead of breaking the row.
router.get('/u/me/redemptions', requireAuth, (req, res, next) => {
  try {
    const items = db.listRedemptions()
      .filter(r => r.userId === req.userId)
      .sort((a, b) => (b.ts || 0) - (a.ts || 0))
      .map(r => {
        const prize = findPrize(r.prizeId);
        const partner = prize ? findPartner(prize.partnerId) : null;
        return {
          id: r.id,
          code: r.code,
          date: r.date,
          ts: r.ts || null,
          prize: prize
            ? { title: prize.title, photoUrl: prize.photoUrl || null, priceCoins: prize.priceCoins }
            : null,
          partner: partner ? { name: partner.name, logoUrl: partner.logoUrl || null } : null,
        };
      });
    res.json(items);
  } catch (err) { next(err); }
});

// ── Web Push subscriptions ──────────────────────────────────────────────

router.post('/u/me/push/subscribe', requireAuth, async (req, res, next) => {
  try {
    const user = db.findUserById(req.userId);
    if (!user) return res.status(401).json({ error: 'Колдонуучу табылган жок' });

    const { subscription } = req.body || {};
    if (!subscription?.endpoint) return res.status(400).json({ error: 'Жараксыз subscription' });

    // One entry per endpoint (device/browser) — resubscribing the same
    // device replaces its old keys instead of piling up duplicates.
    const list = (user.state.pushSubscriptions || []).filter(s => s.endpoint !== subscription.endpoint);
    list.push(subscription);
    user.state.pushSubscriptions = list;
    await db.saveUser(user);

    res.status(201).json({ ok: true });
  } catch (err) { next(err); }
});

router.post('/u/me/push/unsubscribe', requireAuth, async (req, res, next) => {
  try {
    const user = db.findUserById(req.userId);
    if (!user) return res.status(401).json({ error: 'Колдонуучу табылган жок' });

    const { endpoint } = req.body || {};
    user.state.pushSubscriptions = (user.state.pushSubscriptions || []).filter(s => s.endpoint !== endpoint);
    await db.saveUser(user);

    res.status(204).end();
  } catch (err) { next(err); }
});

// ── Task 6: learner-facing avatar upload ────────────────────────────────
//
// Separate from admin-api/adminRoutes.js's /media/upload — that one is
// admin-token-gated (lesson/module/partner art); this is the one path a
// learner can upload media through, gated by their own auth and reusing
// the exact same storage plumbing (uploads.js — local disk or Vercel Blob,
// whichever this deploy has configured).
router.post('/u/me/avatar', requireAuth, uploadLimiter, upload.single('file'), async (req, res, next) => {
  try {
    const user = db.findUserById(req.userId);
    if (!user) return res.status(401).json({ error: 'Колдонуучу табылган жок' });
    if (!req.file) return res.status(400).json({ error: 'Файл алынган жок (түрү уруксат берилбейт же өтө чоң)' });

    user.avatar = await saveUploadedFile(req.file);
    await db.saveUser(user);
    res.status(201).json(toPublicUser(user));
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
        notifications: typeof body.settings.notifications === 'boolean' ? body.settings.notifications : state.settings.notifications === true,
      };
      changed = true;
    }

    if (typeof body.name === 'string' && body.name.trim() && body.name.trim() !== user.name) {
      user.name = body.name.trim().slice(0, 60);
      changed = true;
    }

    // The client proposes achievement ids (computed from the reward it just
    // received); the server independently re-derives which ones actually
    // qualify and only grants the intersection. The client's `xp` field is
    // never trusted directly — the bonus is always summed from content.
    if (Array.isArray(body.achievements)) {
      const qualifying = checkNewAchievements(state, user._lastReward, totalLessons())
        .filter(id => body.achievements.includes(id));
      if (qualifying.length) {
        state.achievements = [...new Set([...(state.achievements || []), ...qualifying])];
        const bonus = qualifying.reduce((sum, id) => sum + (getContent().achievements.find(a => a.id === id)?.xp || 0), 0);
        state.xp = (state.xp || 0) + bonus;
        changed = true;
      }
    }

    if (changed) await db.saveUser(user);
    res.json(toPublicUser(user));
  } catch (err) { next(err); }
});

export default router;
