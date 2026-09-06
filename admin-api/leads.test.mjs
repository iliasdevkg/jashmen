// admin-api/leads.test.mjs — the B2B enquiry inbox.
//
//   node --test admin-api/leads.test.mjs
//
// This endpoint is the only thing on the whole B2B site that matters: if it
// drops a bank's enquiry, every other decision on the site was wasted. So
// the rules pinned down here are about never losing one and never mixing
// the two audiences — a partner's enquiry must not queue behind a learner's
// bug report, and a missing optional field must never refuse a submission.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DATA_DIR = path.join(import.meta.dirname, 'data');
const BACKUP = path.join(os.tmpdir(), `jashmen-leads-backup-${process.pid}`);
const LEADS_FILE = path.join(DATA_DIR, 'leads.json');

let server, base, adminToken, leads;

const post = (body) =>
  fetch(`${base}/public/enquiry`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

const admin = (method, p, body) =>
  fetch(`${base}/admin${p}`, {
    method,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${adminToken}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const PARTNER = {
  kind: 'partner',
  organization: 'Демир Банк',
  contact: 'Айбек Осмонов',
  email: 'a.osmonov@example.kg',
  phone: '+996 555 000000',
  interest: 'module',
  message: 'Интересует модуль по накоплениям для студентов.',
};

before(async () => {
  if (fs.existsSync(DATA_DIR)) fs.cpSync(DATA_DIR, BACKUP, { recursive: true });
  fs.rmSync(LEADS_FILE, { force: true });
  fs.rmSync(path.join(DATA_DIR, 'db.json'), { force: true });

  process.env.JWT_SECRET = 'test-secret-for-lead-tests';
  process.env.ADMIN_PASSWORD = 'test-admin-password';
  process.env.TRUST_PROXY_HOPS = '0';
  // Every test here posts through the same limiter from 127.0.0.1, so the
  // production allowance would refuse the suite from test 13 onward. The
  // brake itself is still proven, by the last test in the file.
  process.env.LEAD_RATE_LIMIT = '60';
  process.env.NODE_ENV = 'test';

  const { default: app } = await import('./server.js');
  leads = await import('./leads.js');

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

after(() => {
  server?.close();
  if (fs.existsSync(BACKUP)) {
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
    fs.cpSync(BACKUP, DATA_DIR, { recursive: true });
    fs.rmSync(BACKUP, { recursive: true, force: true });
  }
});

// ── Accepting a partner enquiry ──────────────────────────────────────────

test('a partner enquiry is accepted and comes back with an id', async () => {
  const res = await post(PARTNER);
  assert.equal(res.status, 201);
  const { id } = await res.json();
  assert.ok(id, 'the id is what a person quotes when they follow up');

  const row = leads.listLeads('partner').find(l => l.id === id);
  assert.equal(row.organization, 'Демир Банк');
  assert.equal(row.interest, 'module');
  assert.equal(row.handledAt, null, 'a new enquiry is unanswered');
});

test('no account is needed — that is the whole point', async () => {
  const res = await post({ ...PARTNER, email: 'anon@example.kg' });
  assert.equal(res.status, 201, 'a bank must be able to write without signing up');
});

test('the optional second step is genuinely optional', async () => {
  const res = await post({
    kind: 'partner',
    organization: 'Только обязательные',
    contact: 'Кто-то',
    email: 'min@example.kg',
    interest: 'rewards',
  });
  assert.equal(res.status, 201, 'a missing optional field must never refuse a lead');
});

test('an unknown interest is kept as "other", not rejected', async () => {
  const res = await post({ ...PARTNER, email: 'odd@example.kg', interest: 'нечто' });
  assert.equal(res.status, 201);
  const row = leads.listLeads('partner').find(l => l.email === 'odd@example.kg');
  assert.equal(row.interest, 'other', 'a dropdown typo is never worth losing a lead over');
});

// ── Refusing what cannot be answered ─────────────────────────────────────

test('a missing organisation is refused, and says which field', async () => {
  const res = await post({ ...PARTNER, organization: '   ' });
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /организац/i);
});

test('an unanswerable email is refused', async () => {
  for (const email of ['', 'not-an-email', 'a@b']) {
    const res = await post({ ...PARTNER, email });
    assert.equal(res.status, 400, `"${email}" is not a reply-to address`);
  }
});

test('oversized input is trimmed, not rejected', async () => {
  const res = await post({
    ...PARTNER,
    email: 'long@example.kg',
    organization: 'О'.repeat(2000),
    message: 'М'.repeat(20000),
  });
  assert.equal(res.status, 201);
  const row = leads.listLeads('partner').find(l => l.email === 'long@example.kg');
  assert.ok(row.organization.length <= 400);
  assert.ok(row.message.length <= 4000);
});

// ── The two audiences stay apart ─────────────────────────────────────────

test('learner feedback is stored under its own kind', async () => {
  const res = await post({
    kind: 'feedback',
    email: 'learner@example.kg',
    topic: 'bug',
    message: 'Урок не открывается после обновления.',
  });
  assert.equal(res.status, 201);

  const feedback = leads.listLeads('feedback');
  const partners = leads.listLeads('partner');
  assert.ok(feedback.some(l => l.email === 'learner@example.kg'));
  assert.ok(!partners.some(l => l.email === 'learner@example.kg'),
    'a bug report must never appear in the partner queue');
});

test('feedback with no message is refused — there is nothing to act on', async () => {
  const res = await post({ kind: 'feedback', email: 'empty@example.kg', topic: 'bug' });
  assert.equal(res.status, 400);
});

test('feedback needs no organisation', async () => {
  const res = await post({
    kind: 'feedback', email: 'x@example.kg', topic: 'suggestion', message: 'Добавьте тёмную тему.',
  });
  assert.equal(res.status, 201, 'a learner is not an organisation');
});

// ── Newsletter subscribers ───────────────────────────────────────────────

test('a subscriber needs nothing but an address', async () => {
  const res = await post({ kind: 'subscribe', email: 'reader@example.kg', source: 'footer' });
  assert.equal(res.status, 201, 'a newsletter form that demands a company name is an abandoned form');
  const row = leads.listLeads('subscribe').find(l => l.email === 'reader@example.kg');
  assert.equal(row.source, 'footer');
});

test('subscribing twice does not create a second row', async () => {
  const first = await post({ kind: 'subscribe', email: 'twice@example.kg' });
  const second = await post({ kind: 'subscribe', email: 'twice@example.kg' });
  assert.equal(first.status, 201);
  assert.equal(second.status, 201, 'pressing the button again must not look like an error');
  assert.equal(
    leads.listLeads('subscribe').filter(l => l.email === 'twice@example.kg').length, 1,
    'and it must not leave the operator a duplicate to clean up',
  );
});

test('a subscriber is not a partner and not a bug report', async () => {
  await post({ kind: 'subscribe', email: 'separate@example.kg' });
  assert.ok(!leads.listLeads('partner').some(l => l.email === 'separate@example.kg'));
  assert.ok(!leads.listLeads('feedback').some(l => l.email === 'separate@example.kg'));
});

test('a subscriber with no usable address is still refused', async () => {
  assert.equal((await post({ kind: 'subscribe', email: 'nope' })).status, 400);
});

// ── The admin side ───────────────────────────────────────────────────────

test('the admin sees both queues and their unanswered counts', async () => {
  const body = await (await admin('GET', '/leads')).json();
  assert.ok(body.leads.length >= 2);
  assert.ok(body.unhandled.partner >= 1);
  assert.ok(body.unhandled.feedback >= 1);
  assert.ok(body.unhandled.subscribe >= 1);

  const onlyPartners = await (await admin('GET', '/leads?kind=partner')).json();
  assert.ok(onlyPartners.leads.every(l => l.kind === 'partner'));
});

test('leads list newest first', async () => {
  const { leads: rows } = await (await admin('GET', '/leads')).json();
  const ts = rows.map(l => l.ts);
  assert.deepEqual(ts, [...ts].sort((a, b) => b - a));
});

test('a lead can be marked answered and unmarked', async () => {
  const { leads: rows } = await (await admin('GET', '/leads?kind=partner')).json();
  const id = rows[0].id;

  let row = await (await admin('PATCH', `/leads/${id}`, { handled: true })).json();
  assert.ok(row.handledAt);

  row = await (await admin('PATCH', `/leads/${id}`, { handled: false })).json();
  assert.equal(row.handledAt, null);
});

test('marking a lead that does not exist is a 404, not a crash', async () => {
  assert.equal((await admin('PATCH', '/leads/nope', { handled: true })).status, 404);
});

test('a lead can be deleted', async () => {
  const before = await (await admin('GET', '/leads?kind=feedback')).json();
  const id = before.leads[0].id;
  assert.equal((await admin('DELETE', `/leads/${id}`)).status, 204);
  const after = await (await admin('GET', '/leads?kind=feedback')).json();
  assert.ok(!after.leads.some(l => l.id === id));
});

test('the inbox needs an admin session', async () => {
  assert.equal((await fetch(`${base}/admin/leads`)).status, 401);
});

// ── Durability ───────────────────────────────────────────────────────────

test('leads live on their own disk file, away from the learner database',
  async () => {
    const onDisk = JSON.parse(fs.readFileSync(LEADS_FILE, 'utf8'));
    assert.ok(onDisk.some(l => l.email === 'a.osmonov@example.kg'),
      'an enquiry must outlive the process that received it');

    const db = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'db.json'), 'utf8'));
    assert.ok(!JSON.stringify(db).includes('a.osmonov@example.kg'),
      'a lead is not a user and must not be mixed into db.json');
  });

// ── The brake ────────────────────────────────────────────────────────────
//
// Last, because it deliberately exhausts the hour's allowance for this IP.

test('a flood is eventually refused, with a message a person can read',
  async () => {
    let refused = null;
    // The allowance this suite runs under (60), plus room to cross it.
    for (let i = 0; i < 90 && !refused; i += 1) {
      const res = await post({ ...PARTNER, email: `flood${i}@example.kg` });
      if (res.status === 429) refused = await res.json();
    }
    assert.ok(refused, 'an unauthenticated write endpoint must have a brake');
    assert.ok(refused.error, 'and it must say so in words, not just a status');
  });
