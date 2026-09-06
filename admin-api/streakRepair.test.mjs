// admin-api/streakRepair.test.mjs — what happens to a streak when a day is
// missed, and the one chance to buy it back.
//
//   node --test admin-api/streakRepair.test.mjs
//
// The rules being pinned down: a missed day ends the run at 0 rather than
// silently restarting it at 1, the lost number is stashed for exactly the
// day it was lost on, the repair is paid for in energy from the same pool
// lessons come out of, and the shop's permanent shield still short-circuits
// the whole thing for anyone who bought it.
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
const BACKUP = path.join(os.tmpdir(), `jashmen-streak-backup-${process.pid}`);

let server, base;
let db, content, signAccessToken;
let originalLimits;

const DAY = 86_400_000;
const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
const today = () => iso(Date.now());
const daysAgo = (n) => iso(Date.now() - n * DAY);

/** A signed-in user whose streak history is whatever the test needs. */
async function makeUser({ streak = 0, lastActiveDate = null, ...state } = {}) {
  const user = {
    id: randomUUID(),
    name: 'Streak',
    email: `streak-${randomUUID().slice(0, 8)}@example.com`,
    avatar: '🔥',
    passwordHash: null,
    state: {
      xp: 0, uniXp: 0, lifetimeXp: 0, coins: 50,
      streak,
      lessonsToday: 0, energyDate: null, energyPeriod: null, bonusEnergyToday: 0,
      energyGivenToday: 0, supportEnergyToday: 0, energySpentToday: 0,
      supportGivenPeriod: null,
      uniId: null, uniRole: null, uniJoinedAt: null,
      completedLessons: [], achievements: [], ownedShop: [],
      settings: { sound: true, animations: true },
      lastActiveDate,
      activeDays: lastActiveDate ? [lastActiveDate] : [],
      streakLost: null, streakLostAt: null,
      hasStreakShield: false, hasXpBoost: false, vipBadge: false,
      pushSubscriptions: [],
      ...state,
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

before(async () => {
  if (fs.existsSync(DATA_DIR)) fs.cpSync(DATA_DIR, BACKUP, { recursive: true });
  fs.rmSync(path.join(DATA_DIR, 'db.json'), { force: true });

  process.env.JWT_SECRET = 'test-secret-for-streak-tests';
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
  await content.setLimits({
    dailyFreeLessons: 3, energyRefillHours: 24, streakRepairEnergy: 1,
  });
});

after(async () => {
  if (originalLimits) await content.setLimits(originalLimits);
  server?.close();
  if (fs.existsSync(BACKUP)) {
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
    fs.cpSync(BACKUP, DATA_DIR, { recursive: true });
    fs.rmSync(BACKUP, { recursive: true, force: true });
  }
});

// ── The claim ────────────────────────────────────────────────────────────

test('an unbroken run keeps counting up', async () => {
  const { token } = await makeUser({ streak: 6, lastActiveDate: daysAgo(1) });

  const body = await (await call('POST', '/u/me/daily', { token })).json();
  assert.equal(body.streak, 7);
  assert.equal(body.streakIncreased, true);
  assert.equal(body.streakRepair, null, 'nothing was lost, so nothing to sell');
});

test('a missed day ends the run at 0 and offers it back', async () => {
  const { token } = await makeUser({ streak: 12, lastActiveDate: daysAgo(3) });

  const body = await (await call('POST', '/u/me/daily', { token })).json();
  assert.equal(body.streak, 0, 'the run is over — today is not day one');
  assert.equal(body.streakIncreased, false);
  assert.deepEqual(body.streakRepair, { lost: 12, cost: 1 });
  assert.equal(body.user.state.streakLostAt, today());
});

test('the shop shield still absorbs the gap and sells nothing', async () => {
  const { token } = await makeUser({
    streak: 9, lastActiveDate: daysAgo(4), hasStreakShield: true,
  });

  const body = await (await call('POST', '/u/me/daily', { token })).json();
  assert.equal(body.streak, 9, 'the shield holds the number where it was');
  assert.equal(body.streakRepair, null);
  assert.equal(body.user.state.streakLost, null);
});

test('a first-ever claim starts at 1 and offers nothing', async () => {
  const { token } = await makeUser({ streak: 0, lastActiveDate: null });

  const body = await (await call('POST', '/u/me/daily', { token })).json();
  assert.equal(body.streak, 1);
  assert.equal(body.streakRepair, null);
});

test('the day after a loss the run restarts at 1 and the offer expires', async () => {
  const { token } = await makeUser({
    streak: 0,
    lastActiveDate: daysAgo(1),
    streakLost: 20,
    streakLostAt: daysAgo(1),
  });

  const body = await (await call('POST', '/u/me/daily', { token })).json();
  assert.equal(body.streak, 1, 'counting again from today');
  assert.equal(body.streakRepair, null, 'yesterday’s offer is gone');
  assert.equal(body.user.state.streakLost, null);

  const res = await call('POST', '/u/me/streak/repair', { token });
  assert.equal(res.status, 400, 'and the endpoint agrees');
});

// ── The repair ───────────────────────────────────────────────────────────

test('repairing restores the run and costs energy', async () => {
  const { user, token } = await makeUser({
    streak: 0,
    lastActiveDate: today(),
    streakLost: 15,
    streakLostAt: today(),
  });

  const res = await call('POST', '/u/me/streak/repair', { token });
  assert.equal(res.status, 200);
  const body = await res.json();

  assert.equal(body.streak, 16, 'the lost run plus today');
  assert.equal(body.spent, 1);
  assert.equal(body.user.state.streakLost, null);
  assert.equal(body.user.state.streakLostAt, null);
  // Paid out of the lesson pool, but counted apart from it so "lessons
  // today" stays an honest number.
  assert.equal(body.user.state.energySpentToday, 1);
  assert.equal(body.user.state.lessonsToday, 0);

  assert.equal(db.findUserById(user.id).state.streak, 16, 'and it persisted');
});

test('a second repair on the same day has nothing left to sell', async () => {
  const { token } = await makeUser({
    streak: 0, lastActiveDate: today(), streakLost: 4, streakLostAt: today(),
  });

  assert.equal((await call('POST', '/u/me/streak/repair', { token })).status, 200);
  const again = await call('POST', '/u/me/streak/repair', { token });
  assert.equal(again.status, 400);
});

test('an empty energy bar blocks the repair and keeps the run at 0', async () => {
  const { user, token } = await makeUser({
    streak: 0,
    lastActiveDate: today(),
    streakLost: 8,
    streakLostAt: today(),
    // Exactly the whole allowance already spent on lessons.
    lessonsToday: 3,
    energyDate: today(),
    energyPeriod: Math.floor(Date.now() / DAY),
  });

  const res = await call('POST', '/u/me/streak/repair', { token });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.match(body.error, /Энергия/);
  assert.ok(body.resetInMs > 0, 'and says when energy comes back');

  const after = db.findUserById(user.id).state;
  assert.equal(after.streak, 0, 'nothing changed');
  assert.equal(after.streakLost, 8, 'the offer survives for another try today');
});

test('a price the admin raised is the price charged', async () => {
  await content.setLimits({ streakRepairEnergy: 3 });
  try {
    const { token } = await makeUser({
      streak: 0, lastActiveDate: today(), streakLost: 5, streakLostAt: today(),
    });

    const body = await (await call('POST', '/u/me/streak/repair', { token })).json();
    assert.equal(body.spent, 3);
    assert.equal(body.user.state.energySpentToday, 3);
  } finally {
    await content.setLimits({ streakRepairEnergy: 1 });
  }
});

test('a price of 0 switches the whole offer off', async () => {
  await content.setLimits({ streakRepairEnergy: 0 });
  try {
    const { token } = await makeUser({ streak: 11, lastActiveDate: daysAgo(2) });

    const claim = await (await call('POST', '/u/me/daily', { token })).json();
    assert.equal(claim.streak, 0, 'the run still ends');
    assert.equal(claim.streakRepair, null, 'but there is nothing to buy');

    const res = await call('POST', '/u/me/streak/repair', { token });
    assert.equal(res.status, 400);
  } finally {
    await content.setLimits({ streakRepairEnergy: 1 });
  }
});

test('the repair needs a session', async () => {
  const res = await call('POST', '/u/me/streak/repair');
  assert.equal(res.status, 401);
});

// ── The admin knob ───────────────────────────────────────────────────────

test('the admin panel accepts the price and clamps it', async () => {
  const login = await fetch(`${base}/admin/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password: 'test-admin-password' }),
  });
  const { token: adminToken } = await login.json();

  const put = (value) => fetch(`${base}/admin/limits`, {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ streakRepairEnergy: value }),
  });

  let limits = await (await put(4)).json();
  assert.equal(limits.streakRepairEnergy, 4);

  limits = await (await put(999)).json();
  assert.equal(limits.streakRepairEnergy, 10, 'clamped to a day it can be paid in');

  limits = await (await put(0)).json();
  assert.equal(limits.streakRepairEnergy, 0, '0 is a real choice — the offer off');

  await content.setLimits({ streakRepairEnergy: 1 });
});
