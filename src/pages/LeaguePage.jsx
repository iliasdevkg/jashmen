import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, ChevronRight, Flame } from 'lucide-react';
import { useAuth, useContent, useBrightMode } from '../store.jsx';
import { getCurrentLeague } from '../utils.js';
import * as api from '../api.js';

const AVATAR_COLORS = [
  '#F97316', '#8B5CF6', '#EAB308', '#06B6D4',
  '#10B981', '#EF4444', '#EC4899', '#3B82F6',
  '#A855F7', '#14B8A6', '#F59E0B', '#6366F1',
];
function avatarColor(name = '') {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
function initial(name = '') {
  return name.trim().slice(0, 1).toUpperCase() || '?';
}

function Avatar({ name, size = 48 }) {
  const color = avatarColor(name);
  return (
    <div
      className="rounded-full flex items-center justify-center font-extrabold shrink-0"
      style={{
        width: size, height: size,
        background: color,
        fontSize: size * 0.38,
        color: 'white',
        boxShadow: `0 2px 10px ${color}50`,
      }}
    >
      {initial(name)}
    </div>
  );
}

function LeagueCard({ league, isActive, onClick, bright }) {
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      className="flex flex-col items-center rounded-2xl p-4 shrink-0 w-[110px] transition-all"
      style={{
        background: isActive ? `${league.color}18` : (bright ? '#f1f5f9' : '#151f30'),
        border: `2px solid ${isActive ? league.color : (bright ? '#e2e8f0' : 'rgba(255,255,255,0.06)')}`,
      }}
    >
      <span className="text-3xl mb-1">{league.emoji}</span>
      <p className="font-bold text-sm" style={{ color: bright ? '#0f172a' : 'white' }}>{league.name}</p>
      <p className="text-xs mt-0.5 font-semibold" style={{ color: league.color }}>{league.minXp}+ XP</p>
    </motion.button>
  );
}

