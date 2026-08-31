// src/components/GoogleSignInButton.jsx
//
// The button is ALWAYS on screen — it is part of the sign-in design, not an
// optional extra that appears once a server variable happens to be set.
// (It used to hide itself when GET /public/config reported no client ID.
// That made "sign in with Google" silently absent on a fresh deploy, which
// looked like a missing feature rather than a missing setting.)
//
// Two render paths behind one layout:
//   • configured   → Google's own button (their brand guidelines require it,
//                    and it drives the popup/FedCM flow),
//   • unconfigured → a pixel-matched stand-in that says, on click, that
//                    Google sign-in is not switched on yet. Email/password
//                    is right above it and keeps working either way.
//
// Uses Google Identity Services via @react-oauth/google rather than
// Firebase: the only thing needed here is an id_token, and Firebase would
// mean a second identity system to keep in sync with our own sessions.

import { useEffect, useState } from 'react';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../store.jsx';
import { useI18n } from '../i18n.jsx';
import * as api from '../api.js';

// Matches GoogleLogin's `size="large" width="320" shape="pill"` so the two
// states occupy exactly the same box and the form never reflows.
const BUTTON_WIDTH = 320;
const BUTTON_HEIGHT = 40;

/** Google's four-colour G, drawn rather than fetched so it can't 404. */
function GoogleGlyph({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.3 13.2 17.6 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.6c0-1.6-.1-3.2-.4-4.6H24v9.1h12.4c-.5 2.9-2.2 5.3-4.7 6.9l7.3 5.7c4.3-3.9 6.8-9.8 6.8-17.1z" />
      <path fill="#FBBC05" d="M10.4 28.7c-.5-1.4-.8-2.9-.8-4.7s.3-3.3.8-4.7l-7.8-6.1C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l7.8-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.3-5.7c-2 1.4-4.7 2.3-8.6 2.3-6.4 0-11.7-3.7-13.6-9.1l-7.8 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}

export default function GoogleSignInButton({ onError, disabled }) {
  const { loginWithGoogle } = useAuth();
  const { t, locale } = useI18n();
  // undefined = still asking the server, null = configured off, string = on.
  const [clientId, setClientId] = useState(undefined);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    api.fetchPublicConfig()
      .then(cfg => { if (alive) setClientId(cfg.googleClientId || null); })
      // A failed config fetch is treated as "not configured": the button
      // still shows, it just can't start the flow. The page works either way,
      // so this is not worth surfacing as a page-level error.
      .catch(() => { if (alive) setClientId(null); })
    return () => { alive = false; };
  }, []);

  const handleSuccess = async (credentialResponse) => {
    const idToken = credentialResponse?.credential;
    if (!idToken) return onError?.(t('auth.googleFailed'));

    setBusy(true);
    try {
      await loginWithGoogle(idToken);
      // On success the auth context flips and App.jsx swaps this whole page
      // out, so there is nothing to reset here.
    } catch (err) {
      onError?.(err.message || t('auth.googleFailed'));
      setBusy(false);
    }
  };

  const dimmed = busy || disabled;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-slate-700/60" />
        <span className="text-xs font-semibold text-slate-500">{t('auth.or')}</span>
        <div className="flex-1 h-px bg-slate-700/60" />
      </div>

      <div
        className={`flex justify-center transition-opacity ${dimmed ? 'opacity-50 pointer-events-none' : ''}`}
        style={{ minHeight: BUTTON_HEIGHT }}
      >
        {clientId ? (
          <GoogleOAuthProvider clientId={clientId}>
            {/* Google's own button — required by their brand guidelines, and
                it can't be styled with Tailwind, so it is centred and
                width-matched to the form instead. */}
            <GoogleLogin
              onSuccess={handleSuccess}
              onError={() => onError?.(t('auth.googleFailed'))}
              theme="filled_black"
              shape="pill"
              size="large"
              width={String(BUTTON_WIDTH)}
              text="continue_with"
              locale={locale}
            />
          </GoogleOAuthProvider>
        ) : (
          <button
            type="button"
            // Deliberately enabled while the config is still loading: a
            // click in that first moment says "not available yet", which is
            // true, rather than looking like a dead control.
            onClick={() => onError?.(t('auth.googleUnavailable'))}
            className="flex items-center justify-center gap-3 rounded-full font-medium transition-colors hover:bg-[#1f1f20]"
            style={{
              width: BUTTON_WIDTH,
              maxWidth: '100%',
              height: BUTTON_HEIGHT,
              background: '#131314',
              border: '1px solid #8E918F',
              color: '#E3E3E3',
              fontSize: 14,
            }}
          >
            <span className="flex items-center justify-center rounded-full bg-white" style={{ width: 22, height: 22 }}>
              <GoogleGlyph size={14} />
            </span>
            {t('auth.google')}
          </button>
        )}
      </div>
    </div>
  );
}
