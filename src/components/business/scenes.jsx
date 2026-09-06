// src/components/business/scenes.jsx — the illustration behind each
// "Решения" tab.
//
// One drawing vocabulary, six arrangements. Every scene is built from the
// same three parts — a glass volume, a lit window field, and one accent
// mark — so switching tabs reads as the camera moving rather than as six
// unrelated pictures. The gradients and window patterns come from the page
// sprite (sprite.jsx), which is what keeps them agreeing.
//
// These are abstractions on purpose. A photograph of a bank branch, or a
// named building, would be a claim about a customer we do not have; a glass
// skyline is scenery, and scenery is allowed to be invented.
//
// The scene sits under a left-to-right scrim (business.css
// .jb-solution__media::after) that fades it into the copy, so detail on the
// left half is wasted — everything meaningful is drawn right of centre.

const VB = { w: 620, h: 420 };

/// A glass volume with a field of lit windows inset from its edges.
function Tower({ x, y, w, h, pattern = 'jbWindows', grad = 'jbGlass', r = 4, dim = 1 }) {
  return (
    <g opacity={dim}>
      <rect x={x} y={y} width={w} height={h} rx={r} fill={`url(#${grad})`} />
      <rect
        x={x + 7}
        y={y + 10}
        width={Math.max(0, w - 14)}
        height={Math.max(0, h - 20)}
        fill={`url(#${pattern})`}
      />
      {/* The lit top bevel — without it a tower is a rectangle. */}
      <rect x={x} y={y} width={w} height={1.5} rx={0.75} fill="#a8d0ff" opacity="0.35" />
    </g>
  );
}

/// The soft pool every scene is lit by, so no arrangement sits on flat black.
function Glow({ cx, cy, r = 200, color = 'rgba(70,120,255,0.30)' }) {
  return (
    <radialGradient id={`jbGlow-${cx}-${cy}`} cx="50%" cy="50%" r="50%">
      <stop offset="0%" stopColor={color} />
      <stop offset="100%" stopColor="rgba(70,120,255,0)" />
    </radialGradient>
  );
}

