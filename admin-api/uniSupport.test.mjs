// admin-api/uniSupport.test.mjs — the university league's server side:
// enrolment, the student board, viewer→student energy gifts, the supporter
// list, and self-serve password change.
//
//   node --test admin-api/uniSupport.test.mjs
//
// Boots the real Express app against the real data dir on a random port
// (same harness as redeem.test.mjs), backing the dir up first the way
// googleAuth.test.mjs does so a dev's local db.json survives the run.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const DATA_DIR = path.join(import.meta.dirname, 'data');
const BACKUP = path.join(os.tmpdir(), `jashmen-uni-backup-${process.pid}`);
const UNI = 'kstu';

let server, base;
let db, content, energy, signAccessToken, hashPassword;
let originalLimits;

/** A signed-in user with a full default-shaped state. */
async function makeUser({ name, role = 'student', xp = 0, password = null, uniId = UNI }) {
  // routes.js#awardXp: a campus student's points go to `uniXp`, everyone
  // else's to `xp`; `lifetimeXp` is the never-reset total behind both. The
  // caller passes one number and the fixture puts it where the app would.
  const competitor = Boolean(uniId) && role === 'student';
  const user = {
    id: randomUUID(),
    name,
    email: `${name.toLowerCase()}-${randomUUID().slice(0, 6)}@example.com`,
    avatar: '🦅',
    passwordHash: password ? await hashPassword(password) : null,
    state: {
      xp: competitor ? 0 : xp,
      uniXp: competitor ? xp : 0,
      lifetimeXp: xp,
      coins: 50, streak: 0,
      lessonsToday: 0, energyDate: null, energyPeriod: null, bonusEnergyToday: 0,
      energyGivenToday: 0, supportEnergyToday: 0, supportGivenPeriod: null,
      uniId, uniRole: role, uniJoinedAt: Date.now(),
      completedLessons: [], achievements: [], ownedShop: [],
      settings: { sound: true, animations: true },
      lastActiveDate: null, activeDays: [],
      hasStreakShield: false, hasXpBoost: false, vipBadge: false, pushSubscriptions: [],
    },
  };
  await db.insertUser(user);
  return { user, token: signAccessToken(user.id) };
}

