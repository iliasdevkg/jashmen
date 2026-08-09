// admin-api/googleRoute.test.mjs — HTTP-level checks for the Google route,
// the passwordless-login guard, and the new rate limiters.
//
//   node --test admin-api/googleRoute.test.mjs
//
// Boots the real Express app against a temp data dir on a random port. No
// real Google token exists here, so the happy path is covered by
// googleAuth.test.mjs; this file covers what the *route* is responsible
// for: status codes, error shapes, and throttling.

import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = path.join(import.meta.dirname, 'data');
let server, base;

before(async () => {
  fs.rmSync(path.join(DATA_DIR, 'db.json'), { force: true });

  process.env.JWT_SECRET = 'test-secret-for-route-tests';
  process.env.ADMIN_PASSWORD = 'test-admin-password';
  process.env.GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
  // No proxy in front of the test server, so req.ip must come straight from
  // the socket — otherwise a spoofed X-Forwarded-For would defeat the
  // limiter assertions below (and, in production, the limiter itself).
  process.env.TRUST_PROXY_HOPS = '0';
  // Stops server.js from grabbing port 3030 on import; the test binds its own.
  process.env.NODE_ENV = 'test';

  const { default: app } = await import('./server.js');
  server = app.listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}/admin/api`;
});

after(() => server?.close());

const post = (path, body) =>
  fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('POST /u/auth/google', () => {
  test('rejects a request with no token (400, JSON error)', async () => {
    const res = await post('/u/auth/google', {});
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.ok(body.error, 'error message is present');
  });

  test('rejects a forged token with 401 and never echoes it back', async () => {
    const forged = 'aaaa.bbbb.cccc-not-a-real-signature';
    const res = await post('/u/auth/google', { idToken: forged });

    assert.equal(res.status, 401);
    const text = await res.text();
    assert.ok(!text.includes(forged), 'the response must not echo the token');
  });

  test('accepts the snake_case alias id_token', async () => {
    // Long enough to clear the cheap length guard, so it actually reaches
    // Google's verifier: 401 (token seen, verification failed) rather than
    // 400 (nothing supplied) is what proves the alias is read.
    const res = await post('/u/auth/google', {
      id_token: `${'a'.repeat(30)}.${'b'.repeat(30)}.${'c'.repeat(30)}`,
    });
    assert.equal(res.status, 401);
  });
});

describe('POST /u/login guard for Google-only accounts', () => {
  test('tells a passwordless user to use Google instead of failing generically',
    async () => {
      const db = await import('./db.js');
      await db.insertUser({
        id: 'google-only',
        name: 'Google Only',
        email: 'googleonly@example.com',
        avatar: '🦅',
        passwordHash: null,
        googleSub: 'sub-google-only',
        state: { xp: 0, coins: 50, completedLessons: [] },
      });

      const res = await post('/u/login', {
        email: 'googleonly@example.com',
        password: 'anything',
      });

      assert.equal(res.status, 401);
      const body = await res.json();
      assert.match(body.error, /Google/, 'the message should point at Google sign-in');
    });
});

describe('rate limiting', () => {
  test('/u/login throttles after the configured burst', async () => {
    let sawLimit = false;

    // The limiter allows 20 per 15 minutes; the earlier tests in this file
    // already consumed a couple, so 30 attempts is comfortably past it.
    for (let i = 0; i < 30; i++) {
      const res = await post('/u/login', {
        email: `brute${i}@example.com`,
        password: 'wrong-password',
      });
      if (res.status === 429) {
        sawLimit = true;
        const body = await res.json();
        assert.ok(body.error, '429 carries a human-readable message');
        break;
      }
    }

    assert.ok(sawLimit, 'repeated failed logins must eventually be throttled');
  });
});

describe('GET /public/config', () => {
  test('exposes the Google client ID so the client can show the button',
    async () => {
      const res = await fetch(`${base}/public/config`);
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.googleClientId, 'test-client-id.apps.googleusercontent.com');
    });
});