function Podium({ top3, bright }) {
  const order    = [top3[1], top3[0], top3[2]];
  const heights  = ['60px', '80px', '44px'];
  const podColors = ['#C0C0C0', '#FFD700', '#CD7F32'];
  const textPri  = bright ? '#0f172a' : 'white';

  return (
    <div className="flex items-end justify-center gap-4 px-4 pt-4 pb-6">
      {order.map((u, col) => {
        if (!u) return <div key={col} className="w-[96px]" />;
        const rank = col === 0 ? 2 : col === 1 ? 1 : 3;
        const podColor = podColors[col];

        return (
          <motion.div
            key={u.id}
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: col === 1 ? 0.05 : col === 0 ? 0.15 : 0.25 }}
            className="flex flex-col items-center gap-1"
            style={{ width: 96 }}
          >
            {rank === 1 && <span className="text-2xl mb-1">👑</span>}
            <Avatar name={u.name} size={rank === 1 ? 58 : 48} />
            <p className="font-bold text-xs text-center mt-1 w-full truncate" style={{ color: textPri }}>
              {u.name}
            </p>
            <p className="text-xs font-semibold" style={{ color: podColor }}>
              {u.xp.toLocaleString()} XP
            </p>
            <div
              className="w-full flex items-center justify-center rounded-t-xl font-black text-xl"
              style={{
                height: heights[col],
                background: `${podColor}18`,
                border: `2px solid ${podColor}`,
                borderBottom: 'none',
                color: podColor,
                marginTop: 4,
              }}
            >
              #{rank}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

function UserRow({ user, rank, isMe, bright }) {
  const podColors = { 1: '#FFD700', 2: '#C0C0C0', 3: '#CD7F32' };
  const rankColor = podColors[rank] || '#64748b';
  const textPri   = bright ? '#0f172a' : 'white';
  const textMut   = bright ? '#64748b' : '#94a3b8';

  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5 rounded-xl"
      style={{
        background: isMe ? 'rgba(28,176,246,0.08)' : 'transparent',
        border: isMe ? '1px solid rgba(28,176,246,0.2)' : '1px solid transparent',
      }}
    >
      <span className="w-7 text-sm font-bold text-center shrink-0" style={{ color: rankColor }}>
        #{rank}
      </span>
      <Avatar name={user.name} size={36} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate" style={{ color: textPri }}>{user.name}</p>
        {user.streak > 0 && (
          <div className="flex items-center gap-0.5">
            <Flame size={11} color="#fb923c" fill="#fb923c" />
            <span className="text-[10px]" style={{ color: textMut }}>{user.streak} күн</span>
          </div>
        )}
      </div>
      <div className="flex items-baseline gap-1 shrink-0">
        <span className="font-bold text-sm" style={{ color: rankColor }}>{user.xp.toLocaleString()}</span>
        <span className="text-xs" style={{ color: textMut }}>XP</span>
      </div>
    </div>
  );
}

export default function LeaguePage() {
  const content  = useContent();
  const { user, state } = useAuth();
  const { bright } = useBrightMode();
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [activeLeague, setActiveLeague] = useState(null);

  const leagues  = content?.leagues || [];
  const xp       = state?.xp || 0;
  const myLeague = getCurrentLeague(xp, leagues);

  useEffect(() => {
    if (!activeLeague && myLeague) setActiveLeague(myLeague);
  }, [myLeague]);

  useEffect(() => {
    api.fetchLeaderboard(50)
      .then(d => { setLeaderboard(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const top3   = leaderboard.slice(0, 3);
  const rest   = leaderboard.slice(3);
  const userId = user?.id;

  const textPri   = bright ? '#0f172a' : 'white';
  const textMut   = bright ? '#64748b' : '#94a3b8';
  const dividerBg = bright ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.05)';
  const dotInact  = bright ? '#e2e8f0' : '#1e293b';

  return (
    <div className="py-4">
      <div className="flex items-center justify-between px-4 mb-4">
        <div className="flex items-center gap-2">
          <Trophy size={20} color="#FFD700" fill="#FFD700" />
          <h2 className="font-extrabold text-base" style={{ color: textPri }}>Бардык лигалар</h2>
        </div>
        <ChevronRight size={18} color={bright ? '#94a3b8' : '#334155'} />
      </div>

      <div className="flex gap-3 overflow-x-auto px-4 pb-3" style={{ scrollbarWidth: 'none' }}>
        {leagues.map(l => (
          <LeagueCard
            key={l.id}
            league={l}
            isActive={activeLeague?.id === l.id}
            onClick={() => setActiveLeague(l)}
            bright={bright}
          />
        ))}
      </div>

      <div className="flex justify-center gap-1.5 mt-2 mb-1">
        {leagues.slice(0, Math.min(leagues.length, 8)).map((l) => (
          <div
            key={l.id}
            className="rounded-full transition-all duration-300"
            style={{
              width: activeLeague?.id === l.id ? '18px' : '6px',
              height: '6px',
              background: activeLeague?.id === l.id ? (myLeague?.color || '#1CB0F6') : dotInact,
            }}
          />
        ))}
      </div>

      {myLeague && (
        <p className="text-center text-xs mt-2 mb-2" style={{ color: textMut }}>
          Сенин лигаң:{' '}
          <span className="font-bold" style={{ color: myLeague.color }}>{myLeague.name}</span>
          {' · '}{xp.toLocaleString()} XP
        </p>
      )}

      <div className="mx-4 h-px mb-1" style={{ background: dividerBg }} />

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="text-3xl animate-pulse">🏆</div>
        </div>
      ) : (
        <>
          {top3.length > 0 && <Podium top3={top3} userId={userId} bright={bright} />}

          <div className="px-3 flex flex-col gap-1 mb-2">
            {rest.map((u, i) => (
              <UserRow key={u.id} user={u} rank={i + 4} isMe={u.id === userId} bright={bright} />
            ))}
          </div>

          {userId && !leaderboard.find(u => u.id === userId) && state && (
            <div className="mx-3 mt-2">
              <UserRow
                user={{ id: userId, name: user.name, avatar: user.avatar, xp: state.xp || 0, streak: state.streak || 0 }}
                rank={leaderboard.length + 1}
                isMe
                bright={bright}
              />
            </div>
          )}
        </>
      )}

      <div className="h-4" />
    </div>
  );
}
