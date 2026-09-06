import { useEffect, useState } from 'react';
import { Trophy, Flame } from 'lucide-react';
import { useAuth, useContent, useBrightMode } from '../store.jsx';
import { useI18n, localizedText } from '../i18n.jsx';
import { getCurrentLeague, STREAK } from '../utils.js';
import * as api from '../api.js';
import MedalWreath from './icons/MedalWreath.jsx';
import Avatar from './Avatar.jsx';
import LeagueBadge from './icons/LeagueBadges.jsx';

export default function RightPanel() {
  const { user, state } = useAuth();
  const content = useContent();
  const { bright } = useBrightMode();
  const { t, locale } = useI18n();
  const [leaderboard, setLeaderboard] = useState([]);

  const leagues  = content?.leagues || [];
  const xp       = state?.xp || 0;
  const streak   = state?.streak || 0;
  const myLeague = getCurrentLeague(xp, leagues);

  const sortedLeagues = [...leagues].sort((a, b) => a.minXp - b.minXp);
  const nextLeague    = sortedLeagues.find(l => l.minXp > xp);
  const leaguePct     = myLeague && nextLeague
    ? Math.min(100, ((xp - myLeague.minXp) / (nextLeague.minXp - myLeague.minXp)) * 100)
    : 100;

  useEffect(() => {
    api.fetchLeaderboard(10).then(setLeaderboard).catch(() => {});
  }, []);

  const cardBg      = bright ? '#ffffff'   : '#1e293b';
  const cardBorder  = bright ? '#e2e8f0'   : '#334155';
  const textPri     = bright ? '#0f172a'   : 'white';
  const textMut     = bright ? '#64748b'   : '#94a3b8';
  const textFaint   = bright ? '#94a3b8'   : '#64748b';
  const progressBg  = bright ? '#f1f5f9'   : '#0f172a';
  const rowDivider  = bright ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.04)';
  const headerDiv   = bright ? '#e2e8f0'   : 'rgba(255,255,255,0.06)';

  return (
    <div className="w-[268px] shrink-0 space-y-4 pt-2 pb-8 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 64px)' }}>

      {/* ── League card ── */}
      {myLeague && (
        <div className="rounded-2xl p-4" style={{ background: cardBg, border: `1.5px solid ${cardBorder}` }}>
          <div className="flex items-center gap-3 mb-3">
            <LeagueBadge id={myLeague.id} color={myLeague.color} size={44} />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: textFaint }}>{t('league.myLeague')}</p>
              <p className="font-bold text-sm" style={{ color: textPri }}>{localizedText(myLeague.name, locale)}</p>
            </div>
            <span className="font-bold text-sm shrink-0" style={{ color: myLeague.color }}>
              {xp.toLocaleString()} XP
            </span>
          </div>

          {nextLeague && (
            <>
              <div className="h-2 rounded-full overflow-hidden mb-1.5" style={{ background: progressBg }}>
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${leaguePct}%`, background: myLeague.color }}
                />
              </div>
              <p className="text-[10px]" style={{ color: textFaint }}>
                {t('league.next')} <span className="font-semibold" style={{ color: textMut }}>{localizedText(nextLeague.name, locale)}</span>
                {' · '}{(nextLeague.minXp - xp).toLocaleString()} {t('league.xpLeft')}
              </p>
            </>
          )}
        </div>
      )}

      {/* ── Streak card ── */}
      {streak > 0 && (
        <div
          className="rounded-2xl px-4 py-3 flex items-center gap-3"
          style={{ background: 'rgba(76,141,255,0.08)', border: '1.5px solid rgba(76,141,255,0.2)' }}
        >
          <Flame size={26} color={STREAK.soft} fill={STREAK.soft} />
          <div>
            <p className="font-bold text-sm" style={{ color: textPri }}>{t('league.streakBadge', { n: streak })}</p>
            <p className="text-xs" style={{ color: textMut }}>{t('league.streakDesc')}</p>
          </div>
        </div>
      )}

      {/* ── Mini leaderboard ── */}
      {leaderboard.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ background: cardBg, border: `1.5px solid ${cardBorder}` }}>
          <div
            className="flex items-center gap-2 px-4 py-3"
            style={{ borderBottom: `1px solid ${headerDiv}` }}
          >
            <Trophy size={14} color="#FFD700" fill="#FFD700" />
            <p className="font-bold text-sm" style={{ color: textPri }}>{t('league.rating')}</p>
          </div>

          <div className="flex flex-col">
            {leaderboard.slice(0, 7).map((u, i) => {
              const isMe = u.id === user?.id;
              const podColors = { 0: '#FFD700', 1: '#C0C0C0', 2: '#CD7F32' };
              const rc = podColors[i] || '#64748b';
              // The top three wear the same medal the podium gives them, so
              // the rank reads identically wherever it is shown.
              const medal = i < 3 ? i + 1 : null;
              return (
                <div
                  key={u.id}
                  className="flex items-center gap-2.5 px-3.5 py-2.5"
                  style={{
                    background: isMe ? 'rgba(28,176,246,0.1)' : 'transparent',
                    borderBottom: i < 6 ? `1px solid ${rowDivider}` : 'none',
                  }}
                >
                  {medal ? (
                    <MedalWreath rank={medal} size={22} glow={false} bright={bright} className="shrink-0" />
                  ) : (
                    <span className="w-[22px] text-center text-xs font-bold shrink-0" style={{ color: rc }}>
                      {i + 1}
                    </span>
                  )}
                  <Avatar name={u.name} photoUrl={u.avatar} size={28} />
                  <p className="text-xs font-medium flex-1 truncate" style={{ color: textPri }}>
                    {u.name}
                    {isMe && <span style={{ color: '#1CB0F6' }}> ●</span>}
                  </p>
                  <span className="text-xs font-bold shrink-0" style={{ color: rc }}>
                    {u.xp.toLocaleString()}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
