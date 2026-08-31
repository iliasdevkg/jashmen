// src/components/landing/LandingFaq.jsx — the accordion.
//
// One panel open at a time: a visitor scanning six questions wants to
// compare answers, not scroll past five open ones. Built on a real
// <button aria-expanded> + region pair rather than a <details> element so
// the open/close can be animated and so only one panel can be open.
//
// Each row is its own frosted panel rather than a hairline-separated list:
// on a page made of floating glass, a stack of bare rules would be the one
// place with a hard edge in it.
import { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { Section, Reveal, C } from './primitives.jsx';

function FaqRow({ item, open, onToggle, index }) {
  const reduced = useReducedMotion();
  const panelId = `faq-panel-${item.id}`;
  const buttonId = `faq-button-${item.id}`;

  return (
    <Reveal delay={Math.min(index, 4) * 0.05}>
      <div
        className="lp-glass overflow-hidden transition-colors duration-200"
        style={open ? { borderColor: 'rgba(255,197,61,0.34)' } : undefined}
      >
        <h3>
          <button
            id={buttonId}
            aria-expanded={open}
            aria-controls={panelId}
            onClick={onToggle}
            className="w-full flex items-center gap-4 px-5 sm:px-6 py-5 text-left group rounded-[22px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#24E6A4]"
          >
            <span
              className="flex-1 lp-display text-[15px] sm:text-[17px] transition-colors"
              style={{ color: open ? C.accent : '#fff' }}
            >
              {item.q}
            </span>
            <motion.span
              animate={{ rotate: open ? 45 : 0 }}
              transition={{ duration: reduced ? 0 : 0.22, ease: 'easeOut' }}
              className="w-8 h-8 rounded-full grid place-items-center shrink-0"
              style={{ background: open ? C.accent : 'rgba(255,255,255,0.1)' }}
            >
              <Plus size={15} color={open ? C.ink : 'rgba(255,255,255,0.7)'} strokeWidth={2.8} />
            </motion.span>
          </button>
        </h3>

        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              initial={reduced ? false : { height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
              transition={{ duration: reduced ? 0 : 0.26, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden"
            >
              <p
                className="px-5 sm:px-6 pb-6 pr-12 text-[14px] leading-relaxed font-body"
                style={{ color: C.muted }}
              >
                {item.a}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Reveal>
  );
}

export default function LandingFaq({ copy }) {
  const items = (copy.items || []).filter(i => i.q);
  const [openId, setOpenId] = useState(null);

  if (!items.length) return null;

  return (
    <Section id="faq" title={copy.title} subtitle={copy.subtitle} narrow>
      <div className="flex flex-col gap-2.5">
        {items.map((item, i) => (
          <FaqRow
            key={item.id}
            item={item}
            index={i}
            open={openId === item.id}
            onToggle={() => setOpenId(prev => (prev === item.id ? null : item.id))}
          />
        ))}
      </div>
    </Section>
  );
}
