// src/components/landing/LandingTestimonials.jsx — what learners say.
//
// Cards, not a carousel: three quotes a visitor can read at a glance beat
// one quote they have to wait for, and a carousel hides two thirds of the
// content from anyone who doesn't touch it.
//
// The avatar is optional — when no photo is uploaded the card falls back to
// the person's initial in a mint disc rather than a grey silhouette, which
// looks like a missing image rather than a design decision.
import { Quote } from 'lucide-react';
import { Section, Reveal, C } from './primitives.jsx';

function initialOf(name) {
  return String(name || '').trim().charAt(0).toUpperCase() || '?';
}

export default function LandingTestimonials({ copy }) {
  const items = (copy.items || []).filter(i => i.text);
  if (!items.length) return null;

  return (
    <Section id="testimonials" title={copy.title} subtitle={copy.subtitle}>
      <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item, i) => (
          <Reveal key={item.id} delay={(i % 3) * 0.07} className="h-full">
            <figure className="lp-glass lp-lift h-full p-6 sm:p-7 flex flex-col">
              <Quote size={22} color={C.mint} strokeWidth={2.4} className="mb-4 shrink-0" aria-hidden="true" />

              <blockquote className="flex-1 text-[14.5px] leading-relaxed font-body text-white/85">
                {item.text}
              </blockquote>

              <figcaption className="mt-6 flex items-center gap-3">
                {item.avatarUrl ? (
                  <img
                    src={item.avatarUrl}
                    alt=""
                    className="w-11 h-11 rounded-full object-cover shrink-0"
                    style={{ border: `1.5px solid ${C.mint}` }}
                  />
                ) : (
                  <span
                    className="w-11 h-11 rounded-full grid place-items-center shrink-0 lp-display text-base"
                    style={{ background: C.mint, color: C.ink }}
                    aria-hidden="true"
                  >
                    {initialOf(item.name)}
                  </span>
                )}
                <span className="min-w-0">
                  {item.name && (
                    <span className="block lp-display text-[14px] truncate">{item.name}</span>
                  )}
                  {item.role && (
                    <span
                      className="block text-[12px] font-body truncate"
                      style={{ color: C.muted }}
                    >
                      {item.role}
                    </span>
                  )}
                </span>
              </figcaption>
            </figure>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
