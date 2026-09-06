const B = '/admin/api';

// `credentials: 'include'` on every call — the refresh-token cookie (set
// by login/signup/refresh, read by /u/refresh and /u/logout) is httpOnly
// and same-path-proxied, so this is what actually gets it sent; the
// short-lived access token stays in memory (store.jsx) and rides along as
// a normal Authorization header, same as before.
// Two things pull against each other here, and the split below is how they
// are settled.
//
// SPEED. A request that never answers is worse than one that fails, and
// `fetch` has no timeout of its own. Measured round trips to
// jashmenstudio.com are ~280ms from a phone on 4G and ~340ms from a desktop,
// so a read gives up after one second — fast enough that a dead connection
// is obvious almost immediately.
//
// SURVIVAL. One second is about 2.5x the typical round trip, which is not
// much margin: a weak signal, a congested cell, a cold container all take
// longer than that legitimately. So a read that times out is simply asked
// again with more room. The common case still resolves in under a second;
// the bad case still resolves, just not as fast.
const READ_BUDGETS_MS = [1_000, 3_000, 6_000];

// A WRITE gets one patient attempt and is never repeated, because every
// write this app makes would do real damage twice:
//
//   /u/me/redeem        pops a promo code off a finite pool and charges coins
//   /u/me/buy           charges coins
//   /u/me/streak/repair spends energy
//   /u/me/lesson        awards XP and spends energy
//   /u/refresh          burns a single-use session token (db.js#rotateSession
//                       revokes the old one), so a repeat logs the user out
//   /u/me/password      revokes every other session
//
// A timeout is not proof the server did nothing — it is only proof that the
// answer did not arrive. Retrying on that would be gambling with the
// learner's coins, so a write waits instead.
const WRITE_BUDGET_MS = 10_000;

