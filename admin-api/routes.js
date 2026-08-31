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
  checkNewAchievements, totalLessons, getLimits, getUniversities,
} from './contentStore.js';
import {
  computeLiveEnergy, spendEnergy, grantBonusEnergy,
  canGiveSupportEnergy, spendSupportEnergy, receiveSupportEnergy,
  currentPeriod, periodEndsAt, normalizeRefillHours,
} from './energy.js';
import { logEvent } from './events.js';
import { getPublicKey } from './push.js';
import { upload, saveUploadedFile } from './uploads.js';

const router = Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

// Every energy call site reads the admin-editable refill period through
// this one helper so a stale hardcoded 24 can never creep back in.
function refillHours() {
  return normalizeRefillHours(getLimits().energyRefillHours);
}

const UNI_ID_RE = /^[a-z0-9][a-z0-9_-]{0,39}$/;
const UNI_ROLES = ['student', 'viewer'];

function daysBetween(isoA, isoB) {
  const a = Date.UTC(...isoA.split('-').map(Number));
  const b = Date.UTC(...isoB.split('-').map(Number));
  return Math.round((b - a) / 86_400_000);
}

// The two leagues are two separate scoreboards, and XP never crosses
// between them: whichever league you are competing in right now is the one
// that grows. Enrolled students compete on their campus board, so their XP
// goes to `uniXp`; everybody else — unenrolled learners and viewers, who
// are counted but never ranked on a campus board — earns into the general
// league's `xp`. `lifetimeXp` is the untouchable running total behind both.
//
// Every place that hands out XP goes through here. Adding a new reward and
// writing `state.xp += n` by hand is the one way this invariant breaks.
function isUniCompetitor(state) {
  return !!state?.uniId && state.uniRole === 'student';
}

function awardXp(state, amount) {
  const gained = Math.max(0, Math.round(amount || 0));
  if (!gained) return 0;
  if (isUniCompetitor(state)) state.uniXp = (state.uniXp || 0) + gained;
  else state.xp = (state.xp || 0) + gained;
  state.lifetimeXp = (state.lifetimeXp || 0) + gained;
  return gained;
}

function defaultState() {
  return {
    // Three XP counters, deliberately: `xp` is the GENERAL league's score,
    // `uniXp` the current university league's, and only one of them grows
    // at a time (see awardXp). `lifetimeXp` is neither league's — it is the
    // never-reset total, the only honest input for anything that must not
    // fall when a counter resets (achievements' xp_total, /public/stats).
    xp: 0,
    uniXp: 0,
    lifetimeXp: 0,
    coins: 50, // starter balance — "Jashmen Coins"
    streak: 0,
    lessonsToday: 0,
    energyDate: null,
    energyPeriod: null,
    bonusEnergyToday: 0,
    // University-league support energy: what this user gave away and what
    // viewers handed them, both reset with the refill period (energy.js).
    energyGivenToday: 0,
    supportEnergyToday: 0,
    supportGivenPeriod: null,
    // University-league enrolment — moved off localStorage so a viewer's
    // gift and a student's supporter list can be resolved server-side.
    uniId: null,
    uniRole: null,
    uniJoinedAt: null,
    completedLessons: [],
    achievements: [],
    ownedShop: [],
    settings: { sound: true, animations: true },
    lastActiveDate: null,
    // Trailing window of days the learner showed up, newest last — the only
    // thing the streak celebration's Su–Sa strip needs that `streak` alone
    // can't answer ("which days of THIS week did I actually study?").
    activeDays: [],
    hasStreakShield: false,
    hasXpBoost: false,
    vipBadge: false,
    pushSubscriptions: [],
  };
}

