import { useEffect, useMemo, useRef, useState, forwardRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Target, Flame, Trophy, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth, useContent, useBrightMode } from '../store.jsx';
import { useI18n, formatDays } from '../i18n.jsx';
import { getCurrentLeague } from '../utils.js';
import * as api from '../api.js';
import LeagueBadge from '../components/icons/LeagueBadges.jsx';
import Avatar from '../components/Avatar.jsx';

// The active tab runs ~27–29% larger than the rest (spec: "25–30% larger")
// and a league whose minXp the player hasn't reached yet renders as a dark
// graphite crystal with a centered lock, active or not — you can still
// browse ahead to preview it, you just can't earn its colors yet.
function LeagueCard({ league, isActive, locked, onClick, bright }) {
  const textPri = bright ? '#0f172a' : '#ffffff';
  const textMut = bright ? '#64748b' : '#94a3b8';
  const accent = locked ? textMut : league.color;

  return (
    <motion.button
      layout
      data-league-id={league.id}
      onClick={onClick}
      whileTap={{ scale: 0.95 }}
      animate={{ width: isActive ? 132 : 104, height: isActive ? 181 : 140, y: isActive ? -12 : 0 }}
      transition={{ type: 'spring', stiffness: 340, damping: 28 }}
      className="relative flex flex-col items-center justify-center shrink-0 rounded-2xl snap-center"
      style={{
        background: isActive && !locked
          ? `color-mix(in srgb, ${league.color} 16%, ${bright ? '#ffffff' : '#0b0f1a'})`
          : (bright ? '#f8fafc' : '#12141c'),
        border: `1.5px solid ${isActive && !locked ? league.color : (bright ? '#e2e8f0' : 'rgba(255,255,255,0.08)')}`,
        boxShadow: isActive && !locked ? `0 10px 26px -8px ${league.color}80, inset 0 0 0 1px ${league.color}30` : 'none',
      }}
    >
      <div style={{ marginBottom: 6 }}>
        <LeagueBadge id={league.id} color={league.color} locked={locked} size={isActive ? 92 : 68} />
      </div>
      <p className="font-extrabold text-[11px] uppercase tracking-wide text-center px-1" style={{ color: isActive && !locked ? textPri : textMut }}>
        {league.name}
      </p>
      <p className="text-[10px] mt-0.5 font-medium" style={{ color: isActive ? accent : textMut }}>
        {league.minXp}+ XP
      </p>
    </motion.button>
  );
}

function podiumFace(color) {
  return {
    background: `linear-gradient(180deg, color-mix(in srgb, ${color} 85%, white) 0%, ${color} 55%, color-mix(in srgb, ${color} 78%, black) 100%)`,
    boxShadow: `inset 0 2px 0 rgba(255,255,255,0.55), inset 0 -4px 10px rgba(0,0,0,0.18), 0 12px 26px -8px ${color}90`,
  };
}

