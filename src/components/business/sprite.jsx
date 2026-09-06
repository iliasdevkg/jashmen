// src/components/business/sprite.jsx — one <svg> of defs the whole B2B page
// draws from, mounted once at the top of the page.
//
// Two reasons it is a sprite rather than per-component inline SVG: the fluid
// artwork is referenced five times (hero twice, CTA twice, solution scenes)
// and duplicating its filter chain would run feTurbulence five times over;
// and the gradients and patterns below are shared by the scenes, which need
// them to agree so six tabs read as one illustration system.
//
// What is NOT here: brand marks. The template shipped hand-drawn logos for
// six Kazakh banks JashMen has no agreement with — putting those under a
// heading that says "нам доверяют" would be a claim, not a decoration. Real
// partner and university logos come from the content store instead
// (BusinessPage.jsx#Trust), and the JashMen mark is the real file in
// /public rather than a redrawing of it.

export default function BusinessSprite() {
  return (
    <svg
      width="0"
      height="0"
      style={{ position: 'absolute' }}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="jbFgA" gradientUnits="userSpaceOnUse" x1="80" y1="40" x2="560" y2="480">
          <stop offset="0%" stopColor="#5ec8ff" />
          <stop offset="34%" stopColor="#6d8cff" />
          <stop offset="68%" stopColor="#9a6bff" />
          <stop offset="100%" stopColor="#2f6bff" />
        </linearGradient>
        <linearGradient id="jbFgB" gradientUnits="userSpaceOnUse" x1="620" y1="0" x2="60" y2="520">
          <stop offset="0%" stopColor="#7fd6ff" />
          <stop offset="50%" stopColor="#8f7bff" />
          <stop offset="100%" stopColor="#3459d8" />
        </linearGradient>

        {/* The displacement pair that turns concentric ellipses into a ribbon
            of liquid light. Two seeds so the two stacked copies in the hero
            never trace the same edge. */}
        <filter id="jbWarpA" x="-45%" y="-45%" width="190%" height="190%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.0042 0.0095" numOctaves="3" seed="9" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="86" xChannelSelector="R" yChannelSelector="G" />
          <feGaussianBlur stdDeviation="1.1" />
        </filter>
        <filter id="jbWarpB" x="-45%" y="-45%" width="190%" height="190%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.0055 0.011" numOctaves="3" seed="23" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="72" xChannelSelector="R" yChannelSelector="G" />
          <feGaussianBlur stdDeviation="1.4" />
        </filter>

        {/* Glass for the scene towers, and the lit windows that make them
            read as buildings rather than as rectangles. */}
        <linearGradient id="jbGlass" x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0%" stopColor="#2a4489" />
          <stop offset="100%" stopColor="#080f28" />
        </linearGradient>
        <linearGradient id="jbGlass2" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#12204c" />
          <stop offset="100%" stopColor="#050b1d" />
        </linearGradient>
        <pattern id="jbWindows" width="24" height="17" patternUnits="userSpaceOnUse">
          <rect x="2" y="2" width="18" height="12" rx="1" fill="#a8d0ff" opacity="0.3" />
        </pattern>
        <pattern id="jbWindows2" width="20" height="15" patternUnits="userSpaceOnUse">
          <rect x="2" y="2" width="14" height="10" rx="1" fill="#a8d0ff" opacity="0.2" />
        </pattern>
      </defs>

      {/* Суюк форма — жарык лента */}
      <symbol id="jb-fluid-art" viewBox="0 0 620 520">
        <g filter="url(#jbWarpA)" fill="none" stroke="url(#jbFgA)" strokeLinecap="round">
          <ellipse cx="310" cy="258" rx="228" ry="158" strokeWidth="54" opacity="0.42" />
          <ellipse cx="310" cy="258" rx="188" ry="126" strokeWidth="30" opacity="0.6" />
          <ellipse cx="310" cy="258" rx="248" ry="184" strokeWidth="15" opacity="0.4" />
          <ellipse cx="310" cy="258" rx="152" ry="98" strokeWidth="9" opacity="0.85" />
          <ellipse cx="310" cy="258" rx="205" ry="142" strokeWidth="4" stroke="#dbe8ff" opacity="0.7" />
        </g>
        <g filter="url(#jbWarpB)" fill="none" stroke="url(#jbFgB)" strokeLinecap="round">
          <ellipse cx="310" cy="258" rx="216" ry="150" strokeWidth="20" opacity="0.35" />
          <ellipse cx="310" cy="258" rx="168" ry="112" strokeWidth="6" stroke="#eaf1ff" opacity="0.5" />
        </g>
      </symbol>

      {/* UI иконкалар */}
      <symbol id="jb-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></symbol>
      <symbol id="jb-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h13" /><path d="m12 5 7 7-7 7" /></symbol>
      <symbol id="jb-play" viewBox="0 0 24 24"><path fill="currentColor" d="M8 5.2v13.6L19 12z" /></symbol>
      <symbol id="jb-menu" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></symbol>
      <symbol id="jb-close" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></symbol>
      <symbol id="jb-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m20 6-11 11-5-5" /></symbol>
      <symbol id="jb-alert" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9.2" /><path d="M12 7.6v5.2M12 16.3h.01" /></symbol>
      <symbol id="jb-gamepad" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M6 11h4M8 9v4M15.5 11.5h.01M18 9.5h.01" /><path d="M17.3 5.5H6.7a4 4 0 0 0-4 3.6C2.6 9.8 2 14.5 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.4-1.4a2 2 0 0 1 1.4-.6h4.4a2 2 0 0 1 1.4.6L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.5-.6-6.2-.7-6.9a4 4 0 0 0-4-3.6Z" /></symbol>
      <symbol id="jb-chart" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v16a2 2 0 0 0 2 2h16" /><path d="m19 9-5 5-4-4-4 4" /><path d="M19 9h-3.5M19 9v3.5" /></symbol>
      <symbol id="jb-layers" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="m12 2.5 9.5 4.7L12 12 2.5 7.2 12 2.5Z" /><path d="m2.5 12 9.5 4.8L21.5 12" /><path d="m2.5 16.8 9.5 4.7 9.5-4.7" /></symbol>
      <symbol id="jb-plug" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22v-4.5" /><path d="M8.5 8.5V3M15.5 8.5V3" /><path d="M18 8.5v4.2a5.2 5.2 0 0 1-5.2 5.2h-1.6A5.2 5.2 0 0 1 6 12.7V8.5Z" /></symbol>
      <symbol id="jb-blocks" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2.8" y="2.8" width="7.4" height="7.4" rx="1.8" /><rect x="13.8" y="2.8" width="7.4" height="7.4" rx="1.8" /><rect x="2.8" y="13.8" width="7.4" height="7.4" rx="1.8" /><path d="M17.5 13.8v7.4M13.8 17.5h7.4" /></symbol>
      <symbol id="jb-globe" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9.2" /><path d="M2.8 12h18.4" /><path d="M12 2.8c2.4 2.5 3.8 5.8 3.8 9.2S14.4 18.7 12 21.2C9.6 18.7 8.2 15.4 8.2 12S9.6 5.3 12 2.8Z" /></symbol>
      <symbol id="jb-user" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-1.8a4.2 4.2 0 0 0-4.2-4.2H8.2A4.2 4.2 0 0 0 4 19.2V21" /><circle cx="12" cy="7.2" r="4" /></symbol>
      <symbol id="jb-users" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-1.8a4.2 4.2 0 0 0-4.2-4.2H6.2A4.2 4.2 0 0 0 2 19.2V21" /><circle cx="9.5" cy="7.2" r="4" /><path d="M22 21v-1.8a4.2 4.2 0 0 0-3.2-4.07M16 3.4a4.2 4.2 0 0 1 0 7.6" /></symbol>
      <symbol id="jb-book" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 3.5h5.2A4 4 0 0 1 12 7.5v13a3.2 3.2 0 0 0-3.2-2.6H2.5Z" /><path d="M21.5 3.5h-5.2A4 4 0 0 0 12 7.5v13a3.2 3.2 0 0 1 3.2-2.6h6.3Z" /></symbol>
      <symbol id="jb-shield" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21.5s7.6-3.7 7.6-9.4V5.4L12 2.5 4.4 5.4v6.7c0 5.7 7.6 9.4 7.6 9.4Z" /><path d="m8.8 11.8 2.3 2.3 4.1-4.4" /></symbol>
      <symbol id="jb-building" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2.6" width="16" height="18.8" rx="2" /><path d="M9.5 21.4v-4h5v4" /><path d="M8.4 6.6h.01M12 6.6h.01M15.6 6.6h.01M8.4 10.4h.01M12 10.4h.01M15.6 10.4h.01M8.4 14.2h.01M12 14.2h.01M15.6 14.2h.01" /></symbol>
      <symbol id="jb-cap" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 9.5 12 4.5 2 9.5l10 5 10-5Z" /><path d="M6 11.7v4.6c0 1.6 2.7 3.2 6 3.2s6-1.6 6-3.2v-4.6" /><path d="M22 9.5v5.6" /></symbol>
      <symbol id="jb-radio" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="2.4" /><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 16.2a6 6 0 0 0 0-8.4M4.9 4.9a10 10 0 0 0 0 14.2M19.1 19.1a10 10 0 0 0 0-14.2" /></symbol>
      <symbol id="jb-flame" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2.5s5.6 4.3 5.6 9.6a5.6 5.6 0 0 1-11.2 0c0-2 .9-3.6 1.9-4.8.3 1.4 1.2 2.3 2.2 2.3 1.4 0 2-1.3 1.8-3-.1-1.5-.3-3-.3-4.1Z" /></symbol>
      <symbol id="jb-coin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9.2" /><path d="M12 7v10M14.6 9.4a2.8 2.8 0 0 0-2.6-1.6c-1.5 0-2.7.9-2.7 2.2 0 2.9 5.4 1.6 5.4 4.4 0 1.3-1.2 2.2-2.7 2.2a2.9 2.9 0 0 1-2.7-1.7" /></symbol>
      <symbol id="jb-trophy" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M7 4.5h10v5a5 5 0 0 1-10 0Z" /><path d="M7 6H4.6v1.4A3.4 3.4 0 0 0 7 10.7M17 6h2.4v1.4a3.4 3.4 0 0 1-2.4 3.3" /><path d="M12 14.5V18M8.8 20.5h6.4" /></symbol>
      <symbol id="jb-mail" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2.6" y="4.6" width="18.8" height="14.8" rx="2.6" /><path d="m3.4 7 7.4 5.2a2 2 0 0 0 2.4 0L20.6 7" /></symbol>

      {/* Социалдык тармактар */}
      <symbol id="jb-ig" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.1" cy="6.9" r="1.15" fill="currentColor" stroke="none" /></symbol>
      <symbol id="jb-tg" viewBox="0 0 24 24"><path fill="currentColor" d="M21.7 4.4 3.4 11.5c-.92.35-.9 1.62.02 1.94l4.6 1.6 1.76 5.28c.25.72 1.15.9 1.63.33l2.44-2.87 4.7 3.45c.65.48 1.6.13 1.77-.67l3.1-14.6c.2-.9-.7-1.65-1.72-1.24ZM9.9 14.4l7.9-5-6.5 6.1z" /></symbol>
      <symbol id="jb-in" viewBox="0 0 24 24"><path fill="currentColor" d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3.1 9.2h3.8V21H3.1zM9.4 9.2h3.6v1.6h.05c.5-.9 1.75-1.85 3.6-1.85 3.85 0 4.55 2.4 4.55 5.5V21h-3.8v-5.35c0-1.28-.02-2.92-1.8-2.92-1.8 0-2.07 1.38-2.07 2.82V21H9.4z" /></symbol>
    </svg>
  );
}

/// Tiny helper so a caller writes <Ico id="arrow" /> instead of the full
/// <svg><use href="#jb-arrow" /></svg> forty times over.
export function Ico({ id, className, style }) {
  return (
    <svg className={className} style={style} aria-hidden="true">
      <use href={`#jb-${id}`} />
    </svg>
  );
}
