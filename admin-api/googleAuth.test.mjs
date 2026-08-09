// admin-api/googleAuth.test.mjs — node:test, no framework.
//
//   node --test admin-api/googleAuth.test.mjs
//
// Google's signature check is stubbed (we can't mint a real id_token in a
// test), but everything downstream of it — audience rejection,
// email_verified enforcement, create vs. link vs. sign-in, and the
// passwordless-login guard — is exercised for real against a temp datastore.

import { test, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// db.js resolves its file relative to its own directory, so isolate the test
// run by pointing HOME-independent state at a temp copy of admin-api/data.
const DATA_DIR = path.join(import.meta.dirname, 'data');
const BACKUP = path.join(os.tmpdir(), `jashmen-data-backup-${process.pid}`);

let db, googleAuth;

before(async () => {
  // Preserve any real local dev data, then start from an empty store.
  if (fs.existsSync(DATA_DIR)) fs.cpSync(DATA_DIR, BACKUP, { recursive: true });
  fs.rmSync(path.join(DATA_DIR, 'db.json'), { force: true });

  process.env.GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';

  db = await import('./db.js');
  googleAuth = await import('./googleAuth.js');
});

const defaultState = () => ({ xp: 0, coins: 50, completedLessons: [] });

/** Minimal stand-in for the claims verifyGoogleIdToken returns. */
const claims = (over = {}) => ({
  googleSub: 'google-sub-1',
  email: 'someone@example.com',
  name: 'Someone',
  picture: null,
  ...over,
});

describe('resolveGoogleUser', () => {
  // db.js loads state once at import and exposes no reset hook, so tests
  // can't share a blank slate. Each one uses its own email + googleSub and
  // asserts per-email counts, which is what the invariants are actually
  // about anyway.
  const countByEmail = (email) => db.listUsers().filter(u => u.email === email).length;

  test('creates a passwordless account for a brand-new email', async () => {
    const { user, created } = await googleAuth.resolveGoogleUser(
      claims({ email: 'new@example.com', googleSub: 'sub-new' }),
      { defaultState },
    );

    assert.equal(created, true);
    assert.equal(user.email, 'new@example.com');
    assert.equal(user.googleSub, 'sub-new');
    assert.equal(user.passwordHash, null, 'a Google-only account must have no password');
    assert.ok(user.id, 'user gets an id');
  });

  test('signs an already-linked account straight in, without duplicating it', async () => {
    const first = await googleAuth.resolveGoogleUser(
      claims({ email: 'repeat@example.com', googleSub: 'sub-repeat' }),
      { defaultState },
    );
    const second = await googleAuth.resolveGoogleUser(
      claims({ email: 'repeat@example.com', googleSub: 'sub-repeat' }),
      { defaultState },
    );

    assert.equal(second.created, false);
    assert.equal(second.user.id, first.user.id);
    assert.equal(countByEmail('repeat@example.com'), 1,
      'signing in twice must not create a second record');
  });

  test('links to an existing password account and KEEPS the password', async () => {
    await db.insertUser({
      id: 'existing-id',
      name: 'Existing',
      email: 'both@example.com',
      avatar: '🦅',
      passwordHash: '$2a$10$fakehashfakehashfakehashfakehashfakehashfake',
      state: defaultState(),
    });

    const { user, created } = await googleAuth.resolveGoogleUser(
      claims({ email: 'both@example.com', googleSub: 'sub-link' }),
      { defaultState },
    );

    assert.equal(created, false, 'linking is not account creation');
    assert.equal(user.id, 'existing-id', 'must be the same account, not a new one');
    assert.equal(user.googleSub, 'sub-link', 'Google is now linked');
    assert.ok(user.passwordHash, 'linking must not remove the existing password');
    assert.equal(countByEmail('both@example.com'), 1,
      'linking must not leave a duplicate account behind');
  });

  test('progress survives linking', async () => {
    await db.insertUser({
      id: 'progress-id',
      name: 'Learner',
      email: 'progress@example.com',
      avatar: '🦅',
      passwordHash: '$2a$10$fakehashfakehashfakehashfakehashfakehashfake',
      state: { ...defaultState(), xp: 420, completedLessons: ['l1', 'l2'] },
    });

    const { user } = await googleAuth.resolveGoogleUser(
      claims({ email: 'progress@example.com', googleSub: 'sub-progress' }),
      { defaultState },
    );

    assert.equal(user.state.xp, 420);
    assert.deepEqual(user.state.completedLessons, ['l1', 'l2']);
  });
});

describe('verifyGoogleIdToken input guards', () => {
  test('rejects a missing token before touching the network', async () => {
    await assert.rejects(
      () => googleAuth.verifyGoogleIdToken(undefined),
      err => err.status === 400,
    );
  });

  test('rejects a non-string token', async () => {
    await assert.rejects(
      () => googleAuth.verifyGoogleIdToken({ evil: true }),
      err => err.status === 400,
    );
  });

  test('rejects an absurdly long token without calling Google', async () => {
    await assert.rejects(
      () => googleAuth.verifyGoogleIdToken('x'.repeat(5000)),
      err => err.status === 400,
    );
  });

  test('a syntactically valid but forged token fails verification with 401', async () => {
    // Real-shaped JWT, bogus signature — google-auth-library must reject it.
    const forged = [
      Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'nope' })).toString('base64url'),
      Buffer.from(JSON.stringify({
        sub: '1', email: 'attacker@example.com', email_verified: true,
        aud: 'test-client-id.apps.googleusercontent.com',
        iss: 'https://accounts.google.com',
        exp: Math.floor(Date.now() / 1000) + 3600,
      })).toString('base64url'),
      'not-a-real-signature',
    ].join('.');

    await assert.rejects(
      () => googleAuth.verifyGoogleIdToken(forged),
      err => err.status === 401,
    );
  });
});
