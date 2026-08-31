const B = '/admin/api';

// `credentials: 'include'` on every call — the refresh-token cookie (set
// by login/signup/refresh, read by /u/refresh and /u/logout) is httpOnly
// and same-path-proxied, so this is what actually gets it sent; the
// short-lived access token stays in memory (store.jsx) and rides along as
// a normal Authorization header, same as before.
async function req(method, path, body, token) {
  const res = await fetch(`${B}${path}`, {
    method,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body != null ? JSON.stringify(body) : undefined,
  });
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
export const fetchMe = (token) => req('GET', '/u/me', null, token);
export const claimDaily = (token) => req('POST', '/u/me/daily', null, token);
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
