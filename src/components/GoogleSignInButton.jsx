// src/components/GoogleSignInButton.jsx
//
// Renders nothing until the server confirms a Google client ID is
// configured (GET /public/config). That keeps the feature genuinely
// optional: with GOOGLE_CLIENT_ID unset, the button never appears and
// email/password sign-in is unchanged — no dead button that 503s on click.
//
// Uses Google Identity Services via @react-oauth/google rather than
// Firebase: the only thing needed here is an id_token, and Firebase would
// mean a second identity system to keep in sync with our own sessions.

import { useEffect, useState } from 'react';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../store.jsx';
import { useI18n } from '../i18n.jsx';
import * as api from '../api.js';

export default function GoogleSignInButton({ onError, disabled }) {
  const { loginWithGoogle } = useAuth();
  const { t, locale } = useI18n();
  const [clientId, setClientId] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    api.fetchPublicConfig()
      .then(cfg => { if (alive) setClientId(cfg.googleClientId || null); })
      // A failed config fetch simply means no Google button — the page still
      // works, so this is not worth surfacing as an error.
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  if (!clientId) return null;

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

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-slate-700/60" />
        <span className="text-xs font-semibold text-slate-500">{t('auth.or')}</span>
        <div className="flex-1 h-px bg-slate-700/60" />
      </div>

      <GoogleOAuthProvider clientId={clientId}>
        {/* GoogleLogin renders Google's own button, which is required by
            their brand guidelines and handles the popup/FedCM flow for us.
            It can't be styled with Tailwind, so it's centred and width-
            matched to the form instead. */}
        <div
          className={`flex justify-center transition-opacity ${
            busy || disabled ? 'opacity-50 pointer-events-none' : ''
          }`}
        >
          <GoogleLogin
            onSuccess={handleSuccess}
            onError={() => onError?.(t('auth.googleFailed'))}
            theme="filled_black"
            shape="pill"
            size="large"
            width="320"
            text="continue_with"
            locale={locale}
          />
        </div>
      </GoogleOAuthProvider>
    </div>
  );
}
