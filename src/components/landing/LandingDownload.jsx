// src/components/landing/LandingDownload.jsx — the closing call to action.
//
// A rounded amber slab, placed last on purpose: the FAQ above it has just
// answered the objections, so this is the moment to ask. It is the only
// full-colour block below the hero, which is what makes it the end of the
// page rather than one more section.
//
// The APK button only exists when an admin has actually put a link in the
// panel. A download button that 404s is worse than no download button, and
// "coming soon" placeholders ship once and then stay for a year.
import { Link } from 'react-router-dom';
import { Download, ArrowRight } from 'lucide-react';
import { Reveal, C, buttonClass, buttonStyle } from './primitives.jsx';

export default function LandingDownload({ copy }) {
  const hasApk = Boolean(copy.apkUrl);

  return (
    <div className="px-3 sm:px-5 py-3 sm:py-4 pb-6 sm:pb-10">
      <section
        id="download"
        className="relative overflow-hidden rounded-[28px] sm:rounded-[44px] px-5 sm:px-10 py-20 sm:py-28"
        style={{ background: C.accent, color: C.ink }}
        aria-labelledby="download-title"
      >
        {/* One warm pool low in the slab so the flat amber has some depth
            behind the buttons without turning into a gradient. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-32 left-1/2 -translate-x-1/2 w-[40rem] h-[24rem] rounded-full blur-[120px] opacity-40"
          style={{ background: '#FFE9AE' }}
        />

        <div className="relative mx-auto max-w-3xl text-center">
          <Reveal>
            <h2
              id="download-title"
              className="text-[2rem] leading-[1.08] sm:text-[3.1rem] tracking-[-0.04em] text-balance"
            >
              {copy.title}
            </h2>

            {copy.subtitle && (
              <p
                className="mt-5 text-[15px] sm:text-lg leading-relaxed font-body max-w-xl mx-auto text-balance"
                style={{ color: C.mutedOnLight }}
              >
                {copy.subtitle}
              </p>
            )}

            <div className="mt-9 flex flex-col sm:flex-row gap-3 justify-center">
              <Link to="/start" className={buttonClass('group !py-4 !px-8')} style={buttonStyle('ink')}>
                {copy.webCta}
                <ArrowRight size={17} strokeWidth={2.6} className="transition-transform group-hover:translate-x-1" />
              </Link>

              {hasApk && (
                <a
                  href={copy.apkUrl}
                  className={buttonClass('!py-4 !px-8 hover:bg-black/5')}
                  style={buttonStyle('ghostInk')}
                >
                  <Download size={17} strokeWidth={2.6} />
                  {copy.apkLabel}
                </a>
              )}
            </div>

            {copy.note && (
              <p className="mt-6 text-[12px] font-medium font-body" style={{ color: C.mutedOnLight }}>
                {copy.note}
              </p>
            )}
          </Reveal>
        </div>
      </section>
    </div>
  );
}
