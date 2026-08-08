// Premium league progression badges — an original "cut-crystal gem" shape
// (rounded hexagon, not a circle/shield/ribbon like existing game badges),
// one finance-themed glyph per league, consistent art direction end to end:
// glossy radial highlight, diagonal shine sweep, colored outer glow, soft
// drop shadow and twinkling sparkles when unlocked; flat dark graphite +
// centered lock when a future league hasn't been reached yet.
//
// Pure vector, no assets, no text baked in — scales cleanly from the small
// league tab (104px) up to the enlarged active tab (~132px) and would hold
// up at 4K if ever exported. See LEAGUE_ICONS at the bottom for the
// id → glyph map consumed by LeaguePage.

import { useId } from 'react';

// Rounded regular hexagon (circumradius 46, corner rounding 12) in a
// 0–100 viewBox — the shared silhouette every league badge is cut from.
const GEM_PATH =
  'M20.59,21 L39.61,10 Q50,4 60.39,10 L79.41,21 Q89.8,27 89.8,39 ' +
  'L89.8,61 Q89.8,73 79.41,79 L60.39,90 Q50,96 39.61,90 L20.59,79 ' +
  'Q10.2,73 10.2,61 L10.2,39 Q10.2,27 20.59,21 Z';

function Sparkle({ x, y, s = 5, delay = 0, dur = 2.4 }) {
  const d =
    `M${x},${y - s} Q${x + s * 0.28},${y - s * 0.28} ${x + s},${y} ` +
    `Q${x + s * 0.28},${y + s * 0.28} ${x},${y + s} ` +
    `Q${x - s * 0.28},${y + s * 0.28} ${x - s},${y} ` +
    `Q${x - s * 0.28},${y - s * 0.28} ${x},${y - s} Z`;
  return (
    <path d={d} fill="white">
      <animate attributeName="opacity" values="0.12;1;0.12" dur={`${dur}s`} begin={`${delay}s`} repeatCount="indefinite" />
    </path>
  );
}

function LockGlyph() {
  return (
    <g>
      <path d="M43,49 v-7 a7,7 0 0 1 14,0 v7" fill="none" stroke="#6b7793" strokeWidth="5.5" strokeLinecap="round" />
      <rect x="38.5" y="48.5" width="23" height="19" rx="5.5" fill="#2a3345" stroke="#586a89" strokeWidth="2" />
      <circle cx="50" cy="56" r="2.6" fill="#8895ac" />
      <rect x="48.7" y="57.2" width="2.6" height="5" rx="1.3" fill="#8895ac" />
    </g>
  );
}

// ── Finance glyphs ──────────────────────────────────────────────────────
// Every glyph shares one visual grammar: bold white silhouette, a thin
// translucent-navy outline for definition, one small accent fill for pop.

function GraduationCapIcon() {
  return (
    <g strokeLinejoin="round" strokeLinecap="round">
      <path d="M50,32 L74,44 L50,56 L26,44 Z" fill="white" stroke="rgba(15,23,42,0.22)" strokeWidth="2" />
      <rect x="38" y="46" width="24" height="11" rx="5" fill="white" stroke="rgba(15,23,42,0.22)" strokeWidth="2" />
      <path d="M74,44 L76,60" stroke="white" strokeWidth="2.6" />
      <circle cx="76.4" cy="63" r="3.2" fill="white" stroke="rgba(15,23,42,0.22)" strokeWidth="1.5" />
    </g>
  );
}

function VaultIcon() {
  return (
    <g strokeLinejoin="round" strokeLinecap="round">
      <rect x="32" y="28" width="36" height="30" rx="7" fill="white" stroke="rgba(15,23,42,0.22)" strokeWidth="2" />
      <circle cx="50" cy="43" r="8" fill="none" stroke="rgba(15,23,42,0.3)" strokeWidth="2.4" />
      <circle cx="50" cy="43" r="2.2" fill="rgba(15,23,42,0.3)" />
      <rect x="56.5" y="41.3" width="7" height="3.4" rx="1.7" fill="white" stroke="rgba(15,23,42,0.22)" strokeWidth="1.5" />
      <ellipse cx="50" cy="65" rx="16" ry="6.2" fill="white" stroke="rgba(15,23,42,0.22)" strokeWidth="2" />
      <ellipse cx="50" cy="72.5" rx="16" ry="6.2" fill="white" stroke="rgba(15,23,42,0.22)" strokeWidth="2" />
      <path d="M43,65 h14" stroke="rgba(15,23,42,0.28)" strokeWidth="1.6" />
      <path d="M43,72.5 h14" stroke="rgba(15,23,42,0.28)" strokeWidth="1.6" />
    </g>
  );
}

