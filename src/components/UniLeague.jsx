// University league — the web twin of the mobile screen's
// "Университет лигасы" tab (mobile/lib/src/screens/league_screen.dart).
//
// Three pieces live here because they are one flow: the two questions that
// gate the tab (who are you, which campus) and the view they unlock. The
// enrolment itself is a hook so LeaguePage owns the flow while this file
// owns the presentation.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Trophy, Users, GraduationCap, Eye, X, Pencil, Check, Zap, Heart, AlertCircle, Gift, BookOpen, ChevronRight } from 'lucide-react';
import { useI18n, localizedText, kyGenitive, formatGrouped, formatSom, formatLongDate } from '../i18n.jsx';
import { useAuth, useContent } from '../store.jsx';
import { energySettings, computeLiveEnergy, formatCountdown } from '../utils.js';
import * as api from '../api.js';
import Avatar from './Avatar.jsx';
import MedalWreath from './icons/MedalWreath.jsx';
import DialogShell, { BottomSheet, SPRING } from './DialogShell.jsx';

// ── Campus catalogue ───────────────────────────────────────────────────
//
// Admin content now (Module Г), shipped inside /public/content, so a prize
// pool or a set of dates is an admin edit rather than a client release. It
// used to be authored in src/data/universities.js and again in the Dart
// twin, which meant the two could disagree.

function useUniversities() {
  const content = useContent();
  return content?.universities || EMPTY_UNIVERSITIES;
}

// A stable identity, so `useMemo` consumers don't re-run on every render
// while the content payload is still loading.
const EMPTY_UNIVERSITIES = [];

// Null for an id that is no longer in the list — a campus can be deleted in
// the admin while a learner still has it saved on their account.
function findUniversity(universities, id) {
  return universities.find(u => u.id === id) || null;
}

// Pre-server builds answered both enrolment questions into localStorage.
// The answers now live on the user record (state.uniId / state.uniRole) —
// these two keys survive only long enough to migrate an existing browser
// once, in useUniEnrolment below.
const LEGACY_ROLE_KEY = 'fl_uni_role';
const LEGACY_UNI_KEY  = 'fl_uni_id';
const ROLES = ['student', 'viewer'];

// ── Enrolment ──────────────────────────────────────────────────────────────
//
// Both answers (who are you, which campus) are server state now, because a
// viewer's gift and a student's supporter list are facts about two people —
// a per-browser localStorage answer could never resolve either.

export function useUniEnrolment() {
  const { token, state, updateUser } = useAuth();

  const role = ROLES.includes(state?.uniRole) ? state.uniRole : null;
  const universityId = state?.uniId || null;
  // Resolved through the catalogue rather than trusted blindly, so an id
  // whose campus was removed from the content re-asks instead of rendering
  // an empty tab.
  const universities = useUniversities();
  const university = useMemo(
    () => findUniversity(universities, universityId),
    [universities, universityId],
  );

  const commit = useCallback(async (nextRole, nextUniversityId) => {
    const user = await api.setUniversity(token, nextUniversityId, nextRole);
    updateUser(user);
    return user;
  }, [token, updateUser]);

  // One-shot migration of a browser that answered before the server owned
  // this. Runs only while the account still has no enrolment, so it can
  // never overwrite a newer answer made on another device.
  const migrated = useRef(false);
  useEffect(() => {
    if (migrated.current || !token || role || universityId) return;
    migrated.current = true;
    let storedRole = null, storedUni = null;
    try {
      storedRole = localStorage.getItem(LEGACY_ROLE_KEY);
      storedUni  = localStorage.getItem(LEGACY_UNI_KEY);
      localStorage.removeItem(LEGACY_ROLE_KEY);
      localStorage.removeItem(LEGACY_UNI_KEY);
    } catch { /* storage unavailable — nothing to migrate */ }
    // Only migrate a campus that still exists in the catalogue; a stale id
    // would enrol the learner into nothing.
    if (ROLES.includes(storedRole) && findUniversity(universities, storedUni)) {
      commit(storedRole, storedUni).catch(() => {});
    }
  }, [token, role, universityId, commit, universities]);

  return { enrolment: { role, universityId }, university, commit };
}

// ── Board data ─────────────────────────────────────────────────────────────
//
// The campus's own standings: real enrolled students ranked by XP, plus the
// viewer count behind the eye badge. Only students are ranked — a viewer's
// XP belongs to the general league, which is exactly what the server's
// role filter gives us.

export function useUniBoard(universityId) {
  const { token } = useAuth();
  const [board, setBoard] = useState(null);
  const [loading, setLoading] = useState(!!universityId);
  const [error, setError] = useState(null);
  // Guards against a slow response for a campus the user has already
  // switched away from landing on top of the new one.
  const requestId = useRef(0);

  const load = useCallback(() => {
    const id = ++requestId.current;
    if (!token || !universityId) {
      setBoard(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    api.fetchUniBoard(token, universityId, 10)
      .then(next => {
        if (requestId.current !== id) return;
        setBoard(next);
        setError(null);
      })
      .catch(err => {
        if (requestId.current !== id) return;
        setError(err);
      })
      .finally(() => {
        if (requestId.current === id) setLoading(false);
      });
  }, [token, universityId]);

  useEffect(() => { load(); }, [load]);

  return { board, loading, error, reload: load };
}

// ── Dialogs ────────────────────────────────────────────────────────────────

function RoleCard({ icon: Icon, title, description, from, to, selected, onClick }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.96 }}
      transition={SPRING}
      aria-pressed={selected}
      className="flex-1 flex flex-col items-center text-center rounded-[14px] px-3 pt-4 pb-3.5"
      style={{
        background: `linear-gradient(135deg, ${from} 0%, ${to} 100%)`,
        // The current answer keeps a light ring so reopening the dialog
        // shows what was chosen last time.
        border: `${selected ? 2 : 1}px solid ${selected ? '#ffffff' : 'rgba(255,255,255,0.25)'}`,
        boxShadow: `0 8px 18px -6px ${to}59`,
      }}
    >
      <Icon size={30} color="#ffffff" strokeWidth={2} />
      <span className="mt-2.5 text-[13px] font-black tracking-wide text-white">{title}</span>
      <span className="mt-1.5 text-[11px] leading-snug" style={{ color: 'rgba(255,255,255,0.88)' }}>
        {description}
      </span>
    </motion.button>
  );
}

