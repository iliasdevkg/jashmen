import { useEffect, useState } from 'react';
import { Flame, Zap, Coins } from 'lucide-react';
import { useAuth, useContent, useBrightMode } from '../store.jsx';
import { energySettings, computeLiveEnergy, formatCountdown, STREAK } from '../utils.js';

export default function TopBar() {
  const { state } = useAuth();
  const content = useContent();
  const { bright } = useBrightMode();

  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const { dailyFreeLessons, energyRefillHours } = energySettings(content);
  const { remaining: energy, resetMs } = computeLiveEnergy(state, dailyFreeLessons, energyRefillHours);
  const streak = state?.streak || 0;
  const coins  = state?.coins  || 0;

  const headerBg     = bright ? 'rgba(248,250,252,0.97)' : 'rgba(10,14,26,0.97)';
  const headerBorder = bright ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(255,255,255,0.06)';
  const badgeText    = bright ? '#0f172a' : 'white';

  return (
    <header
      className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] z-50 px-4 h-14 flex items-center justify-between"
      style={{ background: headerBg, backdropFilter: 'blur(14px)', borderBottom: headerBorder }}
    >
      {/* Mark only — the "Jashmen" wordmark and the achievements medal used
          to sit here, but four-digit coin/streak counts pushed the three
          stat pills off the edge of a narrow phone. Achievements are still
          one tap away on the profile. */}
      <img src="/logo.png" alt="JashMen" className="w-8 h-8 rounded-full object-cover shrink-0" />

      <div className="flex items-center gap-2 min-w-0">
        <div
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full shrink-0"
          style={{ background: 'rgba(76,141,255,0.15)', border: '1px solid rgba(76,141,255,0.32)' }}
        >
          <Flame size={15} color={STREAK.soft} fill={STREAK.soft} />
          <span className="font-bold text-sm leading-none tabular-nums" style={{ color: badgeText }}>{streak}</span>
        </div>

        <div
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full shrink-0"
          style={{ background: 'rgba(255,215,0,0.15)', border: '1px solid rgba(255,215,0,0.3)' }}
        >
          <Coins size={15} color="#FFD700" fill="#FFD700" />
          <span className="font-bold text-sm leading-none tabular-nums" style={{ color: badgeText }}>{coins}</span>
        </div>

        <div
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full shrink-0"
          style={{ background: 'rgba(28,176,246,0.15)', border: '1px solid rgba(28,176,246,0.3)' }}
        >
          <Zap size={15} color="#1CB0F6" fill="#1CB0F6" />
          <div className="flex flex-col leading-none">
            <span className="font-bold text-sm tabular-nums" style={{ color: badgeText }}>{energy}</span>
            {resetMs != null && (
              <span className="text-[8px]" style={{ color: '#1CB0F6' }}>{formatCountdown(resetMs)}</span>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
