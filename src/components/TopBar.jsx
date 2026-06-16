import { useEffect, useState } from 'react';
import { Flame, Heart } from 'lucide-react';
import { useAuth, useBrightMode } from '../store.jsx';
import { computeLiveHearts, formatCountdown } from '../utils.js';

export default function TopBar() {
  const { state } = useAuth();
  const { bright } = useBrightMode();

  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const { hearts, nextRefillMs } = computeLiveHearts(state);
  const streak = state?.streak || 0;
  const gems   = state?.gems   || 0;

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
        <div
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
          style={{ background: 'rgba(251,146,60,0.15)', border: '1px solid rgba(251,146,60,0.3)' }}
        >
          <Flame size={15} color="#fb923c" fill="#fb923c" />
          <span className="font-bold text-sm leading-none" style={{ color: badgeText }}>{streak}</span>
        </div>

        <div
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
          style={{ background: 'rgba(28,176,246,0.15)', border: '1px solid rgba(28,176,246,0.3)' }}
        >
          <span className="text-base leading-none">💎</span>
          <span className="font-bold text-sm leading-none" style={{ color: badgeText }}>{gems}</span>
        </div>

        <div
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
          style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)' }}
        >
          <Heart size={15} color="#ef4444" fill="#ef4444" />
          <div className="flex flex-col leading-none">
            <span className="font-bold text-sm" style={{ color: badgeText }}>{hearts}</span>
            {nextRefillMs && hearts < 5 && (
              <span className="text-[8px] text-red-400">{formatCountdown(nextRefillMs)}</span>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
