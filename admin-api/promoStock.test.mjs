// admin-api/promoStock.test.mjs — promo codes as inventory.
//
//   node --test admin-api/promoStock.test.mjs
//
// The rules being pinned down: one code per sale and never the same one
// twice, a pool that empties stops the shop rather than handing out blanks,
// a prize that never had codes still sells the way it always did, the codes
// themselves never reach an unauthenticated caller, and a sale refused
// after the code was taken puts it back.
//
// Boots the real Express app against the real data dir on a random port
// (same harness as uniSupport.test.mjs), backing the dir up first so a
// dev's local db.json survives the run.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const DATA_DIR = path.join(import.meta.dirname, 'data');
const BACKUP = path.join(os.tmpdir(), `jashmen-promo-backup-${process.pid}`);

let server, base;
let db, content, signAccessToken;
let originalLimits, partnerId;
const madePrizes = [];

async function makePrize({ promoCodes = [], priceCoins = 10 } = {}) {
  const prize = await content.addPrize({
    partnerId,
    title: { ky: `Сыйлык ${randomUUID().slice(0, 4)}` },
    priceCoins,
    promoCodes,
  });
  madePrizes.push(prize.id);
  return prize;
}

async function makeUser({ coins = 1000 } = {}) {
  const user = {
    id: randomUUID(),
    name: 'Promo',
    email: `promo-${randomUUID().slice(0, 8)}@example.com`,
    avatar: '🎁',
    passwordHash: null,
    state: {
      xp: 0, uniXp: 0, lifetimeXp: 0, coins,
      streak: 0, lessonsToday: 0, energyDate: null, energyPeriod: null,
      bonusEnergyToday: 0, energyGivenToday: 0, supportEnergyToday: 0,
      energySpentToday: 0, supportGivenPeriod: null,
      uniId: null, uniRole: null, uniJoinedAt: null,
      completedLessons: [], achievements: [], ownedShop: [],
      settings: { sound: true, animations: true },
      lastActiveDate: null, activeDays: [],
      streakLost: null, streakLostAt: null,
      hasStreakShield: false, hasXpBoost: false, vipBadge: false,
      pushSubscriptions: [],
    },
  };
  await db.insertUser(user);
  return { user, token: signAccessToken(user.id) };
}

