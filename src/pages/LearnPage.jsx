import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Zap, Check, Dumbbell, GraduationCap } from 'lucide-react';
import { useAuth, useContent, useBrightMode } from '../store.jsx';
import { useI18n } from '../i18n.jsx';
import { getLessonOrder, getLessonStatus, computeLiveEnergy, formatCountdown, quizCountOf } from '../utils.js';
import LessonPreviewSheet from '../components/LessonPreviewSheet.jsx';

// Path-node glyph. An admin-uploaded per-lesson icon (contentStore.js#
// addLesson) wins when it loads; otherwise `fallback` — a plain lucide icon
// standing in for the custom glossy GameStar token
// (src/components/icons/GameStar.jsx) while the node-type art direction is
// still being decided. Swap the fallback back to <GameStar/> once that's
// settled; nothing else about the node components below needs to change.
//
// A broken/404 upload silently falls back rather than leaving a torn-image
// box on the node — same treatment the module header gives its own iconUrl.
// Keyed off iconUrl so swapping to a different image re-arms the fallback.
function LessonGlyph({ size = 26, iconUrl, fallback: Fallback = Dumbbell }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [iconUrl]);

  if (iconUrl && !failed) {
    return (
      <img
        src={iconUrl}
        alt=""
        onError={() => setFailed(true)}
        className="object-contain"
        style={{ width: size, height: size }}
      />
    );
  }
  return <Fallback size={size} color="white" strokeWidth={2.5} />;
}

// ── Path geometry ────────────────────────────────────────────────────────
// Nodes sit on a fixed-width canvas (not measured/responsive) so the curve
// math stays simple and never jumps on resize; 288px comfortably fits the
// smallest supported phone (iPhone SE, 320px) inside the app's px-4 gutters.
const NODE = 72;
const R = NODE / 2;
const CANVAS_W = 288;
const CENTER_X = CANVAS_W / 2;
const AMPLITUDE = 56;
const ROW_GAP = 128;
const TOP_PAD = 16;

function nodePositions(count) {
  // The last lesson in every module is the checkpoint, rendered as a wide
  // centered "pit-stop" card rather than a node on the zig-zag — so its x
  // is pinned to the canvas center instead of following the sine wave.
  return Array.from({ length: count }, (_, i) => ({
    x: i === count - 1 ? CENTER_X : CENTER_X + AMPLITUDE * Math.sin(i * 1.4),
    y: TOP_PAD + R + i * ROW_GAP,
  }));
}

