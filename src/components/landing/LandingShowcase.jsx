// src/components/landing/LandingShowcase.jsx — the product, shown in a
// laptop and a phone.
//
// The hardware lives in DeviceFrames.jsx; this file is the software on the
// glass: the Learn screen as it actually renders, at both sizes.
//
// Drawn in code rather than pasted in as screenshots. A screenshot pair
// would weigh half a megabyte, go stale the next time a module colour or a
// label changes, say nothing to a screen reader, and be stuck in one
// language. This reads the real modules, their real colours and the real
// league names out of the same content the app itself uses, in whichever of
// the three languages the visitor chose.
import { motion, useReducedMotion } from 'framer-motion';
import {
  Home, Trophy, ShoppingBag, User, Settings, LogOut,
  Flame, Coins, Zap, Lock, Play, GraduationCap, PiggyBank,
} from 'lucide-react';
import { formatGrouped } from '../../i18n.jsx';
import { SPRING } from './primitives.jsx';
import { IPhoneFrame, MacBookFrame, DiamondBadge } from './DeviceFrames.jsx';

// The product's own palette — this is a portrait of the app, so it wears the
// app's colours, not the landing page's.
const BG = '#0f172a';
const CARD = '#1e293b';
const LINE = '#334155';
const MUTED = '#94a3b8';
const FAINT = '#64748b';

const mix = (hex, pct) => `color-mix(in srgb, ${hex} ${pct}%, ${BG})`;

const NAV = [
  { icon: Home, key: 'navLearn' },
  { icon: Trophy, key: 'navLeague' },
  { icon: ShoppingBag, key: 'navShop' },
  { icon: User, key: 'navProfile' },
  { icon: Settings, key: 'navSettings' },
];

// ── Shared pieces ─────────────────────────────────────────────────────────

function Chip({ icon: Icon, color, value, s = 1 }) {
  return (
    <span
      className="inline-flex items-center"
      style={{
        gap: 4 * s,
        padding: `${4 * s}px ${8 * s}px`,
        borderRadius: 8 * s,
        background: mix(color, 16),
        border: `1px solid ${mix(color, 34)}`,
      }}
    >
      <Icon size={11 * s} color={color} fill={color} strokeWidth={0} />
      <span className="font-extrabold font-body tabular-nums" style={{ fontSize: 10.5 * s, color }}>
        {value}
      </span>
    </span>
  );
}

// The banner that opens each module: its own colour, its number, its title,
// the partner who sponsored it, and how far along the learner is.
function ModuleCard({ n, title, partner, color, s = 1 }) {
  return (
    <div
      style={{
        background: color,
        borderRadius: 12 * s,
        padding: `${11 * s}px ${13 * s}px`,
        boxShadow: `0 ${8 * s}px ${20 * s}px ${-6 * s}px ${color}80`,
      }}
    >
      <p
        className="font-extrabold uppercase font-body"
        style={{ fontSize: 8 * s, letterSpacing: '0.12em', color: 'rgba(255,255,255,.85)' }}
      >
        {n}
      </p>
      <p
        className="font-extrabold font-body text-white truncate"
        style={{ fontSize: 14 * s, marginTop: 2 * s, lineHeight: 1.15 }}
      >
        {title}
      </p>
      {partner && (
        <p className="flex items-center font-body truncate" style={{ fontSize: 8.5 * s, gap: 4 * s, marginTop: 4 * s, color: 'rgba(255,255,255,.9)' }}>
          <span style={{ width: 9 * s, height: 9 * s, borderRadius: '50%', background: '#E4002B', flex: 'none' }} />
          {partner}
        </p>
      )}
      <div className="flex items-center" style={{ gap: 6 * s, marginTop: 7 * s }}>
        <span className="flex-1" style={{ height: 5 * s, borderRadius: 3 * s, background: 'rgba(255,255,255,.32)' }} />
        <span className="font-extrabold font-body text-white tabular-nums" style={{ fontSize: 9.5 * s }}>0/3</span>
      </div>
    </div>
  );
}

