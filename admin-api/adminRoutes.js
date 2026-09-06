// admin-api/adminRoutes.js — everything under /admin/api/admin/*.
//
// Mirrors the JASHMEN.pdf admin spec 1:1:
//   Module A — lesson/quiz constructor (modules, lessons, media upload)
//   Module Б — B2B partner manager (partners + their prize catalog)
//   Module В — daily energy allowance (dailyFreeLessons)
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
import * as leads from './leads.js';
import { sendStreakReminders, sendRetentionReminders, pushEnabled } from './push.js';
import * as presence from './presence.js';

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
  } catch (err) {
    // saveUploadedFile rejects a file whose bytes are not the image or video
    // it claims to be, with a message written for the operator. That has to
    // reach the upload button rather than becoming an anonymous 500.
    if (err.status === 400) return res.status(400).json({ error: err.message });
    next(err);
  }
});

// ── Whole content blob, for the admin app to bootstrap from ────────────────

router.get('/content', (req, res) => res.json(content.getContent()));

// ── Module A: modules + lessons ─────────────────────────────────────────

router.post('/modules', async (req, res, next) => {
  try {
    const { title, color, iconUrl, icon, partnerId, artSide } = req.body || {};
    if (!content.kyOf(title)) return res.status(400).json({ error: 'Модулдун аталышы керек' });
    res.status(201).json(await content.addModule({ title, color, iconUrl, icon, partnerId, artSide }));
  } catch (err) { next(err); }
});