function ChartIcon() {
  return (
    <g strokeLinejoin="round" strokeLinecap="round">
      <rect x="27" y="58" width="10" height="16" rx="2.6" fill="white" stroke="rgba(15,23,42,0.22)" strokeWidth="2" />
      <rect x="41" y="47" width="10" height="27" rx="2.6" fill="white" stroke="rgba(15,23,42,0.22)" strokeWidth="2" />
      <rect x="55" y="33" width="10" height="41" rx="2.6" fill="white" stroke="rgba(15,23,42,0.22)" strokeWidth="2" />
      <path d="M27,52 L44,38 L54,45 L74,24" fill="none" stroke="white" strokeWidth="4.4" strokeLinecap="round" />
      <path d="M63,23 L75,23 L75,35" fill="none" stroke="white" strokeWidth="4.4" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
}

function RocketIcon() {
  return (
    <g strokeLinejoin="round" strokeLinecap="round">
      <path d="M50,24 Q61,33 62,50 L38,50 Q39,33 50,24 Z" fill="white" stroke="rgba(15,23,42,0.22)" strokeWidth="2" />
      <rect x="38" y="50" width="24" height="23" rx="10" fill="white" stroke="rgba(15,23,42,0.22)" strokeWidth="2" />
      <path d="M38,66 L27,80 L38,76 Z" fill="white" stroke="rgba(15,23,42,0.22)" strokeWidth="2" />
      <path d="M62,66 L73,80 L62,76 Z" fill="white" stroke="rgba(15,23,42,0.22)" strokeWidth="2" />
      <circle cx="50" cy="58" r="5.6" fill="rgba(15,23,42,0.35)" />
      <path d="M46.5,55.5 a5.6,5.6 0 0 1 6,-2.4" fill="none" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M44,74 Q50,90 56,74 Q50,80.5 44,74 Z" fill="#FFD24C" stroke="rgba(15,23,42,0.22)" strokeWidth="1.6" />
    </g>
  );
}

function BulbIcon() {
  return (
    <g strokeLinejoin="round" strokeLinecap="round">
      <circle cx="50" cy="43" r="16" fill="white" stroke="rgba(15,23,42,0.22)" strokeWidth="2" />
      <rect x="44" y="56" width="12" height="7" rx="2" fill="white" stroke="rgba(15,23,42,0.22)" strokeWidth="2" />
      <rect x="43.5" y="64" width="13" height="3.4" rx="1.5" fill="white" stroke="rgba(15,23,42,0.22)" strokeWidth="1.4" />
      <rect x="44.5" y="68.4" width="11" height="3.4" rx="1.5" fill="white" stroke="rgba(15,23,42,0.22)" strokeWidth="1.4" />
      <path d="M44,44 L48,37 L52,47 L56,39" fill="none" stroke="#FFD24C" strokeWidth="2.2" />
      <path d="M50,21 L50,15" stroke="white" strokeWidth="3.4" strokeLinecap="round" />
      <path d="M67,29 L72,25" stroke="white" strokeWidth="3.4" strokeLinecap="round" />
      <path d="M33,29 L28,25" stroke="white" strokeWidth="3.4" strokeLinecap="round" />
    </g>
  );
}

function CrownIcon() {
  return (
    <g strokeLinejoin="round" strokeLinecap="round">
      <path d="M32,60 L32,46 L41,55 L50,35 L59,55 L68,46 L68,60 Z" fill="white" stroke="rgba(15,23,42,0.22)" strokeWidth="2" />
      <rect x="30" y="59" width="40" height="10" rx="4" fill="white" stroke="rgba(15,23,42,0.22)" strokeWidth="2" />
      <circle cx="32" cy="46" r="3.4" fill="#FFD24C" />
      <circle cx="50" cy="35" r="4" fill="#FFD24C" />
      <circle cx="68" cy="46" r="3.4" fill="#FFD24C" />
    </g>
  );
}

function DiamondBarsIcon() {
  return (
    <g strokeLinejoin="round" strokeLinecap="round">
      <path d="M38,60 L62,60 L58,68 L42,68 Z" fill="white" stroke="rgba(15,23,42,0.22)" strokeWidth="2" />
      <path d="M34,70 L66,70 L61,79 L39,79 Z" fill="white" stroke="rgba(15,23,42,0.22)" strokeWidth="2" />
      <path d="M40,32 L60,32 L68,41 L50,58 L32,41 Z" fill="#FFD24C" stroke="rgba(15,23,42,0.28)" strokeWidth="2" />
      <path d="M40,32 L50,58 M60,32 L50,58 M32,41 L68,41" stroke="rgba(15,23,42,0.28)" strokeWidth="1.3" />
    </g>
  );
}

function EagleIcon() {
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="50" cy="30" r="6.5" fill="white" stroke="rgba(15,23,42,0.22)" strokeWidth="1.8" />
      <path d="M46,34 L54,34 L50,40 Z" fill="#FFD24C" stroke="rgba(15,23,42,0.22)" strokeWidth="1.2" />
      <path d="M50,38 L58,53 Q50,64 42,53 Z" fill="white" stroke="rgba(15,23,42,0.22)" strokeWidth="1.8" />
      <path d="M54,42 Q70,36 85,20" stroke="white" strokeWidth="6" />
      <path d="M54,47 Q67,45 79,33" stroke="white" strokeWidth="6" />
      <path d="M54,52 Q64,52 73,46" stroke="white" strokeWidth="6" />
      <path d="M46,42 Q30,36 15,20" stroke="white" strokeWidth="6" />
      <path d="M46,47 Q33,45 21,33" stroke="white" strokeWidth="6" />
      <path d="M46,52 Q36,52 27,46" stroke="white" strokeWidth="6" />
    </g>
  );
}