// One node of the path. The unlocked one is a rounded tile with a play
// badge; the rest are flat circles with a padlock.
function PathNode({ color, locked, label, s = 1, offset = 0 }) {
  const size = (locked ? 46 : 58) * s;
  return (
    <div className="flex flex-col items-center" style={{ transform: `translateX(${offset * s}px)` }}>
      <div className="relative" style={{ width: size, height: size }}>
        <div
          className="w-full h-full grid place-items-center"
          style={{
            borderRadius: locked ? '50%' : 16 * s,
            background: locked
              ? '#1b2436'
              : `radial-gradient(circle at 30% 26%, color-mix(in srgb, ${color} 55%, white) 0%, ${color} 55%, color-mix(in srgb, ${color} 75%, black) 100%)`,
            boxShadow: locked ? 'none' : `0 ${6 * s}px ${16 * s}px ${-4 * s}px ${color}90`,
          }}
        >
          {locked
            ? <Lock size={16 * s} color={FAINT} strokeWidth={2.5} />
            : <PiggyBank size={26 * s} color="#fff" strokeWidth={2} />}
        </div>
        {!locked && (
          <span
            className="absolute grid place-items-center"
            style={{
              right: -4 * s, top: -4 * s, width: 18 * s, height: 18 * s, borderRadius: '50%',
              background: '#E4002B', border: `${2 * s}px solid ${BG}`,
            }}
          >
            <Play size={7 * s} color="#fff" fill="#fff" strokeWidth={0} />
          </span>
        )}
      </div>
      <p
        className="font-bold font-body text-center truncate"
        style={{ fontSize: 9.5 * s, marginTop: 6 * s, maxWidth: 104 * s, color: locked ? FAINT : '#f1f5f9' }}
      >
        {label}
      </p>
    </div>
  );
}

// The review checkpoint that sits between skills.
function CheckCard({ kicker, label, s = 1, offset = 0 }) {
  return (
    <div
      className="flex items-center"
      style={{
        gap: 8 * s, padding: `${8 * s}px ${11 * s}px`, borderRadius: 11 * s,
        background: '#161f30', border: '1.5px solid #243044',
        transform: `translateX(${offset * s}px)`,
      }}
    >
      <span className="grid place-items-center shrink-0" style={{ width: 26 * s, height: 26 * s, borderRadius: '50%', background: '#1b2436' }}>
        <Lock size={12 * s} color={FAINT} strokeWidth={2.5} />
      </span>
      <span className="min-w-0">
        <span className="block font-extrabold uppercase font-body" style={{ fontSize: 7.5 * s, letterSpacing: '0.1em', color: FAINT }}>
          {kicker}
        </span>
        <span className="block font-bold font-body truncate" style={{ fontSize: 10 * s, color: '#f1f5f9', maxWidth: 112 * s }}>
          {label}
        </span>
      </span>
    </div>
  );
}