// Never leak the password hash or internal bookkeeping fields to the client.
function toPublicUser(user) {
  const { passwordHash, _lastReward, ...rest } = user;
  // Not the hash — only whether one exists, so Settings can offer a
  // Google-only account "create a password" instead of asking it to prove
  // a current one it never had (see POST /u/me/password).
  return { ...rest, hasPassword: !!passwordHash };
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
  res.json({
    // The WEB client id. Both the web client and the native ones send this
    // as Google's `serverClientId`, which is what makes Google mint an
    // id_token whose audience googleAuth.js recognises.
    googleClientId: process.env.GOOGLE_CLIENT_ID || null,
    // Platform client ids. iOS needs its own at sign-in time; Android
    // resolves itself from the package name + signing certificate and so
    // has nothing to send. Served here rather than baked into the app so
    // an already-installed build starts showing the button the moment the
    // server is configured — no store release to turn it on.
    googleClientIdIos: process.env.GOOGLE_CLIENT_ID_IOS || null,
    googleClientIdAndroid: process.env.GOOGLE_CLIENT_ID_ANDROID || null,
  });
});

// Aggregate counters for the landing page's stats band. Deliberately the
// only numbers that page shows: hand-written marketing stats are stale
// within a week, and this costs one pass over the user list.
//
// Nothing here identifies anybody — four totals, no names, no ids, no
// per-user rows — so it stays unauthenticated like the rest of /public/*.
router.get('/public/stats', (req, res) => {
  const users = db.listUsers();
  res.json({
    learners: users.length,
    lessons: totalLessons(),
    modules: getContent().modules.length,
    universities: getUniversities().length,
    xp: users.reduce((sum, u) => sum + (u.state?.lifetimeXp || 0), 0),
  });
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
    const previousStreak = state.streak || 0;
    let claimed = false;

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
      // Trailing 30 days is two full Su–Sa strips of headroom — enough for
      // the celebration screen to render last week too, small enough that
      // the field never grows without bound.
      const days = Array.isArray(state.activeDays) ? state.activeDays : [];
      state.activeDays = [...new Set([...days, today])].sort().slice(-30);
      claimed = true;
      await db.saveUser(user);
    }

    // `claimed` is what the client gates the streak celebration on: the
    // daily claim fires on every session start (store.jsx), so without it
    // the screen would pop on every reload instead of once a day.
    res.json({
      user: toPublicUser(user),
      claimed,
      streak: state.streak || 0,
      previousStreak,
      streakIncreased: claimed && (state.streak || 0) > previousStreak,
      activeDays: state.activeDays || [],
    });
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
      const { remaining } = computeLiveEnergy(state, dailyFreeLessons, refillHours());
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
      awardXp(state, xp);
      state.coins = (state.coins || 0) + coins;
      spendEnergy(state, refillHours());
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
      if (!grantBonusEnergy(state, getLimits().maxBonusEnergyPerDay, refillHours())) {
        return res.status(400).json({ error: 'Бүгүн максимум энергия толтурулду' });
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
        awardXp(state, bonus);
        changed = true;
      }
    }

    if (changed) await db.saveUser(user);
    res.json(toPublicUser(user));
  } catch (err) { next(err); }
});

// ── Self-serve password change ──────────────────────────────────────────
//
// The only way a password could change before this was the admin panel
// (adminRoutes.js PATCH /admin/users/:id). A Google-only account carries
// passwordHash: null (googleAuth.js), so for those this route is "set a
// password for the first time" and no current password is demanded —
// otherwise there would be no way out of Google-only sign-in.

router.post('/u/me/password', authLimiter, requireAuth, async (req, res, next) => {
  try {
    const user = db.findUserById(req.userId);
    if (!user) return res.status(401).json({ error: 'Колдонуучу табылган жок' });

    const { currentPassword, newPassword } = req.body || {};
    if (typeof newPassword !== 'string' || newPassword.length < 6) {
      return res.status(400).json({ error: 'Жаңы сырсөз жок дегенде 6 белгиден турушу керек' });
    }
    if (newPassword.length > 200) {
      return res.status(400).json({ error: 'Сырсөз өтө узун' });
    }

    if (user.passwordHash) {
      if (typeof currentPassword !== 'string' || !currentPassword) {
        return res.status(400).json({ error: 'Азыркы сырсөздү жазыңыз' });
      }
      if (!(await verifyPassword(currentPassword, user.passwordHash))) {
        return res.status(400).json({ error: 'Азыркы сырсөз туура эмес' });
      }
      if (await verifyPassword(newPassword, user.passwordHash)) {
        return res.status(400).json({ error: 'Жаңы сырсөз эскисинен башка болушу керек' });
      }
    }

    user.passwordHash = await hashPassword(newPassword);
    await db.saveUser(user);

    // A password change is exactly the moment a leaked refresh token should
    // die, so every session is revoked — then this device is handed a fresh
    // pair straight away so the person who just changed it stays signed in.
    await db.revokeUserSessions(user.id);
    const refreshToken = await issueRefreshToken(user.id);
    setRefreshCookie(res, REFRESH_COOKIE_NAME, refreshToken, REFRESH_TOKEN_TTL_MS);

    res.json({ token: signAccessToken(user.id), user: toPublicUser(user) });
  } catch (err) { next(err); }
});

