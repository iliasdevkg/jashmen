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
// Fire-and-forget analytics — callers should .catch(() => {}) this, never
// let a telemetry failure block or surface in the UI.
export const logEvent = (token, type, payload) =>
  req('POST', '/u/log-event', { type, ...payload }, token);

export const fetchPushPublicKey = () => req('GET', '/public/push-key');
export const subscribePush = (token, subscription) =>
  req('POST', '/u/me/push/subscribe', { subscription }, token);
export const unsubscribePush = (token, endpoint) =>
  req('POST', '/u/me/push/unsubscribe', { endpoint }, token);