// The slack curve between two nodes, same as the path draws in the app.
function Curve({ s = 1 }) {
  return (
    <svg width={60 * s} height={32 * s} viewBox="0 0 60 32" fill="none" aria-hidden="true">
      <path d="M14 0 C 14 17, 46 15, 46 32" stroke="#243044" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

function Path({ copy, s, nodeOffset, checkOffset, maxCard }) {
  return (
    <>
      <div style={{ width: '100%', maxWidth: maxCard }}>
        <ModuleCard n={copy.mod1Label} title={copy.mod1Title} partner={copy.mod1Partner} color={copy.mod1Color} s={s} />
      </div>
      <div style={{ height: 11 * s }} />
      <PathNode color={copy.mod1Color} label={copy.lesson1} s={s} />
      <Curve s={s} />
      <PathNode color={copy.mod1Color} locked label={copy.lesson2} s={s} offset={nodeOffset} />
      <div style={{ height: 9 * s }} />
      <CheckCard kicker={copy.checkLabel} label={copy.lesson3} s={s} offset={checkOffset} />
      <div style={{ height: 15 * s }} />
      <div style={{ width: '100%', maxWidth: maxCard }}>
        <ModuleCard n={copy.mod2Label} title={copy.mod2Title} color={copy.mod2Color} s={s} />
      </div>
    </>
  );
}

// ── Phone screen ──────────────────────────────────────────────────────────

function PhoneScreen({ copy }) {
  const s = 0.86;
  return (
    <div className="absolute inset-0 flex flex-col" style={{ background: BG }}>
      <div className="flex items-center justify-between shrink-0" style={{ padding: `${36 * s}px ${12 * s}px ${8 * s}px` }}>
        <img src="/logo.png" alt="" style={{ width: 22 * s, height: 22 * s, borderRadius: 6 * s, objectFit: 'cover' }} />
        <span className="flex" style={{ gap: 5 * s }}>
          <Chip icon={Flame} color="#FF9600" value="1" s={s} />
          <Chip icon={Coins} color="#FFD700" value="55" s={s} />
          <Chip icon={Zap} color="#1CB0F6" value="25" s={s} />
        </span>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden flex flex-col items-center" style={{ padding: `${6 * s}px ${12 * s}px 0` }}>
        <Path copy={copy} s={s} nodeOffset={26} checkOffset={-14} maxCard="100%" />
      </div>

      <div
        className="flex items-center justify-around shrink-0"
        style={{ padding: `${8 * s}px 0 ${20 * s}px`, borderTop: '1px solid rgba(255,255,255,.07)' }}
      >
        {NAV.map(({ icon: Icon, key }, i) => (
          <span key={key} className="flex flex-col items-center" style={{ gap: 3 * s }}>
            <Icon size={17 * s} color={i === 0 ? '#1CB0F6' : FAINT} strokeWidth={2.2} />
            <span className="font-bold font-body" style={{ fontSize: 7.5 * s, color: i === 0 ? '#1CB0F6' : FAINT }}>
              {copy[key]}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Laptop screen ─────────────────────────────────────────────────────────

function PanelCard({ children, accent }) {
  return (
    <div
      style={{
        background: CARD,
        border: `1px solid ${accent ? mix(accent, 40) : LINE}`,
        borderRadius: 10,
        padding: '10px 12px',
      }}
    >
      {children}
    </div>
  );
}

function DesktopScreen({ copy }) {
  const s = 0.92;
  return (
    <div className="absolute inset-0 flex" style={{ background: BG }}>
      {/* Sidebar */}
      <div className="shrink-0 flex flex-col" style={{ width: 148, background: '#0b1220', padding: '14px 10px 12px' }}>
        <div className="flex items-center gap-2 px-1 mb-4">
          <img src="/logo.png" alt="" className="w-7 h-7 object-cover" style={{ borderRadius: 7 }} />
          <img src="/jashmen_wordmark_white.png" alt="" style={{ height: 13 }} />
        </div>

        <div className="flex flex-col gap-0.5">
          {NAV.map(({ icon: Icon, key }, i) => (
            <span
              key={key}
              className="flex items-center gap-2.5 px-2.5 py-2"
              style={{
                borderRadius: 8,
                background: i === 0 ? 'rgba(28,176,246,0.14)' : 'transparent',
                color: i === 0 ? '#1CB0F6' : MUTED,
              }}
            >
              <Icon size={14} strokeWidth={2.3} />
              <span className="font-bold font-body" style={{ fontSize: 11 }}>{copy[key]}</span>
            </span>
          ))}
        </div>

        <div className="mt-auto flex flex-col gap-2">
          <div className="flex gap-1.5">
            <Chip icon={Flame} color="#FF9600" value="1" s={0.95} />
            <Chip icon={Coins} color="#FFD700" value="55" s={0.95} />
            <Chip icon={Zap} color="#1CB0F6" value="25" s={0.95} />
          </div>
          <div
            className="flex items-center gap-2 px-2 py-2"
            style={{ background: CARD, border: `1px solid ${LINE}`, borderRadius: 9 }}
          >
            <span className="grid place-items-center shrink-0" style={{ width: 22, height: 22, borderRadius: '50%', background: '#1CB0F6' }}>
              <User size={12} color="#fff" strokeWidth={2.4} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-bold font-body truncate text-white" style={{ fontSize: 9.5 }}>{copy.userLine}</span>
            </span>
            <LogOut size={11} color={FAINT} strokeWidth={2.2} />
          </div>
        </div>
      </div>

      {/* Path */}
      <div className="flex-1 min-w-0 flex flex-col items-center overflow-hidden" style={{ padding: '16px 26px 0' }}>
        <Path copy={copy} s={s} nodeOffset={30} checkOffset={-18} maxCard={300} />
      </div>

      {/* Right panel */}
      <div className="shrink-0 flex flex-col gap-2.5" style={{ width: 178, padding: '16px 14px 0' }}>
        <PanelCard>
          <div className="flex items-start gap-2">
            <span className="grid place-items-center shrink-0" style={{ width: 26, height: 26, borderRadius: 7, background: mix('#1CB0F6', 22) }}>
              <GraduationCap size={14} color="#1CB0F6" strokeWidth={2.2} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-extrabold uppercase font-body" style={{ fontSize: 7.5, letterSpacing: '0.1em', color: FAINT }}>
                {copy.leagueKicker}
              </span>
              <span className="block font-extrabold font-body text-white truncate" style={{ fontSize: 12 }}>{copy.leagueName}</span>
            </span>
            <span className="font-extrabold font-body tabular-nums text-white shrink-0" style={{ fontSize: 11 }}>0 XP</span>
          </div>
          <div style={{ height: 5, borderRadius: 3, background: '#0f172a', marginTop: 8 }} />
          <p className="font-body truncate" style={{ fontSize: 8, color: FAINT, marginTop: 6 }}>{copy.leagueNext}</p>
        </PanelCard>

        <PanelCard accent="#FF9600">
          <div className="flex items-center gap-2">
            <Flame size={17} color="#FF9600" fill="#FF9600" strokeWidth={0} />
            <span className="min-w-0">
              <span className="block font-extrabold font-body text-white truncate" style={{ fontSize: 11 }}>{copy.streakLine}</span>
              <span className="block font-body truncate" style={{ fontSize: 8.5, color: MUTED }}>{copy.streakSub}</span>
            </span>
          </div>
        </PanelCard>

        {/* The university contest rather than the app's public leaderboard:
            that leaderboard is a list of real people's names, and a marketing
            page is not the place to publish them. */}
        {copy.uniName && (
          <PanelCard accent="#FFD700">
            <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
              <Trophy size={13} color="#FFD700" fill="#FFD700" strokeWidth={0} />
              <span className="font-extrabold uppercase font-body truncate" style={{ fontSize: 8, letterSpacing: '0.1em', color: MUTED }}>
                {copy.uniKicker}
              </span>
            </div>
            <p className="font-extrabold font-body text-white truncate" style={{ fontSize: 11 }}>{copy.uniName}</p>
            <div className="flex items-baseline justify-between gap-2" style={{ marginTop: 6 }}>
              <span className="font-body shrink-0" style={{ fontSize: 8, color: FAINT }}>{copy.uniPrizeLabel}</span>
              <span className="font-extrabold font-body tabular-nums whitespace-nowrap" style={{ fontSize: 11, color: '#FFD700' }}>
                {copy.uniPrize}
              </span>
            </div>
          </PanelCard>
        )}
      </div>
    </div>
  );
}

// ── Composition ───────────────────────────────────────────────────────────

export default function LandingShowcase({ copy, badge }) {
  const reduced = useReducedMotion();
  const rise = (delay) => ({
    initial: reduced ? false : { opacity: 0, y: 30 },
    animate: reduced ? undefined : { opacity: 1, y: 0 },
    transition: { ...SPRING, delay },
  });

  return (
    <div className="relative mt-14 sm:mt-16" aria-hidden="true">
      {/* Below lg the laptop's text would be unreadable, so the phone carries
          the whole showcase on its own. */}
      <motion.div {...rise(0.24)} className="hidden lg:block max-w-[820px]">
        <MacBookFrame>
          <DesktopScreen copy={copy} />
        </MacBookFrame>
      </motion.div>

      <motion.div
        {...rise(0.34)}
        className="lg:absolute lg:left-[66%] lg:bottom-[-3.25rem] flex justify-center"
      >
        <IPhoneFrame width={232}>
          <PhoneScreen copy={copy} />
        </IPhoneFrame>
      </motion.div>

      <motion.div
        {...rise(0.44)}
        className="absolute right-[-1.25rem] -top-12 lg:right-auto lg:left-[-4.25rem] lg:top-[44%]"
      >
        <DiamondBadge value={badge.value} label={badge.label} formatted={formatGrouped(badge.value ?? 0)} />
      </motion.div>
    </div>
  );
}
