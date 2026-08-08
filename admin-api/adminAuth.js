// admin-api/adminAuth.js
//
// Separate, minimal auth path for the admin panel — a single shared
// operator password (ADMIN_PASSWORD env var), issuing its own access JWT
// scope (`role: 'admin'`) signed with its own secret, so an admin token
// can never be replayed against the regular /u/* user routes or vice
// versa.
//
// This is deliberately MVP: one operator, one shared password, no
// per-admin accounts or roles. That's the right size for a single-founder
// admin panel today — a real multi-admin/role system is a later step, not
// an oversight.
//
// Two-token model (Task 2 — JWT storage migration), same shape as the
// user side in auth.js: a short-lived access JWT the admin panel keeps in
// memory only, plus a refresh token in an httpOnly cookie backed by
// db.js's session store — actually revocable now, and capped at a much
// shorter absolute session length than the old flat 12h token, since an
// admin session is the single highest-value target in the app (full
// content/prize/limits control).

import jwt from 'jsonwebtoken';
import { timingSafeEqual } from 'node:crypto';
import * as db from './db.js';

const ADMIN_SECRET = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET || 'jashmen-admin-dev-secret-change-me';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || null;
if (!ADMIN_PASSWORD) {
  console.warn(
    '[adminAuth] ADMIN_PASSWORD is not set — every /admin/api/admin/login attempt will be rejected.\n' +
    '             Set ADMIN_PASSWORD in admin-api/.env before using the admin panel.'
  );
}

const ACCESS_TOKEN_TTL = '15m';
export const REFRESH_TOKEN_TTL_MS = 8 * 60 * 60 * 1000; // 8h absolute admin-session cap
export const REFRESH_COOKIE_NAME = 'jashmen_admin_refresh';

export function verifyAdminPassword(password) {
  if (!ADMIN_PASSWORD || typeof password !== 'string') return false;
  const a = Buffer.from(password);
  const b = Buffer.from(ADMIN_PASSWORD);
  if (a.length !== b.length) return false; // lengths differ → not equal, but still constant-time below
  return timingSafeEqual(a, b);
}

export function signAdminAccessToken() {
  return jwt.sign({ role: 'admin' }, ADMIN_SECRET, { expiresIn: ACCESS_TOKEN_TTL });
}

export function issueAdminRefreshToken() {
  return db.createSession({ type: 'admin', ttlMs: REFRESH_TOKEN_TTL_MS });
}

// See auth.js#refreshAccessToken's comment — db.js#rotateSession checks
// the session's type ('admin' here) before mutating anything, so a user
// refresh token presented at this endpoint is rejected untouched rather
// than being revoked/rotated as a side effect of the wrong-type lookup.
export async function refreshAdminAccessToken(refreshToken) {
  const rotated = await db.rotateSession(refreshToken, REFRESH_TOKEN_TTL_MS, 'admin');
  if (!rotated) return null;
  return { accessToken: signAdminAccessToken(), refreshToken: rotated.newToken };
}

export function revokeAdminRefreshToken(refreshToken) {
  return db.revokeSession(refreshToken, 'admin');
}

export function requireAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Админ катары кирүү керек' });
  }
  try {
    const payload = jwt.verify(token, ADMIN_SECRET);
    if (payload.role !== 'admin') throw new Error('not admin');
    next();
  } catch {
    return res.status(401).json({ error: 'Админ сессиясы аяктады, кайра кириңиз' });
  }
}
