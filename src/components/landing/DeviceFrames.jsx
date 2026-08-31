// src/components/landing/DeviceFrames.jsx — the two chassis.
//
// Body only: a titanium iPhone shell (adapted from the simulator CSS, scaled
// to landing size) and an aluminium laptop. Whatever is passed as children
// renders inside the glass. Keeping the hardware here and the software in
// LandingShowcase means the screens can change without anyone touching a
// bezel radius again.
//
// Deliberately not photo-realistic to the last screw: at 860px wide a real
// device photo would be a 500kb asset that goes stale with the next
// hardware refresh. These are recognisable, weigh nothing, and stay sharp
// on any display.
import { C } from './primitives.jsx';

const TI = {
  light: '#c9c2b8',
  mid: '#8d8880',
  dark: '#3d3a37',
  deep: '#5f5a54',
};

// ── iPhone ────────────────────────────────────────────────────────────────
//
// Proportions come straight from the simulator: a 432×904 body with a 68px
// corner, 3px rail, 12px bezel and a 126×36 island. Everything below is that
// set multiplied by `scale`, so the whole handset resizes as one piece
// instead of drifting apart at different sizes.
export function IPhoneFrame({ children, width = 232, className = '', style }) {
  const k = width / 432;
  const px = (n) => `${(n * k).toFixed(2)}px`;

  const railStyle = {
    position: 'absolute',
    background: `linear-gradient(90deg, ${TI.dark}, ${TI.mid}, ${TI.deep})`,
  };

  return (
    <div
      className={`relative shrink-0 ${className}`}
      style={{ width: px(432), height: px(904), ...style }}
    >
      {/* Side buttons */}
      <span style={{ ...railStyle, left: px(-4), top: px(168), width: px(5), height: px(34), borderRadius: `${px(3)} 0 0 ${px(3)}` }} />
      <span style={{ ...railStyle, left: px(-4), top: px(232), width: px(5), height: px(64), borderRadius: `${px(3)} 0 0 ${px(3)}` }} />
      <span style={{ ...railStyle, left: px(-4), top: px(310), width: px(5), height: px(64), borderRadius: `${px(3)} 0 0 ${px(3)}` }} />
      <span style={{ ...railStyle, right: px(-4), top: px(262), width: px(5), height: px(96), borderRadius: `0 ${px(3)} ${px(3)} 0` }} />
      <span style={{ ...railStyle, right: px(-4), top: px(400), width: px(5), height: px(44), borderRadius: `0 ${px(3)} ${px(3)} 0`, background: 'linear-gradient(90deg,#2a2a2a,#6f6a63,#1c1c1c)' }} />

      {/* Titanium rail */}
      <div
        className="absolute inset-0"
        style={{
          borderRadius: px(68),
          padding: px(3),
          background: `linear-gradient(145deg, ${TI.light} 0%, ${TI.mid} 18%, ${TI.dark} 42%, ${TI.deep} 62%, ${TI.light} 82%, ${TI.mid} 100%)`,
          boxShadow: `0 0 0 1px rgba(255,255,255,.14), 0 ${px(45)} ${px(90)} ${px(-25)} rgba(0,0,0,.9)`,
        }}
      >
        <div
          className="absolute"
          style={{
            inset: px(3),
            borderRadius: px(65),
            background: 'linear-gradient(160deg,#4a4642,#2c2a27 40%,#3f3b36 70%,#1e1c1a)',
          }}
        >
          {/* Bezel */}
          <div
            className="absolute overflow-hidden"
            style={{
              inset: px(12),
              borderRadius: px(54),
              background: '#000',
              boxShadow: `inset 0 0 0 ${px(2)} #0c0c0c`,
            }}
          >
            <div className="absolute inset-0 overflow-hidden" style={{ borderRadius: px(52) }}>
              {children}

              {/* Dynamic Island */}
              <div
                className="absolute left-1/2 -translate-x-1/2 flex items-center justify-end"
                style={{
                  top: px(13), width: px(126), height: px(36),
                  background: '#000', borderRadius: px(22), zIndex: 20,
                  paddingRight: px(16),
                }}
              >
                <span
                  style={{
                    width: px(11), height: px(11), borderRadius: '50%',
                    background: 'radial-gradient(circle at 35% 35%,#1c2740,#000 70%)',
                  }}
                />
              </div>

              {/* Home indicator */}
              <span
                className="absolute left-1/2 -translate-x-1/2"
                style={{ bottom: px(9), width: px(140), height: px(5), borderRadius: px(3), background: '#fff', opacity: 0.85, zIndex: 20 }}
              />

              {/* Glass */}
              <span
                className="absolute inset-0 pointer-events-none"
                style={{
                  zIndex: 30,
                  background: 'linear-gradient(115deg,rgba(255,255,255,.13) 0%,rgba(255,255,255,.03) 22%,transparent 45%)',
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Laptop ────────────────────────────────────────────────────────────────
//
// A 16:10 lid over a hinge lip. The base is drawn with a clip-path trapezoid
// rather than a border trick so the taper reads correctly at any width.
export function MacBookFrame({ children, className = '', style }) {
  return (
    <div className={`relative ${className}`} style={style}>
      {/* Lid */}
      <div
        className="relative"
        style={{
          borderRadius: '14px',
          padding: '10px 10px 14px',
          background: 'linear-gradient(150deg,#d8d6d2 0%,#a8a5a0 22%,#6f6c68 50%,#94918c 74%,#cfccc7 100%)',
          boxShadow: '0 0 0 1px rgba(255,255,255,.18), 0 40px 80px -30px rgba(0,0,0,.85)',
        }}
      >
        <div
          className="relative overflow-hidden"
          style={{ borderRadius: '6px', background: '#000', boxShadow: 'inset 0 0 0 1.5px #0b0b0d' }}
        >
          <div className="relative" style={{ aspectRatio: '16 / 10' }}>
            {children}
          </div>

          <span
            className="absolute inset-0 pointer-events-none"
            style={{
              zIndex: 30,
              background: 'linear-gradient(112deg,rgba(255,255,255,.10) 0%,rgba(255,255,255,.02) 26%,transparent 48%)',
            }}
          />
        </div>

        <div
          className="mx-auto mt-[7px]"
          style={{ width: '64px', height: '3px', borderRadius: '2px', background: 'rgba(0,0,0,.35)' }}
        />
      </div>

      {/* Hinge lip */}
      <div
        className="mx-auto"
        style={{
          width: '112%',
          height: '13px',
          marginLeft: '-6%',
          background: 'linear-gradient(180deg,#b9b6b1,#87847f 55%,#5d5a56)',
          clipPath: 'polygon(0 0, 100% 0, 97.5% 100%, 2.5% 100%)',
          boxShadow: '0 10px 22px -8px rgba(0,0,0,.7)',
        }}
      >
        <div
          className="mx-auto"
          style={{ width: '16%', height: '5px', borderRadius: '0 0 7px 7px', background: 'rgba(0,0,0,.32)' }}
        />
      </div>
    </div>
  );
}

// The mint disc that hangs off the laptop's left edge. It used to be a square
// rotated 45 degrees; on a page whose every other corner is rounded, that
// diamond was the one remaining point. Hidden whenever the counter behind it
// is absent — a badge reading "0" is worse than none.
export function DiamondBadge({ value, label, formatted }) {
  if (value == null || !label) return null;
  return (
    <div
      className="w-[104px] h-[104px] sm:w-[132px] sm:h-[132px] rounded-full grid place-items-center"
      style={{
        background: C.mint,
        boxShadow: '0 24px 55px -20px rgba(36,230,164,0.7), inset 0 2px 0 rgba(255,255,255,0.4)',
      }}
    >
      <span className="flex flex-col items-center px-4 text-center" style={{ color: C.ink }}>
        <span className="lp-display text-[1.6rem] sm:text-[2.2rem] leading-none tabular-nums">{formatted}</span>
        <span className="mt-1 text-[8.5px] sm:text-[9.5px] font-semibold font-body leading-tight">
          {label}
        </span>
      </span>
    </div>
  );
}
