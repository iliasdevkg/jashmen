// admin-api/cronRoutes.js — endpoints meant to be called by a scheduler,
// not a logged-in user or admin. Protected by CRON_SECRET (Vercel's own
// convention: it auto-injects `Authorization: Bearer $CRON_SECRET` on
// requests it makes to paths listed in vercel.json's `crons`, once
// CRON_SECRET is set as a project env var — nothing else to wire up
// there). Locally, hit it yourself with the same header to test.

import { Router } from 'express';
import { sendStreakReminders } from './push.js';

const router = Router();

function verifyCron(req, res, next) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return res.status(503).json({ error: 'CRON_SECRET катталган эмес' });
  if (req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Уруксат жок' });
  }
  next();
}

router.get('/streak-reminders', verifyCron, async (req, res, next) => {
  try {
    res.json(await sendStreakReminders());
  } catch (err) { next(err); }
});

export default router;