const call = (method, p, { token, body } = {}) =>
  fetch(`${base}${p}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const redeem = (token, prizeId) => call('POST', '/u/me/redeem', { token, body: { prizeId } });

before(async () => {
  if (fs.existsSync(DATA_DIR)) fs.cpSync(DATA_DIR, BACKUP, { recursive: true });
  fs.rmSync(path.join(DATA_DIR, 'db.json'), { force: true });

  process.env.JWT_SECRET = 'test-secret-for-promo-tests';
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

  originalLimits = { ...content.getLimits() };

  const partner = await content.addPartner({ name: { ky: 'Тест өнөктөш' } });
  partnerId = partner.id;
});

after(async () => {
  for (const id of madePrizes) await content.deletePrize(id).catch(() => {});
  if (partnerId) await content.deletePartner(partnerId).catch(() => {});
  if (originalLimits) await content.setLimits(originalLimits);
  server?.close();
  if (fs.existsSync(BACKUP)) {
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
    fs.cpSync(BACKUP, DATA_DIR, { recursive: true });
    fs.rmSync(BACKUP, { recursive: true, force: true });
  }
});

// ── Normalising a pool ───────────────────────────────────────────────────

test('a pasted block becomes a deduplicated, upper-case pool', () => {
  const pool = content.normalizePromoCodes('mbank-1\n mbank-2 \nMBANK-1\n\n mbank-3;mbank-2');
  assert.deepEqual(pool, ['MBANK-1', 'MBANK-2', 'MBANK-3']);
});

test('one plain string is a pool of one', () => {
  assert.deepEqual(content.normalizePromoCodes('kофе 20'), ['KОФЕ20']);
  assert.deepEqual(content.normalizePromoCodes(''), []);
  assert.deepEqual(content.normalizePromoCodes(null), []);
});

test('a prize with no codes is unlimited, not sold out', () => {
  const stock = content.prizeStock({ promoCodes: [], codesUsed: 0 });
  assert.deepEqual(stock, { left: 0, used: 0, unlimited: true, soldOut: false });
});

test('an emptied pool is sold out', () => {
  const stock = content.prizeStock({ promoCodes: [], codesUsed: 3 });
  assert.deepEqual(stock, { left: 0, used: 3, unlimited: false, soldOut: true });
});

// ── Selling ──────────────────────────────────────────────────────────────

test('each sale takes the next code and never repeats one', async () => {
  const prize = await makePrize({ promoCodes: ['A-1', 'A-2', 'A-3'] });
  const { token } = await makeUser();

  const handed = [];
  for (let i = 0; i < 3; i++) {
    const res = await redeem(token, prize.id);
    assert.equal(res.status, 201);
    const body = await res.json();
    handed.push(body.promoCode);
  }

  assert.deepEqual(handed, ['A-1', 'A-2', 'A-3'], 'in order, front of the queue first');
  assert.equal(new Set(handed).size, 3, 'and never the same string twice');

  const after = content.findPrize(prize.id);
  assert.deepEqual(after.promoCodes, [], 'the pool is empty');
  assert.equal(after.codesUsed, 3);
});

test('an empty pool refuses the sale and keeps the coins', async () => {
  const prize = await makePrize({ promoCodes: ['B-1'], priceCoins: 40 });
  const { user, token } = await makeUser({ coins: 500 });

  assert.equal((await redeem(token, prize.id)).status, 201);
  assert.equal(db.findUserById(user.id).state.coins, 460);

  const res = await redeem(token, prize.id);
  assert.equal(res.status, 409);
  assert.match((await res.json()).error, /түгөндү/);
  assert.equal(db.findUserById(user.id).state.coins, 460, 'nothing was charged');
});

test('a prize with no codes still sells, with no partner code', async () => {
  const prize = await makePrize({ promoCodes: [] });
  const { token } = await makeUser();

  for (let i = 0; i < 3; i++) {
    const res = await redeem(token, prize.id);
    assert.equal(res.status, 201, 'unlimited — nothing to run out of');
    assert.equal((await res.json()).promoCode, null);
  }
  assert.equal(content.findPrize(prize.id).codesUsed, 0);
});

test('concurrent buyers never share a code', async () => {
  const prize = await makePrize({ promoCodes: ['C-1', 'C-2', 'C-3', 'C-4'] });
  const buyers = await Promise.all([1, 2, 3, 4, 5, 6].map(() => makeUser()));

  const results = await Promise.all(buyers.map(b => redeem(b.token, prize.id)));
  const ok = results.filter(r => r.status === 201);
  const gone = results.filter(r => r.status === 409);

  assert.equal(ok.length, 4, 'exactly as many sales as there were codes');
  assert.equal(gone.length, 2);

  const codes = await Promise.all(ok.map(async r => (await r.json()).promoCode));
  assert.equal(new Set(codes).size, 4, 'four buyers, four different codes');
});

test('the coupon keeps the code it was handed after the pool is edited', async () => {
  const prize = await makePrize({ promoCodes: ['D-OLD'] });
  const { user, token } = await makeUser();

  const handed = (await (await redeem(token, prize.id)).json()).promoCode;
  assert.equal(handed, 'D-OLD');

  await content.updatePrize(prize.id, { promoCodes: ['D-NEW-1', 'D-NEW-2'] });

  const mine = await (await call('GET', '/u/me/redemptions', { token })).json();
  const row = mine.find(r => r.promoCode === 'D-OLD');
  assert.ok(row, 'the learner still holds the string they were actually given');
  assert.equal(db.findUserById(user.id).id, user.id);
});

// ── What the public endpoint may say ─────────────────────────────────────

test('/public/content ships the count, never the codes', async () => {
  const prize = await makePrize({ promoCodes: ['E-1', 'E-2'] });

  const body = await (await call('GET', '/public/content')).json();
  const shipped = body.prizes.find(p => p.id === prize.id);

  assert.equal(shipped.stockLeft, 2);
  assert.equal(shipped.soldOut, false);
  assert.equal(shipped.promoCodes, undefined);
  assert.equal(shipped.codesUsed, undefined);
  assert.ok(!JSON.stringify(body).includes('E-1'), 'no code anywhere in the payload');
});

test('/public/content marks an emptied prize sold out and an uncoded one unlimited', async () => {
  const limited = await makePrize({ promoCodes: ['F-1'] });
  const open = await makePrize({ promoCodes: [] });
  const { token } = await makeUser();
  await redeem(token, limited.id);

  const body = await (await call('GET', '/public/content')).json();
  const soldOut = body.prizes.find(p => p.id === limited.id);
  const unlimited = body.prizes.find(p => p.id === open.id);

  assert.equal(soldOut.soldOut, true);
  assert.equal(soldOut.stockLeft, 0);
  assert.equal(unlimited.soldOut, false);
  assert.equal(unlimited.stockLeft, null, 'null means "no stock to speak of"');
});

// ── Editing a pool ───────────────────────────────────────────────────────

test('updatePrize replaces the pool but never rewrites the tally', async () => {
  const prize = await makePrize({ promoCodes: ['G-1', 'G-2'] });
  const { token } = await makeUser();
  await redeem(token, prize.id);

  await content.updatePrize(prize.id, { promoCodes: ['G-9'], codesUsed: 999 });
  const after = content.findPrize(prize.id);

  assert.deepEqual(after.promoCodes, ['G-9'], 'topped up');
  assert.equal(after.codesUsed, 1, 'the tally is what happened, not what was sent');
  assert.equal(after.promoCode, undefined, 'the old single-code field is gone');
});

test('an omitted pool leaves the codes alone', async () => {
  const prize = await makePrize({ promoCodes: ['H-1', 'H-2'] });
  await content.updatePrize(prize.id, { priceCoins: 55 });
  const after = content.findPrize(prize.id);
  assert.deepEqual(after.promoCodes, ['H-1', 'H-2']);
  assert.equal(after.priceCoins, 55);
});

// ── Nothing outside the pool limits a sale any more ──────────────────────

test('a prize with codes left sells however many times a day it is asked', async () => {
  // There used to be a house-wide "N prizes a day" ceiling that could
  // refuse a sale while the prize still had stock. It is gone
  // (db.js#addRedemption): the pool is the only limit now, so a busy day
  // sells everything the partner supplied and not one coupon more.
  const prize = await makePrize({ promoCodes: ['I-1', 'I-2', 'I-3'] });
  const { token } = await makeUser();

  for (const expected of ['I-1', 'I-2', 'I-3']) {
    const res = await redeem(token, prize.id);
    assert.equal(res.status, 201, 'stock left means the sale goes through');
    assert.equal((await res.json()).promoCode, expected);
  }

  const res = await redeem(token, prize.id);
  assert.equal(res.status, 409, 'and the pool, not a daily ceiling, is what stops it');
  assert.match((await res.json()).error, /түгөндү/);
});

// ── Analytics ────────────────────────────────────────────────────────────

test('the analytics endpoint buckets sales and reports the stock', async () => {
  const login = await fetch(`${base}/admin/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password: 'test-admin-password' }),
  });
  const { token: adminToken } = await login.json();

  const prize = await makePrize({ promoCodes: ['J-1', 'J-2', 'J-3'] });
  const { token } = await makeUser();
  await redeem(token, prize.id);
  await redeem(token, prize.id);

  const res = await fetch(`${base}/admin/analytics/prizes?bucket=day`, {
    headers: { authorization: `Bearer ${adminToken}` },
  });
  assert.equal(res.status, 200);
  const body = await res.json();

  assert.equal(body.bucket, 'day');
  assert.ok(body.total >= 2);
  assert.ok(Array.isArray(body.series) && body.series.length >= 1);
  assert.equal(body.series.reduce((a, s) => a + s.count, 0), body.total,
    'the chart adds up to the headline number');

  const row = body.byPrize.find(r => r.prizeId === prize.id);
  assert.equal(row.sold, 2);
  assert.equal(row.left, 1, 'one code still on the shelf');
  assert.equal(row.unlimited, false);
  assert.equal(row.soldOut, false);
});

