// Shared user avatar — a colored circle with the user's name-initial.
// For now this is the ONE avatar treatment across the whole app (league
// podium/rows, right-panel mini leaderboard, side nav, profile header,
// settings) — no emoji/photo avatars, per product direction. The color is
// deterministic per name (a simple hash into a fixed palette) so the same
// person renders the same color everywhere without storing anything.
const AVATAR_COLORS = [
  '#F97316', '#8B5CF6', '#EAB308', '#06B6D4',
  '#10B981', '#EF4444', '#EC4899', '#3B82F6',
  '#A855F7', '#14B8A6', '#F59E0B', '#6366F1',
];

function colorForName(name = '') {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function initialOf(name = '') {
  return name.trim().slice(0, 1).toUpperCase() || '?';
}

export default function Avatar({ name, size = 48, style }) {
  const color = colorForName(name);
  return (
    <div
      className="rounded-full flex items-center justify-center font-extrabold shrink-0"
      style={{
        width: size,
        height: size,
        background: color,
        fontSize: size * 0.42,
        color: 'white',
        boxShadow: `0 2px 10px ${color}50`,
        ...style,
      }}
    >
      {initialOf(name)}
    </div>
  );
}