// Smooth curve through every node center (Catmull-Rom → cubic Bézier), so
// the "road" reads as one continuous line rather than straight segments.
function smoothPath(points) {
  if (points.length < 2) return '';
  let d = `M ${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? i : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2 < points.length ? i + 2 : i + 1];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
  }
  return d;
}

function sphereStyle(color, isLocked) {
  if (isLocked) {
    return {
      background: 'radial-gradient(circle at 30% 26%, #3a4459, #1b2436 62%, #10161f 100%)',
      boxShadow: 'inset 0 -6px 10px rgba(0,0,0,0.4), inset 0 3px 6px rgba(255,255,255,0.05)',
    };
  }
  return {
    background: `radial-gradient(circle at 30% 26%, color-mix(in srgb, ${color} 55%, white) 0%, ${color} 55%, color-mix(in srgb, ${color} 75%, black) 100%)`,
    boxShadow: `inset 0 -6px 10px rgba(0,0,0,0.25), inset 0 3px 7px rgba(255,255,255,0.4), 0 6px 18px -2px ${color}70`,
  };
}

function NoEnergyBanner({ resetMs, bright }) {
  const { t } = useI18n();
  const [ms, setMs] = useState(resetMs || 0);
  useEffect(() => {
    const timer = setInterval(() => setMs(m => Math.max(0, m - 1000)), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-4 mb-4 px-4 py-3 rounded-2xl flex items-center gap-3"
      style={{
        background: bright ? '#eff6ff' : '#0d1e33',
        border: bright ? '1.5px solid rgba(28,176,246,0.3)' : '1.5px solid rgba(28,176,246,0.4)',
      }}
    >
      <Zap size={18} color="#1CB0F6" fill="#1CB0F6" />
      <div>
        <p className="font-bold text-sm" style={{ color: bright ? '#0f172a' : 'white' }}>{t('learn.noEnergyTitle')}</p>
        <p className="text-xs" style={{ color: bright ? '#64748b' : '#94a3b8' }}>
          {t('learn.noEnergyDesc', { time: formatCountdown(ms) })}
        </p>
      </div>
    </motion.div>
  );
}

// Plain node: every lesson that is neither the checkpoint nor the one the
// player should tap next. Only ever renders 'completed' or 'locked' —
// 'available' is peeled off into NextLessonNode before this is reached, so
// there's no gated/pulse state to account for here.
function LessonNode({ lesson, status, moduleColor, x, y, bright, partnerLogoUrl, onOpenLesson }) {
  const isLocked    = status === 'locked';
  const isCompleted = status === 'completed';
  const tint = isCompleted ? `color-mix(in srgb, ${moduleColor} 78%, #64748b)` : moduleColor;

  const handlePress = () => {
    if (isLocked) return;
    onOpenLesson({ lesson, status, isCheckpoint: false, moduleColor, isGated: false });
  };

  const labelColor = isLocked
    ? (bright ? '#94a3b8' : '#475569')
    : (bright ? '#334155' : '#cbd5e1');

  return (
    <div className="absolute flex flex-col items-center" style={{ left: x - R, top: y - R, width: NODE }}>
      <div className="relative shrink-0" style={{ width: NODE, height: NODE }}>
        <motion.button
          whileTap={!isLocked ? { scale: 0.9 } : {}}
          onClick={handlePress}
          disabled={isLocked}
          className="absolute inset-0 rounded-full flex items-center justify-center"
          style={sphereStyle(tint, isLocked)}
          aria-label={lesson.title}
        >
        {isLocked
          ? <Lock size={26} color="#64748b" strokeWidth={2.5} />
          : <LessonGlyph iconUrl={lesson.iconUrl} />}

        {isCompleted && (
          <span
            className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center"
            style={{
              background: bright ? '#ffffff' : '#0b1220',
              boxShadow: bright ? '0 2px 6px rgba(15,23,42,0.25)' : '0 2px 6px rgba(0,0,0,0.5)',
            }}
          >
            <Check size={13} color="#58CC02" strokeWidth={3.5} />
          </span>
        )}
        </motion.button>

        {/* Bank/partner branding — "круглый значок MBANK" on the level node,
            per the manifest. Additive only: never touches the sphere/path
            styling above, just an overlay badge. */}
        {partnerLogoUrl && !isLocked && (
          <img
            src={partnerLogoUrl}
            alt=""
            className="absolute -top-1 -right-1 w-6 h-6 rounded-full object-cover"
            style={{
              border: `2px solid ${bright ? '#ffffff' : '#0b1220'}`,
              boxShadow: bright ? '0 2px 6px rgba(15,23,42,0.3)' : '0 2px 6px rgba(0,0,0,0.6)',
            }}
          />
        )}
      </div>

      <span
        className="mt-2 text-[11px] text-center font-semibold truncate"
        style={{ color: labelColor, maxWidth: NODE + 36 }}
      >
        {lesson.title}
      </span>
    </div>
  );
}

// The node the player should tap next: a bigger "glossy app-icon" squircle
// tile instead of a plain sphere, floating above the path with a slow
// bob — the path's single strongest visual anchor, same idea as a
// "start here" marker. Reuses sphereStyle for the inner gradient (only the
// shape/frame differ from LessonNode) so the two never drift out of sync.
const NEXT_SIZE = 88;
const NEXT_HALF = NEXT_SIZE / 2;

function NextLessonNode({ lesson, moduleColor, x, y, energyEmpty, bright, partnerLogoUrl, onOpenLesson }) {
  const isGated = energyEmpty;
  // Clamp so the enlarged tile can't overhang the 288px canvas at the
  // sine wave's extremes — regular nodes are narrow enough to never need this.
  const centerX = Math.min(Math.max(x, NEXT_HALF + 8), CANVAS_W - NEXT_HALF - 8);

  return (
    <div className="absolute flex flex-col items-center" style={{ left: centerX - NEXT_HALF, top: y - NEXT_HALF, width: NEXT_SIZE }}>
      <motion.div
        className="relative shrink-0"
        style={{ width: NEXT_SIZE, height: NEXT_SIZE, opacity: isGated ? 0.6 : 1 }}
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
      >
        {/* Outer bezel — the "glass tile" a phone app icon sits in. */}
        <div
          className="absolute inset-0 rounded-[24px] p-[7px]"
          style={{
            background: bright ? 'linear-gradient(155deg, #ffffff, #dbe3ee)' : 'linear-gradient(155deg, #e7ecf5, #aab6c8)',
            filter: bright
              ? 'drop-shadow(0 2px 3px rgba(15,23,42,0.18)) drop-shadow(0 10px 14px rgba(15,23,42,0.22))'
              : 'drop-shadow(0 3px 4px rgba(0,0,0,0.45)) drop-shadow(0 14px 18px rgba(0,0,0,0.5))',
          }}
        >
          <motion.button
            whileTap={{ scale: 0.93 }}
            onClick={() => onOpenLesson({ lesson, status: 'available', isCheckpoint: false, moduleColor, isGated })}
            className="relative w-full h-full rounded-[18px] flex items-center justify-center overflow-hidden"
            style={sphereStyle(moduleColor, false)}
            aria-label={lesson.title}
          >
            <LessonGlyph size={32} iconUrl={lesson.iconUrl} />
            {/* Diagonal glass sheen. */}
            <span
              className="absolute inset-0 rounded-[18px] pointer-events-none"
              style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.35), transparent 55%)' }}
            />
          </motion.button>
        </div>

        {partnerLogoUrl && (
          <img
            src={partnerLogoUrl}
            alt=""
            className="absolute -top-1.5 -right-1.5 w-7 h-7 rounded-full object-cover"
            style={{
              border: `2px solid ${bright ? '#ffffff' : '#0b1220'}`,
              boxShadow: bright ? '0 2px 6px rgba(15,23,42,0.3)' : '0 2px 6px rgba(0,0,0,0.6)',
            }}
          />
        )}
      </motion.div>

      <span
        className="mt-2 text-[12px] text-center font-bold truncate"
        style={{ color: bright ? '#0f172a' : '#f1f5f9', maxWidth: NEXT_SIZE + 40 }}
      >
        {lesson.title}
      </span>
    </div>
  );
}

