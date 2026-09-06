// src/components/LeaguePodium.jsx — the top-three podium, shared by the
// general league (LeaguePage) and the university league (UniLeague).
//
// It lives here rather than in either page because the two boards must look
// identical: first place has to read as first place whichever league the
// learner is looking at. They were separate implementations once, and they
// drifted — the general board grew the metallic gold/silver/bronze blocks
// and the campus board kept a flat card, so the same achievement looked
// smaller on a campus. One component means that cannot happen again.
import { motion } from 'framer-motion';
import { formatGrouped } from '../i18n.jsx';
import Avatar from './Avatar.jsx';
import MedalWreath from './icons/MedalWreath.jsx';

/// Metal, not brand colour: these are the three medals, and they are the
/// same three on every board.
export const PODIUM_METAL = { 1: '#FFD700', 2: '#C0C0C0', 3: '#CD7F32' };

/// The step. First place is tallest, third shortest, and the row is bottom
/// aligned so the heights alone create the staircase — no magic offsets.
const BLOCK_HEIGHT = { 1: 86, 2: 64, 3: 46 };

/// The XP figure takes a readable variant of the metal: raw silver and
/// bronze are too low-contrast to set text in.
const XP_INK = {
  1: () => '#EAB308',
  2: (bright) => (bright ? '#64748B' : '#C3C9D4'),
  3: () => '#F59E0B',
};

/// A lit top edge, the metal through the middle, a shaded foot, and a
/// coloured drop shadow — what makes the block read as a solid object
/// rather than a rectangle of flat colour.
function podiumFace(color) {
  return {
    background: `linear-gradient(180deg, color-mix(in srgb, ${color} 85%, white) 0%, ${color} 55%, color-mix(in srgb, ${color} 78%, black) 100%)`,
    boxShadow: `inset 0 2px 0 rgba(255,255,255,0.55), inset 0 -4px 10px rgba(0,0,0,0.18), 0 12px 26px -8px ${color}90`,
  };
}

const SPRING = { type: 'spring', stiffness: 300, damping: 26 };

/// The 2–1–3 running order, so the winner stands in the middle.
const ENTRY_DELAY = { 1: 0.05, 2: 0.16, 3: 0.27 };

/**
 * One place on the podium.
 *
 * `entry` is `{ id, name, avatar, xp }`; anything extra a board wants to show
 * (the campus league's backer count, for instance) goes in `footer`.
 * A null entry reserves the column so a board with fewer than three
 * competitors keeps its shape instead of collapsing sideways.
 */
export function PodiumColumn({ entry, rank, bright, textColor, footer, onPick, pickLabel }) {
  if (!entry) return <div className="flex-1 min-w-0" />;

  const metal = PODIUM_METAL[rank];
  const xpInk = XP_INK[rank](bright);

  const body = (
    <>
      {/* Every place gets its medal, not just the winner: second and third
          are podium finishes too, and a bare avatar beside a crowned one
          reads as "also-ran" rather than "runner-up". */}
      <motion.span
        className="mb-0.5"
        animate={rank === 1 ? { rotate: [-5, 5, -5] } : undefined}
        transition={rank === 1 ? { duration: 2.6, repeat: Infinity, ease: 'easeInOut' } : undefined}
      >
        <MedalWreath rank={rank} size={rank === 1 ? 52 : 40} bright={bright} />
      </motion.span>

      <div className="rounded-full" style={{ boxShadow: `0 0 0 3px ${metal}, 0 4px 16px ${metal}70` }}>
        <Avatar name={entry.name} photoUrl={entry.avatar} size={rank === 1 ? 62 : 50} />
      </div>

      <p className="font-bold text-xs text-center mt-1 w-full truncate" style={{ color: textColor }}>
        {entry.name}
      </p>
      <p className="text-xs font-extrabold" style={{ color: xpInk }}>
        {formatGrouped(entry.xp)} XP
      </p>
      {footer}
    </>
  );

  return (
    <motion.div
      initial={{ y: 34, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ ...SPRING, delay: ENTRY_DELAY[rank] }}
      className="flex-1 min-w-0 flex flex-col items-center gap-1"
    >
      {onPick ? (
        <motion.button
          type="button"
          onClick={onPick}
          aria-label={pickLabel}
          whileTap={{ scale: 0.96 }}
          transition={SPRING}
          className="w-full flex flex-col items-center gap-1"
        >
          {body}
        </motion.button>
      ) : (
        body
      )}

      <div
        className="w-full flex items-center justify-center rounded-t-xl font-black text-xl"
        style={{
          height: BLOCK_HEIGHT[rank],
          marginTop: 4,
          color: 'rgba(0,0,0,0.55)',
          ...podiumFace(metal),
        }}
      >
        #{rank}
      </div>
    </motion.div>
  );
}

/**
 * The whole podium. `top3` is in rank order — [first, second, third] — and
 * this lays them out 2–1–3 so the winner stands in the middle.
 */
export default function LeaguePodium({ top3, bright, textColor, renderFooter, onPick, pickLabel, className = '' }) {
  const column = (entry, rank) => (
    <PodiumColumn
      key={rank}
      entry={entry}
      rank={rank}
      bright={bright}
      textColor={textColor}
      footer={entry && renderFooter ? renderFooter(entry) : null}
      onPick={entry && onPick ? () => onPick(entry) : null}
      pickLabel={pickLabel}
    />
  );

  return (
    <div className={`flex items-end justify-center gap-3 px-4 pt-2 ${className}`}>
      {column(top3[1], 2)}
      {column(top3[0], 1)}
      {column(top3[2], 3)}
    </div>
  );
}