function Scene({ id, children, glow = { cx: 400, cy: 190, r: 210 } }) {
  const gid = `jbSceneGlow-${id}`;
  return (
    <svg
      className="jb-scene jb-fade-in"
      viewBox={`0 0 ${VB.w} ${VB.h}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={gid} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(80,130,255,0.34)" />
          <stop offset="100%" stopColor="rgba(80,130,255,0)" />
        </radialGradient>
      </defs>
      <circle cx={glow.cx} cy={glow.cy} r={glow.r} fill={`url(#${gid})`} />
      {children}
      {/* The ground the volumes stand on, fading down into the card. */}
      <rect x="0" y={VB.h - 46} width={VB.w} height="46" fill="#050a18" opacity="0.55" />
    </svg>
  );
}

// ── Банктар — эң бийик айнек мунаралар ────────────────────────────────
function Banks() {
  return (
    <Scene id="banks">
      <Tower x={252} y={196} w={62} h={228} grad="jbGlass2" pattern="jbWindows2" dim={0.7} />
      <Tower x={330} y={92} w={86} h={332} />
      <Tower x={432} y={148} w={72} h={276} grad="jbGlass2" />
      <Tower x={520} y={214} w={64} h={210} grad="jbGlass2" pattern="jbWindows2" dim={0.78} />
      {/* The crown light on the tallest volume. */}
      <circle cx={373} cy={80} r={4} fill="#8fb4ff" />
      <path d="M373 84v8" stroke="#8fb4ff" strokeWidth="1.5" opacity="0.5" />
    </Scene>
  );
}

// ── Фин. уюмдар — мунаралар + калкыган төлөм картасы ──────────────────
function Fintech() {
  return (
    <Scene id="fintech" glow={{ cx: 420, cy: 210, r: 200 }}>
      <Tower x={288} y={210} w={58} h={214} grad="jbGlass2" pattern="jbWindows2" dim={0.66} />
      <Tower x={362} y={158} w={74} h={266} />
      <Tower x={452} y={200} w={62} h={224} grad="jbGlass2" dim={0.8} />
      <g transform="translate(392 96) rotate(-9)">
        <rect x="0" y="0" width="152" height="94" rx="13" fill="url(#jbGlass)" stroke="rgba(168,208,255,0.34)" />
        <rect x="0" y="0" width="152" height="94" rx="13" fill="rgba(91,140,255,0.16)" />
        <rect x="16" y="24" width="34" height="24" rx="5" fill="#a8d0ff" opacity="0.42" />
        <rect x="16" y="62" width="76" height="6" rx="3" fill="#a8d0ff" opacity="0.3" />
        <rect x="102" y="60" width="34" height="10" rx="5" fill="#8fb4ff" opacity="0.4" />
      </g>
    </Scene>
  );
}

// ── Университеттер — кампус корпусу жана бүтүрүү шляпасы ──────────────
function Universities() {
  return (
    <Scene id="universities" glow={{ cx: 400, cy: 220, r: 195 }}>
      <Tower x={268} y={252} w={70} h={172} grad="jbGlass2" pattern="jbWindows2" dim={0.72} />
      <Tower x={352} y={214} w={132} h={210} r={6} />
      <Tower x={498} y={262} w={68} h={162} grad="jbGlass2" pattern="jbWindows2" dim={0.72} />
      {/* The portico that turns a block into a faculty building. */}
      <path d="M352 214h132l-66-38z" fill="url(#jbGlass2)" stroke="rgba(168,208,255,0.3)" />
      {[366, 392, 418, 444, 470].map(x => (
        <rect key={x} x={x} y="352" width="8" height="72" rx="2" fill="#0a1230" opacity="0.75" />
      ))}
      <g transform="translate(376 92)" opacity="0.9">
        <path d="M66 0 132 30 66 60 0 30Z" fill="url(#jbGlass)" stroke="rgba(168,208,255,0.4)" />
        <path d="M24 40v26c0 9 19 17 42 17s42-8 42-17V40" fill="none" stroke="rgba(168,208,255,0.55)" strokeWidth="3" />
        <path d="M132 30v34" stroke="rgba(168,208,255,0.55)" strokeWidth="3" strokeLinecap="round" />
      </g>
    </Scene>
  );
}

// ── Медиа — таратуу мунарасы жана толкундар ───────────────────────────
function Media() {
  return (
    <Scene id="media" glow={{ cx: 424, cy: 172, r: 200 }}>
      <Tower x={276} y={246} w={62} h={178} grad="jbGlass2" pattern="jbWindows2" dim={0.62} />
      <Tower x={492} y={224} w={70} h={200} grad="jbGlass2" pattern="jbWindows2" dim={0.7} />
      <path d="M392 424 414 148h12l22 276z" fill="url(#jbGlass)" stroke="rgba(168,208,255,0.3)" />
      {[210, 262, 314, 366].map(y => (
        <path key={y} d={`M${404 - (y - 200) * 0.09} ${y}h${32 + (y - 200) * 0.18}`} stroke="#a8d0ff" strokeWidth="2" opacity="0.24" />
      ))}
      <circle cx={420} cy={140} r={7} fill="#8fb4ff" />
      {[34, 62, 92].map((r, i) => (
        <path
          key={r}
          d={`M${420 - r} 140a${r} ${r} 0 0 1 ${r * 2} 0`}
          fill="none"
          stroke="#8fb4ff"
          strokeWidth="2"
          strokeLinecap="round"
          opacity={0.44 - i * 0.12}
        />
      ))}
    </Scene>
  );
}

// ── Корпорациялар — кызматкерлер отурган кеңири блок ──────────────────
function Corporate() {
  return (
    <Scene id="corporate" glow={{ cx: 412, cy: 216, r: 200 }}>
      <Tower x={258} y={230} w={58} h={194} grad="jbGlass2" pattern="jbWindows2" dim={0.6} />
      <Tower x={330} y={166} w={168} h={258} r={6} />
      <Tower x={512} y={244} w={62} h={180} grad="jbGlass2" pattern="jbWindows2" dim={0.68} />
      {/* Three lit floors — the ones the programme actually runs on. */}
      {[212, 268, 324].map((y, i) => (
        <rect key={y} x={340} y={y} width={148} height={16} rx={3} fill="#a8d0ff" opacity={0.3 - i * 0.06} />
      ))}
      <g transform="translate(430 92)" opacity="0.92">
        <circle cx="0" cy="0" r="34" fill="url(#jbGlass)" stroke="rgba(168,208,255,0.38)" />
        <circle cx="0" cy="-6" r="9" fill="#a8d0ff" opacity="0.6" />
        <path d="M-15 14a15 15 0 0 1 30 0" fill="#a8d0ff" opacity="0.5" />
      </g>
    </Scene>
  );
}

// ── NGO / мамлекеттик программалар — тегерек жана жапыз корпустар ─────
function Ngo() {
  return (
    <Scene id="ngo" glow={{ cx: 408, cy: 214, r: 195 }}>
      <Tower x={262} y={276} w={72} h={148} grad="jbGlass2" pattern="jbWindows2" dim={0.62} />
      <Tower x={348} y={248} w={104} h={176} r={6} />
      <Tower x={466} y={286} w={92} h={138} grad="jbGlass2" pattern="jbWindows2" dim={0.72} />
      <g transform="translate(400 138)">
        <circle cx="0" cy="0" r="62" fill="none" stroke="rgba(168,208,255,0.34)" strokeWidth="2" />
        <circle cx="0" cy="0" r="44" fill="url(#jbGlass)" stroke="rgba(168,208,255,0.4)" />
        <path
          d="M0 22c-14-9-24-18-24-28a12 12 0 0 1 24-6 12 12 0 0 1 24 6c0 10-10 19-24 28Z"
          fill="#a8d0ff"
          opacity="0.55"
        />
      </g>
    </Scene>
  );
}

const SCENES = {
  banks: Banks,
  fintech: Fintech,
  universities: Universities,
  media: Media,
  corporate: Corporate,
  ngo: Ngo,
};

/// Renders the scene for `id`; falls back to the banks skyline so an
/// unrecognised tab shows the design rather than an empty panel.
export default function SolutionScene({ id }) {
  const Cmp = SCENES[id] || Banks;
  // `key` forces a remount so the fade-in animation replays on every tab
  // change — without it the panel swaps content with no transition and the
  // switch reads as a glitch.
  return <Cmp key={id} />;
}
