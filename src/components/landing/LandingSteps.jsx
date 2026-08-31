// src/components/landing/LandingSteps.jsx — the numbered "how it works" rail.
//
// Sits on a rounded blue slab laid on the page, so it reads as its own object
// between two dark sections rather than as another stripe stacked on the last.
//
// The number is the hero of each step — amber, in a filled disc pinned to the
// icon well, so three of them in a row lead the eye without shouting over the
// copy. The connector is a real element rather than a border trick, so it
// stops at the last step instead of dangling past it, and it flips from
// vertical to horizontal with the layout.
import { Sparkles } from 'lucide-react';
import { lessonIconFor } from '../../../shared/lessonIconComponents.jsx';
import { Section, Reveal, C } from './primitives.jsx';

export default function LandingSteps({ copy }) {
  const items = (copy.items || []).filter(i => i.title || i.text);
  if (!items.length) return null;

  return (
    <Section id="steps" title={copy.title} subtitle={copy.subtitle} tone="blue">
      <ol className="relative grid gap-10 sm:gap-8 md:grid-cols-3">
        {items.map((item, i) => {
          const Icon = lessonIconFor(item.icon) || Sparkles;
          const last = i === items.length - 1;
          return (
            <Reveal as="li" key={item.id} delay={i * 0.09} className="relative">
              {!last && (
                <span
                  aria-hidden="true"
                  className="absolute left-[31px] top-[74px] bottom-[-2.75rem] w-px md:left-[78px] md:right-[-2rem] md:top-[31px] md:bottom-auto md:w-auto md:h-px"
                  style={{ background: 'rgba(255,197,61,0.38)' }}
                />
              )}

              <div className="flex md:flex-col gap-5">
                <div className="relative z-10 shrink-0 w-[62px]">
                  <span
                    className="lp-glass-pill w-[62px] h-[62px] rounded-[20px] grid place-items-center"
                  >
                    <Icon size={24} color={C.accent} strokeWidth={2.2} />
                  </span>
                  <span
                    className="absolute -top-2.5 -right-2.5 w-8 h-8 rounded-full grid place-items-center lp-display text-[13px]"
                    style={{ background: C.accent, color: C.ink }}
                  >
                    {i + 1}
                  </span>
                </div>

                <div className="min-w-0">
                  {item.title && (
                    <h3 className="text-[17px] sm:text-[19px] mb-2">{item.title}</h3>
                  )}
                  {item.text && (
                    <p
                      className="text-[13.5px] leading-relaxed font-body"
                      style={{ color: 'rgba(255,255,255,0.76)' }}
                    >
                      {item.text}
                    </p>
                  )}
                </div>
              </div>
            </Reveal>
          );
        })}
      </ol>
    </Section>
  );
}
