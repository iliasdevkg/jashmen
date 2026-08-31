// src/components/landing/primitives.jsx — the shared pieces of the landing
// page's design system, so nine section files don't each reinvent them.
//
// The system in one paragraph: soft geometry — nothing on this page has a
// corner sharper than 16px — and frosted glass instead of solid panels, so
// the brand blue behind the page reads through every card. Three colours do
// three jobs: amber for anything that asks to be clicked, blue for the deep
// bands, mint for the marks on a card, over a blue-black ground. Onest sets
// the headings, Inter the prose, and headings are sentence case: uppercase
// against a blurred, rounded surface reads as shouting through frosted
// glass, which is the one thing this look cannot carry.
//
// Motion rule: everything enters once and then stops. The ribbon is the only
// thing that loops, and `prefers-reduced-motion` stops even that (landing.css).
import { useEffect, useRef, useState } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';

// One spring for the whole page, matching the app's dialogs so the site and
// the product feel like the same piece of software even though they don't
// look alike.
export const SPRING = { type: 'spring', stiffness: 300, damping: 30 };

// `blue` is sampled from the logo's own ground (public/logo.png) rather than
// picked to sit near it, so the white mark never floats on an almost-match.
export const C = {
  blue: '#0147EE',
  blueDeep: '#0B2AA8',
  accent: '#FFC53D',
  accentDim: '#E8A81F',
  mint: '#24E6A4',
  ink: '#050B1F',
  line: 'rgba(255,255,255,0.14)',
  lineOnLight: 'rgba(5,11,31,0.10)',
  muted: 'rgba(255,255,255,0.66)',
  mutedOnLight: 'rgba(5,11,31,0.62)',
};

// The blue wash used by every "deep" band.
export const BRAND_BG = `linear-gradient(158deg, ${C.blue} 0%, ${C.blueDeep} 100%)`;

// Reveals children when they scroll into view, once. `delay` staggers a grid
// without a parent orchestrator, which would make every card wait for the
// slowest one.
//
// `min-w-0` is not cosmetic: a Reveal is almost always a grid item, and a
// grid item's automatic minimum size refuses to shrink below its content's
// min-content width — which a `truncate` (white-space: nowrap) line inside a
// card makes as wide as the untruncated text. Without this, one long
// university name pushed a 280px grid track out to 320px and gave the whole
// page a horizontal scrollbar at 320px wide.
export function Reveal({ children, delay = 0, y = 20, className = '', as = 'div' }) {
  const reduced = useReducedMotion();
  const Tag = motion[as] || motion.div;
  return (
    <Tag
      className={`min-w-0 ${className}`}
      initial={reduced ? false : { opacity: 0, y }}
      whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ ...SPRING, delay }}
    >
      {children}
    </Tag>
  );
}

// The little pill above a section heading. On dark bands it is glass with an
// amber label; where the band itself is light it fills with amber, because
// glass over white has nothing behind it to frost.
export function Eyebrow({ children, tone = 'glass' }) {
  if (!children) return null;
  const solid = tone === 'solid';
  return (
    <span
      className={`inline-flex items-center rounded-full px-3.5 py-1.5 text-[10.5px] sm:text-[11px] font-semibold uppercase tracking-[0.14em] font-body ${solid ? '' : 'lp-glass-pill'}`}
      style={solid ? { background: C.accent, color: C.ink } : { color: C.accent }}
    >
      {children}
    </span>
  );
}

