// Self-serve password change — the dialog behind Settings → Аккаунт.
//
// Two shapes, one form: an email/password account proves its current
// password first, a Google-only account (user.hasPassword === false) has
// none to prove and is setting its first one, which is what makes
// email sign-in start working for it.
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, Eye, EyeOff, Check } from 'lucide-react';
import DialogShell, { SPRING } from './DialogShell.jsx';
import { useAuth } from '../store.jsx';
import { useI18n } from '../i18n.jsx';
import * as api from '../api.js';

const MIN_LENGTH = 6; // matches admin-api/routes.js#/u/signup and #/u/me/password

function Field({ label, value, onChange, bright, autoFocus, onEnter }) {
  const [reveal, setReveal] = useState(false);
  const textPri = bright ? '#0f172a' : '#ffffff';
  const textMut = bright ? '#64748b' : '#8a93a6';
  const RevealIcon = reveal ? EyeOff : Eye;

  return (
    <label className="block">
      <span className="block mb-1.5 text-[11px] font-bold uppercase tracking-wide" style={{ color: textMut }}>
        {label}
      </span>
      <div className="relative">
        <input
          autoFocus={autoFocus}
          type={reveal ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') onEnter?.(); }}
          autoComplete={label ? 'off' : undefined}
          className="w-full pl-3 pr-10 py-2.5 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#1CB0F6]"
          style={{
            background: bright ? '#ffffff' : '#0a1223',
            color: textPri,
            border: `1.5px solid ${bright ? '#cbd5e1' : '#1d3358'}`,
          }}
        />
        <button
          type="button"
          onClick={() => setReveal(r => !r)}
          aria-label={label}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md"
          style={{ color: textMut }}
        >
          <RevealIcon size={15} />
        </button>
      </div>
    </label>
  );
}

export default function PasswordDialog({ bright, onDismiss }) {
  const { token, user, adoptSession } = useAuth();
  const { t } = useI18n();

  const hasPassword = user?.hasPassword !== false;
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const textPri = bright ? '#0f172a' : '#ffffff';
  const textMut = bright ? '#64748b' : '#8a93a6';

  const submit = async () => {
    if (saving || done) return;
    setError('');
    if (next.length < MIN_LENGTH) return setError(t('settings.passwordShort'));
    if (next !== repeat) return setError(t('settings.passwordMismatch'));

    setSaving(true);
    try {
      const { token: fresh, user: updated } = await api.changePassword(
        token,
        hasPassword ? current : undefined,
        next,
      );
      // Every other session was just revoked server-side — adopting the
      // returned pair is what keeps THIS tab signed in.
      adoptSession(fresh, updated);
      setDone(true);
      setTimeout(onDismiss, 1100);
    } catch (e) {
      setError(e.message || t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <DialogShell onDismiss={onDismiss} bright={bright} labelledBy="password-dialog-title" maxWidth={360}>
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-center gap-2.5 mb-1">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'rgba(28,176,246,0.15)' }}
          >
            <Lock size={15} color="#1CB0F6" />
          </div>
          <h3 id="password-dialog-title" className="text-[15px] font-black" style={{ color: textPri }}>
            {hasPassword ? t('settings.changePassword') : t('settings.setPassword')}
          </h3>
        </div>
        <p className="text-[11px] leading-snug mb-4" style={{ color: textMut }}>
          {hasPassword ? t('settings.changePasswordDesc') : t('settings.setPasswordDesc')}
        </p>

        {done ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={SPRING}
            className="flex items-center gap-2 px-3 py-3 rounded-xl"
            style={{ background: 'rgba(88,204,2,0.14)', border: '1px solid rgba(88,204,2,0.4)' }}
          >
            <Check size={16} color="#58CC02" />
            <span className="text-sm font-bold" style={{ color: '#58CC02' }}>
              {t('settings.passwordSaved')}
            </span>
          </motion.div>
        ) : (
          <div className="flex flex-col gap-3">
            {hasPassword && (
              <Field
                label={t('settings.currentPassword')}
                value={current}
                onChange={setCurrent}
                bright={bright}
                autoFocus
                onEnter={submit}
              />
            )}
            <Field
              label={t('settings.newPassword')}
              value={next}
              onChange={setNext}
              bright={bright}
              autoFocus={!hasPassword}
              onEnter={submit}
            />
            <Field
              label={t('settings.repeatPassword')}
              value={repeat}
              onChange={setRepeat}
              bright={bright}
              onEnter={submit}
            />

            {error && (
              <p className="text-[11px] font-semibold leading-snug" style={{ color: '#FF4B4B' }}>
                {error}
              </p>
            )}

            <div className="flex gap-2 mt-1">
              <button
                type="button"
                onClick={onDismiss}
                className="flex-1 py-2.5 rounded-xl text-[13px] font-bold"
                style={{
                  background: bright ? '#e2e8f0' : '#16213c',
                  color: textMut,
                }}
              >
                {t('common.cancel')}
              </button>
              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                transition={SPRING}
                onClick={submit}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl text-[13px] font-black text-white disabled:opacity-60"
                style={{ background: '#1CB0F6' }}
              >
                {saving ? t('common.loading') : t('common.save')}
              </motion.button>
            </div>
          </div>
        )}
      </div>
    </DialogShell>
  );
}
