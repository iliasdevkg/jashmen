// src/components/landing/LandingRibbon.jsx — the amber strip that scrolls.
//
// The seam-free loop is the whole trick: the track holds the phrase list
// twice and animates to exactly -50%, so the moment the first copy leaves
// the viewport the second sits precisely where it began (landing.css).
// Duration scales with how much an admin actually wrote — a six-phrase
// ribbon and a two-phrase one should move at the same speed, not take the
// same time.
import { C } from './primitives.jsx';

// A rough px-per-second target, tuned so the text is comfortably readable
// while still obviously moving.
const SPEED = 90;
const CHAR_PX = 13; // ~ the width of one uppercase Inter character at 14px

export default function LandingRibbon({ items }) {
  const phrases = (items || []).map(i => i.text).filter(Boolean);
  if (!phrases.length) return null;

  // One track = the full list once. The animation moves half the doubled
  // width, so its duration is the time to cross a single list.
  const trackPx = phrases.reduce((sum, p) => sum + p.length * CHAR_PX + 64, 0);
  const duration = Math.max(14, Math.round(trackPx / SPEED));

  const run = (key) => (
    <div className="flex shrink-0" key={key} aria-hidden={key === 'b' ? 'true' : undefined}>
      {phrases.map((text, i) => (
        <span key={i} className="flex items-center shrink-0">
          <span className="px-6 sm:px-8 text-[12.5px] sm:text-[14px] font-semibold uppercase tracking-[0.16em] font-body whitespace-nowrap">
            {text}
          </span>
          {/* A round dot rather than the rotated square this strip used —
              the only mark left on a page with no sharp corners in it. */}
          <span className="w-[5px] h-[5px] rounded-full shrink-0 opacity-45" style={{ background: C.ink }} />
        </span>
      ))}
    </div>
  );

  // The strip is inset and fully rounded, so it reads as one more object
  // laid on the page next to the cards rather than a band cut across it.
  // The negative top margin tucks it into the hero's rounded bottom edge.
  return (
    <div className="px-3 sm:px-5 -mt-7 sm:-mt-9 relative z-20">
      <div
        className="lp-marquee relative py-3.5 rounded-full"
        style={{
          background: C.accent,
          color: C.ink,
          boxShadow: '0 18px 45px -22px rgba(255,197,61,0.85)',
          // Consumed by .lp-marquee-track in landing.css.
          '--lp-marquee-duration': `${duration}s`,
        }}
      >
        <div className="lp-marquee-track">
          {run('a')}
          {run('b')}
        </div>
      </div>
    </div>
  );
}
