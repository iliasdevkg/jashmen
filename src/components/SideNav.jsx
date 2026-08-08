import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Trophy, ShoppingBag, User, Settings, Zap, LogOut } from 'lucide-react';
import { useAuth, useContent, useBrightMode } from '../store.jsx';
import { useI18n } from '../i18n.jsx';
import { computeLiveEnergy } from '../utils.js';
import Avatar from './Avatar.jsx';

const links = [
  { to: '/learn',       icon: Home,        key: 'nav.learn' },
  { to: '/leaderboard', icon: Trophy,      key: 'nav.league' },
  { to: '/shop',        icon: ShoppingBag, key: 'nav.shop' },
  { to: '/profile',     icon: User,        key: 'nav.profile' },
  { to: '/settings',    icon: Settings,    key: 'nav.settings' },
];

export default function SideNav() {
  const { user, state, logout } = useAuth();
  const content = useContent();
  const { bright } = useBrightMode();
  const { t } = useI18n();
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const dailyFreeLessons = content?.limits?.dailyFreeLessons ?? 3;
  const { remaining: energy } = computeLiveEnergy(state, dailyFreeLessons);
  const streak      = state?.streak || 0;
  const coins       = state?.coins  || 0;

  const navBg      = bright ? '#ffffff'                       : '#070c16';
  const navBorder  = bright ? '1px solid #e2e8f0'            : '1px solid rgba(255,255,255,0.06)';
  const textNorm   = bright ? '#475569'                       : '#94a3b8';
  const textHover  = bright ? 'hover:text-slate-700 hover:bg-slate-100' : 'hover:text-slate-200 hover:bg-white/[0.05]';
  const cardBg     = bright ? '#f1f5f9'                       : '#1e293b';
  const cardBorder = bright ? '1px solid #e2e8f0'            : '1px solid #334155';
  const textPri    = bright ? '#0f172a'                       : 'white';
  const textMut    = bright ? '#64748b'                       : '#64748b';
  const badgeText  = bright ? '#0f172a'                       : 'white';

  return (
    <nav
      className="fixed top-0 left-0 h-screen w-[240px] flex flex-col z-50"
      style={{ background: navBg, borderRight: navBorder }}
    >
      {/* ── Logo ── */}
      <div className="flex items-center gap-2.5 px-5 pt-6 pb-5">
        <img src="/logo.png" alt="" className="w-9 h-9 rounded-xl object-cover" />
        <img
          src={bright ? '/jashmen_wordmark_blue.png' : '/jashmen_text_white.png'}
          alt="JashMen"
          className="h-[28px] w-auto object-contain"
        />
      </div>

      {/* ── Nav links ── */}
      <div className="flex flex-col gap-0.5 px-3 flex-1">
        {links.map(({ to, icon: Icon, key }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-150 ${
                isActive ? 'text-white' : `${textHover}`
              }`
            }
            style={({ isActive }) =>
              isActive
                ? { background: 'rgba(28,176,246,0.12)', color: '#1CB0F6' }
                : { color: textNorm }
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                {t(key)}
              </>
            )}
          </NavLink>
        ))}
      </div>

      {/* ── Stats ── */}
      <div className="px-4 pb-4">
        <div className="flex gap-2 mb-3">
          <div
            className="flex-1 flex flex-col items-center py-2.5 rounded-xl gap-1"
            style={{ background: 'rgba(251,146,60,0.1)', border: '1px solid rgba(251,146,60,0.2)' }}
          >
            <span className="text-base leading-none">🔥</span>
            <span className="font-bold text-[11px]" style={{ color: badgeText }}>{streak}</span>
          </div>
          <div
            className="flex-1 flex flex-col items-center py-2.5 rounded-xl gap-1"
            style={{ background: 'rgba(255,215,0,0.1)', border: '1px solid rgba(255,215,0,0.2)' }}
          >
            <span className="text-base leading-none">🪙</span>
            <span className="font-bold text-[11px]" style={{ color: badgeText }}>{coins}</span>
          </div>
          <div
            className="flex-1 flex flex-col items-center py-2.5 rounded-xl gap-1"
            style={{ background: 'rgba(28,176,246,0.1)', border: '1px solid rgba(28,176,246,0.2)' }}
          >
            <Zap size={14} color="#1CB0F6" fill="#1CB0F6" />
            <span className="font-bold text-[11px]" style={{ color: badgeText }}>{energy}</span>
          </div>
        </div>

        {user && (
          <div
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl"
            style={{ background: cardBg, border: cardBorder }}
          >
            <Avatar name={user.name} size={32} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate" style={{ color: textPri }}>{user.name}</p>
              <p className="text-[10px] truncate" style={{ color: textMut }}>{user.email}</p>
            </div>
            <button
              onClick={logout}
              title={t('nav.logout')}
              className="transition-colors p-1 rounded-lg hover:text-red-400"
              style={{ color: textMut }}
            >
              <LogOut size={15} />
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