// ── University league: enrolment, board, viewer support ─────────────────
//
// The league's *content* (campus name, prize pool, dates, sponsor) stays
// authored client-side in src/data/universities.js / universities.dart —
// what moved here is everything that has to be true across two people:
// who is enrolled as what, who is actually on the board, and the energy a
// viewer hands a student. `universityId` is validated for shape only; the
// catalogue of ids lives with the content that describes them.

router.put('/u/me/university', requireAuth, async (req, res, next) => {
  try {
    const user = db.findUserById(req.userId);
    if (!user) return res.status(401).json({ error: 'Колдонуучу табылган жок' });

    const { universityId, role } = req.body || {};
    const { state } = user;

    // Both null → leave the league (the "change university" flow's escape
    // hatch, and what a fresh account looks like).
    if (universityId == null && role == null) {
      state.uniId = null;
      state.uniRole = null;
      state.uniJoinedAt = null;
      state.uniXp = 0;
      await db.saveUser(user);
      return res.json(toPublicUser(user));
    }

    const id = String(universityId || '').toLowerCase().trim();
    if (!UNI_ID_RE.test(id)) return res.status(400).json({ error: 'Университет туура эмес' });
    if (!UNI_ROLES.includes(role)) return res.status(400).json({ error: 'Роль туура эмес' });

    // Every enrolment write starts the campus score at zero — a new
    // university, a re-join of the same one, or a role switch. Nothing is
    // carried in from the general league and nothing is kept from a
    // previous campus: each entry is a clean run, by design.
    state.uniId = id;
    state.uniRole = role;
    state.uniJoinedAt = Date.now();
    state.uniXp = 0;
    await db.saveUser(user);
    res.json(toPublicUser(user));
  } catch (err) { next(err); }
});

// The board a student competes on, ranked on `uniXp` — the score earned
// since this enrolment began, not the account's general-league XP. Someone
// arriving from the top of the general league starts here on 0 like
// everyone else. Viewers are counted (the eye badge) but never ranked —
// they earn into the general league, which is exactly what filtering on
// uniRole === 'student' gives for free.
router.get('/u/university/:uniId/board', requireAuth, (req, res, next) => {
  try {
    const uniId = String(req.params.uniId || '').toLowerCase();
    if (!UNI_ID_RE.test(uniId)) return res.status(400).json({ error: 'Университет туура эмес' });

    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const members = db.listUsers().filter(u => u.state?.uniId === uniId);
    const students = members.filter(u => u.state.uniRole === 'student');
    const viewerCount = members.filter(u => u.state.uniRole === 'viewer').length;
    const supporters = db.countSupportersByUniversity(uniId);

    const ranked = students
      .map(u => ({
        id: u.id,
        name: u.name,
        avatar: u.avatar,
        xp: u.state.uniXp || 0,
        streak: u.state.streak || 0,
        supporters: supporters.get(u.id)?.size || 0,
      }))
      .sort((a, b) => b.xp - a.xp || a.name.localeCompare(b.name));

    const myIndex = ranked.findIndex(r => r.id === req.userId);
    const me = db.findUserById(req.userId);

    res.json({
      universityId: uniId,
      studentCount: ranked.length,
      viewerCount,
      totalXp: ranked.reduce((sum, r) => sum + r.xp, 0),
      students: ranked.slice(0, limit).map((r, i) => ({ ...r, rank: i + 1 })),
      me: {
        role: me?.state?.uniRole || null,
        rank: myIndex === -1 ? null : myIndex + 1,
        xp: me?.state?.uniXp || 0,
        supporters: supporters.get(req.userId)?.size || 0,
      },
    });
  } catch (err) { next(err); }
});

