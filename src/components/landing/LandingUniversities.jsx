// src/components/landing/LandingUniversities.jsx — the campus band.
//
// The campuses are the real ones from the admin store, not a picture of
// some: adding a university in the panel puts it on the marketing page the
// same minute, which is why the league's content moved server-side.
//
// A campus with a live contest wears an amber prize strip along its bottom
// edge and a brighter border; one without shows only its name. Sorting by
// prize pool puts the campus with something to win first.
import { Link } from 'react-router-dom';
import { GraduationCap, ArrowRight } from 'lucide-react';
import { localizedText, formatSom } from '../../i18n.jsx';
import { Section, Reveal, C, buttonClass, buttonStyle } from './primitives.jsx';

export default function LandingUniversities({ copy, universities, locale }) {
  const campuses = (universities || []).slice().sort(
    (a, b) => (b.contest?.prizePool || 0) - (a.contest?.prizePool || 0),
  );
  if (!campuses.length) return null;

  return (
    <Section id="uni" title={copy.title} subtitle={copy.subtitle}>
      <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {campuses.map((uni, i) => {
          const prize = uni.contest?.prizePool || 0;
          const live = prize > 0;
          return (
            <Reveal key={uni.id} delay={(i % 3) * 0.06} className="h-full">
              <article
                className="lp-glass lp-lift h-full flex flex-col overflow-hidden"
                style={live ? { borderColor: 'rgba(255,197,61,0.4)' } : undefined}
              >
                <div className="flex items-center gap-3.5 p-5 flex-1">
                  <span
                    className="w-12 h-12 rounded-2xl grid place-items-center shrink-0 overflow-hidden"
                    style={{ background: live ? 'rgba(255,197,61,0.16)' : 'rgba(255,255,255,0.08)' }}
                  >
                    {uni.logoUrl
                      ? <img src={uni.logoUrl} alt="" className="w-full h-full object-contain p-1.5" />
                      : <GraduationCap size={21} color={live ? C.accent : 'rgba(255,255,255,0.5)'} strokeWidth={2} />}
                  </span>
                  <div className="min-w-0">
                    <p className="lp-display text-[15px] truncate">{uni.listName}</p>
                    <p className="text-[12px] font-body leading-snug line-clamp-2" style={{ color: C.muted }}>
                      {localizedText(uni.name, locale)}
                    </p>
                  </div>
                </div>

                {live && (
                  <div
                    className="flex items-baseline justify-between gap-2 px-5 py-3"
                    style={{ background: C.accent, color: C.ink }}
                  >
                    <span className="text-[10.5px] font-semibold uppercase tracking-[0.12em] font-body shrink-0">
                      {copy.prizeLabel}
                    </span>
                    <span className="lp-display text-[15px] whitespace-nowrap">
                      {formatSom(prize, locale)}
                    </span>
                  </div>
                )}
              </article>
            </Reveal>
          );
        })}
      </div>

      {copy.cta && (
        <Reveal delay={0.12} className="mt-10 flex justify-center">
          <Link to="/start" className={buttonClass('group !py-4 !px-8')} style={buttonStyle('accent')}>
            {copy.cta}
            <ArrowRight size={17} strokeWidth={2.6} className="transition-transform group-hover:translate-x-1" />
          </Link>
        </Reveal>
      )}
    </Section>
  );
}