// The module's final lesson: a wide "pit-stop" card rather than a node on
// the zig-zag, with a hanging badge showing how many questions it covers
// (real quizCountOf data — never a placeholder number). Always this shape
// regardless of locked/available/completed status; only the coloring and
// lock/check treatment change, mirroring how LessonNode's states work.
const CHECKPOINT_W = 232;

function CheckpointNode({ lesson, status, moduleColor, x, y, bright, onOpenLesson }) {
  const { t } = useI18n();
  const isLocked    = status === 'locked';
  const isCompleted = status === 'completed';
  const tint = isCompleted ? `color-mix(in srgb, ${moduleColor} 78%, #64748b)` : moduleColor;
  const quizCount = quizCountOf(lesson);

  const handlePress = () => {
    if (isLocked) return;
    onOpenLesson({ lesson, status, isCheckpoint: true, moduleColor, isGated: false });
  };

  return (
    <div className="absolute flex flex-col items-center" style={{ left: x - CHECKPOINT_W / 2, top: y - 34, width: CHECKPOINT_W }}>
      <motion.button
        whileTap={!isLocked ? { scale: 0.97 } : {}}
        onClick={handlePress}
        disabled={isLocked}
        className="relative w-full flex items-center gap-3 rounded-2xl px-4 py-3 text-left"
        style={{
          background: isLocked
            ? (bright ? '#e2e8f0' : '#161f30')
            : `color-mix(in srgb, ${tint} 20%, ${bright ? '#ffffff' : '#0b1220'})`,
          border: `1.5px solid ${isLocked ? (bright ? '#cbd5e1' : '#243044') : `color-mix(in srgb, ${tint} 45%, transparent)`}`,
          boxShadow: isLocked ? 'none' : `0 8px 18px -8px ${tint}90`,
        }}
        aria-label={lesson.title}
      >
        <span
          className="relative shrink-0 w-11 h-11 rounded-full flex items-center justify-center"
          style={isLocked ? { background: '#1b2436' } : sphereStyle(tint, false)}
        >
          {isLocked
            ? <Lock size={20} color="#64748b" strokeWidth={2.5} />
            : <LessonGlyph size={22} iconUrl={lesson.iconUrl} fallback={GraduationCap} />}

          {isCompleted && (
            <span
              className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center"
              style={{
                background: bright ? '#ffffff' : '#0b1220',
                boxShadow: bright ? '0 2px 6px rgba(15,23,42,0.25)' : '0 2px 6px rgba(0,0,0,0.5)',
              }}
            >
              <Check size={11} color="#58CC02" strokeWidth={3.5} />
            </span>
          )}
        </span>

        <span className="min-w-0">
          <span
            className="block text-[10px] font-extrabold uppercase tracking-widest"
            style={{ color: isLocked ? '#64748b' : tint }}
          >
            {t('lesson.previewCheckpoint')}
          </span>
          <span
            className="block text-sm font-bold truncate"
            style={{ color: isLocked ? (bright ? '#94a3b8' : '#64748b') : (bright ? '#0f172a' : '#f1f5f9') }}
          >
            {lesson.title}
          </span>
        </span>
      </motion.button>

      {!isLocked && quizCount > 0 && (
        <div className="flex flex-col items-center -mt-px">
          <span className="w-1 h-2.5 rounded-full" style={{ background: `color-mix(in srgb, ${tint} 45%, transparent)` }} />
          <span
            className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold text-white"
            style={{ background: tint, boxShadow: `0 4px 10px -3px ${tint}90` }}
          >
            {quizCount}
          </span>
        </div>
      )}
    </div>
  );
}

