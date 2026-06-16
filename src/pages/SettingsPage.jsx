import { useState } from 'react';
import { motion } from 'framer-motion';
import { Volume2, Sparkles, LogOut, Shield, Sun } from 'lucide-react';
import { useAuth, useBrightMode } from '../store.jsx';
import * as api from '../api.js';

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
    <div className="flex items-center justify-between px-4 py-4">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: iconBg }}>
          <Icon size={16} color={iconColor} />
        </div>
        <div>
          <p className="text-sm font-semibold" style={{ color: textPrimary }}>{label}</p>
          {desc && <p className="text-[11px]" style={{ color: textMuted }}>{desc}</p>}
        </div>
      </div>
      {right}
    </div>
  );
}

export default function SettingsPage() {
  const { user, state, token, logout, updateUser } = useAuth();
  const { bright, setBright } = useBrightMode();
  const settings = state?.settings || { sound: true, animations: true };
  const [sound, setSound] = useState(settings.sound !== false);
  const [animations, setAnimations] = useState(settings.animations !== false);

  const save = async (newSettings) => {
    try {
      const u = await api.patchState(token, { settings: newSettings });
      updateUser(u);
    } catch (e) { console.error(e); }
  };

  const cardBg      = bright ? '#ffffff' : '#1e293b';
  const cardBorder  = bright ? '#e2e8f0' : '#334155';
  const textPrimary = bright ? '#0f172a' : 'white';
  const textMuted   = bright ? '#64748b' : '#94a3b8';
  const iconBg      = bright ? '#f1f5f9' : '#0f172a';
  const divider     = bright ? '#e2e8f0' : '#334155';

  return (
    <div className="py-4 px-4">
      <h2 className="font-extrabold text-xl mb-6" style={{ color: textPrimary }}>Орнотуулар</h2>

      {user && (
        <div
          className="flex items-center gap-3 p-4 rounded-2xl mb-4"
          style={{ background: cardBg, border: `1.5px solid ${cardBorder}` }}
        >
          <div className="text-3xl">{user.avatar || '🦅'}</div>
          <div>
            <p className="font-bold text-sm" style={{ color: textPrimary }}>{user.name}</p>
            <p className="text-xs" style={{ color: textMuted }}>{user.email}</p>
          </div>
        </div>
      )}

      {/* Жарык режим — биринчи, эң көрүнүктүү */}
      <div
        className="rounded-2xl overflow-hidden mb-4"
        style={{ background: cardBg, border: `2px solid ${bright ? '#f59e0b' : cardBorder}` }}
      >
        <Row
          icon={Sun}
          label="Жарык режим"
          desc="Ачык фон — көзгө жеңил"
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
      </div>

      <div className="rounded-2xl overflow-hidden mb-4" style={{ background: cardBg, border: `1.5px solid ${cardBorder}` }}>
        <Row
          icon={Volume2}
          label="Үн"
          desc="Жооп берүүдөгү сигналдар"
          iconColor="#94a3b8"
          iconBg={iconBg}
          textPrimary={textPrimary}
          textMuted={textMuted}
          right={
            <Toggle
              checked={sound}
              onChange={v => { setSound(v); save({ sound: v, animations }); }}
            />
          }
        />
        <div style={{ borderTop: `1px solid ${divider}` }}>
          <Row
            icon={Sparkles}
            label="Анимациялар"
            desc="Жылтылдак эффекттер"
            iconColor="#94a3b8"
            iconBg={iconBg}
            textPrimary={textPrimary}
            textMuted={textMuted}
            right={
              <Toggle
                checked={animations}
                onChange={v => { setAnimations(v); save({ sound, animations: v }); }}
              />
            }
          />
        </div>
      </div>

      <div className="rounded-2xl mb-6" style={{ background: cardBg, border: `1.5px solid ${cardBorder}` }}>
        <Row
          icon={Shield}
          label="Версия"
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
        Аккаунттан чыгуу
      </motion.button>

      <div className="h-4" />
    </div>
  );
}
