// src/components/icons/MedalWreath.jsx — the 1st / 2nd / 3rd place medal.
//
// The supplied artwork, shipped as three PNGs in public/medals/ and used
// unmodified. It replaced a hand-drawn SVG wreath: the SVG scaled for free
// and weighed nothing, but the two clients have to show the SAME medal, and
// the only way to guarantee that with artwork somebody else authored is to
// ship the file itself rather than a drawing of it. mobile/assets/medals/
// holds byte-identical copies.
//
// The source images are trimmed to their visible bounds and padded to a
// square, so a medal is always centred in whatever box the caller gives it
// and the three line up at the same optical size.

/// Every caller passes a rank; the file name is the rank. Anything else
/// renders nothing rather than a broken image.
const RANKS = new Set([1, 2, 3]);

export default function MedalWreath({
  rank,
  size = 40,
  glow = true,
  bright = false,
  className = '',
  style,
}) {
  if (!RANKS.has(Number(rank))) return null;

  // No shadow at all: the supplied artwork carries its own depth, and a
  // drop-shadow behind it read as a smudge around the edges. `glow` and
  // `bright` are kept in the signature because every call site passes them
  // and they may matter again if the artwork is ever redrawn.

  return (
    <img
      src={`/medals/${rank}.png`}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      draggable={false}
      className={`select-none ${className}`}
      style={{ width: size, height: size, objectFit: 'contain', ...style }}
    />
  );
}