export function RoleDialog({ current, bright, onPick, onDismiss }) {
  const { t } = useI18n();
  const textPri = bright ? '#0f172a' : '#ffffff';
  const textMut = bright ? '#64748b' : '#8a93a6';

  return (
    <DialogShell onDismiss={onDismiss} bright={bright} labelledBy="uni-role-title">
      <div className="px-4 pt-5 pb-4">
        <h2 id="uni-role-title" className="text-center text-[15px] font-black tracking-wide" style={{ color: textPri }}>
          {t('uni.roleTitle')}
        </h2>
        <p className="text-center text-[12.5px] leading-snug mt-1.5" style={{ color: textMut }}>
          {t('uni.roleSubtitle')}
        </p>
        <div className="flex items-stretch gap-2.5 mt-4">
          <RoleCard
            icon={GraduationCap}
            title={t('uni.roleStudent')}
            description={t('uni.roleStudentDesc')}
            from="#3B82F6"
            to="#1D4ED8"
            selected={current === 'student'}
            onClick={() => onPick('student')}
          />
          <RoleCard
            icon={Eye}
            title={t('uni.roleViewer')}
            description={t('uni.roleViewerDesc')}
            from="#A855F7"
            to="#7C3AED"
            selected={current === 'viewer'}
            onClick={() => onPick('viewer')}
          />
        </div>
      </div>
    </DialogShell>
  );
}

export function UniversityPickerDialog({ role, current, bright, onPick, onDismiss }) {
  const { t, locale } = useI18n();
  const universities = useUniversities();
  const [selected, setSelected] = useState(current || null);
  const textPri = bright ? '#0f172a' : '#ffffff';
  const textMut = bright ? '#64748b' : '#8a93a6';

  return (
    <DialogShell onDismiss={onDismiss} bright={bright} labelledBy="uni-pick-title">
      <div className="flex flex-col" style={{ maxHeight: '82vh' }}>
        <div className="relative px-4 pt-5">
          <div className="px-7">
            <h2 id="uni-pick-title" className="text-center text-[14px] font-black tracking-wide" style={{ color: textPri }}>
              {t('uni.pickTitle')}
            </h2>
            <p className="text-center text-[12.5px] leading-snug mt-1.5" style={{ color: textMut }}>
              {t(role === 'student' ? 'uni.pickSubtitle' : 'uni.pickSubtitleViewer')}
            </p>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            aria-label={t('uni.close')}
            className="absolute right-3 top-3.5 w-8 h-8 rounded-full flex items-center justify-center"
          >
            <X size={20} color={textMut} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 mt-3.5 flex flex-col gap-2">
          {universities.map((u, i) => {
            const on = u.id === selected;
            return (
              <motion.button
                key={u.id}
                type="button"
                onClick={() => setSelected(u.id)}
                whileTap={{ scale: 0.98 }}
                aria-pressed={on}
                className="flex items-center gap-2.5 rounded-[11px] px-2.5 py-2 text-left"
                style={{
                  background: on
                    ? 'rgba(59,130,246,0.14)'
                    : (bright ? '#ffffff' : '#0c1526'),
                  border: `${on ? 1.5 : 1}px solid ${on ? '#3B82F6' : (bright ? '#dbeafe' : '#1b2a45')}`,
                }}
              >
                <Crest university={u} size={30} locale={locale} />
                <span className="text-[13px] font-bold shrink-0" style={{ color: textMut }}>{i + 1}.</span>
                <span className="flex-1 min-w-0 truncate text-[13px] font-bold tracking-wide" style={{ color: textPri }}>
                  {u.listName}
                </span>
                {on && <Check size={18} color="#3B82F6" strokeWidth={3} />}
              </motion.button>
            );
          })}
        </div>

        <div className="px-4 pt-4 pb-4">
          <motion.button
            type="button"
            disabled={!selected}
            onClick={() => selected && onPick(selected)}
            whileTap={selected ? { scale: 0.97 } : undefined}
            className="w-full h-[50px] rounded-full text-[16px] font-black tracking-wide"
            style={{
              background: '#ffffff',
              color: '#1D4ED8',
              opacity: selected ? 1 : 0.45,
              cursor: selected ? 'pointer' : 'not-allowed',
              transition: 'opacity 150ms ease',
            }}
          >
            {t('uni.ok')}
          </motion.button>
        </div>
      </div>
    </DialogShell>
  );
}

// ── Crest ──────────────────────────────────────────────────────────────────

// "КГТУ" stays whole; "Салымбеков" and "Ала-Тоо" become initials — four
// glyphs is as much as a crest can hold before it turns into a label.
function crestLabel(shortName) {
  const name = String(shortName || '').trim();
  if (!name) return '?';
  if (name.length <= 4 && name === name.toUpperCase()) return name;
  const parts = name.split(/[\s\-–—]+/).filter(Boolean);
  const initials = parts.slice(0, 3).map(w => w[0].toUpperCase()).join('');
  return initials || name[0].toUpperCase();
}