const call = (method, path, { token, body } = {}) =>
  fetch(`${base}${path}`, {
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

  process.env.JWT_SECRET = 'test-secret-for-uni-tests';
  process.env.ADMIN_PASSWORD = 'test-admin-password';
  process.env.TRUST_PROXY_HOPS = '0';
  process.env.NODE_ENV = 'test';

  const { default: app } = await import('./server.js');
  db = await import('./db.js');
  content = await import('./contentStore.js');
  energy = await import('./energy.js');
  ({ signAccessToken, hashPassword } = await import('./auth.js'));

  server = app.listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}/admin/api`;

  originalLimits = { ...content.getLimits() };
  await content.setLimits({ dailyFreeLessons: 10, supportEnergyAmount: 5, energyRefillHours: 24 });
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

// ── Energy period ────────────────────────────────────────────────────────

test('refill period at 24h is the UTC day, and shorter periods subdivide it', () => {
  const dayIndex = Math.floor(Date.now() / 86_400_000);
  assert.equal(energy.currentPeriod(24), dayIndex);
  assert.equal(energy.currentPeriod(8), Math.floor(Date.now() / (8 * 3_600_000)));
  assert.equal(new Date(energy.periodEndsAt(24)).toISOString().slice(11), '00:00:00.000Z');
  assert.ok(energy.periodEndsAt(8) - Date.now() <= 8 * 3_600_000);
});

test('normalizeRefillHours clamps junk to the guard rails', () => {
  assert.equal(energy.normalizeRefillHours(0), 24);
  assert.equal(energy.normalizeRefillHours('abc'), 24);
  assert.equal(energy.normalizeRefillHours(8), 8);
  assert.equal(energy.normalizeRefillHours(9999), 168);
});

test('a mid-day pre-interval state keeps its counters when it first rolls', () => {
  const today = new Date().toISOString().slice(0, 10);
  const legacy = { energyDate: today, lessonsToday: 2, bonusEnergyToday: 1 };
  const { remaining } = energy.computeLiveEnergy(legacy, 3, 24);
  assert.equal(remaining, 2, 'cap 3+1 bonus minus 2 spent');
  assert.equal(legacy.energyPeriod, energy.currentPeriod(24));
});

// ── Enrolment + board ────────────────────────────────────────────────────

test('enrolment persists role and university, and can be cleared', async () => {
  const { token } = await makeUser({ name: 'Enrol', role: 'student', uniId: null });

  let res = await call('PUT', '/u/me/university', { token, body: { universityId: 'KSTU', role: 'viewer' } });
  assert.equal(res.status, 200);
  let user = await res.json();
  assert.equal(user.state.uniId, 'kstu', 'id is normalized to lower case');
  assert.equal(user.state.uniRole, 'viewer');
  assert.ok(user.state.uniJoinedAt);

  res = await call('PUT', '/u/me/university', { token, body: { universityId: null, role: null } });
  user = await res.json();
  assert.equal(user.state.uniId, null);
  assert.equal(user.state.uniRole, null);
});

// The app re-sends this write every time the university tab opens
// (league_screen.dart#_enrol). While an unchanged enrolment counted as a
// fresh join, a learner lost their whole campus score just by switching tabs
// and switching back.
test('re-sending an unchanged enrolment keeps the campus score', async () => {
  const { token, user } = await makeUser({ name: 'Steady', role: 'student', xp: 340 });
  assert.equal(user.state.uniXp, 340, 'fixture puts a student\'s points on the campus score');

  const res = await call('PUT', '/u/me/university', { token, body: { universityId: UNI, role: 'student' } });
  assert.equal(res.status, 200);
  const after = await res.json();
  assert.equal(after.state.uniXp, 340, 'a no-op re-commit must not reset the score');
  assert.equal(after.state.uniJoinedAt, user.state.uniJoinedAt, 'nor restart the run');
});

test('a real enrolment change still starts a clean run', async () => {
  const { token } = await makeUser({ name: 'Switcher', role: 'student', xp: 500 });

  // Same campus, different role — still a different enrolment.
  let res = await call('PUT', '/u/me/university', { token, body: { universityId: UNI, role: 'viewer' } });
  assert.equal((await res.json()).state.uniXp, 0, 'a role switch resets');

  res = await call('PUT', '/u/me/university', { token, body: { universityId: 'auca', role: 'student' } });
  const moved = await res.json();
  assert.equal(moved.state.uniId, 'auca');
  assert.equal(moved.state.uniXp, 0, 'a new campus resets');
});

test('enrolment rejects a bad role or a bad university id', async () => {
  const { token } = await makeUser({ name: 'BadEnrol' });
  const bad = await call('PUT', '/u/me/university', { token, body: { universityId: UNI, role: 'admin' } });
  assert.equal(bad.status, 400);
  const worse = await call('PUT', '/u/me/university', { token, body: { universityId: '../etc', role: 'student' } });
  assert.equal(worse.status, 400);
});

test('the board ranks students by XP and counts viewers without ranking them', async () => {
  const uni = `board-${randomUUID().slice(0, 6)}`;
  await makeUser({ name: 'Asan', xp: 900, uniId: uni });
  await makeUser({ name: 'Usen', xp: 500, uniId: uni });
  const { token: viewerToken } = await makeUser({ name: 'Watcher', role: 'viewer', xp: 100_000, uniId: uni });

  const res = await call('GET', `/u/university/${uni}/board`, { token: viewerToken });
  assert.equal(res.status, 200);
  const board = await res.json();

  assert.equal(board.studentCount, 2);
  assert.equal(board.viewerCount, 1);
  assert.deepEqual(board.students.map(s => s.name), ['Asan', 'Usen']);
  assert.deepEqual(board.students.map(s => s.rank), [1, 2]);
  assert.equal(board.totalXp, 1400, "the viewer's 100k XP stays out of the university total");
  assert.deepEqual(board.students.map(s => s.xp), [900, 500], 'students are ranked on their campus score');
  assert.equal(board.me.role, 'viewer');
  assert.equal(board.me.rank, null, 'a viewer is never ranked on the board');
});

// ── Viewer support energy ────────────────────────────────────────────────

test('a viewer gifts energy once per period; the student receives it', async () => {
  const uni = `gift-${randomUUID().slice(0, 6)}`;
  const student = await makeUser({ name: 'Leader', xp: 400, uniId: uni });
  const viewer = await makeUser({ name: 'Fan', role: 'viewer', uniId: uni });

  const before = energy.computeLiveEnergy(viewer.user.state, 10, 24).remaining;

  const res = await call('POST', '/u/university/support', { token: viewer.token, body: { toUserId: student.user.id } });
  assert.equal(res.status, 201);
  const payload = await res.json();
  assert.equal(payload.amount, 5);
  assert.equal(payload.to.name, 'Leader');
  assert.ok(payload.nextGiftInMs > 0);

  const after = energy.computeLiveEnergy(db.findUserById(viewer.user.id).state, 10, 24).remaining;
  assert.equal(after, before - 5, 'the gift is spent from the giver’s own pool');

  const recipient = db.findUserById(student.user.id).state;
  assert.equal(recipient.supportEnergyToday, 5);
  assert.equal(energy.computeLiveEnergy(recipient, 10, 24).remaining, 15, 'support stacks on the free allowance');

  const repeat = await call('POST', '/u/university/support', { token: viewer.token, body: { toUserId: student.user.id } });
  assert.equal(repeat.status, 429, 'one gift per refill period');
});

test('a student cannot gift, and a viewer cannot gift outside their university', async () => {
  const uni = `guard-${randomUUID().slice(0, 6)}`;
  const student = await makeUser({ name: 'Rival', uniId: uni });
  const otherStudent = await makeUser({ name: 'Outsider', uniId: `${uni}-other` });
  const viewer = await makeUser({ name: 'Guard', role: 'viewer', uniId: uni });

  const asStudent = await call('POST', '/u/university/support', { token: student.token, body: { toUserId: otherStudent.user.id } });
  assert.equal(asStudent.status, 403, 'only viewers may gift');

  const crossCampus = await call('POST', '/u/university/support', { token: viewer.token, body: { toUserId: otherStudent.user.id } });
  assert.equal(crossCampus.status, 404, 'the student must be on the same board');
});

test('supporters are folded to one row per backer, biggest first', async () => {
  const uni = `sup-${randomUUID().slice(0, 6)}`;
  const student = await makeUser({ name: 'Star', uniId: uni });
  const a = await makeUser({ name: 'FanA', role: 'viewer', uniId: uni });
  const b = await makeUser({ name: 'FanB', role: 'viewer', uniId: uni });

  for (const fan of [a, b]) {
    const res = await call('POST', '/u/university/support', { token: fan.token, body: { toUserId: student.user.id } });
    assert.equal(res.status, 201);
  }

  const res = await call('GET', '/u/me/supporters', { token: student.token });
  const { supporters, totalEnergy } = await res.json();
  assert.equal(supporters.length, 2);
  assert.deepEqual(supporters.map(s => s.name).sort(), ['FanA', 'FanB']);
  assert.equal(totalEnergy, 10);

  const board = await (await call('GET', `/u/university/${uni}/board`, { token: student.token })).json();
  assert.equal(board.students[0].supporters, 2, 'the board shows the backer count');
  assert.equal(board.me.supporters, 2);
});

// ── Password change ──────────────────────────────────────────────────────

test('changing a password needs the current one and rotates every session', async () => {
  const { user, token } = await makeUser({ name: 'Pwd', password: 'original-1' });

  const short = await call('POST', '/u/me/password', { token, body: { currentPassword: 'original-1', newPassword: '123' } });
  assert.equal(short.status, 400);

  const wrong = await call('POST', '/u/me/password', { token, body: { currentPassword: 'nope', newPassword: 'brand-new-1' } });
  assert.equal(wrong.status, 400);

  const same = await call('POST', '/u/me/password', { token, body: { currentPassword: 'original-1', newPassword: 'original-1' } });
  assert.equal(same.status, 400, 'the new password must actually differ');

  const oldRefresh = await db.createSession({ type: 'user', userId: user.id, ttlMs: 60_000 });
  const ok = await call('POST', '/u/me/password', { token, body: { currentPassword: 'original-1', newPassword: 'brand-new-1' } });
  assert.equal(ok.status, 200);
  const payload = await ok.json();
  assert.ok(payload.token, 'the caller is handed a fresh access token');
  assert.equal(payload.user.hasPassword, true);
  assert.equal(payload.user.passwordHash, undefined, 'the hash never leaves the server');

  const replay = await db.rotateSession(oldRefresh, 60_000, 'user');
  assert.equal(replay, null, 'other sessions are revoked by the change');

  const login = await call('POST', '/u/login', { body: { email: user.email, password: 'brand-new-1' } });
  assert.equal(login.status, 200);
});

test('a Google-only account sets its first password with no current one', async () => {
  const { token } = await makeUser({ name: 'Googler' }); // passwordHash: null

  const me = await (await call('GET', '/u/me', { token })).json();
  assert.equal(me.hasPassword, false);

  const res = await call('POST', '/u/me/password', { token, body: { newPassword: 'first-password-1' } });
  assert.equal(res.status, 200);
  const { user } = await res.json();
  assert.equal(user.hasPassword, true);
});
