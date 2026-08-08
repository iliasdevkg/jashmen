import { NavLink } from 'react-router-dom';
import { Home, Trophy, ShoppingBag, User, Settings } from 'lucide-react';
import { useBrightMode } from '../store.jsx';
import { useI18n } from '../i18n.jsx';

const tabs = [
  { to: '/learn',        icon: Home,        key: 'nav.learn' },
  { to: '/leaderboard',  icon: Trophy,      key: 'nav.league' },
  { to: '/shop',         icon: ShoppingBag, key: 'nav.shop' },
  { to: '/profile',      icon: User,        key: 'nav.profile' },
  { to: '/settings',     icon: Settings,    key: 'nav.settings' },
];

export default function BottomNav() {
  const { bright } = useBrightMode();
  const { t } = useI18n();

  return (
    <nav
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] z-50"
      style={{
        background: bright ? 'rgba(255,255,255,0.97)' : 'rgba(15,23,42,0.95)',
        backdropFilter: 'blur(12px)',
        borderTop: bright ? '1px solid #e2e8f0' : '1px solid rgba(51,65,85,0.6)',
      }}
    >
      <div className="flex">
        {tabs.map(({ to, icon: Icon, key }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center gap-0.5 py-2 transition-colors ${
                isActive ? 'text-[#1CB0F6]' : bright ? 'text-slate-400' : 'text-slate-500'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-[10px] font-medium">{t(key)}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
      <div style={{ height: 'env(safe-area-inset-bottom, 0px)' }} />
    </nav>
  );
}