// A section shell: shared max width, shared vertical rhythm, an optional
// heading block. `tone` picks the ground; a tone other than `ink` is inset
// from the page edge and rounded, so the band reads as a slab laid ON the
// page rather than a stripe cut THROUGH it — which is what the old diagonal
// clip-paths did, and what a rounded design system can't carry.
export function Section({
  id, eyebrow, title, subtitle, children,
  tone = 'ink', narrow = false, className = '', align = 'center',
}) {
  const grounds = {
    ink: { background: 'transparent', color: '#fff' },
    blue: { background: BRAND_BG, color: '#fff' },
    amber: { background: C.accent, color: C.ink },
    paper: { background: '#F3F6FF', color: C.ink },
  };
  const light = tone === 'amber' || tone === 'paper';
  const inset = tone !== 'ink';
  const centered = align === 'center';

  const body = (
    <div className={`mx-auto ${narrow ? 'max-w-3xl' : 'max-w-6xl'}`}>
      {(title || eyebrow) && (
        <Reveal className={`mb-9 sm:mb-12 ${centered ? 'text-center' : ''}`}>
          {eyebrow && (
            <div className={centered ? 'flex justify-center' : ''}>
              <Eyebrow tone={light ? 'solid' : 'glass'}>{eyebrow}</Eyebrow>
            </div>
          )}
          {title && (
            <h2
              id={`${id}-title`}
              className="mt-5 text-[1.85rem] leading-[1.1] sm:text-[2.85rem] tracking-[-0.03em] text-balance"
            >
              {title}
            </h2>
          )}
          {subtitle && (
            <p
              className={`mt-4 text-[15px] sm:text-base leading-relaxed text-balance ${centered ? 'max-w-2xl mx-auto' : 'max-w-2xl'}`}
              style={{ color: light ? C.mutedOnLight : C.muted }}
            >
              {subtitle}
            </p>
          )}
        </Reveal>
      )}
      {children}
    </div>
  );

  // The inset wrapper is a plain padded div rather than a margin on the
  // section itself, so the rounded band keeps its own background box and the
  // page's aurora shows in the gutter beside it.
  if (inset) {
    return (
      <div className="px-3 sm:px-5 py-3 sm:py-4">
        <section
          id={id}
          className={`rounded-[28px] sm:rounded-[44px] px-5 sm:px-10 py-16 sm:py-24 overflow-hidden ${className}`}
          style={grounds[tone]}
          aria-labelledby={title ? `${id}-title` : undefined}
        >
          {body}
        </section>
      </div>
    );
  }

  return (
    <section
      id={id}
      className={`px-5 sm:px-8 py-14 sm:py-20 ${className}`}
      style={grounds[tone]}
      aria-labelledby={title ? `${id}-title` : undefined}
    >
      {body}
    </section>
  );
}

// The one button shape on this page: a full pill, no shadow but a soft glow
// on the amber one so it still leads the eye now that nothing else is loud.
// `variant` picks which of the colours it wears.
const BUTTON_VARIANTS = {
  accent: {
    background: C.accent,
    color: C.ink,
    border: '1px solid transparent',
    boxShadow: '0 10px 30px -12px rgba(255,197,61,0.75)',
  },
  ink: { background: C.ink, color: '#fff', border: '1px solid transparent' },
  white: { background: '#fff', color: C.blue, border: '1px solid transparent' },
  ghost: {
    background: 'rgba(255,255,255,0.08)',
    color: '#fff',
    border: '1px solid rgba(255,255,255,0.24)',
    backdropFilter: 'blur(14px)',
    WebkitBackdropFilter: 'blur(14px)',
  },
  ghostInk: { background: 'transparent', color: C.ink, border: `1.5px solid ${C.lineOnLight}` },
  mint: { background: C.mint, color: C.ink, border: '1px solid transparent' },
};

const BUTTON_BASE =
  'inline-flex items-center justify-center gap-2 rounded-full px-6 py-3.5 text-[14px] sm:text-[15px] font-semibold '
  + 'font-body transition-all duration-200 hover:-translate-y-[1px] active:translate-y-[1px] '
  + 'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent '
  + 'focus-visible:ring-[#24E6A4]';

export function buttonClass(extra = '') {
  return `${BUTTON_BASE} ${extra}`;
}

export function buttonStyle(variant = 'accent') {
  return BUTTON_VARIANTS[variant] || BUTTON_VARIANTS.accent;
}

// Counts from 0 to `value` the first time it scrolls into view. rAF rather
// than an interval so it can't tear on a slow frame; snaps straight to the
// target under prefers-reduced-motion.
export function useCountUp(value, duration = 1200) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const target = Number(value) || 0;
    if (!inView) return undefined;
    if (reduced || target === 0) { setShown(target); return undefined; }

    let raf = 0;
    let start = 0;
    const step = (now) => {
      if (!start) start = now;
      const p = Math.min(1, (now - start) / duration);
      // easeOutCubic — fast first, settles gently, never overshoots a digit.
      setShown(Math.round(target * (1 - (1 - p) ** 3)));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [inView, value, duration, reduced]);

  return [ref, shown];
}
