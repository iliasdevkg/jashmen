// admin-api/adminRoutes.js — everything under /admin/api/admin/*.
//
// Mirrors the JASHMEN.pdf admin spec 1:1:
//   Module A — lesson/quiz constructor (modules, lessons, media upload)
//   Module Б — B2B partner manager (partners + their prize catalog)
//   Module В — Daily Cap Protection (dailyFreeLessons / dailyPrizeCap)
//   Дополнение — analytics (funnel + wrong-answer heatmap)
//
// Everything past /login requires a valid admin token (requireAdmin).

import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { adminLoginLimiter } from './rateLimit.js';
import {
  verifyAdminPassword, signAdminAccessToken, requireAdmin,
  issueAdminRefreshToken, refreshAdminAccessToken, revokeAdminRefreshToken,
  REFRESH_TOKEN_TTL_MS, REFRESH_COOKIE_NAME,
} from './adminAuth.js';
import { hashPassword } from './auth.js';
import { normalizeRefillHours } from './energy.js';
import { setRefreshCookie, clearRefreshCookie } from './cookies.js';
import { upload, saveUploadedFile } from './uploads.js';
import * as content from './contentStore.js';
import * as events from './events.js';
import * as db from './db.js';
import { sendStreakReminders, sendRetentionReminders, pushEnabled } from './push.js';

const router = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Same shape as routes.js#defaultState — a user the admin creates directly
// (not via /u/signup) still needs every field the rest of the app reads.
function defaultUserState() {
  return {
    xp: 0,
    uniXp: 0,
    lifetimeXp: 0,
    coins: 50,
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

function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

router.post('/login', adminLoginLimiter, async (req, res, next) => {
  try {
    const { password } = req.body || {};
    if (!verifyAdminPassword(password)) {
      return res.status(401).json({ error: 'Сырсөз туура эмес' });
    }
    const refreshToken = await issueAdminRefreshToken();
    setRefreshCookie(res, REFRESH_COOKIE_NAME, refreshToken, REFRESH_TOKEN_TTL_MS);
    res.json({ token: signAdminAccessToken() });
  } catch (err) { next(err); }
});

// Silently exchanges the httpOnly admin-refresh cookie for a fresh access
// token, rotating it in the process — same shape as /admin/api/u/refresh.
router.post('/refresh', async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
    if (!refreshToken) return res.status(401).json({ error: 'Админ сессиясы табылган жок' });

    const result = await refreshAdminAccessToken(refreshToken);
    if (!result) {
      clearRefreshCookie(res, REFRESH_COOKIE_NAME);
      return res.status(401).json({ error: 'Админ сессиясынын мөөнөтү бүттү, кайра кириңиз' });
    }

    setRefreshCookie(res, REFRESH_COOKIE_NAME, result.refreshToken, REFRESH_TOKEN_TTL_MS);
    res.json({ token: result.accessToken });
  } catch (err) { next(err); }
});

// Real, server-side admin logout — revokes the session, clears the cookie.
router.post('/logout', async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
    if (refreshToken) await revokeAdminRefreshToken(refreshToken);
    clearRefreshCookie(res, REFRESH_COOKIE_NAME);
    res.status(204).end();
  } catch (err) { next(err); }
});

router.use(requireAdmin);

// ── Media upload (Module A: "Загрузить Фото / Видеоролик") ─────────────────

router.post('/media/upload', upload.single('file'), async (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Файл алынган жок (түрү уруксат берилбейт же өтө чоң)' });
  }
  try {
    const url = await saveUploadedFile(req.file);
    res.status(201).json({ url });
  } catch (err) { next(err); }
});

// ── Whole content blob, for the admin app to bootstrap from ────────────────

router.get('/content', (req, res) => res.json(content.getContent()));

// ── Module A: modules + lessons ─────────────────────────────────────────

router.post('/modules', async (req, res, next) => {
  try {
    const { title, color, iconUrl, icon } = req.body || {};
    if (!content.kyOf(title)) return res.status(400).json({ error: 'Модулдун аталышы керек' });
    res.status(201).json(await content.addModule({ title, color, iconUrl, icon }));
  } catch (err) { next(err); }
});

router.put('/modules/:id', async (req, res, next) => {
  try {
    res.json(await content.updateModule(req.params.id, req.body || {}));
  } catch (err) { res.status(404).json({ error: err.message }); }
});

router.delete('/modules/:id', async (req, res, next) => {
  try { await content.deleteModule(req.params.id); res.status(204).end(); }
  catch (err) { next(err); }
});

