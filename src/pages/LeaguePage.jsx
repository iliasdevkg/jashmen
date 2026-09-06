import { useEffect, useMemo, useRef, useState, forwardRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Target, Flame, Trophy, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth, useContent, useBrightMode } from '../store.jsx';
import { useI18n, formatDays, localizedText } from '../i18n.jsx';
import { getCurrentLeague, STREAK } from '../utils.js';
import * as api from '../api.js';
import LeagueBadge from '../components/icons/LeagueBadges.jsx';
import Avatar from '../components/Avatar.jsx';
import LeaguePodium from '../components/LeaguePodium.jsx';
import {
  LeagueTabs,
  RoleDialog,
  UniLeagueView,
  UniversityPickerDialog,
  useUniEnrolment,
} from '../components/UniLeague.jsx';

// The active tab runs ~27–29% larger than the rest (spec: "25–30% larger")
// and a league whose minXp the player hasn't reached yet renders as a dark
// graphite crystal with a centered lock, active or not — you can still
// browse ahead to preview it, you just can't earn its colors yet.
function LeagueCard({ league, isActive, locked, onClick, bright, locale }) {
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
        <LeagueBadge id={league.id} color={league.color} locked={locked} size={isActive ? 92 : 68} iconUrl={league.iconUrl} icon={league.icon} />
      </div>
      <p className="font-extrabold text-[11px] uppercase tracking-wide text-center px-1" style={{ color: isActive && !locked ? textPri : textMut }}>
        {localizedText(league.name, locale)}
      </p>
      <p className="text-[10px] mt-0.5 font-medium" style={{ color: isActive ? accent : textMut }}>
        {league.minXp}+ XP
      </p>
    </motion.button>
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
      <Avatar name={user.name} photoUrl={user.avatar} size={36} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate" style={{ color: textPri }}>{user.name}</p>
        {user.streak > 0 && (
          <div className="flex items-center gap-0.5">
            <Flame size={11} color={STREAK.soft} fill={STREAK.soft} />
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
  const { t, locale } = useI18n();
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [activeLeague, setActiveLeague] = useState(null);
  const [scrollState, setScrollState] = useState({ left: false, right: false });
  const scrollRef = useRef(null);

  // ── University league ──
  //
  // `tab` is the chrome: it can say 'uni' while the general league is still
  // the thing on screen — that is the state the design shows behind the role
  // and university dialogs.
  const [tab, setTab]   = useState('general');
  const [flow, setFlow] = useState(null); // { step: 'role' | 'picker', role, mode }
  const { enrolment, university, commit } = useUniEnrolment();
  // Enrolment is a server write now, so it can be in flight and it can fail
  // — both states have to be visible rather than silently dropping the user
  // back on the general league.
  const [enrolling, setEnrolling] = useState(false);
  const [enrolError, setEnrolError] = useState('');

  const showUni = tab === 'uni' && !!university && !!enrolment.role;

  const selectTab = (next) => {
    if (next === tab) return;
    setTab(next);
    // Entering the tab asks the two questions it needs, in order. `university`
    // is the resolved record, not the stored id: one saved here can vanish
    // from the list upstream, and that has to re-ask.
    if (next === 'uni' && !(university && enrolment.role)) {
      setFlow({ step: enrolment.role ? 'picker' : 'role', role: enrolment.role, mode: 'enrol' });
    }
  };

  // "Өзгөртүү / Изменить / Change" — reopens both questions with the current
  // answers preselected.
  const startChange  = () => setFlow({ step: 'role', role: enrolment.role, mode: 'change' });

  // "Чыгуу" — leaves the campus entirely and goes back to the general
  // league. Destructive in a way changing campus is not: a student forfeits
  // the campus score they built, and the server zeroes uniXp on the way out
  // (routes.js#/u/me/university), so it asks first.
  const leaveUniversity = async () => {
    if (!window.confirm(t('uni.leaveConfirm'))) return;
    setEnrolError('');
    setEnrolling(true);
    try {
      await commit(null, null);
      setTab('general');
    } catch (e) {
      setEnrolError(e.message);
    } finally {
      setEnrolling(false);
    }
  };
  const onRolePicked = (role) => setFlow(f => ({ ...f, step: 'picker', role }));

  // Nothing is written until both answers come back, so backing out of
  // either dialog leaves the page exactly as it was.
  const onUniversityPicked = async (id) => {
    const role = flow.role;
    setFlow(null);
    setEnrolError('');
    setEnrolling(true);
    try {
      await commit(role, id);
    } catch (e) {
      setEnrolError(e.message || t('common.error'));
      setTab('general');
    } finally {
      setEnrolling(false);
    }
  };

  const dismissFlow = () => {
    // Landing on an empty university tab would be a dead end.
    if (flow?.mode === 'enrol' && !(university && enrolment.role)) setTab('general');
    setFlow(null);
  };

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
      <LeagueTabs tab={tab} onSelect={selectTab} bright={bright} />

      {/* The design keeps this line under the general league only — the
          university tab replaces it with the "change my campus" row. */}
      {!showUni && (
        <p className="px-5 pb-1 text-center text-[13px] font-semibold" style={{ color: heroTextMut }}>
          {t('league.generalSubtitle')}
        </p>
      )}

      {enrolError && (
        <p className="px-5 pb-1 text-center text-[12px] font-semibold" style={{ color: '#FF4B4B' }}>
          {enrolError}
        </p>
      )}

      {tab === 'uni' && enrolling ? (
        <p className="py-16 text-center text-sm" style={{ color: textMut }}>{t('common.loading')}</p>
      ) : showUni ? (
        <UniLeagueView university={university} bright={bright} onChange={startChange} onLeave={leaveUniversity} />
      ) : (
        <>
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
                    locale={locale}
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
                <Trophy size={30} color={heroTextMut} className="animate-pulse" />
              </div>
            ) : top3.length > 0 ? (
              <LeaguePodium top3={top3} textColor={heroTextPri} />
            ) : (
              <div className="relative flex flex-col items-center gap-1 py-10 px-6 text-center">
                <Users size={30} color={heroTextMut} className="mb-1" />
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
        </>
      )}

      <AnimatePresence>
        {flow && (flow.step === 'role' ? (
          <RoleDialog
            key="role"
            current={flow.role}
            bright={bright}
            onPick={onRolePicked}
            onDismiss={dismissFlow}
          />
        ) : (
          <UniversityPickerDialog
            key="picker"
            role={flow.role}
            current={flow.role === enrolment.role ? enrolment.universityId : null}
            bright={bright}
            onPick={onUniversityPicked}
            onDismiss={dismissFlow}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