function ModuleSection({ module, partner, lessonOrder, completedLessons, moduleIndex, energyEmpty, bright, onOpenLesson }) {
  const { t } = useI18n();
  const completedCount = module.lessons.filter(l => completedLessons.includes(l.id)).length;
  const total = module.lessons.length;
  const pct   = total > 0 ? (completedCount / total) * 100 : 0;

  // A broken/404 admin-uploaded iconUrl should silently fall back to the
  // icon-less layout, not leave a bare browser broken-image glyph floating
  // over the card. Keyed off iconUrl itself so swapping to a different
  // (working) icon in the admin panel clears a stale error on reload.
  const [iconError, setIconError] = useState(false);
  useEffect(() => { setIconError(false); }, [module.iconUrl]);
  const showIcon = module.iconUrl && !iconError;

  const statuses = module.lessons.map(l => getLessonStatus(l.id, lessonOrder, completedLessons));
  const points   = nodePositions(module.lessons.length);
  const pathD    = smoothPath(points);
  const doneCount = statuses.filter(s => s !== 'locked').length;
  const doneFrac  = points.length > 1 ? Math.max(0, (doneCount - 1) / (points.length - 1)) : (doneCount > 0 ? 1 : 0);
  // The last row is always the checkpoint's wide card + hanging badge,
  // which reaches further down than a plain circular node would — pad the
  // canvas enough for that instead of the tighter R+16 a sphere needs.
  const canvasHeight = points.length ? points[points.length - 1].y + 76 : 0;
  const trackColor = bright ? '#e2e8f0' : '#1b2436';

  return (
    <div className="mb-10">
      <div className="sticky top-14 lg:top-6 z-10 mx-4 mb-6">
        {showIcon && (
          <div className="relative z-10 flex justify-center pointer-events-none -mb-10">
            <motion.img
              src={module.iconUrl}
              alt=""
              draggable={false}
              onError={() => setIconError(true)}
              initial={{ opacity: 0, scale: 0.5, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="w-[90px] h-[90px] object-contain select-none"
              style={{
                filter: bright
                  ? 'drop-shadow(0 2px 3px rgba(15,23,42,0.18)) drop-shadow(0 10px 14px rgba(15,23,42,0.22))'
                  : 'drop-shadow(0 3px 4px rgba(0,0,0,0.45)) drop-shadow(0 14px 18px rgba(0,0,0,0.5))',
              }}
            />
          </div>
        )}

        <div
          className={`rounded-2xl px-4 pb-4 ${showIcon ? 'pt-14' : 'pt-4'}`}
          style={{ background: module.color, boxShadow: `0 8px 20px -6px ${module.color}80` }}
        >
          <div className="mb-1">
            <p className="text-white/70 text-[11px] font-extrabold uppercase tracking-widest">
              {t('learn.moduleLabel', { n: moduleIndex + 1 })}
            </p>
            <p className="text-white font-extrabold text-xl leading-tight">{module.title}</p>
          </div>
          {partner && (
            <p className="flex items-center gap-1.5 text-white/85 text-[11px] font-semibold mb-2">
              {partner.logoUrl && <img src={partner.logoUrl} alt="" className="w-4 h-4 rounded-full object-cover" />}
              {t('learn.courseFrom', { partner: partner.name })}
            </p>
          )}
          <div className="flex items-center gap-3 mt-2">
            <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.3)' }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.7, ease: 'easeOut' }}
                className="h-full rounded-full bg-white"
              />
            </div>
            <span className="text-white font-bold text-sm shrink-0">{completedCount}/{total}</span>
          </div>
        </div>
      </div>

      <div className="relative mx-auto" style={{ width: CANVAS_W, height: canvasHeight }}>
        <svg className="absolute inset-0 overflow-visible" width={CANVAS_W} height={canvasHeight}>
          <path d={pathD} fill="none" stroke={trackColor} strokeWidth="12" strokeLinecap="round" />
          {doneFrac > 0 && (
            <path
              d={pathD} fill="none" stroke={module.color} strokeWidth="12" strokeLinecap="round"
              pathLength={100} strokeDasharray={`${doneFrac * 100} 100`}
            />
          )}
        </svg>

        {module.lessons.map((lesson, i) => {
          const isCheckpoint = i === module.lessons.length - 1;
          const status = statuses[i];

          if (isCheckpoint) {
            return (
              <CheckpointNode
                key={lesson.id}
                lesson={lesson}
                status={status}
                moduleColor={module.color}
                x={points[i].x}
                y={points[i].y}
                bright={bright}
                onOpenLesson={onOpenLesson}
              />
            );
          }

          if (status === 'available') {
            return (
              <NextLessonNode
                key={lesson.id}
                lesson={lesson}
                moduleColor={module.color}
                x={points[i].x}
                y={points[i].y}
                energyEmpty={energyEmpty}
                bright={bright}
                partnerLogoUrl={partner?.logoUrl}
                onOpenLesson={onOpenLesson}
              />
            );
          }

          return (
            <LessonNode
              key={lesson.id}
              lesson={lesson}
              status={status}
              moduleColor={module.color}
              x={points[i].x}
              y={points[i].y}
              bright={bright}
              partnerLogoUrl={partner?.logoUrl}
              onOpenLesson={onOpenLesson}
            />
          );
        })}
      </div>
    </div>
  );
}

export default function LearnPage() {
  const navigate = useNavigate();
  const content = useContent();
  const { state } = useAuth();
  const { bright } = useBrightMode();
  const completedLessons = state?.completedLessons || [];

  // Tapping a node opens this preview first — nothing navigates until the
  // player commits to an action inside the sheet.
  const [preview, setPreview] = useState(null);

  const [, tick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => tick(n => n + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const dailyFreeLessons = content?.limits?.dailyFreeLessons ?? 3;
  const { remaining: energy, resetMs } = computeLiveEnergy(state, dailyFreeLessons);
  const energyEmpty = energy === 0;

  if (!content) {
    return (
      <div className="flex items-center justify-center h-64">
        <img src="/logo.png" alt="" className="w-16 h-16 rounded-full animate-pulse" />
      </div>
    );
  }

  const lessonOrder = getLessonOrder(content.modules);
  const partners = content.partners || [];

  return (
    <div className="py-4 lg:max-w-[520px]">
      {energyEmpty && <NoEnergyBanner resetMs={resetMs} bright={bright} />}

      {content.modules.map((module, i) => (
        <ModuleSection
          key={module.id}
          module={module}
          partner={module.partnerId ? partners.find(p => p.id === module.partnerId) : null}
          lessonOrder={lessonOrder}
          completedLessons={completedLessons}
          moduleIndex={i}
          energyEmpty={energyEmpty}
          bright={bright}
          onOpenLesson={setPreview}
        />
      ))}
      <div className="h-4" />

      <AnimatePresence>
        {preview && (
          <LessonPreviewSheet
            lesson={preview.lesson}
            status={preview.status}
            isCheckpoint={preview.isCheckpoint}
            isGated={preview.isGated}
            moduleColor={preview.moduleColor}
            bright={bright}
            onClose={() => setPreview(null)}
            onStart={() => navigate(`/lesson/${preview.lesson.id}`)}
            onReview={() => navigate(`/lesson/${preview.lesson.id}?review=1`)}
            onGoShop={() => navigate('/shop')}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
