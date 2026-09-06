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

const EMPTY_STATE = () => ({ users: [], redemptions: [], sessions: [], energyGifts: [] });

// One-time migration for db.json files written before the coins/energy
// rework: `gems` → `coins` (keeping the balance, not resetting it to 0),
// and drop the now-unused hearts fields. Runs on every load; a no-op once
// a file has already been migrated.
//
// Also backfills the two XP counters added with the split-league scoring
// (routes.js#awardXp). `lifetimeXp` seeds from the existing `xp` — before
// the split every point earned did land there, so that IS the lifetime
// total. `uniXp` seeds at 0 on purpose, including for people already
// enrolled: nobody's general-league score may leak onto a campus board.
function migrate(state) {
  if (!Array.isArray(state.redemptions)) state.redemptions = [];
  if (!Array.isArray(state.sessions)) state.sessions = [];
  if (!Array.isArray(state.energyGifts)) state.energyGifts = [];
  for (const user of state.users || []) {
    const s = user.state;
    if (!s) continue;
    if (s.gems !== undefined && s.coins === undefined) s.coins = s.gems;
    if (s.lifetimeXp === undefined) s.lifetimeXp = s.xp || 0;
    if (s.uniXp === undefined) s.uniXp = 0;
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
  // Stamped here rather than by each caller (routes.js signup, googleAuth.js)
  // so every new user gets it the same way — used by the admin's
  // "Катталган" (registered) column. Users inserted before this existed have
  // no createdAt; the admin UI shows those as "белгисиз" (unknown).
  user.createdAt = Date.now();
  state.users.push(user);
  await persist();
  return user;
}

export async function deleteUser(id) {
  const idx = state.users.findIndex(u => u.id === id);
  if (idx === -1) return false;
  state.users.splice(idx, 1);
  await persist();
  return true;
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

// Headline numbers for the admin's "Жалпы статистика" (overall stats)
// panel — same style as funnel()/questionHeatmap() in events.js: a thin
// aggregation over data that's already in memory, no separate store.
export function overview() {
  const users = state.users;
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  let totalXp = 0, totalCoins = 0, totalLessonsCompleted = 0, activeLast7Days = 0;
  for (const u of users) {
    const s = u.state || {};
    totalXp += s.lifetimeXp || 0; // lifetime, so a campus-board reset can't shrink it
    totalCoins += s.coins || 0;
    totalLessonsCompleted += (s.completedLessons || []).length;
    if (s.lastActiveDate && s.lastActiveDate >= cutoff) activeLast7Days += 1;
  }
  return { totalUsers: users.length, totalXp, totalCoins, totalLessonsCompleted, activeLast7Days };
}

/// The student side of the roster, split the way the two leagues are.
///
/// "Student" here means someone who joined a campus AS a student — the role
/// that competes on a campus board. A viewer picked a campus too, but their
/// points go to the general league, so counting them among students would
/// overstate every campus.
///
/// Everything is computed from the user records in one pass; the caller
/// resolves campus ids to names, which is content the database does not hold.
export function studentOverview({ activeCutoffDate, onlineIds = [] } = {}) {
  const online = new Set(onlineIds);
  const byUni = new Map();

  let students = 0, viewers = 0, general = 0;
  let studentXp = 0, studentLessons = 0, studentsActive = 0, studentsOnline = 0;

  const bump = (uniId) => {
    if (!byUni.has(uniId)) {
      byUni.set(uniId, {
        uniId, students: 0, viewers: 0, xp: 0,
        lessonsCompleted: 0, active: 0, online: 0, topXp: 0,
        // Who they actually are, ranked, so the panel can print the roll
        // rather than only a headcount. Students only — a viewer supports a
        // campus but does not compete for it.
        roster: [],
      });
    }
    return byUni.get(uniId);
  };

  for (const u of state.users) {
    const st = u.state || {};
    const isActive = Boolean(activeCutoffDate) && st.lastActiveDate >= activeCutoffDate;
    const isOnline = online.has(u.id);

    if (st.uniId && st.uniRole === 'student') {
      students += 1;
      // The campus score, not the lifetime total: this is what the campus
      // board ranks on, and it resets when somebody joins or leaves.
      const xp = st.uniXp || 0;
      const done = (st.completedLessons || []).length;
      studentXp += xp;
      studentLessons += done;
      if (isActive) studentsActive += 1;
      if (isOnline) studentsOnline += 1;

      const row = bump(st.uniId);
      row.students += 1;
      row.xp += xp;
      row.lessonsCompleted += done;
      if (isActive) row.active += 1;
      if (isOnline) row.online += 1;
      if (xp > row.topXp) row.topXp = xp;
      row.roster.push({
        id: u.id,
        name: u.name,
        email: u.email,
        avatar: u.avatar,
        xp,
        lessonsCompleted: done,
        streak: st.streak || 0,
        lastActiveDate: st.lastActiveDate || null,
        active: isActive,
        online: isOnline,
        joinedAt: st.uniJoinedAt || null,
      });
    } else if (st.uniId && st.uniRole === 'viewer') {
      viewers += 1;
      bump(st.uniId).viewers += 1;
    } else {
      general += 1;
    }
  }

  return {
    // The three populations, which add up to every account.
    students, viewers, generalOnly: general,
    studentXp, studentLessons, studentsActive, studentsOnline,
    byUniversity: [...byUni.values()]
      .map(row => ({
        ...row,
        // Highest campus score first — the same order the learners see on
        // the board they are competing on.
        roster: row.roster.sort((a, b) => b.xp - a.xp),
      }))
      .sort((a, b) => b.students - a.students),
  };
}

// ── Redemptions ─────────────────────────────────────────────────────────

// Records a redemption. Synchronous, and deliberately so: the caller
// (routes.js#/u/me/redeem) takes the promo code out of the pool in the same
// unbroken run, with no `await` in between, and that is what stops two
// concurrent requests from being handed the same code.
//
// This used to also enforce a house-wide "N prizes a day" cap. That cap
// predates promo-code stock: back then nothing limited how many coupons a
// prize could issue, so a daily ceiling was the only brake. Each prize now
// carries its own finite pool of codes (contentStore.js#prizeStock), which
// is a real inventory rather than a guess, so the ceiling only stopped
// people buying prizes that were genuinely in stock.
//
// Persistence is the caller's job (saveUser()/persist right after).
export function addRedemption(entry) {
  state.redemptions.push(entry);
}

/// Undoes an addRedemption that was never persisted — see
/// routes.js#/u/me/redeem, where a failed disk write has to leave the
/// learner's coins and the partner's code exactly as it found them.
export function removeRedemption(id) {
  const i = state.redemptions.findIndex(r => r.id === id);
  if (i >= 0) state.redemptions.splice(i, 1);
}

export function listRedemptions() {
  return state.redemptions;
}

/// Every coupon issued between two dates (inclusive), oldest first.
///
/// The filter is on the stored `date` string rather than on `ts`, because
/// `date` is the UTC day the sale was booked against — the same day the
/// daily cap counted it under — and comparing "YYYY-MM-DD" strings is
/// exactly comparing the dates they spell.
export function redemptionsBetween(fromDate, toDate) {
  return state.redemptions
    .filter(r => r.date >= fromDate && r.date <= toDate)
    .sort((a, b) => (a.ts || 0) - (b.ts || 0));
}

/// The first day a coupon was ever issued, or null. Lets the admin's range
/// picker open on the whole history instead of a guessed window.
export function firstRedemptionDate() {
  let first = null;
  for (const r of state.redemptions) {
    if (r.date && (first === null || r.date < first)) first = r.date;
  }
  return first;
}

/// Marks a coupon as handed over to the partner, or takes the mark back.
///
/// A nullable timestamp rather than a boolean: it answers "when" for free,
/// reads as false-y while unset, and needs no migration for the records
/// written before the field existed. Persists here because the only other
/// redemption writer (addRedemption) deliberately does not, and
/// persist() is module-private.
export async function setRedemptionFulfilled(id, fulfilled) {
  const row = state.redemptions.find(r => r.id === id);
  if (!row) return null;
  row.fulfilledAt = fulfilled ? Date.now() : null;
  await persist();
  return row;
}

// ── University league: viewer → student energy gifts ────────────────────
//
// One row per gift, kept rather than folded into a counter because the
// player's "СЕНИ КОЛДОГОНДОР" sheet has to name every supporter. Written
// by routes.js#/u/university/support, which has already reserved the
// giver's once-per-period slot on their own state, so no cap logic lives
// here — this is pure append + query.

export function addEnergyGift(gift) {
  state.energyGifts.push(gift);
  return gift;
}

// Newest first. Callers aggregate per supporter themselves.
export function listEnergyGiftsTo(userId) {
  return state.energyGifts.filter(g => g.toUserId === userId).sort((a, b) => (b.ts || 0) - (a.ts || 0));
}

// How many distinct people have backed each student of a university —
// rendered as the small count next to a name on the league board.
export function countSupportersByUniversity(universityId) {
  const byStudent = new Map();
  for (const gift of state.energyGifts) {
    if (gift.universityId !== universityId) continue;
    if (!byStudent.has(gift.toUserId)) byStudent.set(gift.toUserId, new Set());
    byStudent.get(gift.toUserId).add(gift.fromUserId);
  }
  return byStudent;
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
// as addRedemption) — refresh-token rotation, so a stolen-and-
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

// Kills every live session a user has — used after a self-serve password
// change so a stolen refresh token stops working the moment the real owner
// notices. The caller issues itself a fresh pair right after, so the device
// that made the change stays signed in.
export async function revokeUserSessions(userId) {
  let revoked = 0;
  for (const session of state.sessions) {
    if (session.type !== 'user' || session.userId !== userId) continue;
    if (session.revokedAt || session.expiresAt < Date.now()) continue;
    session.revokedAt = Date.now();
    revoked += 1;
  }
  if (revoked) await persist();
  return revoked;
}

export async function revokeSession(token, expectedType) {
  const session = findLiveSession(token, expectedType);
  if (!session) return false;
  session.revokedAt = Date.now();
  await persist();
  return true;
}