router.post('/modules/:id/lessons', async (req, res, next) => {
  try {
    const { title, cards, iconUrl, icon } = req.body || {};
    if (!content.kyOf(title)) return res.status(400).json({ error: 'Сабактын аталышы керек' });
    if (!Array.isArray(cards) || cards.length === 0) {
      return res.status(400).json({ error: 'Жок дегенде бир карта керек' });
    }
    res.status(201).json(await content.addLesson(req.params.id, { title, cards, iconUrl, icon }));
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.put('/lessons/:id', async (req, res, next) => {
  try {
    res.json(await content.updateLesson(req.params.id, req.body || {}));
  } catch (err) { res.status(404).json({ error: err.message }); }
});

router.delete('/lessons/:id', async (req, res, next) => {
  try { await content.deleteLesson(req.params.id); res.status(204).end(); }
  catch (err) { next(err); }
});

// ── Module Б: B2B partners + prize catalog ──────────────────────────────

router.post('/partners', async (req, res, next) => {
  try {
    const { name, logoUrl } = req.body || {};
    if (!content.kyOf(name)) return res.status(400).json({ error: 'Партнёрдун аты керек' });
    res.status(201).json(await content.addPartner({ name, logoUrl }));
  } catch (err) { next(err); }
});

router.put('/partners/:id', async (req, res, next) => {
  try {
    res.json(await content.updatePartner(req.params.id, req.body || {}));
  } catch (err) { res.status(404).json({ error: err.message }); }
});

router.delete('/partners/:id', async (req, res, next) => {
  try { await content.deletePartner(req.params.id); res.status(204).end(); }
  catch (err) { next(err); }
});

router.post('/prizes', async (req, res, next) => {
  try {
    const { partnerId, title, description, photoUrl, priceCoins } = req.body || {};
    if (!partnerId || !content.kyOf(title)) {
      return res.status(400).json({ error: 'Партнёр жана сыйлыктын аталышы керек' });
    }
    if (!content.findPartner(partnerId)) return res.status(404).json({ error: 'Партнёр табылган жок' });
    res.status(201).json(await content.addPrize({ partnerId, title, description, photoUrl, priceCoins }));
  } catch (err) { next(err); }
});

router.put('/prizes/:id', async (req, res, next) => {
  try {
    res.json(await content.updatePrize(req.params.id, req.body || {}));
  } catch (err) { res.status(404).json({ error: err.message }); }
});

router.delete('/prizes/:id', async (req, res, next) => {
  try { await content.deletePrize(req.params.id); res.status(204).end(); }
  catch (err) { next(err); }
});

// ── Shop items — unlimited, effect-driven (Task 12) ─────────────────────

router.post('/shop-items', async (req, res, next) => {
  try {
    const { title, desc, price, effect, iconUrl, icon } = req.body || {};
    res.status(201).json(await content.addShopItem({ title, desc, price, effect, iconUrl, icon }));
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.put('/shop-items/:id', async (req, res, next) => {
  try { res.json(await content.updateShopItem(req.params.id, req.body || {})); }
  catch (err) { res.status(err.message === 'Товар табылган жок' ? 404 : 400).json({ error: err.message }); }
});

router.delete('/shop-items/:id', async (req, res, next) => {
  try { await content.deleteShopItem(req.params.id); res.status(204).end(); }
  catch (err) { next(err); }
});

// ── Module В: daily limits — Task 12 expands this to EVERY previously-
// hardcoded gameplay/economy constant, all admin-editable from one panel:
// energy caps, the XP formula (points per question, mistake penalty, the
// mistake-proof floor, the perfect-lesson bonus, the xp_boost multiplier),
// and both coin payouts. See contentStore.js#withDefaults for the defaults
// (byte-identical to what routes.js/energy.js used to hardcode) and
// routes.js#/u/me/lesson + /u/me/buy for where each one is actually read.

const LIMIT_FIELDS = [
  'dailyFreeLessons', 'dailyPrizeCap', 'maxBonusEnergyPerDay',
  'xpPerQuestion', 'xpMistakePenalty', 'xpMinFloorPct', 'xpPerfectBonusPct',
  'xpBoostMultiplierPct', 'coinsPerfectLesson', 'coinsNormalLesson',
  'energyRefillHours', 'supportEnergyAmount',
];

router.get('/limits', (req, res) => {
  res.json({ ...content.getLimits(), redeemedToday: db.countRedemptionsToday(todayUTC()) });
});

router.put('/limits', async (req, res, next) => {
  try {
    const body = req.body || {};
    const patch = {};
    for (const key of LIMIT_FIELDS) {
      if (body[key] != null) patch[key] = Math.max(0, parseInt(body[key], 10) || 0);
    }
    // These two floors match their pre-Task-12 hardcoded minimums — a cap of
    // 0 would mean "no free lessons ever" / "no prizes ever", which is a
    // real admin choice elsewhere, but these two specifically always had a
    // floor of 1 and changing that is more likely a typo than an intent.
    if (patch.dailyFreeLessons != null) patch.dailyFreeLessons = Math.max(1, patch.dailyFreeLessons);
    if (patch.dailyPrizeCap != null) patch.dailyPrizeCap = Math.max(1, patch.dailyPrizeCap);
    // The refill period is a divisor of real time, so 0 would mean "refill
    // infinitely often" — clamped to energy.js's own guard rails instead.
    if (patch.energyRefillHours != null) {
      patch.energyRefillHours = normalizeRefillHours(patch.energyRefillHours);
    }
    // A gift of 0 energy is a button that does nothing; a gift bigger than a
    // full allowance would let one viewer hand out a whole day at once.
    if (patch.supportEnergyAmount != null) {
      patch.supportEnergyAmount = Math.min(50, Math.max(1, patch.supportEnergyAmount));
    }
    res.json(await content.setLimits(patch));
  } catch (err) { next(err); }
});

// ── Leagues — unlimited, admin-defined ──────────────────────────────────

router.post('/leagues', async (req, res, next) => {
  try {
    const { name, iconUrl, icon, color, minXp } = req.body || {};
    if (!content.kyOf(name)) return res.status(400).json({ error: 'Лиганын аты керек' });
    res.status(201).json(await content.addLeague({ name, iconUrl, icon, color, minXp }));
  } catch (err) { next(err); }
});

router.put('/leagues/:id', async (req, res, next) => {
  try { res.json(await content.updateLeague(req.params.id, req.body || {})); }
  catch (err) { res.status(404).json({ error: err.message }); }
});

router.delete('/leagues/:id', async (req, res, next) => {
  try { await content.deleteLeague(req.params.id); res.status(204).end(); }
  catch (err) { next(err); }
});

// ── Module Г: universities & contests ───────────────────────────────────
//
// A validation failure here is the admin mistyping a date or leaving the
// Kyrgyz name blank, not a server fault — contentStore throws with the
// message the form should show, so those come back as 400 rather than
// falling through to the 500 handler.

router.post('/universities', async (req, res) => {
  try { res.status(201).json(await content.addUniversity(req.body || {})); }
  catch (err) { res.status(400).json({ error: err.message }); }
});

router.put('/universities/:id', async (req, res) => {
  try { res.json(await content.updateUniversity(req.params.id, req.body || {})); }
  catch (err) { res.status(400).json({ error: err.message }); }
});

router.delete('/universities/:id', async (req, res, next) => {
  try { await content.deleteUniversity(req.params.id); res.status(204).end(); }
  catch (err) { next(err); }
});

// ── Landing page — the public marketing site ────────────────────────────
//
// PUT merges section by section (contentStore#sanitizeLanding), so the
// editor can save just the section being edited without having to send —
// and risk clobbering — the ones it isn't touching.

router.get('/landing', (req, res) => {
  res.json(content.getLanding());
});

router.put('/landing', async (req, res, next) => {
  try { res.json(await content.setLanding(req.body || {})); }
  catch (err) { next(err); }
});

// ── Achievements — unlimited, rule-driven ───────────────────────────────

router.post('/achievements', async (req, res, next) => {
  try {
    const { iconUrl, icon, title, desc, xp, rule } = req.body || {};
    if (!content.kyOf(title)) return res.status(400).json({ error: 'Жетишкендиктин аты керек' });
    res.status(201).json(await content.addAchievement({ iconUrl, icon, title, desc, xp, rule }));
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.put('/achievements/:id', async (req, res, next) => {
  try { res.json(await content.updateAchievement(req.params.id, req.body || {})); }
  catch (err) { res.status(err.message === 'Жетишкендик табылган жок' ? 404 : 400).json({ error: err.message }); }
});

router.delete('/achievements/:id', async (req, res, next) => {
  try { await content.deleteAchievement(req.params.id); res.status(204).end(); }
  catch (err) { next(err); }
});

// ── Retention — admin-configurable "come back" push campaigns ──────────

router.post('/retention-rules', async (req, res, next) => {
  try {
    const { daysInactive, title, body, enabled } = req.body || {};
    if (!daysInactive) return res.status(400).json({ error: 'Канча күн жооп катуусу керек' });
    res.status(201).json(await content.addRetentionRule({ daysInactive, title, body, enabled }));
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.put('/retention-rules/:id', async (req, res, next) => {
  try { res.json(await content.updateRetentionRule(req.params.id, req.body || {})); }
  catch (err) { res.status(err.message === 'Эреже табылган жок' ? 404 : 400).json({ error: err.message }); }
});

router.delete('/retention-rules/:id', async (req, res, next) => {
  try { await content.deleteRetentionRule(req.params.id); res.status(204).end(); }
  catch (err) { next(err); }
});

// ── Analytics ────────────────────────────────────────────────────────────

router.get('/analytics/funnel', (req, res) => res.json(events.funnel()));
router.get('/analytics/heatmap', (req, res) => res.json(events.questionHeatmap()));
router.get('/analytics/overview', (req, res) => res.json(db.overview()));

// ── Users (Analytics → Колдонуучулар) ───────────────────────────────────
//
// A safe projection of each user record for the admin's monitoring/cleanup
// list — passwordHash and googleSub never leave this endpoint.
router.get('/users', (req, res) => {
  const list = db.listUsers().map(u => ({
    id: u.id,
    name: u.name,
    email: u.email,
    avatar: u.avatar,
    createdAt: u.createdAt || null,
    xp: u.state?.xp || 0,
    coins: u.state?.coins || 0,
    streak: u.state?.streak || 0,
    completedLessons: (u.state?.completedLessons || []).length,
    achievements: (u.state?.achievements || []).length,
    lastActiveDate: u.state?.lastActiveDate || null,
  }));
  res.json(list);
});

// Admin-created account — same shape /u/signup produces, minus the
// refresh-token issuance (the admin isn't logging in as this user).
router.post('/users', async (req, res) => {
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
    state: defaultUserState(),
  };
  await db.insertUser(user);
  res.status(201).json({ id: user.id });
});

// Edits name/email/avatar and the handful of state numbers the "Колдонуучулар"
// card shows (xp, coins, streak) — anything else on the user stays untouched.
// `password`, if present, resets it the same way signup hashes one; omitted
// (the common case) leaves the existing hash alone.
router.patch('/users/:id', async (req, res) => {
  const user = db.findUserById(req.params.id);
  if (!user) return res.status(404).json({ error: 'Колдонуучу табылган жок' });

  const { name, email, avatar, password, xp, coins, streak } = req.body || {};

  if (email !== undefined) {
    const trimmed = email.trim().toLowerCase();
    if (!EMAIL_RE.test(trimmed)) return res.status(400).json({ error: 'Email туура эмес' });
    const existing = db.findUserByEmail(trimmed);
    if (existing && existing.id !== user.id) {
      return res.status(409).json({ error: 'Бул email мурунтан катталган' });
    }
    user.email = trimmed;
  }
  if (name !== undefined) {
    if (!name.trim()) return res.status(400).json({ error: 'Аты бош болбошу керек' });
    user.name = name.trim().slice(0, 60);
  }
  if (avatar !== undefined) user.avatar = avatar || '🦅';
  if (password) {
    if (password.length < 6) {
      return res.status(400).json({ error: 'Сырсөз жок дегенде 6 белгиден турушу керек' });
    }
    user.passwordHash = await hashPassword(password);
  }
  if (xp !== undefined) {
    // The edit box is the GENERAL league's score. Move the lifetime total by
    // the same delta so an admin grant still counts toward xp_total
    // achievements, and a correction downward doesn't leave it inflated.
    const next = Math.max(0, Number(xp) || 0);
    const delta = next - (user.state.xp || 0);
    user.state.xp = next;
    user.state.lifetimeXp = Math.max(0, (user.state.lifetimeXp || 0) + delta);
  }
  if (coins !== undefined) user.state.coins = Math.max(0, Number(coins) || 0);
  if (streak !== undefined) user.state.streak = Math.max(0, Number(streak) || 0);

  await db.saveUser(user);
  res.status(204).end();
});

// Irreversible — used to remove accounts that signed up by mistake/abuse.
// Their past redemptions are deliberately left in place (see db.js#deleteUser):
// a redemption code already handed to a partner should stay as a record even
// after the account behind it is gone.
router.delete('/users/:id', async (req, res) => {
  const ok = await db.deleteUser(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Колдонуучу табылган жок' });
  res.status(204).end();
});

// ── Push (manual triggers — same campaigns the CRON_SECRET-protected
//    /admin/api/cron/* routes run on a schedule; these let you fire them
//    on demand from the admin panel without waiting) ────────────────────

router.get('/push/status', (req, res) => res.json({ enabled: pushEnabled }));

router.post('/push/send-streak-reminders', async (req, res, next) => {
  try { res.json(await sendStreakReminders()); }
  catch (err) { next(err); }
});

router.post('/push/send-retention-reminders', async (req, res, next) => {
  try { res.json(await sendRetentionReminders()); }
  catch (err) { next(err); }
});

export default router;
