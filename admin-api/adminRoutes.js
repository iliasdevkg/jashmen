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
import { adminLoginLimiter } from './rateLimit.js';
import {
  verifyAdminPassword, signAdminAccessToken, requireAdmin,
  issueAdminRefreshToken, refreshAdminAccessToken, revokeAdminRefreshToken,
  REFRESH_TOKEN_TTL_MS, REFRESH_COOKIE_NAME,
} from './adminAuth.js';
import { setRefreshCookie, clearRefreshCookie } from './cookies.js';
import { upload, saveUploadedFile } from './uploads.js';
import * as content from './contentStore.js';
import * as events from './events.js';
import * as db from './db.js';
import { sendStreakReminders, sendRetentionReminders, pushEnabled } from './push.js';

const router = Router();

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
    const { title, color } = req.body || {};
    if (!content.kyOf(title)) return res.status(400).json({ error: 'Модулдун аталышы керек' });
    res.status(201).json(await content.addModule({ title, color }));
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
    const { title, cards, iconUrl } = req.body || {};
    if (!content.kyOf(title)) return res.status(400).json({ error: 'Сабактын аталышы керек' });
    if (!Array.isArray(cards) || cards.length === 0) {
      return res.status(400).json({ error: 'Жок дегенде бир карта керек' });
    }
    res.status(201).json(await content.addLesson(req.params.id, { title, cards, iconUrl }));
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
    const { title, desc, price, effect, iconUrl } = req.body || {};
    res.status(201).json(await content.addShopItem({ title, desc, price, effect, iconUrl }));
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
    res.json(await content.setLimits(patch));
  } catch (err) { next(err); }
});

// ── Leagues — unlimited, admin-defined ──────────────────────────────────

router.post('/leagues', async (req, res, next) => {
  try {
    const { name, iconUrl, color, minXp } = req.body || {};
    if (!content.kyOf(name)) return res.status(400).json({ error: 'Лиганын аты керек' });
    res.status(201).json(await content.addLeague({ name, iconUrl, color, minXp }));
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

// ── Achievements — unlimited, rule-driven ───────────────────────────────

router.post('/achievements', async (req, res, next) => {
  try {
    const { iconUrl, title, desc, xp, rule } = req.body || {};
    if (!content.kyOf(title)) return res.status(400).json({ error: 'Жетишкендиктин аты керек' });
    res.status(201).json(await content.addAchievement({ iconUrl, title, desc, xp, rule }));
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
