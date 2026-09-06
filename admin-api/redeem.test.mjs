// admin-api/redeem.test.mjs — the concurrency guarantee behind
// POST /u/me/redeem, and the admin's view of what it produced.
//
//   node --test admin-api/redeem.test.mjs
//
// A prize's promo codes are a finite pool a partner actually supplied, so
// over-drawing it hands somebody a coupon that does not exist. The stock
// check and the claim must happen in one synchronous step (no `await` in
// between, see routes.js) — this proves that under real concurrency rather
// than by reading the code: it fires far more simultaneous redemptions than
// there are codes and asserts the pool is never over-drawn, no matter how
// the requests interleave.
//
// This used to guard a house-wide daily cap instead. That cap is gone (see
// db.js#addRedemption); the race it protected against is the same one, and
// the pool is what it now protects.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const DATA_DIR = path.join(import.meta.dirname, 'data');
const CODES = 3;
const CONCURRENCY = 20; // >> CODES on purpose — the point is over-subscription

let server, base;
let db, content, signAccessToken, signAdminAccessToken;
let partner, prize;

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
  ({ signAdminAccessToken } = await import('./adminAuth.js'));

  server = app.listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}/admin/api`;

  // Content (partners/prizes) lives in the real content.json, not the
  // throwaway db.json — add a scratch partner + prize and remove them again
  // in after() rather than touching the file wholesale.
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
    // Exactly CODES of them, against CONCURRENCY simultaneous buyers.
    promoCodes: Array.from({ length: CODES }, (_, i) => `RACE-${i + 1}`),
  });
});

after(async () => {
  await content.deletePartner(partner.id); // cascades: also removes `prize`
  server?.close();
});

test(`exactly ${CODES} of ${CONCURRENCY} concurrent redemptions succeed when the prize holds ${CODES} codes`, async () => {
  // A distinct user per request — many different learners racing for the
  // same finite pool of partner codes, which is the actual shape of the bug
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
    }).then(async r => ({ status: r.status, promoCode: (await r.json()).promoCode }))
  ));

  const ok = results.filter(r => r.status === 201);
  const soldOut = results.filter(r => r.status === 409);

  assert.equal(ok.length, CODES,
    `expected exactly ${CODES} redemptions to succeed, got ${ok.length} (statuses: ${results.map(r => r.status).join(',')})`);
  assert.equal(soldOut.length, CONCURRENCY - CODES,
    'every request past the last code must be refused, not silently dropped');

  // Every winner got a DIFFERENT code. Counting successes alone would pass
  // a bug that hands the same string to two people.
  const handed = ok.map(r => r.promoCode);
  assert.equal(new Set(handed).size, CODES, `duplicate code handed out: ${handed.join(',')}`);
  assert.deepEqual([...handed].sort(), ['RACE-1', 'RACE-2', 'RACE-3']);

  // And it held in the store itself, not just in the HTTP responses —
  // guards against a variant where the check races but the response codes
  // happen to still look right.
  const persisted = db.listRedemptions().filter(r => r.prizeId === prize.id).length;
  assert.equal(persisted, CODES, 'the records actually persisted must match the codes spent');
  assert.deepEqual(content.findPrize(prize.id).promoCodes, [], 'the pool is empty');
  assert.equal(content.findPrize(prize.id).codesUsed, CODES);
});

// ── The operator's side of the same flow ────────────────────────────────
//
// Everything above proves a learner can redeem. These prove the person
// running the programme can then see the coupon and mark it handed over —
// which, until GET /admin/redemptions existed, was impossible: the code
// lived only on the learner's phone and in db.json.

const admin = (method, path, body) =>
  fetch(`${base}/admin${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${signAdminAccessToken()}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

test('the admin list returns every coupon, newest first, joined to learner and prize', async () => {
  const res = await admin('GET', '/redemptions');
  assert.equal(res.status, 200);
  const { redemptions, total } = await res.json();

  assert.equal(total, redemptions.length);
  assert.ok(total >= CODES, 'the coupons minted above must be listed');

  for (let i = 1; i < redemptions.length; i++) {
    assert.ok(redemptions[i - 1].ts >= redemptions[i].ts, 'newest first');
  }

  const mine = redemptions.filter(r => r.prize?.id === prize.id);
  assert.equal(mine.length, CODES, 'one row per coupon minted for the scratch prize');

  const row = mine[0];
  assert.match(row.code, /^JASHMEN-[0-9A-F]{8}$/);
  assert.equal(row.user.email.endsWith('@redeem-test.local'), true, 'the learner join resolves');
  assert.equal(row.partner.id, partner.id, 'the partner join resolves through the prize');
  assert.equal(row.fulfilledAt, null, 'a fresh coupon is unfulfilled');
  assert.equal(row.user.passwordHash, undefined, 'the learner projection never carries the hash');
});

test('a coupon can be marked handed over, and unmarked', async () => {
  const { redemptions } = await (await admin('GET', '/redemptions')).json();
  const target = redemptions.find(r => r.prize?.id === prize.id);

  let res = await admin('PATCH', `/redemptions/${target.id}`, { fulfilled: true });
  assert.equal(res.status, 200);
  const marked = await res.json();
  assert.ok(marked.fulfilledAt > 0, 'a timestamp, not a boolean — it answers "when"');

  const after = await (await admin('GET', '/redemptions')).json();
  assert.equal(after.redemptions.find(r => r.id === target.id).fulfilledAt, marked.fulfilledAt,
    'the mark survives a re-read, so it was persisted');

  res = await admin('PATCH', `/redemptions/${target.id}`, { fulfilled: false });
  assert.equal((await res.json()).fulfilledAt, null, 'and it can be taken back');
});

test('marking a coupon that does not exist is a 404, not a crash', async () => {
  const res = await admin('PATCH', `/redemptions/${randomUUID()}`, { fulfilled: true });
  assert.equal(res.status, 404);
});

test('a row whose prize was deleted still lists, with the prize side null', async () => {
  // The normal case, not an edge case: deletePrize is a hard delete with no
  // redemption check, and the coupon may already be in somebody's hand.
  const doomed = await content.addPrize({
    partnerId: partner.id,
    title: { ky: 'Doomed', ru: 'Doomed', en: 'Doomed' },
    description: { ky: '-', ru: '-', en: '-' },
    photoUrl: null,
    priceCoins: 1,
  });
  const user = {
    id: randomUUID(), name: 'orphan', email: `orphan-${randomUUID().slice(0, 6)}@redeem-test.local`,
    avatar: '🦅', passwordHash: null,
    state: {
      xp: 0, coins: 1000, streak: 0, lessonsToday: 0, energyDate: null,
      bonusEnergyToday: 0, completedLessons: [], achievements: [], ownedShop: [],
      settings: { sound: true, animations: true }, lastActiveDate: null,
      hasStreakShield: false, hasXpBoost: false, vipBadge: false, pushSubscriptions: [],
    },
  };
  await db.insertUser(user);
  const minted = await fetch(`${base}/u/me/redeem`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${signAccessToken(user.id)}` },
    body: JSON.stringify({ prizeId: doomed.id }),
  });
  assert.equal(minted.status, 201);
  const { code } = await minted.json();

  await content.deletePrize(doomed.id);
  await db.deleteUser(user.id);

  const { redemptions } = await (await admin('GET', '/redemptions')).json();
  const row = redemptions.find(r => r.code === code);
  assert.ok(row, 'the coupon is still listed after both sides of the join are gone');
  assert.equal(row.prize, null);
  assert.equal(row.partner, null);
  assert.equal(row.user, null);
  assert.equal(row.code, code, 'and the code itself — the only thing the partner holds — survives');
});

test('the redemptions list needs an admin token', async () => {
  const res = await fetch(`${base}/admin/redemptions`);
  assert.equal(res.status, 401);
});