/// One attempt, with its own abort budget. Rejects with `code: 'no-answer'`
/// when nothing came back, which is the only condition a retry is allowed to
/// act on — an HTTP error status means the server DID answer and repeating
/// the request would not change that.
async function attempt(url, init, budgetMs) {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), budgetMs);
  try {
    return await fetch(url, { ...init, signal: abort.signal });
  } catch (e) {
    const err = new Error(
      e?.name === 'AbortError'
        ? 'Сервер жооп бербей жатат. Кайра аракет кылыңыз.'
        : 'Интернет байланышы жок окшойт.',
    );
    err.status = 0;
    err.code = 'no-answer';
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function req(method, path, body, token) {
  const init = {
    method,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body != null ? JSON.stringify(body) : undefined,
  };
  // GET is the only method here that is safe to send twice. Everything else
  // is a write, and a write gets exactly one attempt — see WRITE_BUDGET_MS.
  const budgets = method === 'GET' ? READ_BUDGETS_MS : [WRITE_BUDGET_MS];

  let res;
  for (let i = 0; i < budgets.length; i++) {
    try {
      res = await attempt(`${B}${path}`, init, budgets[i]);
      break;
    } catch (err) {
      // Out of attempts, or something other than silence — either way the
      // caller hears about it rather than the request being repeated.
      if (i === budgets.length - 1 || err.code !== 'no-answer') throw err;
    }
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Ката ${res.status}`);
    // store.jsx's silent-refresh cycle needs this to tell "the session is
    // genuinely gone (401)" apart from "that one request failed" (network
    // blip, 5xx) — only the former should log the user out.
    err.status = res.status;
    throw err;
  }
  return data;
}

export const fetchContent = () => req('GET', '/public/content');
export const fetchPublicConfig = () => req('GET', '/public/config');
// Four aggregate counters for the landing page's stats band. Public and
// anonymous by design — nothing here identifies a user.
export const fetchPublicStats = () => req('GET', '/public/stats');

// A partnership enquiry or a piece of user feedback, from the public forms.
// Unauthenticated on purpose: a bank's marketing lead is not going to create
// a learner account to write to us. The server validates and rate-limits it
// (admin-api/leads.js), and the reply lands in the panel's inbox.
export const submitEnquiry = (payload) => req('POST', '/public/enquiry', payload);

// Exchanges a Google id_token for this app's own session. The server
// verifies the token, then issues the same access JWT + refresh cookie the
// password path does — so the caller treats the result exactly like
// apiLogin's.
export const apiGoogleAuth = (idToken) => req('POST', '/u/auth/google', { idToken });
export const fetchLeaderboard = (n = 50) => req('GET', `/u/leaderboard?limit=${n}`);
export const apiLogin = (email, password) => req('POST', '/u/login', { email, password });
export const apiSignup = (name, email, password, avatar) =>
  req('POST', '/u/signup', { name, email, password, avatar });
// Silently exchanges the httpOnly refresh cookie for a fresh access token
// — no token to send here, the cookie does the work. 401 means there's no
// live session (never logged in, or the refresh token expired/was revoked).
export const apiRefresh = () => req('POST', '/u/refresh');
// Real server-side logout — revokes the session backing the refresh
// cookie and clears it. Safe to call even with no live session.
export const apiLogout = () => req('POST', '/u/logout');

// Deletes the signed-in account. Both stores require this of any app that
// can create one, and the web carries it too because the account is the same
// account — someone who signed up in a browser must be able to leave from a
// browser. What it does is in admin-api/db.js#anonymizeUser.
//
// One of `password` or `confirm` is required by the server, depending on
// whether the account has a password at all.
export const deleteAccount = (token, { password, confirm } = {}) =>
  req('DELETE', '/u/me', { password, confirm }, token);
export const fetchMe = (token) => req('GET', '/u/me', null, token);
export const claimDaily = (token) => req('POST', '/u/me/daily', null, token);
// Buys a broken streak back with energy, on the day it broke. Rejects with
// a 400 once the day is over or the energy is gone — the button is hidden
// in both cases, so a rejection here means the tab was left open past
// midnight, and the error text says so.
export const repairStreak = (token) => req('POST', '/u/me/streak/repair', null, token);
export const completeLesson = (token, lessonId, mistakes, isReview) =>
  req('POST', '/u/me/lesson', { lessonId, mistakes, isReview }, token);
export const buyItem = (token, itemId, price, kind) =>
  req('POST', '/u/me/buy', { itemId, price, kind }, token);
export const patchState = (token, patch) =>
  req('PATCH', '/u/me/state', patch, token);
export const redeemPrize = (token, prizeId) =>
  req('POST', '/u/me/redeem', { prizeId }, token);
// The coupon history behind redeemPrize's one-shot code modal — newest
// first, with prize/partner details joined server-side.
export const fetchMyRedemptions = (token) =>
  req('GET', '/u/me/redemptions', null, token);
// Fire-and-forget analytics — callers should .catch(() => {}) this, never
// let a telemetry failure block or surface in the UI.
export const logEvent = (token, type, payload) =>
  req('POST', '/u/log-event', { type, ...payload }, token);

// Task 6 — learner avatar upload. Separate from `req()` because a file
// upload is FormData, not JSON: no Content-Type header set here on purpose
// — the browser fills in the multipart boundary itself, same convention
// admin-src/api.js#uploadMedia uses for the admin-side uploader.
export async function uploadAvatar(token, file) {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${B}/u/me/avatar`, {
    method: 'POST',
    credentials: 'include',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Ката ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

// ── Account ─────────────────────────────────────────────────────────────

// Self-serve password change. `currentPassword` is omitted for a
// Google-only account (user.hasPassword === false) — that account is
// setting its first password, so there is nothing to prove. Resolves to
// { token, user }: the server revokes every other session and hands this
// device a fresh pair, so the caller MUST adopt the returned token.
export const changePassword = (token, currentPassword, newPassword) =>
  req('POST', '/u/me/password', { currentPassword, newPassword }, token);

// ── University league ───────────────────────────────────────────────────

// Persists the campus + role the picker collected. Pass both null to leave
// the league. Resolves to the updated public user.
export const setUniversity = (token, universityId, role) =>
  req('PUT', '/u/me/university', { universityId, role }, token);

// The live board for one campus: students ranked by XP, the viewer count
// behind the eye badge, and where the caller sits.
export const fetchUniBoard = (token, universityId, limit = 10) =>
  req('GET', `/u/university/${encodeURIComponent(universityId)}/board?limit=${limit}`, null, token);

// A viewer hands a student energy out of their own pool. 429 means this
// viewer already gave one away in the current refill period.
export const sendSupportEnergy = (token, toUserId) =>
  req('POST', '/u/university/support', { toUserId }, token);

// "СЕНИ КОЛДОГОНДОР" — everyone who has backed the caller, one row each.
export const fetchSupporters = (token) =>
  req('GET', '/u/me/supporters', null, token);

export const fetchPushPublicKey = () => req('GET', '/public/push-key');
export const subscribePush = (token, subscription) =>
  req('POST', '/u/me/push/subscribe', { subscription }, token);
export const unsubscribePush = (token, endpoint) =>
  req('POST', '/u/me/push/unsubscribe', { endpoint }, token);