// A viewer spends their own energy to back a student. One gift per refill
// period per viewer — the cap lives on the giver's own state, so it costs
// no scan and rolls over with everything else (energy.js).
router.post('/u/university/support', requireAuth, async (req, res, next) => {
  try {
    const user = db.findUserById(req.userId);
    if (!user) return res.status(401).json({ error: 'Колдонуучу табылган жок' });

    const { state } = user;
    if (state.uniRole !== 'viewer') {
      return res.status(403).json({ error: 'Энергияны көрүүчүлөр гана бере алат' });
    }
    if (!state.uniId) {
      return res.status(400).json({ error: 'Алгач университетти тандаңыз' });
    }

    const { toUserId } = req.body || {};
    if (!toUserId || toUserId === user.id) {
      return res.status(400).json({ error: 'Студентти тандаңыз' });
    }
    const target = db.findUserById(toUserId);
    if (!target || target.state?.uniId !== state.uniId || target.state?.uniRole !== 'student') {
      return res.status(404).json({ error: 'Студент табылган жок' });
    }

    const lim = getLimits();
    const amount = Math.max(1, parseInt(lim.supportEnergyAmount, 10) || 5);
    const hours = refillHours();
    const verdict = canGiveSupportEnergy(state, amount, hours, lim.dailyFreeLessons ?? 3);
    if (verdict === 'already') {
      return res.status(429).json({
        error: 'Бүгүн энергия бердиң — кийинки толтурууну күт',
        resetInMs: periodEndsAt(hours) - Date.now(),
      });
    }
    if (verdict === 'insufficient') {
      return res.status(400).json({ error: 'Энергияң жетишсиз' });
    }

    spendSupportEnergy(state, amount, hours);
    receiveSupportEnergy(target.state, amount, hours);
    db.addEnergyGift({
      id: randomUUID(),
      fromUserId: user.id,
      toUserId: target.id,
      universityId: state.uniId,
      amount,
      date: todayUTC(),
      period: currentPeriod(hours),
      ts: Date.now(),
    });
    // saveUser persists the whole document, so the gift row above lands with
    // both sides of the transfer in a single write.
    await db.saveUser(user);
    await db.saveUser(target);

    res.status(201).json({
      user: toPublicUser(user),
      amount,
      to: { id: target.id, name: target.name, avatar: target.avatar },
      nextGiftInMs: periodEndsAt(hours) - Date.now(),
    });
  } catch (err) { next(err); }
});

// "СЕНИ КОЛДОГОНДОР" — every viewer who has backed this student, folded to
// one row each with their running total.
router.get('/u/me/supporters', requireAuth, (req, res, next) => {
  try {
    const byUser = new Map();
    for (const gift of db.listEnergyGiftsTo(req.userId)) {
      const agg = byUser.get(gift.fromUserId) || { amount: 0, gifts: 0, lastTs: 0 };
      agg.amount += gift.amount || 0;
      agg.gifts += 1;
      agg.lastTs = Math.max(agg.lastTs, gift.ts || 0);
      byUser.set(gift.fromUserId, agg);
    }

    const supporters = [...byUser.entries()]
      .map(([id, agg]) => {
        // Joined at read time, not snapshotted, so a renamed supporter shows
        // their current name and a deleted one degrades to a placeholder.
        const u = db.findUserById(id);
        return {
          id,
          name: u?.name || 'Колдонуучу',
          avatar: u?.avatar || null,
          amount: agg.amount,
          gifts: agg.gifts,
          lastTs: agg.lastTs,
        };
      })
      .sort((a, b) => b.amount - a.amount || b.lastTs - a.lastTs);

    res.json({
      supporters,
      totalEnergy: supporters.reduce((sum, s) => sum + s.amount, 0),
    });
  } catch (err) { next(err); }
});

export default router;
