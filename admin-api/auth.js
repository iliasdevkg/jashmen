// admin-api/auth.js — password hashing, JWT issuing/verification, auth middleware.

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const JWT_SECRET = process.env.JWT_SECRET || 'jashmen-dev-secret-change-me';
if (!process.env.JWT_SECRET) {
  console.warn(
    '[auth] JWT_SECRET is not set — using an insecure development default.\n' +
    '        Set JWT_SECRET in admin-api/.env (or the environment) before deploying.'
  );
}

const TOKEN_TTL = '30d';
const SALT_ROUNDS = 10;

export function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export function signToken(userId) {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: TOKEN_TTL });
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
