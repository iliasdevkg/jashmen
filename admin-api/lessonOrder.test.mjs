// admin-api/lessonOrder.test.mjs — dragging a module's lessons into order.
//
//   node --test admin-api/lessonOrder.test.mjs
//
// The order IS the curriculum: a learner walks the path top to bottom and
// each lesson unlocks the next, so the rules worth pinning down are the ones
// that protect it — a partial or stale list from the panel must be able to
// reshuffle the deck but must never drop a lesson out of it.
//
// Boots the real Express app against the real data dir on a random port
// (same harness as uniSupport.test.mjs), backing the dir up first.

import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DATA_DIR = path.join(import.meta.dirname, 'data');
const BACKUP = path.join(os.tmpdir(), `jashmen-order-backup-${process.pid}`);

let server, base, adminToken;
let content;
let moduleId;

const titles = () =>
  content.getContent().modules.find(m => m.id === moduleId).lessons
    .map(l => l.title.ky);

const ids = () =>
  content.getContent().modules.find(m => m.id === moduleId).lessons.map(l => l.id);

const putOrder = (order, id = moduleId) =>
  fetch(`${base}/admin/modules/${id}/lessons/order`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ order }),
  });

before(async () => {
  if (fs.existsSync(DATA_DIR)) fs.cpSync(DATA_DIR, BACKUP, { recursive: true });
  fs.rmSync(path.join(DATA_DIR, 'db.json'), { force: true });

  process.env.JWT_SECRET = 'test-secret-for-order-tests';
  process.env.ADMIN_PASSWORD = 'test-admin-password';
  process.env.TRUST_PROXY_HOPS = '0';
  process.env.NODE_ENV = 'test';

  const { default: app } = await import('./server.js');
  content = await import('./contentStore.js');

  server = app.listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}/admin/api`;

  const login = await fetch(`${base}/admin/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password: 'test-admin-password' }),
  });
  ({ token: adminToken } = await login.json());
});

beforeEach(async () => {
  if (moduleId) await content.deleteModule(moduleId).catch(() => {});
  const mod = await content.addModule({ title: { ky: 'Ирээт тести' }, color: '#58CC02' });
  moduleId = mod.id;
  for (const name of ['A', 'B', 'C', 'D']) {
    await content.addLesson(moduleId, {
      title: { ky: name },
      cards: [{ type: 'theory', body: { ky: 'текст' } }],
    });
  }
});

after(async () => {
  if (moduleId) await content.deleteModule(moduleId).catch(() => {});
  server?.close();
  if (fs.existsSync(BACKUP)) {
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
    fs.cpSync(BACKUP, DATA_DIR, { recursive: true });
    fs.rmSync(BACKUP, { recursive: true, force: true });
  }
});

test('lessons start in the order they were created', () => {
  assert.deepEqual(titles(), ['A', 'B', 'C', 'D']);
});

test('a full order is applied exactly', async () => {
  const [a, b, c, d] = ids();
  const res = await putOrder([d, b, a, c]);
  assert.equal(res.status, 200);
  assert.deepEqual(titles(), ['D', 'B', 'A', 'C']);
});

test('dragging the last lesson to the top', async () => {
  const list = ids();
  const moved = [list[3], list[0], list[1], list[2]];
  await putOrder(moved);
  assert.deepEqual(titles(), ['D', 'A', 'B', 'C']);
});

test('a lesson left out of the list keeps its place at the end', async () => {
  const [a, b, c] = ids();
  await putOrder([c, a, b]); // D omitted entirely
  assert.deepEqual(titles(), ['C', 'A', 'B', 'D'], 'D must not vanish');
});

test('an id from another module is ignored, and nothing is lost', async () => {
  const list = ids();
  await putOrder(['not-a-real-id', list[2], list[0]]);
  assert.deepEqual(titles(), ['C', 'A', 'B', 'D']);
});

test('a duplicated id is used once, not twice', async () => {
  const list = ids();
  await putOrder([list[1], list[1], list[0]]);
  assert.deepEqual(titles(), ['B', 'A', 'C', 'D']);
});

test('an empty order changes nothing rather than emptying the module', async () => {
  await putOrder([]);
  assert.deepEqual(titles(), ['A', 'B', 'C', 'D']);
});

test('the new order survives a reload from disk', async () => {
  const [a, b, c, d] = ids();
  await putOrder([d, c, b, a]);

  const onDisk = JSON.parse(
    fs.readFileSync(path.join(DATA_DIR, 'content.json'), 'utf8'),
  );
  const mod = onDisk.modules.find(m => m.id === moduleId);
  assert.deepEqual(mod.lessons.map(l => l.title.ky), ['D', 'C', 'B', 'A']);
});

test('the learner-facing content serves the new order', async () => {
  const [a, b, c, d] = ids();
  await putOrder([b, a, d, c]);

  const body = await (await fetch(`${base}/public/content`)).json();
  const mod = body.modules.find(m => m.id === moduleId);
  assert.deepEqual(mod.lessons.map(l => l.title.ky), ['B', 'A', 'D', 'C']);
});

test('a missing order array is refused', async () => {
  const res = await fetch(`${base}/admin/modules/${moduleId}/lessons/order`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({}),
  });
  assert.equal(res.status, 400);
  assert.deepEqual(titles(), ['A', 'B', 'C', 'D']);
});

test('an unknown module is a 404', async () => {
  const res = await putOrder([], 'no-such-module');
  assert.equal(res.status, 404);
});

// ── Modules ──────────────────────────────────────────────────────────────

test('modules reorder, and /modules/order is not swallowed by /modules/:id',
  async () => {
    // Express matches in source order: with '/modules/:id' declared first,
    // this request would arrive there as id === 'order' and 404. The route
    // is deliberately declared above it.
    const before = content.getContent().modules.map(m => m.id);
    assert.ok(before.length >= 2, 'need at least two modules to reorder');

    const moved = [before[before.length - 1], ...before.slice(0, -1)];
    const res = await fetch(`${base}/admin/modules/order`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ order: moved }),
    });
    assert.equal(res.status, 200);
    assert.deepEqual(content.getContent().modules.map(m => m.id), moved);

    await fetch(`${base}/admin/modules/order`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ order: before }),
    });
    assert.deepEqual(content.getContent().modules.map(m => m.id), before);
  });

test('a module left out of the order keeps its place at the end', async () => {
  const before = content.getContent().modules.map(m => m.id);
  await fetch(`${base}/admin/modules/order`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ order: [before[before.length - 1]] }),
  });
  const after = content.getContent().modules.map(m => m.id);
  assert.equal(after.length, before.length, 'no module may fall off the path');
  assert.equal(after[0], before[before.length - 1]);

  await fetch(`${base}/admin/modules/order`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ order: before }),
  });
});

test('a module order that is not an array is refused', async () => {
  const before = content.getContent().modules.map(m => m.id);
  const res = await fetch(`${base}/admin/modules/order`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ order: 'nope' }),
  });
  assert.equal(res.status, 400);
  assert.deepEqual(content.getContent().modules.map(m => m.id), before);
});

test('reordering modules needs an admin session', async () => {
  const res = await fetch(`${base}/admin/modules/order`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ order: [] }),
  });
  assert.equal(res.status, 401);
});

test('reordering needs an admin session', async () => {
  const res = await fetch(`${base}/admin/modules/${moduleId}/lessons/order`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ order: [] }),
  });
  assert.equal(res.status, 401);
});
