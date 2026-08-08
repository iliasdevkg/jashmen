// admin-api/push.js
//
// Real Web Push (the browser-native standard, RFC 8030 + VAPID) — not a
// third-party push SaaS, no account or SDK key needed beyond a VAPID key
// pair you generate yourself once with `npx web-push generate-vapid-keys`.
// This is what backs the manifest's "Умные ИИ-Push-уведомления (Поддержка
// Стрика)": remind a user before their streak burns out at midnight.

import webpush from 'web-push';
import * as db from './db.js';

const PUBLIC_KEY  = process.env.VAPID_PUBLIC_KEY || null;
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || null;
const SUBJECT      = process.env.VAPID_SUBJECT || 'mailto:admin@jashmen.app';

export const pushEnabled = !!(PUBLIC_KEY && PRIVATE_KEY);

if (pushEnabled) {
  webpush.setVapidDetails(SUBJECT, PUBLIC_KEY, PRIVATE_KEY);
} else {
  console.warn(
    '[push] VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY are not set — push\n' +
    '       notifications are disabled (subscribe silently no-ops). Run\n' +
    '       `npx web-push generate-vapid-keys` and put both in admin-api/.env.'
  );
}

export function getPublicKey() {
  return PUBLIC_KEY;
}

// Sends one push. `gone: true` means the subscription is dead (permission
// revoked, browser data cleared, endpoint expired) — the caller should
// drop it rather than keep retrying it forever.
export async function sendPush(subscription, payload) {
  if (!pushEnabled) return { ok: false, gone: false, reason: 'disabled' };
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    return { ok: true, gone: false };
  } catch (err) {
    const gone = err.statusCode === 404 || err.statusCode === 410;
    return { ok: false, gone, reason: err.message };
  }
}

function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

// The one campaign the manifest actually asks for: anyone with a streak to
// lose who hasn't played yet today gets reminded. Called both by the
// CRON_SECRET-protected route (admin-api/cronRoutes.js, for a real
// scheduled Vercel Cron) and the admin-triggered manual endpoint (so you
// can test it without waiting for midnight).
export async function sendStreakReminders() {
  const today = todayUTC();
  const candidates = db.listUsers().filter(u =>
    (u.state.streak || 0) > 0 &&
    u.state.lastActiveDate !== today &&
    (u.state.pushSubscriptions || []).length > 0
  );

  let sent = 0;
  let removedDead = 0;

  for (const user of candidates) {
    const survivors = [];
    for (const sub of user.state.pushSubscriptions) {
      const result = await sendPush(sub, {
        title: 'JashMen',
        body: `🔥 ${user.state.streak}-күндүк стригиң түн ортосунда бүтөт! Бир сабак өтүп кал.`,
        url: '/learn',
      });
      if (result.ok) { sent += 1; survivors.push(sub); }
      else if (!result.gone) survivors.push(sub); // transient failure — keep it, don't drop on one hiccup
      else removedDead += 1;
    }
    if (survivors.length !== user.state.pushSubscriptions.length) {
      user.state.pushSubscriptions = survivors;
      await db.saveUser(user);
    }
  }

  return { candidateUsers: candidates.length, sent, removedDead };
}