function Podium({ top3, heroTextPri }) {
  const order     = [top3[1], top3[0], top3[2]];
  const heights   = ['64px', '86px', '46px'];
  const podColors = ['#C0C0C0', '#FFD700', '#CD7F32'];

  return (
    <div className="flex items-end justify-center gap-3 px-4 pt-2">
      {order.map((u, col) => {
        if (!u) return <div key={col} className="w-[92px]" />;
        const rank = col === 0 ? 2 : col === 1 ? 1 : 3;
        const podColor = podColors[col];

        return (
          <motion.div
            key={u.id}
            initial={{ y: 34, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 26, delay: col === 1 ? 0.05 : col === 0 ? 0.16 : 0.27 }}
            className="flex flex-col items-center gap-1"
            style={{ width: 92 }}
          >
            {rank === 1 && (
              <motion.span
                className="text-2xl mb-0.5"
                animate={{ rotate: [-6, 6, -6] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
              >
                👑
              </motion.span>
            )}
            <div style={{ boxShadow: `0 0 0 3px ${podColor}, 0 4px 16px ${podColor}70` }} className="rounded-full">
              <Avatar name={u.name} size={rank === 1 ? 62 : 50} />
            </div>
            <p className="font-bold text-xs text-center mt-1 w-full truncate" style={{ color: heroTextPri }}>
              {u.name}
            </p>
            <p className="text-xs font-extrabold" style={{ color: podColor }}>
              {u.xp.toLocaleString()} XP
            </p>
            <div
              className="w-full flex items-center justify-center rounded-t-xl font-black text-xl"
              style={{ height: heights[col], marginTop: 4, color: 'rgba(0,0,0,0.55)', ...podiumFace(podColor) }}
            >
              #{rank}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

function StatCell({ icon: Icon, value, label, color, textPri, textMut, last }) {
  return (
    <div
      className="flex-1 flex flex-col items-center gap-0.5 py-3.5"
      style={!last ? { borderRight: `1px solid ${textMut}22` } : undefined}
    >
      <Icon size={15} color={color} strokeWidth={2.5} />
      <span className="font-extrabold text-[15px] leading-none" style={{ color: textPri }}>{value}</span>
      <span className="text-[10px] font-medium" style={{ color: textMut }}>{label}</span>
    </div>
  );
}

const UserRow = forwardRef(function UserRow({ user, rank, isMe, bright }, ref) {
  const { locale } = useI18n();
  const podColors = { 1: '#FFD700', 2: '#C0C0C0', 3: '#CD7F32' };
  const rankColor = podColors[rank] || (bright ? '#94a3b8' : '#64748b');
  const textPri   = bright ? '#0f172a' : 'white';
  const textMut   = bright ? '#64748b' : '#94a3b8';
  const rowBg     = isMe
    ? (bright ? 'rgba(28,176,246,0.08)' : 'rgba(28,176,246,0.12)')
    : (bright ? '#ffffff' : '#151f30');

  return (
    <motion.div
      ref={ref}
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="flex items-center gap-3 px-3.5 py-2.5 rounded-2xl"
      style={{
        background: rowBg,
        border: isMe ? '1.5px solid rgba(28,176,246,0.35)' : `1px solid ${bright ? '#f1f5f9' : 'rgba(255,255,255,0.04)'}`,
        boxShadow: bright ? '0 1px 3px rgba(15,23,42,0.06)' : '0 1px 3px rgba(0,0,0,0.2)',
      }}
    >
      <span
        className="w-7 h-7 rounded-full text-xs font-extrabold flex items-center justify-center shrink-0"
        style={{ color: rankColor, background: `${rankColor}18` }}
      >
        {rank}
      </span>
      <Avatar name={user.name} size={36} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate" style={{ color: textPri }}>{user.name}</p>
        {user.streak > 0 && (
          <div className="flex items-center gap-0.5">
            <Flame size={11} color="#fb923c" fill="#fb923c" />
            <span className="text-[10px]" style={{ color: textMut }}>{formatDays(user.streak, locale)}</span>
          </div>
        )}
      </div>
      <div className="flex items-baseline gap-1 shrink-0">
        <span className="font-bold text-sm" style={{ color: textPri }}>{user.xp.toLocaleString()}</span>
        <span className="text-xs" style={{ color: textMut }}>XP</span>
      </div>
    </motion.div>
  );
});

export default function LeaguePage() {
  const content  = useContent();
  const { user, state } = useAuth();
  const { bright } = useBrightMode();
  const { t } = useI18n();
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [activeLeague, setActiveLeague] = useState(null);
  const [scrollState, setScrollState] = useState({ left: false, right: false });
  const scrollRef = useRef(null);

  const leagues  = content?.leagues || [];
  const xp       = state?.xp || 0;
  const myLeague = getCurrentLeague(xp, leagues);

  useEffect(() => {
    if (!activeLeague && myLeague) setActiveLeague(myLeague);
  }, [myLeague]);

  const updateScrollState = () => {
    const el = scrollRef.current;
    if (!el) return;
    setScrollState({
      left: el.scrollLeft > 4,
      right: el.scrollLeft < el.scrollWidth - el.clientWidth - 4,
    });
  };
  useEffect(updateScrollState, [leagues.length]);

  // Keep the selected card scrolled into view — including on first load,
  // when it jumps straight to the player's current league.
  useEffect(() => {
    if (!activeLeague || !scrollRef.current) return;
    scrollRef.current
      .querySelector(`[data-league-id="${activeLeague.id}"]`)
      ?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [activeLeague]);

  const scrollByCard = (dir) => scrollRef.current?.scrollBy({ left: dir * 130, behavior: 'smooth' });

  useEffect(() => {
    api.fetchLeaderboard(200)
      .then(d => { setLeaderboard(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // Each league tab is a real filter — XP band [thisLeague.minXp, nextLeague.minXp).
  const leagueBounds = useMemo(() => {
    const sorted = [...leagues].sort((a, b) => a.minXp - b.minXp);
    const map = new Map();
    sorted.forEach((l, i) => map.set(l.id, { min: l.minXp, max: sorted[i + 1]?.minXp ?? Infinity }));
    return map;
  }, [leagues]);

  const viewLeaderboard = useMemo(() => {
    if (!activeLeague) return leaderboard;
    const bounds = leagueBounds.get(activeLeague.id);
    if (!bounds) return leaderboard;
    return leaderboard.filter(u => u.xp >= bounds.min && u.xp < bounds.max);
  }, [leaderboard, activeLeague, leagueBounds]);

  const top3   = viewLeaderboard.slice(0, 3);
  const rest   = viewLeaderboard.slice(3);
  const userId = user?.id;
  const myRankInView = viewLeaderboard.findIndex(u => u.id === userId);
  const iAmRanked = myRankInView >= 0;

  const heroBg = 'transparent';
  const heroTextPri = bright ? '#0f172a' : '#ffffff';
  const heroTextMut = bright ? 'rgba(15,23,42,0.5)' : 'rgba(255,255,255,0.55)';
  const sheetBg    = bright ? '#f8fafc' : '#0b1220';
  const textPri    = bright ? '#0f172a' : 'white';
  const textMut    = bright ? '#64748b' : '#94a3b8';

  return (
    <div className="pb-4">
      {/* ── Hero: league cards, podium ── */}
      <div className="relative overflow-hidden pt-4 pb-10" style={{ background: heroBg }}>
        <div className="relative">
          <div
            ref={scrollRef}
            onScroll={updateScrollState}
            className="flex gap-3 overflow-x-auto px-4 pt-2 pb-1 snap-x snap-mandatory"
            style={{ scrollbarWidth: 'none' }}
          >
            {leagues.map(l => (
              <LeagueCard
                key={l.id}
                league={l}
                isActive={activeLeague?.id === l.id}
                locked={xp < l.minXp}
                onClick={() => setActiveLeague(l)}
                bright={bright}
              />
            ))}
          </div>

          {scrollState.left && (
            <button
              onClick={() => scrollByCard(-1)}
              aria-label={t('league.prevLeagues')}
              className="absolute left-1 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center"
              style={{
                background: bright ? 'rgba(255,255,255,0.9)' : 'rgba(15,23,42,0.75)',
                border: `1.5px solid ${bright ? '#e2e8f0' : 'rgba(255,255,255,0.15)'}`,
                backdropFilter: 'blur(6px)',
              }}
            >
              <ChevronLeft size={18} color={heroTextPri} />
            </button>
          )}
          {scrollState.right && (
            <button
              onClick={() => scrollByCard(1)}
              aria-label={t('league.nextLeagues')}
              className="absolute right-1 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center"
              style={{
                background: bright ? 'rgba(255,255,255,0.9)' : 'rgba(15,23,42,0.75)',
                border: `1.5px solid ${bright ? '#e2e8f0' : 'rgba(255,255,255,0.15)'}`,
                backdropFilter: 'blur(6px)',
              }}
            >
              <ChevronRight size={18} color={heroTextPri} />
            </button>
          )}
        </div>

        <div className="flex justify-center gap-1.5 mt-3 mb-1">
          {leagues.map(l => (
            <button
              key={l.id}
              onClick={() => setActiveLeague(l)}
              aria-label={l.name}
              className="rounded-full transition-all duration-300"
              style={{
                width: activeLeague?.id === l.id ? '18px' : '6px',
                height: '6px',
                background: activeLeague?.id === l.id ? l.color : (bright ? '#e2e8f0' : '#1e293b'),
              }}
            />
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-14">
            <div className="text-3xl animate-pulse">🏆</div>
          </div>
        ) : top3.length > 0 ? (
          <Podium top3={top3} heroTextPri={heroTextPri} />
        ) : (
          <div className="relative flex flex-col items-center gap-1 py-10 px-6 text-center">
            <span className="text-3xl mb-1">🌌</span>
            <p className="font-bold text-sm" style={{ color: heroTextPri }}>{t('league.emptyTitle')}</p>
            <p className="text-xs" style={{ color: heroTextMut }}>{t('league.emptyDesc')}</p>
          </div>
        )}
      </div>

      {/* ── Sheet: stats + ranked list, rising over the hero ── */}
      <div
        className="relative -mt-6 rounded-t-[28px] pt-1"
        style={{ background: sheetBg, boxShadow: bright ? '0 -6px 20px rgba(15,23,42,0.06)' : '0 -6px 20px rgba(0,0,0,0.3)' }}
      >
        <div className="mx-4 -mt-5 mb-3 rounded-2xl flex overflow-hidden" style={{ background: bright ? '#ffffff' : '#151f30', boxShadow: bright ? '0 6px 20px rgba(15,23,42,0.1)' : '0 6px 20px rgba(0,0,0,0.35)' }}>
          <StatCell icon={Users}   value={viewLeaderboard.length}                     label={t('league.participants')} color="#1CB0F6" textPri={textPri} textMut={textMut} />
          <StatCell icon={Trophy}  value={(top3[0]?.xp ?? 0).toLocaleString()}        label={t('league.leaderXp')}     color="#FFD700" textPri={textPri} textMut={textMut} />
          <StatCell icon={Target}  value={iAmRanked ? `#${myRankInView + 1}` : '—'}    label={t('league.myRank')}       color="#58CC02" textPri={textPri} textMut={textMut} last />
        </div>

        {!loading && (
          <>
            <div className="px-3 flex flex-col gap-1.5 mb-2">
              <AnimatePresence mode="popLayout">
                {rest.map((u, i) => (
                  <UserRow key={u.id} user={u} rank={i + 4} isMe={u.id === userId} bright={bright} />
                ))}
              </AnimatePresence>
            </div>

            {userId && !viewLeaderboard.find(u => u.id === userId) && state && activeLeague?.id === myLeague?.id && (
              <div className="mx-3 mt-1">
                <UserRow
                  user={{ id: userId, name: user.name, xp: state.xp || 0, streak: state.streak || 0 }}
                  rank={leaderboard.length + 1}
                  isMe
                  bright={bright}
                />
              </div>
            )}
          </>
        )}

        <div className="h-3" />
      </div>
    </div>
  );
}
