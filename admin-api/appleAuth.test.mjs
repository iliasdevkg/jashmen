// admin-api/appleAuth.test.mjs — "Sign in with Apple".
//
//   node --test admin-api/appleAuth.test.mjs
//
// Required by App Store Guideline 4.8 wherever the Google button ships, so
// getting it wrong is not a degraded feature — it is a rejected build.
//
// The signature check itself is jose's job and is not re-tested here. What
// IS tested is the account resolution, because that is where Apple's three
// departures from every other provider do their damage:
//
//   · the display name arrives once, ever
//   · the email may be a Hide My Email relay, which is real and must work
//   · the email is absent on every sign-in after the first, so `sub` — not
//     the address — has to be what identifies the account
//
// A second sign-in that fails to find the first account creates a duplicate
// the person cannot get out of, and that is the bug this file exists for.

import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DATA_DIR = path.join(import.meta.dirname, 'data');
const BACKUP = path.join(os.tmpdir(), `jashmen-apple-backup-${process.pid}`);

let apple, db;
const made = [];

const defaultState = () => ({ xp: 0, coins: 50, completedLessons: [] });

/// Whatever verifyAppleIdentityToken would have returned for a given token.
const claims = (sub, email = null) => ({ appleSub: sub, email, isPrivateRelay: false });

before(async () => {
  if (fs.existsSync(DATA_DIR)) fs.cpSync(DATA_DIR, BACKUP, { recursive: true });
  fs.rmSync(path.join(DATA_DIR, 'db.json'), { force: true });

  process.env.APPLE_BUNDLE_ID = 'com.jashmenstudio.jashmen';
  process.env.NODE_ENV = 'test';

  apple = await import('./appleAuth.js');
  db = await import('./db.js');
});

beforeEach(() => { made.length = 0; });

after(() => {
  if (fs.existsSync(BACKUP)) {
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
    fs.cpSync(BACKUP, DATA_DIR, { recursive: true });
    fs.rmSync(BACKUP, { recursive: true, force: true });
  }
});

// ── Configuration ────────────────────────────────────────────────────────

test('it is configured once the bundle id is set', () => {
  assert.equal(apple.isAppleAuthConfigured(), true);
});

test('an unconfigured server refuses rather than pretending', async () => {
  const saved = process.env.APPLE_BUNDLE_ID;
  delete process.env.APPLE_BUNDLE_ID;
  // The module reads the env once at import, so re-import it fresh.
  const fresh = await import(`./appleAuth.js?nocache=${Date.now()}`);
  assert.equal(fresh.isAppleAuthConfigured(), false);
  await assert.rejects(
    () => fresh.verifyAppleIdentityToken('a'.repeat(40)),
    e => e.status === 503,
  );
  process.env.APPLE_BUNDLE_ID = saved;
});

test('junk never reaches the verifier', async () => {
  for (const bad of [null, undefined, 42, '', 'short', 'x'.repeat(9000)]) {
    await assert.rejects(
      () => apple.verifyAppleIdentityToken(bad),
      e => e.status === 400 || e.status === 401,
      `${typeof bad} must not be treated as a token`,
    );
  }
});

// ── The first sign-in ────────────────────────────────────────────────────

test('a new identity creates an account', async () => {
  const sub = `sub-${Date.now()}`;
  const { user, created } = await apple.resolveAppleUser(
    claims(sub, `apple.${Date.now()}@example.kg`),
    { defaultState, name: 'Айпери Осмонова' },
  );
  made.push(user.id);

  assert.equal(created, true);
  assert.equal(user.appleSub, sub);
  assert.equal(user.name, 'Айпери Осмонова', 'the name Apple sent once was used');
  assert.equal(user.passwordHash, null, 'no password, exactly like a Google account');
});

test('a Hide My Email address is a real address, not a reason to refuse',
  async () => {
    const sub = `relay-${Date.now()}`;
    const { user, created } = await apple.resolveAppleUser(
      { appleSub: sub, email: `abc123.def@privaterelay.appleid.com`, isPrivateRelay: true },
      { defaultState, name: 'Реле Колдонуучу' },
    );
    made.push(user.id);
    assert.equal(created, true);
    assert.match(user.email, /privaterelay\.appleid\.com$/);
  });

test('no name from Apple falls back to something readable', async () => {
  const { user } = await apple.resolveAppleUser(
    claims(`noname-${Date.now()}`, `nurbek.${Date.now()}@example.kg`),
    { defaultState },
  );
  made.push(user.id);
  assert.ok(user.name.startsWith('nurbek'), 'not blank, not "undefined"');
});

// ── Every sign-in after the first ────────────────────────────────────────

test('the second sign-in finds the same account, with no email at all',
  async () => {
    const sub = `again-${Date.now()}`;
    const first = await apple.resolveAppleUser(
      claims(sub, `again.${Date.now()}@example.kg`),
      { defaultState, name: 'Кайра Келген' },
    );
    made.push(first.user.id);

    // Apple sends no email and no name on any subsequent authorisation.
    const second = await apple.resolveAppleUser(claims(sub, null), { defaultState });

    assert.equal(second.created, false, 'a duplicate here is an account nobody can escape');
    assert.equal(second.user.id, first.user.id);
    assert.equal(second.user.name, 'Кайра Келген', 'the name from the first time survives');
  });

test('a returning identity does not need the address it first used', async () => {
  const sub = `moved-${Date.now()}`;
  const first = await apple.resolveAppleUser(
    claims(sub, `moved.${Date.now()}@example.kg`), { defaultState, name: 'Тест' },
  );
  made.push(first.user.id);

  const again = await apple.resolveAppleUser(
    claims(sub, 'a-completely-different@example.kg'), { defaultState },
  );
  assert.equal(again.user.id, first.user.id, 'sub identifies the account, not the email');
});

// ── Linking, and refusing to link ────────────────────────────────────────

test('a verified email links to the password account that already has it',
  async () => {
    const email = `link.${Date.now()}@example.kg`;
    const existing = {
      id: `u-${Date.now()}`, name: 'Мурунтан бар', email,
      avatar: '🦅', passwordHash: 'hashed', state: defaultState(),
    };
    await db.insertUser(existing);
    made.push(existing.id);

    const { user, created } = await apple.resolveAppleUser(
      claims(`link-${Date.now()}`, email), { defaultState },
    );

    assert.equal(created, false);
    assert.equal(user.id, existing.id, 'one person, one account');
    assert.equal(user.passwordHash, 'hashed',
      'linking adds a way in — it must not take the password away');
    assert.ok(user.appleSub);
  });

test('a brand-new identity with no email is refused, with instructions',
  async () => {
    // The one case where Apple sends neither: re-authorising an app the
    // person already removed from their Apple ID. Silently creating a second
    // unreachable account would be worse than saying so.
    await assert.rejects(
      () => apple.resolveAppleUser(claims(`empty-${Date.now()}`, null), { defaultState }),
      e => e.status === 409 && /Apple ID/.test(e.message),
    );
  });

test('a deleted account is not resurrected by signing in again', async () => {
  const sub = `gone-${Date.now()}`;
  const email = `gone.${Date.now()}@example.kg`;
  const { user } = await apple.resolveAppleUser(claims(sub, email), {
    defaultState, name: 'Кеткен',
  });
  made.push(user.id);
  await db.anonymizeUser(user.id);

  const again = await apple.resolveAppleUser(claims(sub, email), {
    defaultState, name: 'Кеткен',
  });
  made.push(again.user.id);

  assert.equal(again.created, true, 'they get a fresh account, not the stripped row');
  assert.notEqual(again.user.id, user.id);
});
