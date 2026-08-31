// src/components/icons/MedalWreath.jsx — the 1st / 2nd / 3rd place medal.
//
// A laurel wreath with a star above it and a numbered disc between the
// branches, in gold, silver and bronze. Drawn as one SVG rather than shipped
// as three PNGs: it stays sharp at 28px in a list row and at 96px on the
// podium, weighs nothing, recolours from one table, and needs no asset
// pipeline.
//
// The leaves are generated from a polar sweep rather than hand-placed —
// twenty-six hand-tuned <path> elements is how a wreath ends up subtly
// lopsided and impossible to adjust later.

const TONES = {
  gold: {
    leafA: '#FFD54A', leafB: '#E8A200', stem: '#C98A00',
    discA: '#FFDF6B', discB: '#F0A800', ring: '#C98A00',
    starA: '#FFE47A', starB: '#F2B100',
    ink: '#5A3D00', glow: 'rgba(255,199,0,.55)',
  },
  silver: {
    leafA: '#F4F6F8', leafB: '#B9C1CA', stem: '#9AA3AD',
    discA: '#FFFFFF', discB: '#C6CDD5', ring: '#9AA3AD',
    starA: '#FFFFFF', starB: '#CDD4DC',
    ink: '#2E3540', glow: 'rgba(226,232,240,.5)',
  },
  bronze: {
    leafA: '#F0A868', leafB: '#C4702F', stem: '#A85C22',
    discA: '#F2AF72', discB: '#C06C29', ring: '#A85C22',
    starA: '#FFFFFF', starB: '#CDD4DC',
    ink: '#4A2409', glow: 'rgba(217,125,60,.5)',
  },
};

const TONE_BY_RANK = { 1: 'gold', 2: 'silver', 3: 'bronze' };

// One branch, described once and mirrored. `a0`/`a1` sweep counter-clockwise
// from the bottom of the wreath up to its shoulder; each row of leaves rides
// the same sweep at a different radius so they interleave the way a real
// laurel does.
function branchLeaves() {
  const CX = 60;
  const CY = 63;
  const rows = [
    { r: 45, n: 6, a0: 108, a1: 196, len: 15, wid: 6.4 },
    { r: 32, n: 5, a0: 116, a1: 190, len: 12.5, wid: 5.4 },
  ];

  const leaves = [];
  rows.forEach((row, ri) => {
    for (let i = 0; i < row.n; i++) {
      const t = row.n === 1 ? 0 : i / (row.n - 1);
      const deg = row.a0 + (row.a1 - row.a0) * t;
      const rad = (deg * Math.PI) / 180;
      const x = CX + row.r * Math.cos(rad);
      const y = CY - row.r * Math.sin(rad);
      // Leaves point away from the disc and fan slightly forward along the
      // sweep, which is what stops the wreath reading as a ring of blobs.
      const rot = -deg + (ri === 0 ? 26 : 8) + 180;
      leaves.push({ x, y, rot, len: row.len, wid: row.wid, key: `${ri}-${i}` });
    }
  });
  return leaves;
}

const LEAVES = branchLeaves();

function Branch({ tone, id }) {
  return (
    <g>
      {/* Stem */}
      <path
        d="M46 101 C 26 94, 14 78, 14 58 C 14 44, 18 33, 26 25"
        fill="none"
        stroke={tone.stem}
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      {LEAVES.map(l => (
        <g key={l.key} transform={`translate(${l.x} ${l.y}) rotate(${l.rot})`}>
          <path
            d={`M0 0 C ${l.len * 0.34} ${-l.wid} ${l.len * 0.76} ${-l.wid} ${l.len} 0 C ${l.len * 0.76} ${l.wid} ${l.len * 0.34} ${l.wid} 0 0 Z`}
            fill={`url(#leaf-${id})`}
            stroke={tone.stem}
            strokeWidth="0.7"
            strokeLinejoin="round"
          />
          <path d={`M1.5 0 L ${l.len - 1.5} 0`} stroke={tone.stem} strokeWidth="0.6" opacity="0.55" />
        </g>
      ))}
    </g>
  );
}

export default function MedalWreath({ rank = 1, tone: toneName, size = 64, glow = true, className = '', title }) {
  const key = toneName || TONE_BY_RANK[rank] || 'gold';
  const tone = TONES[key] || TONES.gold;
  // Gradients live in <defs> and are referenced by id, so two medals on the
  // same page must not share one.
  const id = `mw-${key}-${rank}`;

  return (
    <svg
      width={size}
      height={size * (110 / 120)}
      viewBox="0 0 120 110"
      className={className}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : 'true'}
    >
      <defs>
        <linearGradient id={`leaf-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={tone.leafA} />
          <stop offset="100%" stopColor={tone.leafB} />
        </linearGradient>
        <linearGradient id={`disc-${id}`} x1="0.25" y1="0" x2="0.75" y2="1">
          <stop offset="0%" stopColor={tone.discA} />
          <stop offset="100%" stopColor={tone.discB} />
        </linearGradient>
        <linearGradient id={`star-${id}`} x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor={tone.starA} />
          <stop offset="100%" stopColor={tone.starB} />
        </linearGradient>
        {glow && (
          <radialGradient id={`glow-${id}`}>
            <stop offset="35%" stopColor={tone.glow} />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
        )}
      </defs>

      {glow && <circle cx="60" cy="60" r="52" fill={`url(#glow-${id})`} />}

      <Branch tone={tone} id={id} />
      <g transform="translate(120 0) scale(-1 1)">
        <Branch tone={tone} id={id} />
      </g>

      {/* Star */}
      <path
        d="M60 4 L66.2 17.4 L80.6 19.3 L70.1 29.4 L72.8 43.8 L60 36.9 L47.2 43.8 L49.9 29.4 L39.4 19.3 L53.8 17.4 Z"
        fill={`url(#star-${id})`}
        stroke={tone.ring}
        strokeWidth="1.4"
        strokeLinejoin="round"
      />

      {/* Disc */}
      <circle cx="60" cy="63" r="26" fill={`url(#disc-${id})`} stroke={tone.ring} strokeWidth="2" />
      <circle cx="60" cy="63" r="21.5" fill="none" stroke={tone.ring} strokeWidth="1" opacity="0.5" />
      <text
        x="60"
        y="63"
        textAnchor="middle"
        dominantBaseline="central"
        fill={tone.ink}
        style={{ font: '900 30px -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif' }}
      >
        {rank}
      </text>
    </svg>
  );
}
