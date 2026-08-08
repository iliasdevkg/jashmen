// admin-api/db.js
//
// JSON-document datastore with two interchangeable backends, same idea as
// uploads.js's media storage but a DIFFERENT (private) Blob store —
// db.json holds emails, coin/xp state, and session records, so it must
// never share a store — let alone a token — with anything served
// publicly (see uploads.js's MEDIA_READ_WRITE_TOKEN for the public one):
//
//   - BLOB_READ_WRITE_TOKEN set  → Vercel Blob, access:'private' (requires
//     the token to read — this is not a publicly-fetchable URL the way
//     uploaded media is). Survives a serverless/ephemeral deploy (local
//     disk doesn't — a fresh cold-start container has none of the
//     previous invocation's writes). This is what makes it safe to
//     deploy this backend to Vercel at all.
//   - unset (default, local dev) → admin-api/data/db.json, tmp-file +
//     rename so a crash mid-write can't corrupt it.
//
// Either way: loaded ONCE into memory (this file's top-level `await`
// blocks the module — and so the whole server — from serving a request
// until that load finishes), mutated in memory, written back whole on
// every persist() call. That's a real limitation carried over from the
// disk-only version, not something Blob fixes on its own: two concurrent
// serverless invocations each hold their OWN in-memory copy of `state`
// (nothing here is shared across invocations except via Blob reads/
// writes), so under true concurrent writes to the same record, whichever
// persist() lands last wins and silently overwrites the other's change.
// Acceptable for this app's actual write pattern (one shared admin
// identity, a modest user base, no high-frequency concurrent writes to
// the same user/session) — NOT a substitute for a real transactional
// store (Postgres/etc.) if this ever needs to handle that.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { put, get } from '@vercel/blob';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN || null;
const DB_BLOB_PATHNAME = 'db.json';

if (!BLOB_TOKEN) {
  console.warn(
    '[db] BLOB_READ_WRITE_TOKEN is not set — the user/session database\n' +
    '     saves to local disk (admin-api/data/db.json), which does NOT\n' +
    '     survive a serverless/ephemeral deploy. Create a Blob store in\n' +
    '     the Vercel dashboard and set this in admin-api/.env before\n' +
    '     deploying this backend to production.'
  );
}

const EMPTY_STATE = () => ({ users: [], redemptions: [], sessions: [] });

// One-time migration for db.json files written before the coins/energy
// rework: `gems` → `coins` (keeping the balance, not resetting it to 0),
// and drop the now-unused hearts fields. Runs on every load; a no-op once
// a file has already been migrated.
function migrate(state) {
  if (!Array.isArray(state.redemptions)) state.redemptions = [];
  if (!Array.isArray(state.sessions)) state.sessions = [];
  for (const user of state.users || []) {
    const s = user.state;
    if (!s) continue;
    if (s.gems !== undefined && s.coins === undefined) s.coins = s.gems;
    delete s.gems;
    delete s.hearts;
    delete s.heartsRefilledAt;
  }
  return state;
}

function loadFromDisk() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(EMPTY_STATE(), null, 2));
  }
  try {
    return migrate(JSON.parse(fs.readFileSync(DB_FILE, 'utf8')));
  } catch (err) {
    console.error('[db] db.json is corrupt, starting from an empty store:', err.message);
    return EMPTY_STATE();
  }
}

// `access: 'private'` is load-bearing, not just an access-control choice —
// it's also what makes `useCache: false` actually take effect: the
// installed SDK only sends the cache-busting request when access is
// 'private' (a public blob is always read straight off the CDN, private
// or not). Without it, a read right after a write could silently hand
// back a stale pre-write snapshot — this is why db.json/content.json
// live in a SEPARATE Blob store from uploads.js's public media store,
// not just for the access-control reason.
//
// Deliberately does NOT catch-and-fall-back-to-EMPTY_STATE() here on a
// thrown error (a real earlier version of this function did, and it was
// a genuine data-loss bug: a transient network blip / rate limit / bad
// token makes get() throw, gets treated identically to "nothing written
// yet", and the very next persist() call — e.g. from the same request
// that triggered the failed read — writes that "empty" state right back
// over whatever real data was actually there). `get()` returning `null`
// (not throwing) is how the SDK signals a genuine "not found", which IS
// the correct case for EMPTY_STATE(); anything that throws is left to
// propagate, failing this cold start loudly (Vercel returns an error for
// that invocation) rather than silently proceeding as if the store were
// empty.
async function loadFromBlobStore() {
  const result = await get(DB_BLOB_PATHNAME, { access: 'private', useCache: false, token: BLOB_TOKEN });
  if (!result) return EMPTY_STATE(); // nothing written yet — first boot of a fresh store
  const text = await new Response(result.stream).text();
  return migrate(JSON.parse(text));
}

const state = BLOB_TOKEN ? await loadFromBlobStore() : loadFromDisk();

function persistToDisk() {
  return new Promise((resolve, reject) => {
    const tmp = `${DB_FILE}.tmp`;
    fs.writeFile(tmp, JSON.stringify(state, null, 2), err => {
      if (err) return reject(err);
      fs.rename(tmp, DB_FILE, err2 => (err2 ? reject(err2) : resolve()));
    });
  });
}

function persistToBlob() {
  return put(DB_BLOB_PATHNAME, JSON.stringify(state, null, 2), {
    access: 'private',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
    token: BLOB_TOKEN,
  });
}

let writeChain = Promise.resolve();