// MUST stay above '/modules/:id' — Express matches in source order, and
// that route would otherwise swallow this one with id === 'order'.
router.put('/modules/order', async (req, res, next) => {
  try {
    const { order } = req.body || {};
    if (!Array.isArray(order)) {
      return res.status(400).json({ error: 'Модулдардын ирээти керек' });
    }
    res.json(await content.reorderModules(order));
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

// Drag-to-reorder in the Сабактар panel. Both of these take the whole order
// rather than a from/to pair: the client already knows the list it is
// showing, and sending it whole means a stale index can never move the
// wrong row.

router.put('/modules/:id/lessons/order', async (req, res, next) => {
  try {
    const { order } = req.body || {};
    if (!Array.isArray(order)) {
      return res.status(400).json({ error: 'Сабактардын ирээти керек' });
    }
    res.json(await content.reorderLessons(req.params.id, order));
  } catch (err) { res.status(404).json({ error: err.message }); }
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
    const {
      partnerId, title, description, photoUrl, priceCoins, promoCodes, promoCode,
    } = req.body || {};
    if (!partnerId || !content.kyOf(title)) {
      return res.status(400).json({ error: 'Партнёр жана сыйлыктын аталышы керек' });
    }
    if (!content.findPartner(partnerId)) return res.status(404).json({ error: 'Партнёр табылган жок' });
    res.status(201).json(await content.addPrize({
      partnerId, title, description, photoUrl, priceCoins, promoCodes, promoCode,
    }));
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
  'dailyFreeLessons', 'maxBonusEnergyPerDay',
  'xpPerQuestion', 'xpMistakePenalty', 'xpMinFloorPct', 'xpPerfectBonusPct',
  'xpBoostMultiplierPct', 'xpPerReview', 'coinsPerfectLesson', 'coinsNormalLesson',
  'energyRefillHours', 'supportEnergyAmount', 'streakRepairEnergy',
];

router.get('/limits', (req, res) => {
  res.json(content.getLimits());
});

router.put('/limits', async (req, res, next) => {
  try {
    const body = req.body || {};
    const patch = {};
    for (const key of LIMIT_FIELDS) {
      if (body[key] != null) patch[key] = Math.max(0, parseInt(body[key], 10) || 0);
    }
    // "No free lessons ever" is not a setting anyone means to choose, and a
    // 0 here is far more likely a typo than an intent.
    if (patch.dailyFreeLessons != null) patch.dailyFreeLessons = Math.max(1, patch.dailyFreeLessons);
    // The refill period is a divisor of real time, so 0 would mean "refill
    // infinitely often" — clamped to energy.js's own guard rails instead.
    if (patch.energyRefillHours != null) {
      patch.energyRefillHours = normalizeRefillHours(patch.energyRefillHours);
    }
    // A gift of 0 energy is a button that does nothing; a gift bigger than a
    // full allowance would let one viewer hand out a whole day at once.
    // 0 is a real choice here — it turns the repair offer off — but a price
    // above a full day's allowance would be a button nobody can ever press.
    if (patch.streakRepairEnergy != null) {
      patch.streakRepairEnergy = Math.min(10, patch.streakRepairEnergy);
    }
    if (patch.supportEnergyAmount != null) {
      patch.supportEnergyAmount = Math.min(50, Math.max(1, patch.supportEnergyAmount));
    }
    const saved = await content.setLimits(patch);
    res.json(saved);
  } catch (err) { next(err); }
});

// ── Enquiries: partnership applications and user feedback ───────────────
//
// One inbox, two kinds, filtered by the caller. They are kept apart because
// they are answered by different people on different clocks — a bank waits
// days, a bug report waits until the next release.

router.get('/leads', (req, res, next) => {
  try {
    const KINDS = new Set(['partner', 'feedback', 'subscribe']);
    const kind = KINDS.has(req.query.kind) ? req.query.kind : null;
    res.json({
      leads: leads.listLeads(kind),
      unhandled: {
        partner: leads.countUnhandled('partner'),
        feedback: leads.countUnhandled('feedback'),
        subscribe: leads.countUnhandled('subscribe'),
      },
    });
  } catch (err) { next(err); }
});

router.patch('/leads/:id', async (req, res, next) => {
  try {
    const row = await leads.setLeadHandled(req.params.id, Boolean(req.body?.handled));
    if (!row) return res.status(404).json({ error: 'Кайрылуу табылган жок' });
    res.json(row);
  } catch (err) { next(err); }
});

router.delete('/leads/:id', async (req, res, next) => {
  try {
    const gone = await leads.deleteLead(req.params.id);
    if (!gone) return res.status(404).json({ error: 'Кайрылуу табылган жок' });
    res.status(204).end();
  } catch (err) { next(err); }
});

// ── Prize redemptions ───────────────────────────────────────────────────
//
// The operator side of POST /u/me/redeem (routes.js). A learner spends coins
// and gets a coupon code; until now that code existed only on the learner's
// own phone and in db.json, so nobody running the programme could tell a
// partner which codes are real or which have already been honoured.
//
// Both joins are best-effort by design. A prize can be deleted
// (contentStore.js#deletePrize) and a user can be deleted (DELETE
// /users/:id, which deliberately keeps their redemptions), so a row whose
// learner or prize is gone still has to render — the coupon may already be
// in somebody's hand.
// ── Prize analytics ─────────────────────────────────────────────────────
//
// One endpoint behind the whole Сыйлыктар аналитикасы screen: a count per
// bucket for the chart, a row per prize for the table, and the stock left
// so "sold 12, 3 codes to go" is one read rather than two.
//
// The buckets are calendar ones — a week is a real Mon–Sun week, a month a
// real month — because that is what an operator reconciles against. Naive
// N-day slices would drift off the calendar within a fortnight.

const BUCKETS = new Set(['day', 'week', 'month', 'year']);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/// The Monday on or before [iso]. ISO weeks start Monday, which is also how
/// a Kyrgyz working week is counted.
function weekStartOf(iso) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

function bucketKey(iso, bucket) {
  switch (bucket) {
    case 'week':  return weekStartOf(iso);
    case 'month': return iso.slice(0, 7);
    case 'year':  return iso.slice(0, 4);
    default:      return iso;
  }
}

/// Every bucket between the two dates, including the empty ones — a chart
/// with the quiet days missing reads as a chart with no quiet days.
function bucketRange(fromIso, toIso, bucket) {
  const keys = [];
  const seen = new Set();
  const end = new Date(`${toIso}T00:00:00Z`);
  for (let d = new Date(`${fromIso}T00:00:00Z`); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const key = bucketKey(d.toISOString().slice(0, 10), bucket);
    if (!seen.has(key)) { seen.add(key); keys.push(key); }
  }
  return keys;
}

router.get('/analytics/prizes', (req, res, next) => {
  try {
    const today = todayUTC();
    const bucket = BUCKETS.has(req.query.bucket) ? req.query.bucket : 'day';

    // An unspecified range means everything there is, so the screen opens on
    // the real history rather than on a window that might be empty.
    const earliest = db.firstRedemptionDate() || today;
    let from = ISO_DATE.test(req.query.from || '') ? req.query.from : earliest;
    let to   = ISO_DATE.test(req.query.to || '')   ? req.query.to   : today;
    if (from > to) [from, to] = [to, from];

    const rows = db.redemptionsBetween(from, to);
    const userById = new Map(db.listUsers().map(u => [u.id, u]));

    const counts = new Map(bucketRange(from, to, bucket).map(k => [k, 0]));
    const perPrize = new Map();
    let fulfilled = 0;
    let coins = 0;

    for (const r of rows) {
      const key = bucketKey(r.date, bucket);
      counts.set(key, (counts.get(key) || 0) + 1);
      if (r.fulfilledAt) fulfilled += 1;

      const prize = content.findPrize(r.prizeId);
      const id = r.prizeId;
      if (!perPrize.has(id)) {
        const partner = prize ? content.findPartner(prize.partnerId) : null;
        const stock = prize ? content.prizeStock(prize) : null;
        perPrize.set(id, {
          prizeId: id,
          title: prize?.title ?? null,
          photoUrl: prize?.photoUrl ?? null,
          priceCoins: prize?.priceCoins ?? 0,
          partner: partner ? { id: partner.id, name: partner.name } : null,
          deleted: !prize,
          left: stock && !stock.unlimited ? stock.left : null,
          unlimited: stock ? stock.unlimited : false,
          soldOut: stock ? stock.soldOut : false,
          sold: 0,
          fulfilled: 0,
        });
      }
      const row = perPrize.get(id);
      row.sold += 1;
      if (r.fulfilledAt) row.fulfilled += 1;
      coins += prize?.priceCoins || 0;
    }

    // Prizes nobody has bought in this range still belong in the table —
    // "0 sold, 5 codes waiting" is the row an operator most needs to see.
    for (const prize of content.getContent().prizes || []) {
      if (perPrize.has(prize.id)) continue;
      const partner = content.findPartner(prize.partnerId);
      const stock = content.prizeStock(prize);
      perPrize.set(prize.id, {
        prizeId: prize.id,
        title: prize.title,
        photoUrl: prize.photoUrl ?? null,
        priceCoins: prize.priceCoins ?? 0,
        partner: partner ? { id: partner.id, name: partner.name } : null,
        deleted: false,
        left: stock.unlimited ? null : stock.left,
        unlimited: stock.unlimited,
        soldOut: stock.soldOut,
        sold: 0,
        fulfilled: 0,
      });
    }

    res.json({
      from, to, bucket, earliest,
      total: rows.length,
      fulfilled,
      coins,
      series: [...counts.entries()].map(([key, count]) => ({ key, count })),
      byPrize: [...perPrize.values()].sort((a, b) => b.sold - a.sold),
    });
  } catch (err) { next(err); }
});

router.get('/redemptions', (req, res, next) => {
  try {
    // One pass over the users to build the join, rather than a linear scan
    // per row; and a copy of the store's array, because listRedemptions
    // hands back the live one and sorting it would reorder the database.
    const byId = new Map(db.listUsers().map(u => [u.id, u]));
    const rows = [...db.listRedemptions()]
      .sort((a, b) => (b.ts || 0) - (a.ts || 0))
      .map(r => {
        const user = byId.get(r.userId) || null;
        const prize = content.findPrize(r.prizeId) || null;
        const partner = prize ? content.findPartner(prize.partnerId) : null;
        return {
          id: r.id,
          code: r.code,
          date: r.date,
          ts: r.ts,
          fulfilledAt: r.fulfilledAt || null,
          // What this learner was actually handed, as it read on the day —
          // not whatever the prize's code says now.
          promoCode: r.promoCode ?? null,
          user: user
            ? { id: user.id, name: user.name, email: user.email, avatar: user.avatar }
            : null,
          // priceCoins is the prize's price TODAY, not what was paid — the
          // redemption record never snapshotted it. Labelled as such in the UI.
          prize: prize
            ? { id: prize.id, title: prize.title, photoUrl: prize.photoUrl, priceCoins: prize.priceCoins }
            : null,
          partner: partner
            ? { id: partner.id, name: partner.name, logoUrl: partner.logoUrl }
            : null,
        };
      });
    res.json({ redemptions: rows, total: rows.length });
  } catch (err) { next(err); }
});

router.patch('/redemptions/:id', async (req, res, next) => {
  try {
    const row = await db.setRedemptionFulfilled(req.params.id, Boolean((req.body || {}).fulfilled));
    if (!row) return res.status(404).json({ error: 'Сыйлык жазуусу табылган жок' });
    res.json({ id: row.id, fulfilledAt: row.fulfilledAt || null });
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

// The business site at `/` — same contract as /landing above: GET returns
// every section, PUT merges the ones it names and leaves the rest alone,
// so the editor saves one section at a time without risking the others.
router.get('/business', (req, res) => {
  res.json(content.getBusiness());
});

router.put('/business', async (req, res, next) => {
  try { res.json(await content.setBusiness(req.body || {})); }
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

/// The student side, split out from the roster as a whole.
///
/// Two questions this answers that the general overview cannot: how the
/// population divides between the two leagues, and how each campus is doing
/// against the others. Campus names come from the content store — the
/// database only holds ids.
router.get('/analytics/students', (req, res) => {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const stats = db.studentOverview({
    activeCutoffDate: cutoff,
    onlineIds: presence.onlineIds(),
  });

  const catalogue = content.getUniversities();
  const byUniversity = stats.byUniversity.map(row => {
    const uni = catalogue.find(u => u.id === row.uniId) || null;
    return {
      ...row,
      // A campus can be deleted while learners still carry its id, so the
      // row survives without a name rather than disappearing.
      listName: uni?.listName ?? null,
      name: uni?.name ?? null,
      color: uni?.color ?? null,
      logoUrl: uni?.logoUrl ?? null,
      hasContest: Boolean(uni?.contest),
      missing: !uni,
      avgXp: row.students > 0 ? Math.round(row.xp / row.students) : 0,
    };
  });

  res.json({ ...stats, byUniversity, activeSinceDate: cutoff });
});

/// How much of the log points at content that no longer exists — what the
/// "tidy up" button needs to know before it offers itself.
router.get('/analytics/stale', (req, res) => {
  const live = new Set(content.getContent().modules.flatMap(m => m.lessons.map(l => l.id)));
  const stale = events.eventLessonIds().filter(id => !live.has(id));
  res.json({ staleLessonIds: stale, staleCount: stale.length });
});

/// Forgets analytics. `?scope=stale` drops only the rows whose lesson has
/// been deleted — the seed and throwaway lessons whose ids still haunt the
/// funnel. `?scope=all` empties the log. Irreversible either way, which is
/// why the admin panel asks first.
router.delete('/analytics/events', async (req, res, next) => {
  try {
    const scope = String(req.query.scope || 'stale');
    if (scope === 'all') return res.json(await events.purgeEvents());
    const live = new Set(content.getContent().modules.flatMap(m => m.lessons.map(l => l.id)));
    res.json(await events.purgeEvents(live));
  } catch (err) { next(err); }
});

/// Who is using the app right now.
///
/// Presence lives in memory (presence.js), so this is a snapshot of the last
/// couple of minutes rather than a queryable history — and it resets when
/// the server restarts, which the panel says out loud rather than showing a
/// suspicious zero.
router.get('/users/online', (req, res) => {
  const ids = presence.onlineIds();
  const byId = new Map(db.listUsers().map(u => [u.id, u]));
  const now = Date.now();

  const users = ids
    // An id with no account is someone deleted mid-session; drop it rather
    // than rendering a ghost row.
    .filter(id => byId.has(id))
    .map(id => {
      const u = byId.get(id);
      const seenAt = presence.lastSeen(id);
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        avatar: u.avatar,
        xp: u.state?.lifetimeXp ?? u.state?.xp ?? 0,
        streak: u.state?.streak ?? 0,
        uniId: u.state?.uniId ?? null,
        uniRole: u.state?.uniRole ?? null,
        secondsAgo: seenAt ? Math.max(0, Math.round((now - seenAt) / 1000)) : null,
      };
    });

  res.json({
    users,
    count: users.length,
    windowSeconds: Math.round(presence.ONLINE_WINDOW_MS / 1000),
    // Uptime lets the panel explain an empty list right after a deploy.
    serverUptimeSeconds: Math.round(process.uptime()),
  });
});

// ── Users (Analytics → Колдонуучулар) ───────────────────────────────────
//
// A safe projection of each user record for the admin's monitoring/cleanup
// list — passwordHash and googleSub never leave this endpoint.
router.get('/users', (req, res) => {
  const list = db.listActiveUsers().map(u => ({
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
