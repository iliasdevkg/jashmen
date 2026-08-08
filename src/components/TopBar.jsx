import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Flame, Zap, Crown } from 'lucide-react';
import { useAuth, useContent, useBrightMode } from '../store.jsx';
import { useI18n } from '../i18n.jsx';
import { computeLiveEnergy, formatCountdown } from '../utils.js';

export default function TopBar() {
  const { state } = useAuth();
  const content = useContent();
  const { bright } = useBrightMode();
  const { t } = useI18n();

  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const dailyFreeLessons = content?.limits?.dailyFreeLessons ?? 3;
  const { remaining: energy, resetMs } = computeLiveEnergy(state, dailyFreeLessons);
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
      <div className="flex items-center gap-2">
        <img src="/logo.png" alt="JashMen" className="w-8 h-8 rounded-full object-cover" />
        <span className="font-extrabold text-base" style={{ color: '#1CB0F6' }}>JashMen</span>
      </div>

      <div className="flex items-center gap-2">
        <Link
          to="/profile#achievements"
          aria-label={t('nav.achievements')}
          className="w-8 h-8 flex items-center justify-center rounded-full shrink-0"
          style={{ background: 'rgba(255,215,0,0.15)', border: '1px solid rgba(255,215,0,0.35)' }}
        >
          <Crown size={15} color="#FFD700" fill="#FFD700" />
        </Link>

        <div
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
          style={{ background: 'rgba(251,146,60,0.15)', border: '1px solid rgba(251,146,60,0.3)' }}
        >
          <Flame size={15} color="#fb923c" fill="#fb923c" />
          <span className="font-bold text-sm leading-none" style={{ color: badgeText }}>{streak}</span>
        </div>

        <div
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
          style={{ background: 'rgba(255,215,0,0.15)', border: '1px solid rgba(255,215,0,0.3)' }}
        >
          <span className="text-base leading-none">🪙</span>
          <span className="font-bold text-sm leading-none" style={{ color: badgeText }}>{coins}</span>
        </div>

        <div
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
          style={{ background: 'rgba(28,176,246,0.15)', border: '1px solid rgba(28,176,246,0.3)' }}
        >
          <Zap size={15} color="#1CB0F6" fill="#1CB0F6" />
          <div className="flex flex-col leading-none">
            <span className="font-bold text-sm" style={{ color: badgeText }}>{energy}</span>
            {resetMs != null && (
              <span className="text-[8px]" style={{ color: '#1CB0F6' }}>{formatCountdown(resetMs)}</span>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