// The supplied artwork, or a monogram disc in the university's own accent
// colour — a designed stand-in, not a gap.
function Crest({ university, size, locale }) {
  if (university.logoUrl) {
    return (
      <img
        src={university.logoUrl}
        alt=""
        className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }
  const label = crestLabel(localizedText(university.shortName, locale));
  return (
    <span
      className="rounded-full shrink-0 flex items-center justify-center font-black leading-none"
      style={{
        width: size,
        height: size,
        background: '#ffffff',
        border: `${Math.max(1.5, size * 0.06)}px solid ${university.color}`,
        color: university.color,
        // Scales with the disc and shrinks further for four-glyph marks, so
        // "КГТУ" and "С" both sit inside the ring rather than over it.
        fontSize: size * (label.length > 2 ? 0.26 : 0.36),
        letterSpacing: '-0.02em',
      }}
    >
      {label}
    </span>
  );
}

// ── Contest card ───────────────────────────────────────────────────────────

function Tile({ children, bright, className = '', style }) {
  return (
    <div
      className={`rounded-[11px] px-2.5 py-2.5 ${className}`}
      style={{
        background: bright ? '#ffffff' : '#0c1526',
        border: `1px solid ${bright ? '#dbeafe' : '#1b2a45'}`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// Never clipped: these labels are short and known ("БАЙГЕ ФОНДУ",
// "ЖАЛПЫ ЧОГУЛГАН") and the design shows them whole — on `truncate` a
// narrow viewport turned them into "БАЙГЕ ФО…", which reads as a bug.
function TileLabel({ children, color }) {
  return (
    <span
      className="block text-[9.5px] font-bold tracking-wider leading-tight"
      style={{ color }}
    >
      {children}
    </span>
  );
}

// One of the four contest facts. Deliberately the same shape the mobile
// profile uses for XP / streak / coins / lessons — a 10%-tint fill, a
// 25%-tint border, radius 18, a 24px icon and a value over a label — so the
// league reads as the same design on both clients.
function ContestStatCard({ icon: Icon, color, value, label, bright, onOpen }) {
  return (
    <motion.button
      type="button"
      onClick={onOpen}
      whileTap={{ scale: 0.97 }}
      transition={SPRING}
      className="flex items-center gap-2 rounded-[18px] px-2.5 py-2.5 text-left min-w-0 overflow-hidden"
      style={{ background: `${color}1a`, border: `1px solid ${color}40` }}
    >
      <Icon size={22} color={color} className="shrink-0" />
      <span className="flex-1 min-w-0">
        {/* 15px and nowrap rather than 16px + truncate: the widest value
            ("120 000 сом") has to fit whole in a half-width card, and the
            design shows it whole — clipped it read as "120 000 с…". */}
        <span
          className="block text-[15px] font-black leading-tight whitespace-nowrap"
          style={{ color: bright ? '#0f172a' : '#ffffff' }}
        >
          {value}
        </span>
        <span
          className="block text-[10.5px] font-semibold leading-tight mt-0.5"
          style={{ color: bright ? '#64748b' : '#8a93a6' }}
        >
          {label}
        </span>
      </span>
      <ChevronRight size={15} className="shrink-0" color={bright ? '#94a3b8' : '#5b6478'} />
    </motion.button>
  );
}

// What a contest card opens: the headline again, the detail rows, then any
// long-form note. Same shell as the role and campus pickers, so the screen
// speaks one modal language.
function ContestFactPanel({ icon: Icon, color, title, headline, rows = [], note, bright, onDismiss }) {
  const { t } = useI18n();
  const textPri = bright ? '#0f172a' : '#ffffff';
  const textMut = bright ? '#64748b' : '#8a93a6';
  const line = bright ? '#e2e8f0' : '#182338';

  return (
    <DialogShell onDismiss={onDismiss} bright={bright} labelledBy="uni-fact-title" maxWidth={360}>
      <div className="px-5 pt-5 pb-5">
        <div className="flex items-center gap-2.5">
          <span
            className="w-[34px] h-[34px] rounded-[11px] flex items-center justify-center shrink-0"
            style={{ background: `${color}24` }}
          >
            <Icon size={18} color={color} />
          </span>
          <h3 id="uni-fact-title" className="text-[14px] font-black tracking-wide" style={{ color: textPri }}>
            {title}
          </h3>
        </div>

        {headline && (
          <p className="mt-2.5 text-[26px] font-black leading-none" style={{ color }}>
            {headline}
          </p>
        )}

        {rows.length > 0 && (
          <div className="mt-3.5">
            {rows.map(([label, value, rank], i) => (
              <div
                key={label}
                className="flex items-center justify-between gap-3 py-2.5"
                style={i > 0 ? { borderTop: `1px solid ${line}` } : undefined}
              >
                <span className="flex items-center gap-2 min-w-0">
                  {rank && <MedalWreath rank={rank} size={30} glow={false} />}
                  <span className="text-[12.5px] font-semibold" style={{ color: textMut }}>{label}</span>
                </span>
                <span className="text-[13px] font-extrabold text-right shrink-0" style={{ color: textPri }}>{value}</span>
              </div>
            ))}
          </div>
        )}

        {note && (
          <p
            className="mt-3.5 rounded-xl px-3 py-3 text-[12px] leading-relaxed"
            style={{
              color: textMut,
              background: bright ? '#f8fafc' : '#0c1526',
              border: `1px solid ${bright ? '#e2e8f0' : '#1b2a45'}`,
            }}
          >
            {note}
          </p>
        )}

        <motion.button
          type="button"
          onClick={onDismiss}
          whileTap={{ scale: 0.97 }}
          transition={SPRING}
          className="w-full mt-4 py-3 rounded-[14px] text-[13.5px] font-black tracking-wide text-white"
          style={{ background: color }}
        >
          {t('uni.close').toUpperCase()}
        </motion.button>
      </div>
    </DialogShell>
  );
}

function ContestCard({ university, contest, bright, totalXp, studentCount, viewerCount }) {
  const { t, locale } = useI18n();
  // Which fact card is open, or null. One piece of state rather than four
  // booleans: only ever one panel at a time.
  const [fact, setFact] = useState(null);
  const textPri = bright ? '#0f172a' : '#ffffff';
  const textMut = bright ? '#64748b' : '#8a93a6';

  return (
    <div
      className="mx-3 rounded-2xl p-3.5"
      style={{
        background: bright
          ? 'linear-gradient(180deg,#f5f9ff 0%,#eaf2fe 100%)'
          : 'linear-gradient(180deg,#0e1b33 0%,#0a1223 100%)',
        border: `1px solid ${bright ? '#bfdbfe' : '#1d3358'}`,
      }}
    >
      <div className="flex items-start gap-3">
        <Crest university={university} size={44} locale={locale} />
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-extrabold leading-tight" style={{ color: textPri }}>
            {localizedText(university.name, locale)}
          </p>
          <p className="text-[11.5px] mt-1.5" style={{ color: textMut }}>
            {t('uni.organizer')}{' '}
            <a href={`tel:${contest.organizerPhone.replace(/\s/g, '')}`} className="font-semibold" style={{ color: '#3B82F6' }}>
              {contest.organizerPhone}
            </a>
          </p>
          <p className="text-[11.5px] mt-0.5" style={{ color: textMut }}>
            {t('uni.address')}{' '}
            <span className="font-semibold" style={{ color: textPri }}>
              {localizedText(contest.address, locale)}
            </span>
          </p>
        </div>
        {contest.sponsorName && (
          contest.sponsorLogoUrl
            ? <img src={contest.sponsorLogoUrl} alt={contest.sponsorName} className="h-[18px] shrink-0 object-contain" />
            : (
              // No supplied mark: the name is set in the tight, lower-case
              // style partner wordmarks use, so the slot reads as a brand.
              <span className="text-[15px] font-extrabold shrink-0" style={{ color: textPri, letterSpacing: '-0.03em' }}>
                {contest.sponsorName}
              </span>
            )
        )}
      </div>

      {/* The four contest facts, in the same card the profile uses for its
          stats — tint-on-tint fill, 2x2, one headline number each. Every one
          is a button: the detail behind it opens in a panel, the way the
          role and campus pickers already work. Mirrors the mobile
          league_screen.dart#_ContestStatCard exactly. */}
      <div className="grid grid-cols-2 gap-2.5 mt-3.5">
        <ContestStatCard
          icon={Trophy}
          color="#EAB308"
          value={formatSom(contest.prizePool, locale)}
          label={t('uni.prizePool')}
          bright={bright}
          onOpen={() => setFact({
            icon: Trophy,
            color: '#EAB308',
            title: t('uni.prizePool'),
            headline: formatSom(contest.prizePool, locale),
            rows: [
              [t('uni.organizer'), contest.organizerPhone],
              [t('uni.address'), localizedText(contest.address, locale)],
              ...(contest.sponsorName ? [[t('uni.sponsor'), contest.sponsorName]] : []),
            ],
          })}
        />
        <ContestStatCard
          icon={Zap}
          color="#3B82F6"
          value={totalXp == null ? '—' : formatGrouped(totalXp)}
          label={t('uni.totalCollected')}
          bright={bright}
          onOpen={() => setFact({
            icon: Zap,
            color: '#3B82F6',
            title: t('uni.totalCollected'),
            headline: totalXp == null ? '—' : `${formatGrouped(totalXp)} XP`,
            rows: [
              [t('uni.studentsCount'), String(studentCount ?? 0)],
              [t('uni.viewersCount'), String(viewerCount ?? 0)],
            ],
            note: t('uni.totalCollectedNote'),
          })}
        />
        <ContestStatCard
          icon={Gift}
          color="#F97316"
          value={t('uni.giftsTop', { n: contest.giftsTopN })}
          label={t('uni.prizes')}
          bright={bright}
          onOpen={() => setFact({
            icon: Gift,
            color: '#F97316',
            title: t('uni.prizes'),
            rows: [
              [t('uni.place1'), formatSom(contest.firstPrize, locale), 1],
              [t('uni.place2'), formatSom(contest.secondPrize, locale), 2],
              [t('uni.place3'), formatSom(contest.thirdPrize, locale), 3],
              [t('uni.gifts'), t('uni.giftsTop', { n: contest.giftsTopN })],
            ],
          })}
        />
        <ContestStatCard
          icon={BookOpen}
          color="#58CC02"
          value={t('uni.rulesValue')}
          label={t('uni.rulesLabel')}
          bright={bright}
          onOpen={() => setFact({
            icon: BookOpen,
            color: '#58CC02',
            title: t('uni.rulesValue'),
            rows: [
              [t('uni.start'), formatLongDate(contest.startsAt, locale)],
              [t('uni.end'), formatLongDate(contest.endsAt, locale)],
            ],
            note: localizedText(contest.rules, locale),
          })}
        />
      </div>

      <AnimatePresence>
        {fact && (
          <ContestFactPanel {...fact} bright={bright} onDismiss={() => setFact(null)} />
        )}
      </AnimatePresence>

      <div className="flex items-stretch gap-2 mt-2">
        {[['uni.start', contest.startsAt], ['uni.end', contest.endsAt]].map(([key, date]) => (
          <Tile key={key} bright={bright} className="flex-1 min-w-0 text-center">
            <TileLabel color={textMut}>{t(key)}</TileLabel>
            <span className="block text-[12px] font-extrabold mt-1 truncate" style={{ color: textPri }}>
              {formatLongDate(date, locale)}
            </span>
          </Tile>
        ))}
      </div>
    </div>
  );
}

// ── Podium ─────────────────────────────────────────────────────────────────

// The laurel medal that straddles the top edge of a podium card. Drawn
// rather than shipped as three images: it has to sit on a gold, a silver and
// a bronze card and pick up each one's tint.
function WreathBadge({ place }) {
  const [tint, deep] = place === 1
    ? ['#FDE047', '#EAB308']
    : place === 2
      ? ['#E2E6EC', '#9AA3B2']
      : ['#E9A87C', '#C2703A'];

  const leaves = [];
  const CX = 20, CY = 16, R = 13, N = 5;
  // Two mirrored arcs sweeping up from the bottom, leaves tilting outward
  // and shrinking towards the tips — the shape a real wreath makes.
  for (const side of [-1, 1]) {
    for (let i = 0; i < N; i++) {
      const k = i / (N - 1);
      const angle = Math.PI / 2 - side * (0.35 + k * 1.55);
      const x = CX + Math.cos(angle) * R * side;
      const y = CY + Math.sin(angle) * R;
      leaves.push(
        <ellipse
          key={`${side}-${i}`}
          cx={0}
          cy={0}
          rx={(7.5 - k * 2.5) / 2}
          ry={(3.6 - k * 1.1) / 2}
          fill={tint}
          transform={`translate(${x} ${y}) rotate(${(side * (0.9 - k * 0.7) * 180) / Math.PI})`}
        />,
      );
    }
  }

  return (
    <svg width="40" height="32" viewBox="0 0 40 32" aria-hidden="true" className="shrink-0">
      {leaves}
      <path d="M20 1.5 L21.4 4.6 L24.8 5 L22.3 7.3 L23 10.6 L20 9 L17 10.6 L17.7 7.3 L15.2 5 L18.6 4.6 Z" fill={tint} />
      <circle cx={CX} cy={CY} r={9.5} fill={deep} />
      <text x={CX} y={CY + 4} textAnchor="middle" fontSize="11" fontWeight="900" fill="#ffffff">{place}</text>
    </svg>
  );
}

function PodiumSlot({ entry, place, bright, onPick, pickLabel }) {
  if (!entry) return <div className="flex-1" />;

  const [border, from, to] = place === 1
    ? ['#EAB308', bright ? '#FEF9C3' : '#2A1E06', bright ? '#FDE68A' : '#15100A']
    : place === 2
      ? [bright ? '#CBD5E1' : '#2A3142', bright ? '#FFFFFF' : '#141B2A', bright ? '#F1F5F9' : '#0D1220']
      : [bright ? '#FDBA74' : '#6D3617', bright ? '#FFF7ED' : '#1F1108', bright ? '#FFEDD5' : '#130C08'];

  const ring    = place === 1 ? '#EAB308' : place === 2 ? '#9AA3B2' : '#C2703A';
  const xpColor = place === 1 ? '#EAB308' : place === 2 ? (bright ? '#64748B' : '#C3C9D4') : '#F59E0B';
  const textPri = bright ? '#0f172a' : '#ffffff';

  return (
    <motion.div
      initial={{ y: 26, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ ...SPRING, delay: place === 1 ? 0.05 : place === 2 ? 0.14 : 0.23 }}
      className="flex-1 min-w-0 relative flex flex-col items-center"
    >
      <div className="absolute top-0 left-1/2 -translate-x-1/2 z-10">
        <WreathBadge place={place} />
      </div>
      <motion.button
        type="button"
        disabled={!onPick}
        onClick={onPick}
        aria-label={pickLabel}
        whileTap={onPick ? { scale: 0.96 } : undefined}
        transition={SPRING}
        className="w-full rounded-[14px] flex flex-col items-center px-1.5 pb-3 disabled:cursor-default"
        style={{
          marginTop: 16,
          paddingTop: place === 1 ? 26 : 22,
          paddingBottom: place === 1 ? 16 : 12,
          background: `linear-gradient(180deg, ${from} 0%, ${to} 100%)`,
          border: `${place === 1 ? 1.5 : 1}px solid ${border}`,
        }}
      >
        <div className="rounded-full" style={{ boxShadow: `0 0 0 2.5px ${ring}${place === 1 ? ', 0 4px 18px rgba(234,179,8,0.4)' : ''}` }}>
          <Avatar name={entry.name} photoUrl={entry.avatar} size={place === 1 ? 50 : 44} />
        </div>
        <p className="mt-2 text-[14px] font-bold truncate w-full text-center" style={{ color: textPri }}>
          {entry.name}
        </p>
        <p className="mt-1 text-[12.5px] font-extrabold truncate w-full text-center" style={{ color: xpColor }}>
          {formatGrouped(entry.xp)} XP
        </p>
        {entry.supporters > 0 && (
          <span className="mt-1 flex items-center gap-1 text-[10.5px] font-bold" style={{ color: '#A855F7' }}>
            <Heart size={10} fill="#A855F7" color="#A855F7" />
            {entry.supporters}
          </span>
        )}
      </motion.button>
    </motion.div>
  );
}

// Top three, laid out 2–1–3. Aligned on the bottom edge, so the winner's
// extra height is what raises it — no magic offsets.
function UniPodium({ students, bright, onPick, pickLabel }) {
  const slot = (entry, place) => (
    <PodiumSlot
      entry={entry}
      place={place}
      bright={bright}
      pickLabel={pickLabel}
      onPick={entry && onPick ? () => onPick(entry) : null}
    />
  );
  return (
    <div className="flex items-end gap-2.5 px-3">
      {slot(students[1], 2)}
      {slot(students[0], 1)}
      {slot(students[2], 3)}
    </div>
  );
}

// Ranks four and down, in one panel — the standings read as a single list,
// which separate cards per row would break up.
function Standings({ students, bright, onPick, pickLabel, meId }) {
  const { t } = useI18n();
  const textPri = bright ? '#0f172a' : '#ffffff';
  const textMut = bright ? '#64748b' : '#8a93a6';
  const line    = bright ? '#e2e8f0' : '#161d2c';

  return (
    <div
      className="mx-3 rounded-[14px] overflow-hidden"
      style={{ background: bright ? '#ffffff' : '#0d1220', border: `1px solid ${line}` }}
    >
      {students.map((u, i) => {
        const isMe = u.id === meId;
        return (
          <motion.button
            key={u.id}
            type="button"
            disabled={!onPick}
            onClick={onPick ? () => onPick(u) : undefined}
            aria-label={pickLabel}
            whileTap={onPick ? { scale: 0.985 } : undefined}
            transition={SPRING}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left disabled:cursor-default"
            style={{
              ...(i > 0 ? { borderTop: `1px solid ${line}` } : null),
              background: isMe ? (bright ? '#eff6ff' : '#14294a') : 'transparent',
            }}
          >
            <span className="w-[22px] text-[13px] font-bold shrink-0" style={{ color: textMut }}>{u.rank ?? i + 4}</span>
            <Avatar name={u.name} photoUrl={u.avatar} size={28} />
            <span className="flex-1 min-w-0 truncate text-[14px] font-semibold" style={{ color: textPri }}>
              {u.name}
              {isMe && <span className="ml-1.5 text-[11px] font-bold" style={{ color: '#3B82F6' }}>· {t('uni.you')}</span>}
            </span>
            {u.supporters > 0 && (
              <span className="flex items-center gap-0.5 text-[11px] font-bold shrink-0" style={{ color: '#A855F7' }}>
                <Heart size={10} fill="#A855F7" color="#A855F7" />
                {u.supporters}
              </span>
            )}
            <span className="text-[13px] font-extrabold shrink-0" style={{ color: textPri }}>
              {formatGrouped(u.xp)} XP
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}

// ── Viewer support ─────────────────────────────────────────────────────────

// The sheet a viewer gets after tapping a student: their own energy on the
// left, the gift button on the right. The gift is spent from the viewer's
// own allowance — that is what makes it worth something — and the server
// allows one per refill period.
function SupportSheet({ student, bright, onDismiss, onSent }) {
  const { t } = useI18n();
  const { token, state, updateUser } = useAuth();
  const content = useContent();

  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const { dailyFreeLessons, energyRefillHours } = energySettings(content);
  const { remaining: energy } = computeLiveEnergy(state, dailyFreeLessons, energyRefillHours);
  const amount = Math.max(1, content?.limits?.supportEnergyAmount ?? 5);

  const textPri = bright ? '#0f172a' : '#ffffff';
  const textMut = bright ? '#64748b' : '#8a93a6';
  const disabled = sending || sent || energy < amount;

  const send = async () => {
    if (disabled) return;
    setError('');
    setSending(true);
    try {
      const res = await api.sendSupportEnergy(token, student.id);
      updateUser(res.user);
      setSent(true);
      onSent?.();
      setTimeout(onDismiss, 1200);
    } catch (e) {
      // 429 is "already gave one this period" — a rule, not a failure, so
      // it gets its own copy rather than the raw server line.
      setError(e.status === 429 ? t('uni.supportAlready') : (e.message || t('common.error')));
    } finally {
      setSending(false);
    }
  };

  return (
    <BottomSheet onDismiss={onDismiss} bright={bright} labelledBy="uni-support-title">
      <div className="px-5 pt-2 pb-6">
        <div className="flex items-start justify-between gap-3">
          <h3 id="uni-support-title" className="text-[17px] font-black leading-tight" style={{ color: textPri }}>
            {t('uni.supportTitle')}
          </h3>
          <button
            type="button"
            onClick={onDismiss}
            aria-label={t('common.close')}
            className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
            style={{ background: bright ? '#e2e8f0' : '#1c2740' }}
          >
            <X size={15} color={textMut} />
          </button>
        </div>

        <div className="flex items-center gap-3 mt-4">
          <div className="rounded-full shrink-0" style={{ boxShadow: '0 0 0 3px #FFD700' }}>
            <Avatar name={student.name} photoUrl={student.avatar} size={58} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-[19px] font-black truncate" style={{ color: textPri }}>{student.name}</p>
              {student.rank <= 3 && <WreathBadge place={student.rank} />}
            </div>
            <p className="text-[13px] font-semibold mt-0.5" style={{ color: textMut }}>
              {t('uni.supportPlace', { n: student.rank })}
            </p>
          </div>
        </div>

        <div className="flex items-stretch gap-2.5 mt-5">
          <div
            className="rounded-[14px] px-3.5 py-2.5 shrink-0"
            style={{
              background: bright ? '#ffffff' : '#0d1526',
              border: `1px solid ${bright ? '#cbd5e1' : '#1d3358'}`,
              minWidth: 132,
            }}
          >
            <p className="text-[10.5px] font-bold tracking-wide" style={{ color: '#38BDF8' }}>
              {t('uni.supportYourEnergy')}
            </p>
            <p className="flex items-center gap-1.5 mt-1.5">
              <Zap size={19} color="#38BDF8" fill="#38BDF8" />
              <span className="text-[24px] font-black leading-none tabular-nums" style={{ color: textPri }}>
                {energy}
              </span>
            </p>
          </div>

          <motion.button
            type="button"
            onClick={send}
            disabled={disabled}
            whileTap={disabled ? undefined : { scale: 0.97 }}
            transition={SPRING}
            className="flex-1 rounded-[14px] px-3 py-2.5 flex flex-col items-center justify-center disabled:opacity-50"
            style={{
              background: sent
                ? 'linear-gradient(135deg,#3FA51A 0%,#2F7D13 100%)'
                : 'linear-gradient(135deg,#8B2BE2 0%,#6D28D9 100%)',
              boxShadow: '0 10px 22px -10px rgba(124,58,237,0.85)',
            }}
          >
            <span className="text-[13.5px] font-black tracking-wide text-white text-center leading-tight">
              {sent ? t('uni.supportSent', { name: student.name }) : t('uni.supportCta')}
            </span>
            {!sent && (
              <span className="flex items-center gap-1.5 mt-1 text-[11.5px] font-semibold" style={{ color: 'rgba(255,255,255,0.85)' }}>
                <Zap size={13} color="#ffffff" fill="#ffffff" />
                {amount}
                <span>{t('uni.supportCtaSub')}</span>
              </span>
            )}
          </motion.button>
        </div>

        {error ? (
          <p className="flex items-center justify-center gap-1.5 mt-3.5 text-[11.5px] font-semibold text-center" style={{ color: '#FF4B4B' }}>
            <AlertCircle size={13} /> {error}
          </p>
        ) : energy < amount && !sent ? (
          <p className="mt-3.5 text-[11.5px] font-semibold text-center" style={{ color: '#FF9600' }}>
            {t('uni.supportNoEnergy')}
          </p>
        ) : (
          <p className="mt-3.5 text-[11.5px] leading-snug text-center" style={{ color: textMut }}>
            {t('uni.supportNote')}
          </p>
        )}
      </div>
    </BottomSheet>
  );
}

// "СЕНИ КОЛДОГОНДОР" — the other half of the loop: what the student sees
// after viewers have backed them.
function SupportersDialog({ bright, onDismiss }) {
  const { t } = useI18n();
  const { token } = useAuth();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    api.fetchSupporters(token)
      .then(res => { if (alive) setRows(res.supporters || []); })
      .catch(err => { if (alive) setError(err); });
    return () => { alive = false; };
  }, [token]);

  const textPri = bright ? '#0f172a' : '#ffffff';
  const textMut = bright ? '#64748b' : '#8a93a6';
  const line    = bright ? '#e2e8f0' : '#182338';

  return (
    <DialogShell onDismiss={onDismiss} bright={bright} labelledBy="uni-supporters-title">
      <div className="flex flex-col" style={{ maxHeight: '82vh' }}>
        <div className="relative px-5 pt-4 pb-3">
          <button
            type="button"
            onClick={onDismiss}
            aria-label={t('common.close')}
            className="absolute right-4 top-4 w-7 h-7 rounded-full flex items-center justify-center"
            style={{ background: bright ? '#e2e8f0' : '#1c2740' }}
          >
            <X size={15} color={textMut} />
          </button>
          <h3
            id="uni-supporters-title"
            className="text-center text-[15px] font-black tracking-wide pt-1"
            style={{ color: textPri }}
          >
            {t('uni.supportersTitle')}
          </h3>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-2">
          {error ? (
            <p className="py-8 text-center text-[13px] font-semibold" style={{ color: '#FF4B4B' }}>
              {t('uni.boardError')}
            </p>
          ) : rows === null ? (
            <p className="py-8 text-center text-[13px]" style={{ color: textMut }}>{t('common.loading')}</p>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-9 text-center">
              <Heart size={26} color={textMut} />
              <p className="text-[13px] font-semibold" style={{ color: textMut }}>{t('uni.supportersEmpty')}</p>
            </div>
          ) : (
            rows.map((r, i) => (
              <div
                key={r.id}
                className="flex items-center gap-2.5 py-2.5"
                style={i > 0 ? { borderTop: `1px solid ${line}` } : undefined}
              >
                <span className="w-[18px] text-[13px] font-bold shrink-0" style={{ color: textMut }}>{i + 1}</span>
                <Avatar name={r.name} photoUrl={r.avatar} size={28} />
                <span className="flex-1 min-w-0 truncate text-[14px] font-semibold" style={{ color: textPri }}>
                  {r.name}
                </span>
                <span className="flex items-center gap-1 text-[13px] font-extrabold shrink-0" style={{ color: '#38BDF8' }}>
                  <Zap size={13} color="#38BDF8" fill="#38BDF8" />
                  {r.amount}
                </span>
              </div>
            ))
          )}
        </div>

        <div className="px-4 pb-4 pt-2">
          <motion.button
            type="button"
            onClick={onDismiss}
            whileTap={{ scale: 0.97 }}
            transition={SPRING}
            className="w-full py-3 rounded-full text-[14px] font-black tracking-wide"
            style={{ background: '#ffffff', color: '#1D4ED8', border: '1px solid #dbeafe' }}
          >
            {t('uni.close').toUpperCase()}
          </motion.button>
        </div>
      </div>
    </DialogShell>
  );
}

// ── The tab itself ─────────────────────────────────────────────────────────

// A university that hasn't launched a contest. Deliberately not a blank
// panel: it says why the space is empty and offers the one action that can
// change what's on screen.
function NoContest({ university, bright, onChange }) {
  const { t, locale } = useI18n();
  const textPri = bright ? '#0f172a' : '#ffffff';
  const textMut = bright ? '#64748b' : '#8a93a6';

  return (
    <div
      className="mx-3 rounded-2xl px-5 py-8 flex flex-col items-center text-center"
      style={{
        background: bright
          ? 'linear-gradient(180deg,#f5f9ff 0%,#eaf2fe 100%)'
          : 'linear-gradient(180deg,#0e1b33 0%,#0a1223 100%)',
        border: `1px solid ${bright ? '#bfdbfe' : '#1d3358'}`,
      }}
    >
      <Crest university={university} size={56} locale={locale} />
      <p className="mt-3.5 text-[15px] font-extrabold" style={{ color: textPri }}>
        {localizedText(university.name, locale)}
      </p>
      <p className="mt-3.5 text-[14px] font-bold" style={{ color: textPri }}>{t('uni.noContestTitle')}</p>
      <p className="mt-1.5 text-[13px] leading-relaxed" style={{ color: textMut }}>{t('uni.noContestDesc')}</p>
      <motion.button
        type="button"
        onClick={onChange}
        whileTap={{ scale: 0.97 }}
        className="mt-5 h-[46px] px-6 rounded-full text-[14px] font-bold text-white"
        style={{ background: '#3B82F6' }}
      >
        {t('uni.chooseAnother')}
      </motion.button>
    </div>
  );
}

export function UniLeagueView({ university, bright, onChange }) {
  const { t, locale } = useI18n();
  const { user, state } = useAuth();
  const contest = university.contest;
  const textMut = bright ? '#64748b' : '#8a93a6';
  const textPri = bright ? '#0f172a' : '#ffffff';

  const { board, loading, error, reload } = useUniBoard(university.id);
  const [supportTarget, setSupportTarget] = useState(null);
  const [supportersOpen, setSupportersOpen] = useState(false);

  const role = state?.uniRole || null;
  const isViewer = role === 'viewer';
  const students = board?.students || [];
  const myId = user?.id || null;
  const mySupporters = board?.me?.supporters || 0;

  // Who a tap belongs to. A viewer taps anyone — that's the gift. A student
  // taps only their own row, which is how they open "who backed me".
  const pickStudent = useCallback((entry) => {
    if (isViewer) { setSupportTarget(entry); return; }
    if (entry.id === myId) setSupportersOpen(true);
  }, [isViewer, myId]);

  const canPick = isViewer || students.some(u => u.id === myId);
  const pickLabel = isViewer ? t('uni.viewerHint') : t('uni.studentHint');

  // "КГТУНУН ТОП 10 СТУДЕНТИ" / "ТОП 10 СТУДЕНТОВ КГТУ" /
  // "KSTU TOP 10 STUDENTS" — Kyrgyz needs the genitive, which no amount of
  // string concatenation in the template can supply.
  const short = localizedText(university.shortName, locale);
  const boardTitle = t('uni.topStudentsTitle', { uni: locale === 'ky' ? kyGenitive(short) : short });

  return (
    <div className="pb-4">
      <div className="px-4 pb-2 flex justify-end">
        <motion.button
          type="button"
          onClick={onChange}
          whileTap={{ scale: 0.94 }}
          className="flex items-center gap-1.5 py-2 text-[13px] font-semibold"
          style={{ color: textMut }}
        >
          {t('uni.change')}
          <Pencil size={15} />
        </motion.button>
      </div>

      {!contest ? (
        <NoContest university={university} bright={bright} onChange={onChange} />
      ) : (
        <>
          <ContestCard
            university={university}
            contest={contest}
            bright={bright}
            totalXp={board?.totalXp}
            studentCount={board?.studentCount}
            viewerCount={board?.viewerCount}
          />

          <div className="px-4 mt-6 mb-3.5 flex items-center justify-between gap-3">
            <h3 className="text-[13px] font-extrabold tracking-wide min-w-0 truncate" style={{ color: textPri }}>
              {boardTitle}
            </h3>
            {/* Eye + how many people are watching this campus rather than
                competing on it. Viewers are counted here and nowhere else —
                they are never ranked below. */}
            <span
              className="flex items-center gap-1.5 shrink-0 text-[12.5px] font-bold tabular-nums"
              style={{ color: textMut }}
              title={t('uni.viewersAria', { n: board?.viewerCount ?? 0 })}
              aria-label={t('uni.viewersAria', { n: board?.viewerCount ?? 0 })}
            >
              {formatGrouped(board?.viewerCount ?? 0)}
              <Eye size={16} />
            </span>
          </div>

          {isViewer && (
            <p className="px-4 -mt-1.5 mb-3 text-[11px] leading-snug" style={{ color: textMut }}>
              {t('uni.viewerXpNote')} {t('uni.viewerHint')}
            </p>
          )}

          {error ? (
            <div className="flex flex-col items-center gap-2.5 py-9 text-center">
              <AlertCircle size={26} color="#FF4B4B" />
              <p className="text-sm font-bold" style={{ color: textPri }}>{t('uni.boardError')}</p>
              <button
                type="button"
                onClick={reload}
                className="mt-1 px-4 py-2 rounded-full text-[12.5px] font-bold"
                style={{ background: 'rgba(28,176,246,0.15)', color: '#1CB0F6' }}
              >
                {t('uni.retry')}
              </button>
            </div>
          ) : loading && !board ? (
            <div className="flex justify-center py-10">
              <p className="text-sm" style={{ color: textMut }}>{t('common.loading')}</p>
            </div>
          ) : students.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <Users size={30} color={textMut} />
              <p className="text-sm font-bold" style={{ color: textPri }}>{t('uni.emptyBoard')}</p>
            </div>
          ) : (
            <>
              <UniPodium
                students={students}
                bright={bright}
                pickLabel={pickLabel}
                onPick={canPick ? pickStudent : null}
              />
              {students.length > 3 && (
                <div className="mt-4">
                  <Standings
                    students={students.slice(3)}
                    bright={bright}
                    meId={myId}
                    pickLabel={pickLabel}
                    onPick={canPick ? pickStudent : null}
                  />
                </div>
              )}
            </>
          )}

          {/* A student outside the top ten still has supporters to look at,
              so the sheet gets its own entry point rather than living only
              behind their row. */}
          {!isViewer && role === 'student' && mySupporters > 0 && (
            <div className="px-3 mt-3.5">
              <motion.button
                type="button"
                onClick={() => setSupportersOpen(true)}
                whileTap={{ scale: 0.98 }}
                transition={SPRING}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-[14px] text-[13px] font-bold"
                style={{
                  background: bright ? '#faf5ff' : '#1a1030',
                  border: `1px solid ${bright ? '#e9d5ff' : '#3b1e69'}`,
                  color: '#A855F7',
                }}
              >
                <Heart size={14} fill="#A855F7" color="#A855F7" />
                {t('uni.supportersCta')} · {t('uni.supportersCount', { n: mySupporters })}
              </motion.button>
            </div>
          )}
        </>
      )}

      <AnimatePresence>
        {supportTarget && (
          <SupportSheet
            key="support"
            student={supportTarget}
            bright={bright}
            onDismiss={() => setSupportTarget(null)}
            onSent={reload}
          />
        )}
        {supportersOpen && (
          <SupportersDialog key="supporters" bright={bright} onDismiss={() => setSupportersOpen(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Tabs ───────────────────────────────────────────────────────────────────

export function LeagueTabs({ tab, onSelect, bright }) {
  const { t } = useI18n();
  const textPri = bright ? '#0f172a' : '#ffffff';
  const textMut = bright ? '#64748b' : '#8a93a6';

  const pill = (id, label) => {
    const on = tab === id;
    return (
      <motion.button
        key={id}
        type="button"
        onClick={() => onSelect(id)}
        whileTap={{ scale: 0.97 }}
        aria-pressed={on}
        className="flex-1 min-w-0 h-12 rounded-xl px-2.5 text-[13px] font-extrabold tracking-wide truncate"
        style={{
          color: on ? textPri : textMut,
          background: on
            ? (bright ? 'linear-gradient(180deg,#eff6ff 0%,#dbeafe 100%)' : 'linear-gradient(180deg,#14294a 0%,#0d1a31 100%)')
            : (bright ? '#ffffff' : '#0d1220'),
          border: `${on ? 1.5 : 1}px solid ${on ? '#3B82F6' : (bright ? '#e2e8f0' : '#1b2334')}`,
          transition: 'background 200ms ease, border-color 200ms ease, color 200ms ease',
        }}
      >
        {label}
      </motion.button>
    );
  };

  return (
    <div className="flex gap-3 px-3.5 pt-3.5 pb-2.5">
      {pill('general', t('league.tabGeneral'))}
      {pill('uni', t('league.tabUni'))}
    </div>
  );
}
