// src/components/landing/LandingFooter.jsx
//
// Deliberately small: a brand line, the two ways to reach us, the privacy
// policy both app stores require, and the copyright. A footer full of links
// to pages that don't exist is worse than no footer.
//
// The mark is the transparent white eagle (public/logo1.png), same lockup as
// the navbar — the blue-tiled version would put a hard-edged square at the
// very bottom of a page that has none anywhere else.
import { Instagram, Mail, Shield } from 'lucide-react';
import { C } from './primitives.jsx';

export default function LandingFooter({ copy, privacyLabel }) {
  const linkClass = 'lp-glass-pill flex items-center gap-2 h-11 px-4 rounded-full text-[12.5px] font-medium font-body transition-colors hover:bg-white/[0.16] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#24E6A4]';
  const linkStyle = { color: 'rgba(255,255,255,0.82)' };

  return (
    <footer className="px-5 sm:px-8 py-12 sm:py-14" style={{ borderTop: `1px solid ${C.line}` }}>
      <div className="mx-auto max-w-6xl flex flex-col sm:flex-row sm:items-center gap-8 sm:gap-6">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 mb-3.5">
            <img src="/logo1.png" alt="" className="w-9 h-9 object-contain" />
            <img src="/jashmen_wordmark_white.png" alt="JashMen" className="h-[17px] w-auto" />
          </div>
          {copy.tagline && (
            <p className="text-[13.5px] font-body leading-relaxed max-w-sm" style={{ color: C.muted }}>
              {copy.tagline}
            </p>
          )}
        </div>

        <nav className="flex flex-wrap items-center gap-2.5" aria-label="JashMen">
          {copy.instagram && (
            <a
              href={copy.instagram}
              target="_blank"
              rel="noreferrer noopener"
              aria-label="Instagram"
              className="lp-glass-pill w-11 h-11 rounded-full grid place-items-center transition-colors hover:bg-white/[0.16] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#24E6A4]"
              style={linkStyle}
            >
              <Instagram size={17} />
            </a>
          )}
          {copy.email && (
            <a href={`mailto:${copy.email}`} className={linkClass} style={linkStyle}>
              <Mail size={15} />
              <span className="hidden sm:inline">{copy.email}</span>
            </a>
          )}
          <a href="/privacy.html" className={linkClass} style={linkStyle}>
            <Shield size={15} />
            {privacyLabel}
          </a>
        </nav>
      </div>

      {copy.rights && (
        <p
          className="mx-auto max-w-6xl mt-10 pt-6 text-[11.5px] font-body"
          style={{ color: 'rgba(255,255,255,0.4)', borderTop: `1px solid ${C.line}` }}
        >
          {copy.rights}
        </p>
      )}
    </footer>
  );
}
