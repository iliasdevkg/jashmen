// admin-api/cookies.js
//
// One place for the refresh-token cookie attributes so user and admin auth
// can't drift apart. Both /admin/api/u/* and /admin/api/admin/* are always
// reached through a same-path proxy from the client's own origin (Vite's
// dev proxy locally, whatever reverse proxy fronts jashmenstudio.com in
// production) — but the exact production topology (same-origin path proxy
// vs. a genuinely cross-origin hop) isn't fully pinned down as of this
// writing. SameSite=None + Secure is the one setting that's *correct*
// either way: it works for a same-origin request (strictly more permissive
// than Lax there, not incorrect) and is *required* for a cross-origin one.
// If the production topology is later confirmed same-origin, this can be
// tightened to SameSite=Lax for stronger CSRF defense-in-depth — nothing
// else about the auth flow needs to change to make that switch.
//
// Not a CSRF hole even at SameSite=None: the refresh cookie only feeds
// /u/refresh and /admin/api/admin/refresh, and every *protected* route
// still requires the short-lived access JWT in an Authorization header,
// which a cross-site request (no XSS, just a forged form/fetch from
// another origin) cannot attach — it doesn't have the token, and CORS
// (no permissive Access-Control-Allow-Origin is configured) stops it from
// reading a /refresh response even if it could trigger one.

const isProd = process.env.NODE_ENV === 'production';

export function setRefreshCookie(res, name, token, ttlMs) {
  res.cookie(name, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge: ttlMs,
    path: '/admin/api',
  });
}

export function clearRefreshCookie(res, name) {
  res.clearCookie(name, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    path: '/admin/api',
  });
}
