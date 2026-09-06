// admin-api/accountDeletion.test.mjs — the erasure both stores require.
//
//   node --test admin-api/accountDeletion.test.mjs
//
// App Store 5.1.1(v) and Play's "Data deletion" both say an app that can
// create an account must be able to destroy one, from inside the app. This
// file pins the two halves of that promise:
//
//   · nothing identifying survives — no address to write to, no name, no
//     picture, no way to sign back in, no session still working
//   · the campus total does not move, because a season a sponsor was shown
//     must not quietly rewrite itself when a student leaves
//
// And the guard in front of it: the one way this goes badly wrong is a
// borrowed phone, so deletion is never one tap.

import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DATA_DIR = path.join(import.meta.dirname, 'data');
const BACKUP = path.join(os.tmpdir(), `jashmen-del-backup-${process.pid}`);

let server, base, db, content, uniId;

const signup = async (name, email) => {
  const res = await fetch(`${base}/u/signup`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, email, password: 'Passw0rd!1' }),
  });
  return res.json();
};

const del = (token, body) =>
  fetch(`${base}/u/me`, {
    method: 'DELETE',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify(body || {}),
  });

before(async () => {
  if (fs.existsSync(DATA_DIR)) fs.cpSync(DATA_DIR, BACKUP, { recursive: true });
  fs.rmSync(path.join(DATA_DIR, 'db.json'), { force: true });

  process.env.JWT_SECRET = 'test-secret-for-deletion-tests';
  process.env.ADMIN_PASSWORD = 'test-admin-password';
  process.env.TRUST_PROXY_HOPS = '0';
  // Every test here signs up from 127.0.0.1, so the production allowance
  // (10/hour) would turn the suite away halfway through and the failures
  // would look like deletion bugs. The brake itself is covered by the
  // limiter's own tests.
  process.env.SIGNUP_RATE_LIMIT = '200';
  process.env.NODE_ENV = 'test';

  const { default: app } = await import('./server.js');
  db = await import('./db.js');
  content = await import('./contentStore.js');

  server = app.listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}/admin/api`;

  uniId = content.getContent().universities?.[0]?.id || null;
});

after(() => {
  server?.close();
  if (fs.existsSync(BACKUP)) {
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
    fs.cpSync(BACKUP, DATA_DIR, { recursive: true });
    fs.rmSync(BACKUP, { recursive: true, force: true });
  }
});

let me;
beforeEach(async () => {
  me = await signup('Тест Колдонуучу', `del.${Date.now()}.${Math.random().toString(36).slice(2)}@example.kg`);
});

// ── Nothing identifying survives ─────────────────────────────────────────

test('everything that names a person is destroyed', async () => {
  const before = db.findUserById(me.user.id);
  assert.ok(before.email && before.name && before.passwordHash, 'the fixture is a real account');

  const res = await del(me.token, { password: 'Passw0rd!1' });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { deleted: true });

  const row = db.findUserById(me.user.id);
  assert.equal(row.email, null, 'no address to write to');
  assert.equal(row.avatar, null);
  assert.equal(row.avatarUrl, null);
  assert.equal(row.passwordHash, null, 'no password to sign in with');
  assert.equal(row.googleSub, null);
  assert.equal(row.appleSub, null);
  assert.ok(row.deletedAt, 'and it is marked gone');
  assert.ok(!/тест|колдонуучу\s/i.test(row.name) || row.name === 'Өчүрүлгөн колдонуучу',
    'the name is a label, not a person');
});

test('the learning history goes with it', async () => {
  const user = db.findUserById(me.user.id);
  user.state.completedLessons = ['l1', 'l2'];
  user.state.achievements = ['first_lesson'];
  user.state.coins = 500;
  await db.saveUser(user);

  await del(me.token, { password: 'Passw0rd!1' });

  const row = db.findUserById(me.user.id);
  assert.deepEqual(row.state.completedLessons, [], 'which lessons someone struggled with is personal');
  assert.deepEqual(row.state.achievements, []);
  assert.equal(row.state.coins, 0);
});

test('the email is freed, so the same person can start over', async () => {
  const email = db.findUserById(me.user.id).email;
  await del(me.token, { password: 'Passw0rd!1' });

  const again = await signup('Кайра келген', email);
  assert.ok(again.token, 'signing up with that address works again');
  assert.notEqual(again.user.id, me.user.id, 'and it is a genuinely new account');
});

test('every session dies with the account', async () => {
  await del(me.token, { password: 'Passw0rd!1' });
  const res = await fetch(`${base}/u/me`, { headers: { authorization: `Bearer ${me.token}` } });
  assert.ok([401, 410].includes(res.status), 'the token in hand stops working');
});

// ── What survives, and why ───────────────────────────────────────────────

test('the campus total does not move when a student leaves', async () => {
  if (!uniId) return; // no seeded campus in this store

  const user = db.findUserById(me.user.id);
  user.state.uniId = uniId;
  user.state.uniRole = 'student';
  user.state.uniXp = 7341;
  await db.saveUser(user);

  const board = () =>
    fetch(`${base}/u/university/${uniId}/board`, {
      headers: { authorization: `Bearer ${me.token}` },
    }).then(r => r.json());

  const before = await board();
  assert.ok(before.totalXp >= 7341, 'the fixture is on the board');

  await del(me.token, { password: 'Passw0rd!1' });

  // A fresh account, only to be allowed to read the board.
  const reader = await signup('Окурман', `reader.${Date.now()}@example.kg`);
  const after = await fetch(`${base}/u/university/${uniId}/board`, {
    headers: { authorization: `Bearer ${reader.token}` },
  }).then(r => r.json());

  assert.equal(after.totalXp, before.totalXp,
    'a season the sponsor was shown must not rewrite itself');
  assert.ok(!after.students.some(st => st.id === me.user.id),
    'but the person is out of the table');
});

test('a deleted account is off the leaderboard and out of the headcount', async () => {
  const statsBefore = await (await fetch(`${base}/public/stats`)).json();

  await del(me.token, { password: 'Passw0rd!1' });

  const statsAfter = await (await fetch(`${base}/public/stats`)).json();
  assert.equal(statsAfter.learners, statsBefore.learners - 1, 'no longer a learner');
  assert.equal(statsAfter.xp, statsBefore.xp, 'the XP earned was still earned');

  const reader = await signup('Окурман2', `reader2.${Date.now()}@example.kg`);
  const board = await fetch(`${base}/u/leaderboard`, {
    headers: { authorization: `Bearer ${reader.token}` },
  }).then(r => r.json());
  assert.ok(!board.some(r => r.id === me.user.id));
});

test('a coupon keeps its count but loses its code and its owner', async () => {
  db.addRedemption({
    id: 'r-test', userId: me.user.id, userName: 'Тест Колдонуучу',
    prizeId: 'p1', code: 'JASHMEN-SECRET', partnerCode: 'MBANK-0001',
    date: '2026-09-01', ts: Date.now(),
  });

  await del(me.token, { password: 'Passw0rd!1' });

  const row = db.listRedemptions().find(r => r.id === 'r-test');
  assert.ok(row, 'the partner’s record that a prize went out stays');
  assert.equal(row.userId, null);
  assert.equal(row.userName, null);
  assert.equal(row.code, null, 'the code was the reward, and it left with them');
  assert.equal(row.partnerCode, null);
});

// ── The guard in front of it ─────────────────────────────────────────────

test('a wrong password deletes nothing', async () => {
  const res = await del(me.token, { password: 'not-my-password' });
  assert.equal(res.status, 403);
  assert.equal(db.findUserById(me.user.id).deletedAt, undefined,
    'the account is untouched');
});

test('no password at all deletes nothing', async () => {
  assert.equal((await del(me.token, {})).status, 403);
  assert.equal(db.findUserById(me.user.id).deletedAt, undefined);
});

test('an account with no password confirms by typing the word', async () => {
  // Exactly the shape Google and Apple sign-in leave behind.
  const user = db.findUserById(me.user.id);
  user.passwordHash = null;
  user.googleSub = 'google-123';
  await db.saveUser(user);

  assert.equal((await del(me.token, {})).status, 403, 'still not one tap');
  assert.equal((await del(me.token, { confirm: 'yes' })).status, 403, 'and not any word');

  const res = await del(me.token, { confirm: 'ӨЧҮР' });
  assert.equal(res.status, 200);
  assert.ok(db.findUserById(me.user.id).deletedAt);
});

test('deleting twice is refused rather than silently repeated', async () => {
  await del(me.token, { password: 'Passw0rd!1' });
  const again = await del(me.token, { password: 'Passw0rd!1' });
  assert.ok([401, 410].includes(again.status));
});

test('it needs a session at all', async () => {
  const res = await fetch(`${base}/u/me`, { method: 'DELETE' });
  assert.equal(res.status, 401);
});
