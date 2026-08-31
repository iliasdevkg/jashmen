import { useState } from 'react';
import { motion } from 'framer-motion';
import { AnimatePresence } from 'framer-motion';
import { Volume2, Sparkles, LogOut, Shield, Sun, Pencil, Check, X, Globe, Bell, Lock, ChevronRight } from 'lucide-react';
import { useAuth, useBrightMode } from '../store.jsx';
import { useI18n, LANGUAGES } from '../i18n.jsx';
import { subscribeToPush, unsubscribeFromPush, isPushSupported } from '../push.js';
import * as api from '../api.js';
import Avatar from '../components/Avatar.jsx';
import PasswordDialog from '../components/PasswordDialog.jsx';

function Toggle({ checked, onChange }) {
  return (
    <motion.button
      onClick={() => onChange(!checked)}
      className="relative w-12 h-6 rounded-full transition-colors shrink-0"
      style={{ background: checked ? '#1CB0F6' : '#334155' }}
    >
      <motion.div
        animate={{ x: checked ? 24 : 2 }}
        className="absolute w-4 h-4 bg-white rounded-full"
        style={{ top: '4px' }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      />
    </motion.button>
  );
}

function Row({ icon: Icon, label, desc, right, iconColor, iconBg, textPrimary, textMuted }) {
  return (
    <div className="flex items-center justify-between px-4 py-4 gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: iconBg }}>
          <Icon size={16} color={iconColor} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold" style={{ color: textPrimary }}>{label}</p>
          {desc && <p className="text-[11px]" style={{ color: textMuted }}>{desc}</p>}
        </div>
      </div>
      {right}
    </div>
  );
}

function LanguagePicker({ locale, setLocale, bright }) {
  return (
    <div className="flex gap-1 shrink-0">
      {LANGUAGES.map(l => (
        <button
          key={l.code}
          onClick={() => setLocale(l.code)}
          aria-label={l.label}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-base transition-all"
          style={locale === l.code
            ? { background: 'rgba(28,176,246,0.15)', border: '1.5px solid #1CB0F6' }
            : { background: bright ? '#f1f5f9' : '#0f172a', border: '1.5px solid transparent' }}
        >
          {l.flag}
        </button>
      ))}
    </div>
  );
}

export default function SettingsPage() {
  const { user, state, token, logout, updateUser } = useAuth();
  const { bright, setBright } = useBrightMode();
  const { t, locale, setLocale } = useI18n();
  const settings = state?.settings || { sound: true, animations: true };
  const [sound, setSound] = useState(settings.sound !== false);
  const [animations, setAnimations] = useState(settings.animations !== false);
  const [notifications, setNotifications] = useState(settings.notifications === true);
  const [notifBusy, setNotifBusy] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(user?.name || '');
  const [savingName, setSavingName] = useState(false);

  const save = async (newSettings) => {
    try {
      const u = await api.patchState(token, { settings: newSettings });
      updateUser(u);
    } catch (e) { console.error(e); }
  };

  const toggleNotifications = async (v) => {
    setNotifBusy(true);
    try {
      if (v) await subscribeToPush(token);
      else await unsubscribeFromPush(token);
      setNotifications(v);
      await save({ sound, animations, notifications: v });
    } catch (e) {
      console.error(e);
      // Permission denied / unsupported browser — don't leave the toggle
      // showing "on" for a subscription that doesn't actually exist.
      setNotifications(false);
    } finally {
      setNotifBusy(false);
    }
  };

  const [passwordOpen, setPasswordOpen] = useState(false);

  const startEditName = () => {
    setNameDraft(user?.name || '');
    setEditingName(true);
  };

  const saveName = async () => {
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === user?.name) { setEditingName(false); return; }
    setSavingName(true);
    try {
      const u = await api.patchState(token, { name: trimmed });
      updateUser(u);
    } catch (e) { console.error(e); }
    finally { setSavingName(false); setEditingName(false); }
  };

  const cardBg      = bright ? '#ffffff' : '#1e293b';
  const cardBorder  = bright ? '#e2e8f0' : '#334155';
  const textPrimary = bright ? '#0f172a' : 'white';
  const textMuted   = bright ? '#64748b' : '#94a3b8';
  const iconBg      = bright ? '#f1f5f9' : '#0f172a';
  const divider     = bright ? '#e2e8f0' : '#334155';

  return (
    <div className="py-4 px-4">
      <h2 className="font-extrabold text-xl mb-6" style={{ color: textPrimary }}>{t('settings.title')}</h2>

      {user && (
        <div
          className="flex items-center gap-3 p-4 rounded-2xl mb-4"
          style={{ background: cardBg, border: `1.5px solid ${cardBorder}` }}
        >
          <Avatar name={user.name} photoUrl={user.avatar} size={44} />
          <div className="flex-1 min-w-0">
            {editingName ? (
              <div className="flex items-center gap-1.5">
                <input
                  autoFocus
                  value={nameDraft}
                  onChange={e => setNameDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false); }}
                  maxLength={60}
                  className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#1CB0F6]"
                  style={{ background: bright ? '#f1f5f9' : '#0f172a', color: textPrimary, border: `1.5px solid ${cardBorder}` }}
                />
                <button onClick={saveName} disabled={savingName} className="w-7 h-7 flex items-center justify-center rounded-lg shrink-0" style={{ background: '#58CC0220' }}>
                  <Check size={14} color="#58CC02" />
                </button>
                <button onClick={() => setEditingName(false)} className="w-7 h-7 flex items-center justify-center rounded-lg shrink-0" style={{ background: bright ? '#f1f5f9' : '#0f172a' }}>
                  <X size={14} color={textMuted} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <p className="font-bold text-sm truncate" style={{ color: textPrimary }}>{user.name}</p>
                <button onClick={startEditName} aria-label={t('settings.editName')} className="p-1 rounded-md shrink-0" style={{ color: textMuted }}>
                  <Pencil size={12} />
                </button>
              </div>
            )}
            <p className="text-xs truncate" style={{ color: textMuted }}>{user.email}</p>
          </div>
        </div>
      )}

      {/* Аккаунт — сырсөз ушул жерден өзгөрөт. A Google-only account has no
          password yet, so the row offers to create one instead. */}
      {user && (
        <div className="rounded-2xl overflow-hidden mb-4" style={{ background: cardBg, border: `1.5px solid ${cardBorder}` }}>
          <button
            type="button"
            onClick={() => setPasswordOpen(true)}
            className="w-full text-left"
          >
            <Row
              icon={Lock}
              label={user.hasPassword === false ? t('settings.setPassword') : t('settings.changePassword')}
              desc={user.hasPassword === false ? t('settings.setPasswordDesc') : t('settings.changePasswordDesc')}
              iconColor="#1CB0F6"
              iconBg={bright ? '#e0f2fe' : iconBg}
              textPrimary={textPrimary}
              textMuted={textMuted}
              right={<ChevronRight size={16} color={textMuted} />}
            />
          </button>
        </div>
      )}

      {/* Жарык режим — биринчи, эң көрүнүктүү */}
      <div
        className="rounded-2xl overflow-hidden mb-4"
        style={{ background: cardBg, border: `2px solid ${bright ? '#f59e0b' : cardBorder}` }}
      >
        <Row
          icon={Sun}
          label={t('settings.brightMode')}
          desc={t('settings.brightDesc')}
          iconColor={bright ? '#f59e0b' : '#94a3b8'}
          iconBg={bright ? '#fef3c7' : iconBg}
          textPrimary={textPrimary}
          textMuted={textMuted}
          right={
            <Toggle
              checked={bright}
              onChange={v => setBright(v)}
            />
          }
        />
        <div style={{ borderTop: `1px solid ${bright ? '#f59e0b40' : divider}` }}>
          <Row
            icon={Globe}
            label={t('settings.language')}
            desc={t('settings.languageDesc')}
            iconColor={bright ? '#f59e0b' : '#94a3b8'}
            iconBg={bright ? '#fef3c7' : iconBg}
            textPrimary={textPrimary}
            textMuted={textMuted}
            right={<LanguagePicker locale={locale} setLocale={setLocale} bright={bright} />}
          />
        </div>
      </div>

      <div className="rounded-2xl overflow-hidden mb-4" style={{ background: cardBg, border: `1.5px solid ${cardBorder}` }}>
        <Row
          icon={Volume2}
          label={t('settings.sound')}
          desc={t('settings.soundDesc')}
          iconColor="#94a3b8"
          iconBg={iconBg}
          textPrimary={textPrimary}
          textMuted={textMuted}
          right={
            <Toggle
              checked={sound}
              onChange={v => { setSound(v); save({ sound: v, animations, notifications }); }}
            />
          }
        />
        <div style={{ borderTop: `1px solid ${divider}` }}>
          <Row
            icon={Sparkles}
            label={t('settings.animations')}
            desc={t('settings.animationsDesc')}
            iconColor="#94a3b8"
            iconBg={iconBg}
            textPrimary={textPrimary}
            textMuted={textMuted}
            right={
              <Toggle
                checked={animations}
                onChange={v => { setAnimations(v); save({ sound, animations: v, notifications }); }}
              />
            }
          />
        </div>
        {isPushSupported() && (
          <div style={{ borderTop: `1px solid ${divider}` }}>
            <Row
              icon={Bell}
              label={t('settings.notifications')}
              desc={t('settings.notificationsDesc')}
              iconColor="#94a3b8"
              iconBg={iconBg}
              textPrimary={textPrimary}
              textMuted={textMuted}
              right={
                <Toggle
                  checked={notifications}
                  onChange={notifBusy ? () => {} : toggleNotifications}
                />
              }
            />
          </div>
        )}
      </div>

      <div className="rounded-2xl mb-6" style={{ background: cardBg, border: `1.5px solid ${cardBorder}` }}>
        <Row
          icon={Shield}
          label={t('settings.version')}
          desc="JashMen v2.1"
          iconColor="#94a3b8"
          iconBg={iconBg}
          textPrimary={textPrimary}
          textMuted={textMuted}
          right={null}
        />
      </div>

      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={logout}
        className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl font-semibold text-sm"
        style={{
          background: bright ? '#fef2f2' : '#2d1515',
          border: `1.5px solid ${bright ? '#fca5a5' : '#7f1d1d'}`,
          color: bright ? '#dc2626' : '#f87171',
        }}
      >
        <LogOut size={16} />
        {t('nav.logout')}
      </motion.button>

      <div className="h-4" />

      <AnimatePresence>
        {passwordOpen && (
          <PasswordDialog bright={bright} onDismiss={() => setPasswordOpen(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
