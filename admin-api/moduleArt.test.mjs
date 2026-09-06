// admin-api/moduleArt.test.mjs — which edge a module's artwork stands on.
//
//   node --test admin-api/moduleArt.test.mjs
//
// One small field, but three clients read it (web LearnPage, the Flutter
// learn screen, the panel), and the rule that matters most is the boring
// one: a module written before this field existed must keep its tile
// exactly where it is. A silent migration that moved every existing tile to
// the other side of the road would be a worse bug than the feature is a
// feature.

import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DATA_DIR = path.join(import.meta.dirname, 'data');
const BACKUP = path.join(os.tmpdir(), `jashmen-art-backup-${process.pid}`);

let server, base, adminToken, content, moduleId;

const moduleOf = id => content.getContent().modules.find(m => m.id === id);

const patch = (id, body) =>
  fetch(`${base}/admin/modules/${id}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${adminToken}` },
    body: JSON.stringify(body),
  });

before(async () => {
  if (fs.existsSync(DATA_DIR)) fs.cpSync(DATA_DIR, BACKUP, { recursive: true });
  fs.rmSync(path.join(DATA_DIR, 'db.json'), { force: true });

  process.env.JWT_SECRET = 'test-secret-for-art-tests';
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
  const mod = await content.addModule({ title: { ky: 'Сүрөт тести' }, color: '#58CC02' });
  moduleId = mod.id;
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

// ── The default ──────────────────────────────────────────────────────────

test('a new module puts its artwork on the left', () => {
  assert.equal(moduleOf(moduleId).artSide, 'left',
    'left is where every tile sat before the field existed');
});

test('a module stored without the field reads back as left', async () => {
  // Exactly the shape content.json holds for anything written before this
  // shipped: the key is simply absent.
  const raw = moduleOf(moduleId);
  delete raw.artSide;
  assert.equal(content.getContent().modules.find(m => m.id === moduleId).artSide, undefined,
    'the fixture really is missing the field');

  // withDefaults() runs on load and backfills it.
  await content.updateModule(moduleId, {});
  assert.notEqual(moduleOf(moduleId).artSide, 'right',
    'a stored module must never silently jump to the other side');
});

// ── Choosing a side ──────────────────────────────────────────────────────

test('the panel can move the artwork to the right, and back', async () => {
  let res = await patch(moduleId, { artSide: 'right' });
  assert.equal(res.status, 200);
  assert.equal(moduleOf(moduleId).artSide, 'right');

  res = await patch(moduleId, { artSide: 'left' });
  assert.equal(res.status, 200);
  assert.equal(moduleOf(moduleId).artSide, 'left');
});

test('a module can be created with a side', async () => {
  const mod = await content.addModule({
    title: { ky: 'Оң жактагы' }, color: '#1CB0F6', artSide: 'right',
  });
  assert.equal(mod.artSide, 'right');
  await content.deleteModule(mod.id);
});

test('the side survives an edit that does not mention it', async () => {
  await patch(moduleId, { artSide: 'right' });
  await patch(moduleId, { color: '#FF9600' });
  assert.equal(moduleOf(moduleId).artSide, 'right',
    'saving the colour must not reset where the picture stands');
});

// ── Bad input ────────────────────────────────────────────────────────────

test('an unknown side falls back to left instead of failing the save', async () => {
  await patch(moduleId, { artSide: 'right' });
  const res = await patch(moduleId, { artSide: 'middle', color: '#CE82FF' });
  assert.equal(res.status, 200, 'the rest of the save still lands');
  assert.equal(moduleOf(moduleId).artSide, 'left');
  assert.equal(moduleOf(moduleId).color, '#CE82FF');
});

test('null and numbers are treated as unset, not stored', async () => {
  for (const bad of [null, 0, '', 'RIGHT ', ['right']]) {
    await patch(moduleId, { artSide: bad });
    assert.equal(moduleOf(moduleId).artSide, 'left', `${JSON.stringify(bad)} is not a side`);
  }
});

// ── What the clients see ─────────────────────────────────────────────────

test('the learner-facing content carries the side', async () => {
  await patch(moduleId, { artSide: 'right' });
  const res = await fetch(`${base}/public/content`);
  const body = await res.json();
  const mod = body.modules.find(m => m.id === moduleId);
  assert.equal(mod.artSide, 'right',
    'the web page and the app both read this from /public/content');
});

test('every module in the public payload names a side', async () => {
  const body = await (await fetch(`${base}/public/content`)).json();
  for (const m of body.modules) {
    assert.ok(['left', 'right'].includes(m.artSide),
      `${m.id} must tell a client which edge to draw on`);
  }
});
