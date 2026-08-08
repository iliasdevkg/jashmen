import { useState, useEffect, useCallback } from 'react';
import { LayoutGrid, Building2, Sliders, BarChart3, LogOut, RefreshCw, Trophy, Award } from 'lucide-react';
import { useAdminAuth } from '../store.jsx';
import * as api from '../api.js';
import LessonsModule from '../pages/LessonsModule.jsx';
import LeaguesModule from '../pages/LeaguesModule.jsx';
import AchievementsModule from '../pages/AchievementsModule.jsx';
import PartnersModule from '../pages/PartnersModule.jsx';
import LimitsModule from '../pages/LimitsModule.jsx';
import AnalyticsModule from '../pages/AnalyticsModule.jsx';

const TABS = [
  { id: 'lessons',      label: 'Сабактар',      icon: LayoutGrid },
  { id: 'leagues',      label: 'Лигалар',       icon: Trophy },
  { id: 'achievements', label: 'Жетишкендиктер', icon: Award },
  { id: 'partners',     label: 'Өнөктөштөр',    icon: Building2 },
  { id: 'limits',       label: 'Лимиттер',      icon: Sliders },
  { id: 'analytics',    label: 'Аналитика',     icon: BarChart3 },
];

export default function Shell() {
  const { token, logout } = useAdminAuth();
  const [tab, setTab] = useState('lessons');
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = useCallback(() => {
    setLoading(true);
    api.fetchContent(token)
      .then(c => { setContent(c); setError(''); })
      .catch(e => {
        if (e.status === 401) { logout(); return; }
        setError(e.message);
      })
      .finally(() => setLoading(false));
  }, [token, logout]);

  useEffect(() => { reload(); }, [reload]);

  return (
    <div className="min-h-dvh flex" style={{ background: '#0b1220' }}>
      <nav className="w-56 shrink-0 flex flex-col" style={{ borderRight: '1px solid #1e293b' }}>
        <div className="px-5 pt-6 pb-5 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center font-extrabold text-white text-sm" style={{ background: '#1CB0F6' }}>J</div>
          <span className="font-extrabold text-white text-[15px]">JashMen Админ</span>
        </div>
        <div className="flex flex-col gap-0.5 px-3 flex-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold text-left transition-colors"
              style={tab === id
                ? { background: 'rgba(28,176,246,0.15)', color: '#1CB0F6' }
                : { color: '#94a3b8' }}
            >
              <Icon size={18} strokeWidth={tab === id ? 2.5 : 2} /> {label}
            </button>
          ))}
        </div>
        <div className="p-3 flex flex-col gap-1">
          <button onClick={reload} className="flex items-center gap-2 w-full px-4 py-2.5 rounded-xl text-sm font-semibold" style={{ color: '#94a3b8' }}>
            <RefreshCw size={15} /> Жаңылоо
          </button>
          <button onClick={logout} className="flex items-center gap-2 w-full px-4 py-2.5 rounded-xl text-sm font-semibold" style={{ color: '#f87171' }}>
            <LogOut size={15} /> Чыгуу
          </button>
        </div>
      </nav>

      <main className="flex-1 overflow-y-auto p-6 lg:p-8">
        {loading ? (
          <div className="flex items-center justify-center h-64 text-slate-400 text-sm">Жүктөлүүдө...</div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
            <p className="text-red-400 text-sm">{error}</p>
            <button onClick={reload} className="text-[#1CB0F6] text-sm font-semibold">Кайра аракет кыл</button>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto">
            {tab === 'lessons'      && <LessonsModule      token={token} content={content} reload={reload} onAuthError={logout} />}
            {tab === 'leagues'      && <LeaguesModule      token={token} content={content} reload={reload} onAuthError={logout} />}
            {tab === 'achievements' && <AchievementsModule token={token} content={content} reload={reload} onAuthError={logout} />}
            {tab === 'partners'     && <PartnersModule     token={token} content={content} reload={reload} onAuthError={logout} />}
            {tab === 'limits'       && <LimitsModule       token={token} onAuthError={logout} />}
            {tab === 'analytics'    && <AnalyticsModule    token={token} content={content} onAuthError={logout} />}
          </div>
        )}
      </main>
    </div>
  );
}
