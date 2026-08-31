// admin-api/redeem.test.mjs — regression test for the daily prize-cap race
// condition in POST /u/me/redeem (see db.js#reserveRedemptionSlot).
//
//   node --test admin-api/redeem.test.mjs
//
// Boots the real Express app against a temp data dir on a random port, same
// harness as googleRoute.test.mjs. The cap check and the redemption-slot
// reservation must happen in one synchronous step (no `await` in between) —
// this test proves that under real concurrency, not just by reading the
// code: it fires far more simultaneous redemptions than the cap allows and
// asserts the cap is never exceeded, no matter how the requests interleave.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const DATA_DIR = path.join(import.meta.dirname, 'data');
const CAP = 3;
const CONCURRENCY = 20; // >> CAP on purpose — the whole point is over-subscription

let server, base;
let db, content, signAccessToken;
let originalDailyPrizeCap, partner, prize;

before(async () => {
  fs.rmSync(path.join(DATA_DIR, 'db.json'), { force: true });

  process.env.JWT_SECRET = 'test-secret-for-redeem-tests';
  process.env.ADMIN_PASSWORD = 'test-admin-password';
  process.env.TRUST_PROXY_HOPS = '0';
  process.env.NODE_ENV = 'test';

  const { default: app } = await import('./server.js');
  db = await import('./db.js');
  content = await import('./contentStore.js');
  ({ signAccessToken } = await import('./auth.js'));

  server = app.listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}/admin/api`;

  // Content (partners/prizes/limits) lives in the real content.json, not
  // the throwaway db.json — add a scratch partner+prize and drop the cap
  // to CAP, then restore everything in after() rather than touching the
  // file wholesale.
  originalDailyPrizeCap = content.getLimits().dailyPrizeCap;
  partner = await content.addPartner({
    name: { ky: 'Test Partner', ru: 'Test Partner', en: 'Test Partner' },
    logoUrl: null,
  });
  prize = await content.addPrize({
    partnerId: partner.id,
    title: { ky: 'Test Prize', ru: 'Test Prize', en: 'Test Prize' },
    description: { ky: '-', ru: '-', en: '-' },
    photoUrl: null,
    priceCoins: 10,
  });
  await content.setLimits({ dailyPrizeCap: CAP });
});

after(async () => {
  await content.deletePartner(partner.id); // cascades: also removes `prize`
  await content.setLimits({ dailyPrizeCap: originalDailyPrizeCap });
  server?.close();
});

test(`exactly ${CAP} of ${CONCURRENCY} concurrent redemptions succeed when the daily cap is ${CAP}`, async () => {
  // A distinct user per request — many different learners racing for the
  // same limited daily prize pool, which is the actual shape of the bug
  // this guards against (not one user replaying the same request).
  const tokens = [];
  for (let i = 0; i < CONCURRENCY; i++) {
    const user = {
      id: randomUUID(),
      name: `racer-${i}`,
      email: `racer-${i}@redeem-test.local`,
      avatar: '🦅',
      passwordHash: null,
      state: {
        xp: 0, coins: 1000, streak: 0, lessonsToday: 0, energyDate: null,
        bonusEnergyToday: 0, completedLessons: [], achievements: [], ownedShop: [],
        settings: { sound: true, animations: true }, lastActiveDate: null,
        hasStreakShield: false, hasXpBoost: false, vipBadge: false, pushSubscriptions: [],
      },
    };
    await db.insertUser(user);
    tokens.push(signAccessToken(user.id));
  }

  const results = await Promise.all(tokens.map(token =>
    fetch(`${base}/u/me/redeem`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ prizeId: prize.id }),
    }).then(r => r.status)
  ));

  const succeeded = results.filter(s => s === 201).length;
  const rejected = results.filter(s => s === 403).length;

  assert.equal(succeeded, CAP, `expected exactly ${CAP} redemptions to succeed, got ${succeeded} (statuses: ${results.join(',')})`);
  assert.equal(rejected, CONCURRENCY - CAP, 'every request past the cap must be rejected with 403, not silently dropped');

  // And the cap held in the store itself, not just in the HTTP responses —
  // guards against a variant bug where the count check races but the
  // response codes happen to still look right.
  const persisted = db.listRedemptions().filter(r => r.prizeId === prize.id).length;
  assert.equal(persisted, CAP, 'the number of redemption records actually persisted must match the cap');
});
