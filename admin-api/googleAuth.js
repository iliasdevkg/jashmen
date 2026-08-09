// admin-api/googleAuth.js — "Sign in with Google".
//
// Deliberately NOT a second auth system. Google is only used to *prove an
// email address*; once proven, the user gets exactly the same session the
// password path issues (short-lived access JWT + rotating httpOnly refresh
// cookie, see auth.js). Everything downstream — requireAuth, /u/refresh,
// revoke lists — is untouched and doesn't know or care how the user signed
// in.
//
// The id_token itself is verified and discarded. It is never stored, never
// logged, and never forwarded anywhere.

import { OAuth2Client } from 'google-auth-library';
import { randomUUID } from 'node:crypto';
import * as db from './db.js';

// One client per audience. Web and the mobile apps each get their own OAuth
// client ID in Google Cloud Console (Google requires this — a native app
// cannot use a web client ID), but they all mint tokens for the same user
// records here, so verifyIdToken is given the full audience list and any of
// them is accepted.
//
// GOOGLE_CLIENT_ID   — web (also the "server" client for Android, see README)
// GOOGLE_CLIENT_ID_IOS / _ANDROID — optional, only if the mobile apps ship
const AUDIENCES = [
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_ID_IOS,
  process.env.GOOGLE_CLIENT_ID_ANDROID,
].filter(Boolean);

// No client secret: verifying an id_token is a signature check against
// Google's public keys, which the library fetches and caches. A secret is
// only needed for the authorization-code flow, which this isn't.
const client = new OAuth2Client();

export function isGoogleAuthConfigured() {
  return AUDIENCES.length > 0;
}

if (!isGoogleAuthConfigured()) {
  console.warn(
    '[googleAuth] GOOGLE_CLIENT_ID is not set — POST /u/auth/google will\n' +
    '             return 503. Create an OAuth 2.0 Web client in Google Cloud\n' +
    '             Console and put its client ID in admin-api/.env. See\n' +
    '             docs/GOOGLE_SIGNIN.md for the full setup.'
  );
}

export class GoogleAuthError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/**
 * Verifies a Google id_token and returns the trustworthy claims from it.
 * Throws GoogleAuthError(401) for anything that fails verification — an
 * expired token, a token minted for someone else's client ID, a forged
 * signature, or an account whose email Google itself hasn't verified.
 */
export async function verifyGoogleIdToken(idToken) {
  if (!isGoogleAuthConfigured()) {
    throw new GoogleAuthError(503, 'Google аркылуу кирүү азырынча жеткиликсиз');
  }
  if (typeof idToken !== 'string' || idToken.length < 20 || idToken.length > 4096) {
    throw new GoogleAuthError(400, 'id_token берилген жок');
  }

  let payload;
  try {
    const ticket = await client.verifyIdToken({
      idToken,
      // Rejects a token minted for a different client — without this, anyone
      // could present a Google token from an unrelated app and log in as
      // that email here.
      audience: AUDIENCES,
    });
    payload = ticket.getPayload();
  } catch (err) {
    // err.message can quote the token; log only the reason class, never the
    // token or the raw message.
    console.warn('[googleAuth] id_token verification failed:', err.name);
    throw new GoogleAuthError(401, 'Google тастыктамасы жараксыз же мөөнөтү бүткөн');
  }

  if (!payload?.sub) {
    throw new GoogleAuthError(401, 'Google тастыктамасы толук эмес');
  }

  // email_verified is the whole basis for auto-linking below: it is what
  // lets us treat "this token carries email X" as "this person controls
  // email X". Without it, a Google account with an unverified address could
  // be used to take over a password account with the same email.
  if (!payload.email || payload.email_verified !== true) {
    throw new GoogleAuthError(401, 'Google аккаунтуңуздун почтасы ырасталган эмес');
  }

  return {
    googleSub: payload.sub,
    email: payload.email.toLowerCase(),
    name: payload.name?.trim() || payload.email.split('@')[0],
    picture: payload.picture || null,
  };
}

/**
 * Resolves a verified Google identity to a user record, creating or linking
 * as needed. Returns { user, created }.
 *
 * Three cases:
 *   1. Already linked (googleSub matches)  → sign in.
 *   2. Email matches a password account    → link, then sign in. Safe
 *      because verifyGoogleIdToken already refused unverified emails, so
 *      Google has attested the person controls that mailbox. The existing
 *      passwordHash is KEPT — linking adds a way in, it doesn't remove one.
 *   3. Nobody with that email              → create a passwordless account.
 */
export async function resolveGoogleUser({ googleSub, email, name, picture }, { defaultState }) {
  const byGoogle = db.listUsers().find(u => u.googleSub === googleSub);
  if (byGoogle) {
    // Google is the source of truth for the display name/avatar only while
    // the user has never set their own — don't clobber a name they changed
    // in the app.
    return { user: byGoogle, created: false };
  }

  const byEmail = db.findUserByEmail(email);
  if (byEmail) {
    byEmail.googleSub = googleSub;
    if (!byEmail.avatar && picture) byEmail.avatar = picture;
    await db.saveUser(byEmail);
    return { user: byEmail, created: false };
  }

  const user = {
    id: randomUUID(),
    name: name.slice(0, 60),
    email,
    avatar: picture || '🦅',
    // No passwordHash on purpose: this account has no password yet. auth.js's
    // login path must refuse to bcrypt-compare against undefined — see the
    // guard in routes.js#/u/login.
    passwordHash: null,
    googleSub,
    state: defaultState(),
  };
  await db.insertUser(user);
  return { user, created: true };
}