export const LEAGUE_ICONS = {
  student: GraduationCapIcon,
  savings: VaultIcon,
  investor: ChartIcon,
  entrepreneur: RocketIcon,
  startup: BulbIcon,
  ceo: CrownIcon,
  billionaire: DiamondBarsIcon,
  legend: EagleIcon,
};

// Legend is the one badge that breaks the color formula on purpose — black
// crystal, gold everything else — per spec ("Black and gold ... majestic
// eagle, ultimate achievement").
const LEGEND_BLACK = { top: '#4a4a4a', mid: '#161616', bottom: '#000000' };

export default function LeagueBadge({ id, color, locked = false, size = 72 }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const fillId = `lb-fill-${uid}`;
  const glossId = `lb-gloss-${uid}`;
  const glowId = `lb-glow-${uid}`;
  const isLegend = id === 'legend' && !locked;
  const accent = isLegend ? '#FFD24C' : color;
  const Icon = LEAGUE_ICONS[id];

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ overflow: 'visible', display: 'block' }}>
      <defs>
        <linearGradient id={fillId} x1="18%" y1="6%" x2="84%" y2="96%">
          {locked ? (
            <>
              <stop offset="0%" stopColor="#3d475e" />
              <stop offset="58%" stopColor="#212a3b" />
              <stop offset="100%" stopColor="#131826" />
            </>
          ) : isLegend ? (
            <>
              <stop offset="0%" stopColor={LEGEND_BLACK.top} />
              <stop offset="55%" stopColor={LEGEND_BLACK.mid} />
              <stop offset="100%" stopColor={LEGEND_BLACK.bottom} />
            </>
          ) : (
            <>
              <stop offset="0%" stopColor={`color-mix(in srgb, ${color} 45%, white)`} />
              <stop offset="55%" stopColor={color} />
              <stop offset="100%" stopColor={`color-mix(in srgb, ${color} 70%, black)`} />
            </>
          )}
        </linearGradient>
        <radialGradient id={glossId} cx="32%" cy="20%" r="60%">
          <stop offset="0%" stopColor="white" stopOpacity={locked ? 0.16 : 0.5} />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </radialGradient>
        {!locked && (
          <filter id={glowId} x="-70%" y="-70%" width="240%" height="240%">
            <feGaussianBlur stdDeviation="4" />
          </filter>
        )}
      </defs>

      {/* soft colored glow behind the gem */}
      {!locked && (
        <path
          d={GEM_PATH}
          fill={accent}
          opacity="0.55"
          filter={`url(#${glowId})`}
          transform="translate(50 50) scale(1.12) translate(-50 -50)"
        />
      )}

      {/* soft drop shadow, always present */}
      <path d={GEM_PATH} fill="black" opacity={locked ? 0.22 : 0.18} transform="translate(0 3)" filter={!locked ? `url(#${glowId})` : undefined} />

      {/* main crystal body */}
      <path
        d={GEM_PATH}
        fill={`url(#${fillId})`}
        stroke={locked ? '#0b0e17' : `color-mix(in srgb, ${accent} 55%, black)`}
        strokeWidth="3.5"
        strokeLinejoin="round"
      />

      {/* inner glass edge highlight */}
      <path
        d={GEM_PATH}
        fill="none"
        stroke={locked ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.4)'}
        strokeWidth="1.4"
        strokeLinejoin="round"
        transform="translate(50 50) scale(0.93) translate(-50 -50)"
      />

      {/* glossy top-left sheen */}
      <path d={GEM_PATH} fill={`url(#${glossId})`} />

      {/* diagonal shine sweep */}
      {!locked && (
        <path d="M22,34 L34,22 L46,34 L34,46 Z" fill="white" opacity="0.13" transform="rotate(6 50 50)" />
      )}

      {/* glyph */}
      {locked ? <LockGlyph /> : Icon ? <Icon /> : null}

      {/* twinkles */}
      {!locked && (
        <>
          <Sparkle x={17} y={23} s={4.6} delay={0.1} />
          <Sparkle x={84} y={16} s={3.2} delay={0.85} />
          <Sparkle x={87} y={75} s={3.8} delay={1.5} />
        </>
      )}
    </svg>
  );
}
