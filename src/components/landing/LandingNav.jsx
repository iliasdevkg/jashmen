// src/components/landing/LandingNav.jsx — the frosted bar.
//
// Glass rather than a solid slab: it opens over the hero's own blue, where it
// is all but invisible, and then frosts whatever section is passing under it
// for the rest of the page. Pinned, so the two calls to action are never more
// than a thumb away.
//
// The mark is the transparent white eagle (public/logo1.png) beside the white
// wordmark, so the pair reads as one lockup on the blue instead of a white
// wordmark next to a blue tile with its own hard edge.
//
// The language switcher sits here rather than in the footer because a
// visitor who can't read the headline needs it in the first second, not
// after nine sections.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Globe } from 'lucide-react';
import { useI18n, LANGUAGES } from '../../i18n.jsx';
import { SPRING, C, buttonClass, buttonStyle } from './primitives.jsx';

function LanguagePicker() {
  const { locale, setLocale } = useI18n();
  const [open, setOpen] = useState(false);
  const current = LANGUAGES.find(l => l.code === locale) || LANGUAGES[0];

  // Close on any outside interaction, not just a backdrop click — otherwise
  // the menu survives a scroll or a tab-away.
  useEffect(() => {
    if (!open) return undefined;
    const close = () => setOpen(false);
    window.addEventListener('scroll', close, { passive: true });
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={current.label}
        className="lp-glass-pill flex items-center gap-1.5 h-10 px-3.5 rounded-full text-[13px] font-semibold font-body text-white transition-colors hover:bg-white/[0.16] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#24E6A4]"
      >
        <Globe size={15} strokeWidth={2.2} />
        <span className="hidden sm:inline uppercase tracking-wide">{current.code}</span>
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden="true" />
            <motion.ul
              role="listbox"
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.97 }}
              transition={SPRING}
              className="lp-glass absolute right-0 top-12 z-20 w-48 p-1.5 origin-top-right"
              style={{ background: 'rgba(5,11,31,0.82)' }}
            >
              {LANGUAGES.map(lang => (
                <li key={lang.code}>
                  <button
                    role="option"
                    aria-selected={lang.code === locale}
                    onClick={() => { setLocale(lang.code); setOpen(false); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-2xl text-[13px] font-medium font-body text-white hover:bg-white/10 transition-colors"
                  >
                    <span aria-hidden="true">{lang.flag}</span>
                    <span className="flex-1 text-left">{lang.label}</span>
                    {lang.code === locale && <Check size={14} color={C.mint} strokeWidth={3} />}
                  </button>
                </li>
              ))}
            </motion.ul>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function LandingNav({ signInLabel, startLabel }) {
  return (
    <header
      className="sticky top-0 z-40"
      style={{
        background: 'rgba(1,71,238,0.72)',
        backdropFilter: 'blur(20px) saturate(160%)',
        WebkitBackdropFilter: 'blur(20px) saturate(160%)',
        borderBottom: '1px solid rgba(255,255,255,0.14)',
      }}
    >
      <nav className="mx-auto max-w-6xl px-5 sm:px-8 h-16 flex items-center gap-2.5 sm:gap-3">
        <a href="#top" className="flex items-center gap-2.5 mr-auto shrink-0" aria-label="JashMen">
          <img src="/logo1.png" alt="" className="w-9 h-9 object-contain" />
          <img src="/jashmen_wordmark_white.png" alt="JashMen" className="h-[18px] w-auto hidden sm:block" />
        </a>

        <LanguagePicker />

        <Link
          to="/login"
          className={buttonClass('hidden sm:inline-flex !px-5 !py-2.5 !text-[14px] hover:bg-white/[0.16]')}
          style={buttonStyle('ghost')}
        >
          {signInLabel}
        </Link>

        <Link to="/start" className={buttonClass('!px-5 !py-2.5 !text-[14px]')} style={buttonStyle('accent')}>
          {startLabel}
        </Link>
      </nav>
    </header>
  );
}
