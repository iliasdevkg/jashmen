// src/components/landing/LandingHero.jsx — the first screen.
//
// The brand blue straight off the logo's own ground, a sentence-case headline
// in Onest, and one amber button that is the single loudest thing on the page.
// Everything is centred on one axis so the device mock-up below it
// (LandingShowcase) can run the full width and bleed off the bottom edge.
//
// The panel's bottom corners are rounded and the page's ink shows past them,
// which is what the diagonal clip used to do — mark the end of the band —
// without cutting a wedge out of it.
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { SPRING, C, BRAND_BG, Eyebrow, buttonClass, buttonStyle } from './primitives.jsx';
import LandingShowcase from './LandingShowcase.jsx';

export default function LandingHero({ hero, showcase, badge }) {
  const reduced = useReducedMotion();
  const rise = (delay) => ({
    initial: reduced ? false : { opacity: 0, y: 22 },
    animate: reduced ? undefined : { opacity: 1, y: 0 },
    transition: { ...SPRING, delay },
  });

  return (
    <div
      id="top"
      className="relative z-10 -mt-16 pt-32 sm:pt-36 px-5 sm:px-8 pb-28 sm:pb-36 overflow-hidden rounded-b-[32px] sm:rounded-b-[56px]"
      style={{ background: BRAND_BG }}
    >
      {/* Two washes rather than one: an amber pool behind the headline and a
          mint one low and left, so the glass in the showcase below has two
          different colours to pick up as it sits over them. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[46rem] h-[34rem] rounded-full blur-[150px] opacity-[0.22]"
        style={{ background: C.accent }}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-[-8rem] left-[-10rem] w-[34rem] h-[28rem] rounded-full blur-[140px] opacity-[0.18]"
        style={{ background: C.mint }}
      />

      <div className="relative mx-auto max-w-5xl text-center">
        {hero.eyebrow && <motion.div {...rise(0)}><Eyebrow>{hero.eyebrow}</Eyebrow></motion.div>}

        <motion.h1
          {...rise(0.06)}
          className="mt-6 text-[2.3rem] leading-[1.06] sm:text-[3.4rem] lg:text-[4.05rem] tracking-[-0.04em] text-balance"
        >
          {hero.title}
        </motion.h1>

        {hero.subtitle && (
          <motion.p
            {...rise(0.12)}
            className="mt-5 text-[15px] sm:text-lg leading-relaxed font-body max-w-2xl mx-auto text-balance"
            style={{ color: 'rgba(255,255,255,0.8)' }}
          >
            {hero.subtitle}
          </motion.p>
        )}

        <motion.div {...rise(0.18)} className="mt-9 flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/start" className={buttonClass('group !py-4 !px-8')} style={buttonStyle('accent')}>
            {hero.primaryCta}
            <ArrowRight size={17} strokeWidth={2.6} className="transition-transform group-hover:translate-x-1" />
          </Link>
          <Link to="/login" className={buttonClass('!py-4 !px-8 hover:bg-white/[0.16]')} style={buttonStyle('ghost')}>
            {hero.secondaryCta}
          </Link>
        </motion.div>
      </div>

      <div className="relative mx-auto max-w-6xl">
        <LandingShowcase copy={showcase} badge={badge} />
      </div>
    </div>
  );
}