// writeChain exists purely to SERIALIZE writes (so two persist() calls in
// flight at once can't interleave/clobber each other) — it must never end
// up permanently rejected, or every persist() call after the first
// failure would short-circuit without running at all. So the chain used
// for sequencing always swallows its own rejection (logging it); the
// PROMISE RETURNED TO THE CALLER (`task`) is the un-swallowed original,
// so `await persist()` genuinely rejects when the write actually failed
// instead of a caller (e.g. a purchase or a signup) reporting success
// over a write that never landed.
function persist() {
  const task = writeChain.then(() => (BLOB_TOKEN ? persistToBlob() : persistToDisk()));
  writeChain = task.catch(err => console.error('[db] failed to persist db.json:', err));
  return task;
}

export function findUserByEmail(email) {
  const normalized = String(email || '').toLowerCase().trim();
  return state.users.find(u => u.email === normalized) || null;
}

export function findUserById(id) {
  return state.users.find(u => u.id === id) || null;
}

export async function insertUser(user) {
  state.users.push(user);
  await persist();
  return user;
}

export async function saveUser(user) {
  const idx = state.users.findIndex(u => u.id === user.id);
  if (idx === -1) throw new Error(`[db] cannot save unknown user ${user.id}`);
  state.users[idx] = user;
  await persist();
  return user;
}

export function listUsers() {
  return state.users;
}

// ── Redemptions (Module В: Daily Cap Protection) ────────────────────────

// Atomically checks the daily cap AND reserves the slot in one synchronous
// step — no `await` between the count-check and the state.redemptions.push,
// so two concurrent /u/me/redeem requests can't both observe the same
// stale count before either commits. (The function this replaced,
// addRedemption(), only pushed *after* the caller had already awaited
// db.saveUser() — that yield was the race window: a second request's cap
// check could run before the first request's redemption was ever pushed.)
// Mirrors energy.js#spendEnergy's synchronous check-then-mutate pattern.
// Persistence is the caller's job (call saveUser()/persist right after) —
// this only guarantees the in-memory reservation itself is atomic.
export function reserveRedemptionSlot(entry, dailyCap) {
  const count = state.redemptions.filter(r => r.date === entry.date).length;
  if (count >= dailyCap) return false;
  state.redemptions.push(entry);
  return true;
}

export function countRedemptionsToday(dateStr) {
  return state.redemptions.filter(r => r.date === dateStr).length;
}

export function listRedemptions() {
  return state.redemptions;
}

// ── Sessions (refresh tokens) — Task 2: JWT storage migration ──────────
//
// A "session" is the server-side record backing a long-lived refresh
// token. The refresh token itself is a random opaque string handed to the
// client only via an httpOnly cookie (never readable by JS); only its
// SHA-256 hash is stored here, so a leaked db.json snapshot can't be
// replayed as a live session. Short-lived access JWTs (see auth.js /
// adminAuth.js) are minted from a valid session and never touch this
// store — this is purely for the thing that makes them renewable AND
// revocable (unlike the old 30-day/12h JWTs, which had no way to be
// invalidated server-side before they naturally expired).

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function newOpaqueToken() {
  return crypto.randomBytes(32).toString('base64url');
}

// type: 'user' | 'admin'. userId is null for admin sessions (there's only
// ever one shared admin identity — see adminAuth.js).
export async function createSession({ type, userId = null, ttlMs }) {
  const token = newOpaqueToken();
  state.sessions.push({
    tokenHash: hashToken(token),
    type,
    userId,
    createdAt: Date.now(),
    expiresAt: Date.now() + ttlMs,
    revokedAt: null,
  });
  await persist();
  return token;
}

// expectedType is required and checked BEFORE anything else — a token
// presented to the wrong endpoint (a user refresh token sent to the admin
// refresh route, or vice versa) must be rejected here, untouched, not
// after some caller-side check that runs only once rotate/revoke has
// already mutated and persisted state. (An earlier version of this
// function looked sessions up by hash alone and left the type check to
// the caller, which meant a cross-type token still got revoked+rotated —
// or flat-out revoked — before the caller ever found out it was the
// wrong type. That's the bug this signature exists to make impossible.)
function findLiveSession(token, expectedType) {
  const hash = hashToken(token);
  const session = state.sessions.find(s => s.tokenHash === hash);
  if (!session || session.type !== expectedType || session.revokedAt || session.expiresAt < Date.now()) return null;
  return session;
}

// Atomically revokes the presented refresh token and mints its
// replacement in one synchronous step (same reserve-before-persist shape
// as reserveRedemptionSlot) — refresh-token rotation, so a stolen-and-
// reused token is detected: once rotated, the old token's hash no longer
// matches any live session, so a replay of it (e.g. by an attacker who
// captured it in transit) fails findLiveSession on the *next* attempt.
// Returns null if the presented token isn't a currently-live session OF
// THE EXPECTED TYPE — in that case nothing is mutated or persisted.
export async function rotateSession(oldToken, ttlMs, expectedType) {
  const session = findLiveSession(oldToken, expectedType);
  if (!session) return null;
  session.revokedAt = Date.now();
  const newToken = newOpaqueToken();
  state.sessions.push({
    tokenHash: hashToken(newToken),
    type: session.type,
    userId: session.userId,
    createdAt: Date.now(),
    expiresAt: Date.now() + ttlMs,
    revokedAt: null,
  });
  await persist();
  return { newToken, type: session.type, userId: session.userId };
}

export async function revokeSession(token, expectedType) {
  const session = findLiveSession(token, expectedType);
  if (!session) return false;
  session.revokedAt = Date.now();
  await persist();
  return true;
}
