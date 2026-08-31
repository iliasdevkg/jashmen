// src/components/landing/LandingPartners.jsx — the logo strip.
//
// Whoever is in the admin's partner list with a logo uploaded, and nobody
// else. There is deliberately no field anywhere to type a partner count
// into: the row is as long as the list of real partners is, and if that
// list is empty the section doesn't render at all.
//
// Logos are shown at reduced opacity that lifts on hover — they are proof,
// not decoration, and they must not out-shout the copy around them.
import { localizedText } from '../../i18n.jsx';
import { Reveal, C } from './primitives.jsx';

export default function LandingPartners({ copy, partners, locale }) {
  const logos = (partners || []).filter(p => p.logoUrl);
  if (!logos.length) return null;

  return (
    <section id="partners" className="px-3 sm:px-5 py-6 sm:py-8" aria-labelledby="partners-title">
      <div className="lp-glass mx-auto max-w-6xl px-5 sm:px-10 py-8 sm:py-9">
        {copy.title && (
          <Reveal>
            <h2
              id="partners-title"
              className="text-center text-[11px] sm:text-[11.5px] font-semibold uppercase tracking-[0.2em] font-body"
              style={{ color: C.muted }}
            >
              {copy.title}
            </h2>
          </Reveal>
        )}

        <Reveal delay={0.08}>
          <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-7 sm:gap-x-16">
            {logos.map(partner => {
              const name = localizedText(partner.name, locale);
              return (
                <li key={partner.id}>
                  <img
                    src={partner.logoUrl}
                    alt={name}
                    title={name}
                    loading="lazy"
                    className="h-12 sm:h-14 w-auto max-w-[170px] object-contain opacity-80 hover:opacity-100 transition-opacity duration-200"
                  />
                </li>
              );
            })}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
