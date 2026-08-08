// Premium shop power-up icons — same gem/glass art direction as the league
// badges (soft 3D gradient shell, glossy sheen, thick rounded outline,
// small shine + sparkle), cast in a rounded-square "capsule" instead of the
// league's hexagon so power-ups read as their own visual family in the
// grid. Keyed by item.id so admin-added items with an unmapped id still
// get a real capsule (just wrapping their configured emoji) instead of a
// bare floating glyph.

import { useId } from 'react';

function Sparkle({ x, y, s = 4, delay = 0, dur = 2.6 }) {
  const d =
    `M${x},${y - s} Q${x + s * 0.28},${y - s * 0.28} ${x + s},${y} ` +
    `Q${x + s * 0.28},${y + s * 0.28} ${x},${y + s} ` +
    `Q${x - s * 0.28},${y + s * 0.28} ${x - s},${y} ` +
    `Q${x - s * 0.28},${y - s * 0.28} ${x},${y - s} Z`;
  return (
    <path d={d} fill="white">
      <animate attributeName="opacity" values="0.15;1;0.15" dur={`${dur}s`} begin={`${delay}s`} repeatCount="indefinite" />
    </path>
  );
}

function EnergyGlyph() {
  return <path d="M54,20 L34,54 L48,54 L44,80 L68,44 L53,44 Z" fill="white" stroke="rgba(15,23,42,0.22)" strokeWidth="2.2" strokeLinejoin="round" />;
}

function StreakFreezeGlyph() {
  return (
    <g strokeLinecap="round" strokeLinejoin="round">
      <path d="M50,22 Q70,30 70,50 Q70,68 50,80 Q30,68 30,50 Q30,30 50,22 Z" fill="white" stroke="rgba(15,23,42,0.22)" strokeWidth="2.2" />
      <g stroke="#38BDF8" strokeWidth="3">
        <path d="M50,36 L50,62" />
        <path d="M40,42 L60,56" />
        <path d="M60,42 L40,56" />
        <path d="M50,36 L45,41 M50,36 L55,41" />
        <path d="M50,62 L45,57 M50,62 L55,57" />
      </g>
    </g>
  );
}

function XpBoostGlyph() {
  return (
    <g strokeLinecap="round" strokeLinejoin="round">
      <g stroke="white" strokeWidth="3.6" opacity="0.85">
        <path d="M50,18 L50,28" />
        <path d="M27,29 L34,35" />
        <path d="M73,29 L66,35" />
        <path d="M22,50 L32,50" />
        <path d="M78,50 L68,50" />
      </g>
      <path d="M53,30 L37,56 L48,56 L45,74 L64,46 L52,46 Z" fill="white" stroke="rgba(15,23,42,0.22)" strokeWidth="2.2" />
    </g>
  );
}

function VipCrownGlyph() {
  return (
    <g strokeLinejoin="round" strokeLinecap="round">
      <path d="M31,58 L31,42 L41,52 L50,30 L59,52 L69,42 L69,58 Z" fill="white" stroke="rgba(15,23,42,0.22)" strokeWidth="2.2" />
      <rect x="29" y="57" width="42" height="11" rx="4.5" fill="white" stroke="rgba(15,23,42,0.22)" strokeWidth="2.2" />
      <circle cx="31" cy="42" r="3.6" fill="#FFD24C" />
      <circle cx="50" cy="30" r="4.2" fill="#FFD24C" />
      <circle cx="69" cy="42" r="3.6" fill="#FFD24C" />
      <rect x="37" y="60.5" width="26" height="3.4" rx="1.7" fill="#FFD24C" opacity="0.8" />
    </g>
  );
}

const SHOP_ICONS = {
  energy_refill: { Glyph: EnergyGlyph, color: '#1CB0F6' },
  streak_freeze: { Glyph: StreakFreezeGlyph, color: '#38BDF8' },
  xp_boost: { Glyph: XpBoostGlyph, color: '#8B5CF6' },
  vip_badge: { Glyph: VipCrownGlyph, color: '#F5C242' },
};

const SQUIRCLE = 'M50,4 C80,4 96,20 96,50 C96,80 80,96 50,96 C20,96 4,80 4,50 C4,20 20,4 50,4 Z';

export default function ShopItemIcon({ item, size = 44 }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const fillId = `si-fill-${uid}`;
  const glossId = `si-gloss-${uid}`;
  const glowId = `si-glow-${uid}`;

  const mapped = SHOP_ICONS[item?.id];
  const color = mapped?.color || '#64748B';
  const Glyph = mapped?.Glyph;

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ overflow: 'visible', display: 'block' }}>
      <defs>
        <linearGradient id={fillId} x1="18%" y1="6%" x2="84%" y2="96%">
          <stop offset="0%" stopColor={`color-mix(in srgb, ${color} 45%, white)`} />
          <stop offset="55%" stopColor={color} />
          <stop offset="100%" stopColor={`color-mix(in srgb, ${color} 70%, black)`} />
        </linearGradient>
        <radialGradient id={glossId} cx="32%" cy="20%" r="62%">
          <stop offset="0%" stopColor="white" stopOpacity="0.55" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </radialGradient>
        <filter id={glowId} x="-70%" y="-70%" width="240%" height="240%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>

      <path d={SQUIRCLE} fill={color} opacity="0.5" filter={`url(#${glowId})`} transform="translate(50 50) scale(1.1) translate(-50 -50)" />
      <path d={SQUIRCLE} fill="black" opacity="0.16" transform="translate(0 2.5)" />
      <path d={SQUIRCLE} fill={`url(#${fillId})`} stroke={`color-mix(in srgb, ${color} 55%, black)`} strokeWidth="3.5" strokeLinejoin="round" />
      <path
        d={SQUIRCLE}
        fill="none"
        stroke="rgba(255,255,255,0.4)"
        strokeWidth="1.4"
        transform="translate(50 50) scale(0.93) translate(-50 -50)"
      />
      <path d={SQUIRCLE} fill={`url(#${glossId})`} />
      <path d="M22,34 L34,22 L46,34 L34,46 Z" fill="white" opacity="0.13" transform="rotate(6 50 50)" />

      {Glyph ? <Glyph /> : (
        <text x="50" y="62" fontSize="40" textAnchor="middle">{item?.emoji || '🎁'}</text>
      )}

      <Sparkle x={83} y={18} s={3.6} delay={0.4} />
    </svg>
  );
}
