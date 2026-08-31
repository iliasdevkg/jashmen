// src/components/landing/LandingStats.jsx — the live-numbers band.
//
// The four figures come from GET /public/stats, computed from the database
// on every request. Nothing here is typed in by hand, which is the point: a
// landing page with hand-written stats is wrong within a week and nobody
// notices until a partner does.
//
// While the request is in flight the band shows a skeleton rather than 0s —
// a counter animating from zero to zero reads as "nobody uses this", which
// would be a lie told by a loading state.
import { formatGrouped } from '../../i18n.jsx';
import { Section, Reveal, useCountUp, C } from './primitives.jsx';

function StatTile({ value, label, loading, delay, accent }) {
  const [ref, shown] = useCountUp(value);

  return (
    <Reveal delay={delay} className="h-full">
      <div
        ref={ref}
        className="lp-glass lp-lift h-full px-4 py-8 sm:py-10 flex flex-col items-center gap-3 text-center"
      >
        {loading ? (
          <span
            className="h-9 w-24 rounded-xl animate-pulse"
            style={{ background: 'rgba(255,255,255,0.14)' }}
            aria-hidden="true"
          />
        ) : (
          <span
            className="lp-display text-[2.1rem] sm:text-[2.9rem] leading-none tabular-nums"
            style={{ color: accent }}
          >
            {formatGrouped(shown)}
          </span>
        )}

        <span
          className="text-[11px] sm:text-[12.5px] font-medium font-body"
          style={{ color: C.muted }}
        >
          {label}
        </span>
      </div>
    </Reveal>
  );
}

export default function LandingStats({ copy, stats, loading }) {
  const tiles = [
    { key: 'learners',     label: copy.learnersLabel,     accent: C.accent },
    { key: 'lessons',      label: copy.lessonsLabel,      accent: '#fff' },
    { key: 'universities', label: copy.universitiesLabel, accent: '#fff' },
    { key: 'xp',           label: copy.xpLabel,           accent: C.mint },
  ].filter(t => t.label);

  if (!tiles.length) return null;

  return (
    <Section id="stats" title={copy.title} subtitle={copy.subtitle}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {tiles.map((t, i) => (
          <StatTile
            key={t.key}
            label={t.label}
            accent={t.accent}
            value={stats?.[t.key] ?? 0}
            loading={loading}
            delay={i * 0.07}
          />
        ))}
      </div>
    </Section>
  );
}
