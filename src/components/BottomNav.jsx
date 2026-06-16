import { NavLink } from 'react-router-dom';
import { Home, Trophy, ShoppingBag, User, Settings } from 'lucide-react';
import { useBrightMode } from '../store.jsx';

const tabs = [
  { to: '/learn',        icon: Home,        label: 'Үйрөнүү' },
  { to: '/leaderboard',  icon: Trophy,      label: 'Лига'     },
  { to: '/shop',         icon: ShoppingBag, label: 'Дүкөн'   },
  { to: '/profile',      icon: User,        label: 'Профиль' },
  { to: '/settings',     icon: Settings,    label: 'Орнотуу' },
];

export default function BottomNav() {
  const { bright } = useBrightMode();

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
        {tabs.map(({ to, icon: Icon, label }) => (
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
                <span className="text-[10px] font-medium">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
      <div style={{ height: 'env(safe-area-inset-bottom, 0px)' }} />
    </nav>
  );
}
