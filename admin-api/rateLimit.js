// admin-api/rateLimit.js — brute-force brakes on the credential endpoints.
//
// Until now nothing throttled /u/login, /u/signup or the admin login: a
// dictionary attack was bounded only by network speed, against a single
// shared admin password and users' own passwords. Adding Google sign-in
// doesn't change that, so the limiter lands here alongside it.
//
// In-process counters (the default memory store) are the right scope for
// this deployment: one Node process, one container. If this ever runs more
// than one replica, swap the store for Redis — otherwise each replica would
// enforce its own allowance and the effective limit multiplies.

import rateLimit from 'express-rate-limit';

// The app sits behind nginx, which sets X-Forwarded-For. server.js sets
// `trust proxy` so req.ip is the real client rather than 127.0.0.1 — without
// that, every request shares one bucket and the first attacker locks out
// everyone.
const common = {
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  // Counting only failures would let an attacker with one valid account
  // hammer freely; count everything, but keep the window generous enough
  // that a person mistyping a password a few times is unaffected.
  skipSuccessfulRequests: false,
};

/** Credential checks: login, Google sign-in. */
export const authLimiter = rateLimit({
  ...common,
  windowMs: 15 * 60 * 1000,
  limit: 20,
  message: { error: 'Өтө көп аракет. 15 мүнөттөн кийин кайра аракет кылыңыз.' },
});

/** Account creation — tighter, since one person needs this at most once. */
export const signupLimiter = rateLimit({
  ...common,
  windowMs: 60 * 60 * 1000,
  limit: 10,
  message: { error: 'Өтө көп катталуу аракети. Бир сааттан кийин аракет кылыңыз.' },
});

/** The admin panel's single shared password — the highest-value target. */
export const adminLoginLimiter = rateLimit({
  ...common,
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: { error: 'Өтө көп аракет. 15 мүнөттөн кийин кайра аракет кылыңыз.' },
});

/// User-uploaded avatars. Uploads are capped at 25MB each and old files are
/// never reclaimed, so an authenticated account could otherwise loop the
/// endpoint and fill the disk — a few per hour is far more than anyone
/// changing their picture needs.
export const uploadLimiter = rateLimit({
  ...common,
  windowMs: 60 * 60 * 1000,
  limit: 10,
  message: { error: 'Өтө көп сүрөт жүктөө. Бир сааттан кийин аракет кылыңыз.' },
});
