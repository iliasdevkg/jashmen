// admin-api/businessContent.test.mjs — the business site's copy store.
//
//   node --test admin-api/businessContent.test.mjs
//
// Every word and every picture on https://jashmenstudio.com/ comes from
// here, so the rules worth pinning are the ones that protect a live page
// from a bad save: a partial PUT must not wipe the sections it does not
// mention, an empty field must be a supported state rather than a crash,
// and nothing an operator can type may reach the page as a url the browser
// would try to fetch.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DATA_DIR = path.join(import.meta.dirname, 'data');
const BACKUP = path.join(os.tmpdir(), `jashmen-biz-backup-${process.pid}`);

let server, base, adminToken, content, original;

const put = body =>
  fetch(`${base}/admin/business`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${adminToken}` },
    body: JSON.stringify(body),
  });

before(async () => {
  if (fs.existsSync(DATA_DIR)) fs.cpSync(DATA_DIR, BACKUP, { recursive: true });
  fs.rmSync(path.join(DATA_DIR, 'db.json'), { force: true });

  process.env.JWT_SECRET = 'test-secret-for-business-tests';
  process.env.ADMIN_PASSWORD = 'test-admin-password';
  process.env.TRUST_PROXY_HOPS = '0';
  process.env.NODE_ENV = 'test';

  const { default: app } = await import('./server.js');
  content = await import('./contentStore.js');
  original = structuredClone(content.getBusiness());

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

after(async () => {
  if (content && original) await content.setBusiness(original);
  server?.close();
  if (fs.existsSync(BACKUP)) {
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
    fs.cpSync(BACKUP, DATA_DIR, { recursive: true });
    fs.rmSync(BACKUP, { recursive: true, force: true });
  }
});

// ── Shape ────────────────────────────────────────────────────────────────

test('every block of the page is seeded, in render order', () => {
  assert.deepEqual(
    Object.keys(content.getBusiness()),
    ['nav', 'hero', 'strip', 'trust', 'why', 'solutions', 'stats', 'cta', 'form', 'footer'],
  );
});

test('the seed is filled in all three languages', () => {
  const b = content.getBusiness();
  for (const [key, value] of Object.entries(b.hero)) {
    if (typeof value !== 'object' || value === null) continue;
    assert.ok(value.ky && value.ru && value.en, `hero.${key} is missing a language`);
  }
  assert.equal(b.solutions.items.length, 6, 'six audiences');
  assert.equal(b.why.items.length, 5);
  assert.equal(b.strip.items.length, 4);
});

test('every section carries a visibility flag', () => {
  for (const key of content.BUSINESS_SECTION_KEYS) {
    assert.equal(typeof content.getBusiness()[key].enabled, 'boolean', key);
  }
});

test('the icons the seed picks really exist', () => {
  const b = content.getBusiness();
  for (const item of [...b.strip.items, ...b.why.items]) {
    assert.ok(item.icon, `${item.id} lost its icon to the slug whitelist`);
  }
});

// ── Editing ──────────────────────────────────────────────────────────────

test('a partial save leaves every other section alone', async () => {
  const before = content.getBusiness();
  const res = await put({ hero: { ...before.hero, line1: { ky: 'Жаңы', ru: 'Новый', en: 'New' } } });
  assert.equal(res.status, 200);

  const after = content.getBusiness();
  assert.equal(after.hero.line1.ru, 'Новый');
  assert.deepEqual(after.footer, before.footer, 'the footer was not in the patch');
  assert.deepEqual(after.solutions, before.solutions);
});

test('a section can be switched off and back on', async () => {
  await put({ trust: { enabled: false } });
  assert.equal(content.getBusiness().trust.enabled, false);
  await put({ trust: { enabled: true } });
  assert.equal(content.getBusiness().trust.enabled, true);
});

test('a blank heading is a supported state, not a rejected one', async () => {
  const res = await put({ cta: { line2: { ky: '', ru: '', en: '' } } });
  assert.equal(res.status, 200);
  // An emptied optional field collapses to '' rather than to an object of
  // three empty strings — the store's shape for "nothing here", and what
  // localizedText resolves to '' on the page, which drops the line.
  assert.equal(content.getBusiness().cta.line2, '',
    'the page drops the line rather than refusing the save');

  // And it can be filled back in.
  await put({ cta: { line2: { ky: 'Кайра', ru: 'Снова', en: 'Again' } } });
  assert.equal(content.getBusiness().cta.line2.ru, 'Снова');
});

test('the solutions list can be reordered and trimmed', async () => {
  const items = content.getBusiness().solutions.items;
  await put({ solutions: { items: [items[2], items[0]] } });
  const after = content.getBusiness().solutions.items;
  assert.equal(after.length, 2);
  assert.equal(after[0].id, items[2].id, 'order is what the page renders tabs in');
});

// ── Bad input ────────────────────────────────────────────────────────────

test('a url field refuses anything that is not one', async () => {
  for (const bad of ['javascript:alert(1)', 'data:text/html,x', 'not a url', ' ']) {
    await put({ hero: { videoUrl: bad } });
    assert.equal(content.getBusiness().hero.videoUrl, '',
      `${bad} must never reach the page as a src`);
  }
  await put({ hero: { videoUrl: '/admin/api/uploads/a.mp4' } });
  assert.equal(content.getBusiness().hero.videoUrl, '/admin/api/uploads/a.mp4');
});

test('an unknown icon slug clears rather than shipping a broken glyph', async () => {
  const items = content.getBusiness().strip.items;
  await put({ strip: { items: [{ ...items[0], icon: 'not-a-real-icon' }] } });
  assert.equal(content.getBusiness().strip.items[0].icon, null);
});

test('the list cap holds', async () => {
  const row = content.getBusiness().why.items[0];
  await put({ why: { items: Array.from({ length: 40 }, (_, i) => ({ ...row, id: `x${i}` })) } });
  assert.ok(content.getBusiness().why.items.length <= 8);
});

test('editing needs an admin session', async () => {
  const res = await fetch(`${base}/admin/business`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ hero: { line1: { ru: 'hacked' } } }),
  });
  assert.equal(res.status, 401);
});

// ── What the page sees ───────────────────────────────────────────────────

test('the public payload carries the whole page', async () => {
  const body = await (await fetch(`${base}/public/content`)).json();
  assert.ok(body.business, 'the page reads its copy from /public/content');
  assert.ok(body.business.hero.line1.ru);
  assert.equal(body.business.solutions.items.length, content.getBusiness().solutions.items.length);
});

test('the footer links name a column the page can group by', () => {
  for (const l of content.getBusiness().footer.links) {
    assert.ok(['1', '2', '3'].includes(l.col), `${l.id} sits in column ${l.col}`);
    assert.ok(l.href, `${l.id} has somewhere to go`);
  }
});
