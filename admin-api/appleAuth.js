// admin-api/appleAuth.js — "Sign in with Apple".
//
// Required, not optional: App Store Guideline 4.8 says an app offering any
// third-party sign-in (Google, here) must also offer Apple's. Without it the
// build is rejected, however well everything else works.
//
// Same shape as googleAuth.js and for the same reason — this is NOT a second
// auth system. Apple is used only to prove an identity; once proved, the
// user gets exactly the session the password path issues, and everything
// downstream is untouched.
//
// THREE THINGS APPLE DOES DIFFERENTLY, all of which have bitten people:
//
//  1. The name arrives ONCE. Apple returns the display name only on the very
//     first authorisation and never again — not even after an uninstall. So
//     the client sends it alongside the token, and we use it only when
//     creating the account. Losing it means an account called "user".
//
//  2. The email may be a relay. "Hide My Email" gives a real, deliverable
//     @privaterelay.appleid.com address. It is not a fake address and must
//     not be refused — it is how a lot of people will sign up.
//
//  3. The email may be ABSENT on later sign-ins. `sub` is the only claim
//     guaranteed on every token, so `sub` is what identifies the account.
//
// The token is verified against Apple's published keys and then discarded:
// never stored, never logged, never forwarded.

import { createRemoteJWKSet, jwtVerify } from 'jose';
import { randomUUID } from 'node:crypto';
import * as db from './db.js';

// The audience is the app's bundle id for a native sign-in, and the Service
// ID for the web. Both mint tokens for the same user records here, so both
// are accepted.
//
//   APPLE_BUNDLE_ID   com.jashmenstudio.jashmen  (the iOS app)
//   APPLE_SERVICE_ID  the Service ID, only if the web ever offers this
const AUDIENCES = [
  process.env.APPLE_BUNDLE_ID,
  process.env.APPLE_SERVICE_ID,
].filter(Boolean);

const ISSUER = 'https://appleid.apple.com';

// Apple's public keys, fetched once and cached by the library, which also
// handles key rotation. No client secret is involved: verifying an identity
// token is a signature check, not an exchange.
const JWKS = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));

export function isAppleAuthConfigured() {
  return AUDIENCES.length > 0;
}

if (!isAppleAuthConfigured()) {
  console.warn(
    '[appleAuth] APPLE_BUNDLE_ID is not set — POST /u/auth/apple will\n' +
    '            return 503. Set it to the iOS bundle id and enable the\n' +
    '            "Sign in with Apple" capability on that App ID. Required\n' +
    '            by App Store Guideline 4.8 wherever Google sign-in ships.\n' +
    '            See docs/STORE_SUBMISSION.md.'
  );
}

export class AppleAuthError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/**
 * Verifies an Apple identity token and returns the claims worth trusting.
 * Throws AppleAuthError(401) for anything that fails — expired, minted for a
 * different app, or forged.
 */
export async function verifyAppleIdentityToken(identityToken) {
  if (!isAppleAuthConfigured()) {
    throw new AppleAuthError(503, 'Apple аркылуу кирүү азырынча жеткиликсиз');
  }
  if (typeof identityToken !== 'string' || identityToken.length < 20 || identityToken.length > 8192) {
    throw new AppleAuthError(400, 'identityToken берилген жок');
  }

  let payload;
  try {
    ({ payload } = await jwtVerify(identityToken, JWKS, {
      issuer: ISSUER,
      // Rejects a token minted for a different app — without this, anyone
      // could present an Apple token from an unrelated app and sign in here.
      audience: AUDIENCES,
    }));
  } catch (err) {
    // err.message can quote the token; log the reason class only.
    console.warn('[appleAuth] identity token verification failed:', err.code || err.name);
    throw new AppleAuthError(401, 'Apple тастыктамасы жараксыз же мөөнөтү бүткөн');
  }

  if (!payload?.sub) {
    throw new AppleAuthError(401, 'Apple тастыктамасы толук эмес');
  }

  // `email` is absent on every sign-in after the first, and `email_verified`
  // arrives as the string "true" as often as the boolean. Both are normal.
  const rawEmail = typeof payload.email === 'string' ? payload.email.toLowerCase() : null;
  const verified = payload.email_verified === true || payload.email_verified === 'true';

  return {
    appleSub: payload.sub,
    // Only an email Apple says it verified is safe to link an existing
    // password account by — see resolveAppleUser.
    email: rawEmail && verified ? rawEmail : null,
    // True for a Hide My Email relay address. Deliverable and legitimate;
    // worth knowing only so support can explain why the address looks odd.
    isPrivateRelay: payload.is_private_email === true || payload.is_private_email === 'true',
  };
}

/**
 * Resolves a verified Apple identity to a user record, creating or linking
 * as needed. Returns { user, created }.
 *
 * Four cases:
 *   1. Already linked (appleSub matches) → sign in. This is the ONLY case
 *      that works on a second sign-in with Hide My Email, which is why the
 *      link is keyed on `sub` and not on the address.
 *   2. A verified email matches an existing account → link and sign in. Safe
 *      for the same reason as Google: Apple has attested the person controls
 *      that mailbox. Any existing password is KEPT — linking adds a way in,
 *      it does not remove one.
 *   3. New, with an email → create an account with it.
 *   4. New, with no email at all → refuse, and say so. This only happens on
 *      a re-authorisation for an app the person already removed from their
 *      Apple ID; telling them to revoke and try again is the fix, and it is
 *      better than silently creating a second, unreachable account.
 */
export async function resolveAppleUser(
  { appleSub, email },
  { defaultState, name } = {},
) {
  const byApple = db.listUsers().find(u => u.appleSub === appleSub && !u.deletedAt);
  if (byApple) return { user: byApple, created: false };

  if (email) {
    const byEmail = db.findUserByEmail(email);
    if (byEmail && !byEmail.deletedAt) {
      byEmail.appleSub = appleSub;
      await db.saveUser(byEmail);
      return { user: byEmail, created: false };
    }
  }

  if (!email) {
    throw new AppleAuthError(
      409,
      'Apple почтаңызды бербеди. iPhone жөндөөлөрүнөн Apple ID → Сырсөз жана '
      + 'коопсуздук → Apple менен кирүү → JashMen дегенди өчүрүп, кайра аракет кылыңыз.',
    );
  }

  // Apple sends the name once, on the first authorisation only, and the
  // client forwards it here. Anything else and the account would be called
  // after the local part of a relay address, which is a random string.
  const display = String(name || '').trim().slice(0, 60)
    || email.split('@')[0].slice(0, 60);

  const user = {
    id: randomUUID(),
    name: display,
    email,
    avatar: '🦅',
    // No passwordHash: this account has no password yet, exactly like a
    // Google-created one. routes.js#/u/login guards against comparing
    // against a null hash.
    passwordHash: null,
    appleSub,
    state: defaultState(),
  };
  await db.insertUser(user);
  return { user, created: true };
}
