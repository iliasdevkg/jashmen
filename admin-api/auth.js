// admin-api/auth.js — password hashing, JWT issuing/verification, auth middleware.
//
// Two-token model (Task 2 — JWT storage migration): a short-lived access
// JWT (15 min) that the client keeps in memory only (never localStorage,
// never a cookie), plus a long-lived refresh token — a random opaque
// string, delivered solely via an httpOnly cookie and tracked server-side
// in db.js's session store, so it's actually revocable (logout) instead
// of just expiring on its own 30 days later with no way to cut it short.
// db.revokeSession() is the primitive; today the only caller is each
// user's own /u/logout reading their own cookie — an operator-facing
// "kill this user's session(s) on demand" endpoint doesn't exist yet, but
// the primitive it would sit on top of already does.

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import * as db from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'jashmen-dev-secret-change-me';
if (!process.env.JWT_SECRET) {
  console.warn(
    '[auth] JWT_SECRET is not set — using an insecure development default.\n' +
    '        Set JWT_SECRET in admin-api/.env (or the environment) before deploying.'
  );
}

const ACCESS_TOKEN_TTL = '15m';
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days — same "remember me" horizon the old 30d JWT gave, but now revocable
export const REFRESH_COOKIE_NAME = 'jashmen_refresh';

const SALT_ROUNDS = 10;

export function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export function signAccessToken(userId) {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL });
}

// Called right after login/signup to start a new session — issues the
// refresh token whose hash gets stored server-side (see db.js#createSession).
export function issueRefreshToken(userId) {
  return db.createSession({ type: 'user', userId, ttlMs: REFRESH_TOKEN_TTL_MS });
}

// Exchanges a live refresh token for a new access token, rotating the
// refresh token in the same step. Returns null if the presented token
// isn't a currently-live *user* session — expired, already revoked,
// already rotated away (see db.js#rotateSession for the reuse-detection
// angle), or, just as importantly, a token of the wrong type (e.g. an
// admin refresh token replayed here) — db.js#rotateSession checks type
// before it mutates anything, so a wrong-type token is rejected without
// touching the session it actually belongs to.
export async function refreshAccessToken(refreshToken) {
  const rotated = await db.rotateSession(refreshToken, REFRESH_TOKEN_TTL_MS, 'user');
  if (!rotated) return null;
  return {
    accessToken: signAccessToken(rotated.userId),
    refreshToken: rotated.newToken,
    userId: rotated.userId,
  };
}

export function revokeRefreshToken(refreshToken) {
  return db.revokeSession(refreshToken, 'user');
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Кирүү керек' });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.sub;
    next();
  } catch {
    return res.status(401).json({ error: 'Сессия аяктады, кайра кириңиз' });
  }
}
