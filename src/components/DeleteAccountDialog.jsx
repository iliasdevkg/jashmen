// src/components/DeleteAccountDialog.jsx — leaving for good.
//
// Both stores require an app that can create an account to be able to
// destroy one from inside it (App Store 5.1.1(v), Play's "Data deletion"),
// and the web carries the same action because it is the same account:
// somebody who signed up in a browser must be able to leave from one.
//
// Designed around the way this goes wrong, which is never a bad request — it
// is a shared laptop and a mis-click. So it is not one button. An account
// with a password retypes it, because that is the one thing its owner has
// and a passer-by does not; an account made through Google has no password
// to ask for, so it types a word instead — friction standing in for a check
// we cannot make.
//
// It also says what SURVIVES. "Your data is deleted" is a promise, and the
// honest version names the one thing that stays and says it belongs to
// nobody.
import { useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Eye, EyeOff, Loader2 } from 'lucide-react';
import DialogShell from './DialogShell.jsx';
import { useAuth } from '../store.jsx';
import { useI18n } from '../i18n.jsx';
import * as api from '../api.js';

/// What a passwordless account types. Matches the server
/// (admin-api/routes.js#DELETE_CONFIRM_WORD) and the app
/// (mobile/lib/src/widgets/delete_account_dialog.dart) — all three have to
/// agree, or one of them enables a button the others refuse.
export const DELETE_CONFIRM_WORD = 'ӨЧҮР';

export default function DeleteAccountDialog({ bright, onDismiss }) {
  const { user, token, logout } = useAuth();
  const { t } = useI18n();
  const hasPassword = user?.hasPassword !== false;

  const [value, setValue] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const ready = hasPassword
    ? value.length > 0
    : value.trim().toUpperCase() === DELETE_CONFIRM_WORD;

  async function submit(e) {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setError('');
    try {
      await api.deleteAccount(token, hasPassword
        ? { password: value }
        : { confirm: value.trim().toUpperCase() });
      // The account is gone; the session in memory is now about nobody.
      // `logout` also fires POST /u/logout, which now 401s — harmless, it is
      // best-effort and the local state is already what matters.
      logout();
    } catch (err) {
      setBusy(false);
      setError(err?.message || t('settings.deleteFailed'));
    }
  }

  const text = bright ? '#0f172a' : '#f1f5f9';
  const muted = bright ? '#64748b' : '#94a3b8';
  const danger = bright ? '#dc2626' : '#f87171';

  return (
    <DialogShell bright={bright} onDismiss={busy ? undefined : onDismiss}>
      <form onSubmit={submit} className="p-6">
        <div className="flex flex-col items-center text-center mb-5">
          <span
            className="w-14 h-14 rounded-full grid place-items-center mb-4"
            style={{ background: bright ? '#fef2f2' : '#2d1515' }}
          >
            <AlertTriangle size={26} color={danger} />
          </span>
          <h2 className="font-extrabold text-lg" style={{ color: text }}>
            {t('settings.deleteAccount')}
          </h2>
          <p className="mt-2.5 text-[13px] leading-relaxed" style={{ color: muted }}>
            {t('settings.deleteWarning')}
          </p>
        </div>

        <label className="block">
          <span className="text-[12.5px] font-semibold" style={{ color: muted }}>
            {hasPassword
              ? t('settings.deleteTypePassword')
              : t('settings.deleteTypeWord', { word: DELETE_CONFIRM_WORD })}
          </span>
          <div className="relative mt-1.5">
            <input
              autoFocus
              type={hasPassword && !show ? 'password' : 'text'}
              value={value}
              onChange={e => { setValue(e.target.value); setError(''); }}
              disabled={busy}
              className="w-full px-4 py-3 rounded-xl text-sm font-medium focus:outline-none"
              style={{
                background: bright ? '#f8fafc' : '#0f172a',
                border: `1.5px solid ${error ? danger : (bright ? '#e2e8f0' : '#1e293b')}`,
                color: text,
              }}
            />
            {hasPassword && (
              <button
                type="button"
                onClick={() => setShow(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: muted }}
                aria-label={show ? 'hide' : 'show'}
              >
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            )}
          </div>
        </label>

        {error && (
          <p className="mt-2 text-[12.5px] font-semibold" style={{ color: danger }}>
            {error}
          </p>
        )}

        <div className="flex gap-2.5 mt-6">
          <button
            type="button"
            onClick={onDismiss}
            disabled={busy}
            className="flex-1 py-3 rounded-xl font-bold text-sm disabled:opacity-50"
            style={{
              background: bright ? '#f1f5f9' : '#1e293b',
              color: bright ? '#475569' : '#cbd5e1',
            }}
          >
            {t('common.cancel')}
          </button>
          <motion.button
            type="submit"
            whileTap={ready && !busy ? { scale: 0.97 } : undefined}
            disabled={!ready || busy}
            className="flex-1 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-45 disabled:cursor-not-allowed"
            style={{ background: danger, color: '#fff' }}
          >
            {busy && <Loader2 size={15} className="animate-spin" />}
            {busy ? t('settings.deleting') : t('settings.deleteConfirm')}
          </motion.button>
        </div>
      </form>
    </DialogShell>
  );
}