test('every bucket size is accepted and a bad one falls back to day', async () => {
  const login = await fetch(`${base}/admin/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password: 'test-admin-password' }),
  });
  const { token: adminToken } = await login.json();
  const get = (qs) => fetch(`${base}/admin/analytics/prizes?${qs}`, {
    headers: { authorization: `Bearer ${adminToken}` },
  }).then(r => r.json());

  for (const bucket of ['day', 'week', 'month', 'year']) {
    const body = await get(`bucket=${bucket}`);
    assert.equal(body.bucket, bucket);
    assert.ok(body.series.length >= 1, `${bucket} produced no buckets`);
  }
  assert.equal((await get('bucket=decade')).bucket, 'day');
});

test('a custom range narrows the result, and a backwards one is straightened', async () => {
  const login = await fetch(`${base}/admin/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password: 'test-admin-password' }),
  });
  const { token: adminToken } = await login.json();
  const get = (qs) => fetch(`${base}/admin/analytics/prizes?${qs}`, {
    headers: { authorization: `Bearer ${adminToken}` },
  }).then(r => r.json());

  // A window that closed before anything was sold.
  const empty = await get('from=2001-01-01&to=2001-01-07');
  assert.equal(empty.total, 0);
  assert.equal(empty.series.length, 7, 'quiet days are still drawn');

  const flipped = await get('from=2001-01-07&to=2001-01-01');
  assert.equal(flipped.from, '2001-01-01');
  assert.equal(flipped.to, '2001-01-07');
});

test('analytics needs an admin session', async () => {
  const res = await fetch(`${base}/admin/analytics/prizes`);
  assert.equal(res.status, 401);
});
