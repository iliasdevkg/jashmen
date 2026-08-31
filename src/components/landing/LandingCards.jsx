// src/components/landing/LandingCards.jsx — the icon-card grid, shared by
// "what you'll learn" and the gamification band.
//
// Both are the same object (icon, title, paragraph) laid out the same way,
// so they're one component with a tone switch rather than two files that
// drift apart the first time someone adjusts a padding.
//
// The cards are frosted panels with 22px corners; hovering lifts one off the
// page and lights a blue pool under it (landing.css), which is the page's
// only per-element state change.
import { Sparkles } from 'lucide-react';
import { lessonIconFor } from '../../../shared/lessonIconComponents.jsx';
import { Section, Reveal, C } from './primitives.jsx';

export default function LandingCards({ id, copy, columns = 3, tone = 'ink' }) {
  const items = (copy.items || []).filter(i => i.title || i.text);
  if (!items.length) return null;

  const light = tone === 'paper' || tone === 'amber';
  const grid = columns === 4
    ? 'sm:grid-cols-2 lg:grid-cols-4'
    : 'sm:grid-cols-2 lg:grid-cols-3';

  // On a light ground the accent has to be the blue itself — amber on white
  // is unreadable, and mint on white is only just readable.
  const iconColor = light ? C.blue : C.accent;
  const iconWell = light ? 'rgba(1,71,238,0.10)' : 'rgba(255,197,61,0.14)';
  const bodyColor = light ? C.mutedOnLight : C.muted;

  return (
    <Section id={id} title={copy.title} subtitle={copy.subtitle} tone={tone}>
      <div className={`grid gap-3 sm:gap-4 ${grid}`}>
        {items.map((item, i) => {
          const Icon = lessonIconFor(item.icon) || Sparkles;
          return (
            <Reveal key={item.id} delay={(i % 3) * 0.06} className="h-full">
              <article className={`${light ? 'lp-glass-light' : 'lp-glass'} lp-lift h-full p-6 sm:p-7`}>
                <span
                  className="w-12 h-12 rounded-2xl grid place-items-center mb-5"
                  style={{ background: iconWell }}
                >
                  <Icon size={21} color={iconColor} strokeWidth={2.2} />
                </span>
                {item.title && (
                  <h3 className="text-[16px] sm:text-[17px] mb-2">{item.title}</h3>
                )}
                {item.text && (
                  <p className="text-[13.5px] leading-relaxed font-body" style={{ color: bodyColor }}>
                    {item.text}
                  </p>
                )}
              </article>
            </Reveal>
          );
        })}
      </div>
    </Section>
  );
}
