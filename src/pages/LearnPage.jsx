import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Zap, Check, Dumbbell, GraduationCap } from 'lucide-react';
import { useAuth, useContent, useBrightMode } from '../store.jsx';
import { useI18n } from '../i18n.jsx';
import { getLessonOrder, getLessonStatus, computeLiveEnergy, formatCountdown } from '../utils.js';
import LessonPreviewSheet from '../components/LessonPreviewSheet.jsx';

// Placeholder path-node glyphs — plain lucide icons standing in for the
// custom glossy GameStar/GameCap tokens (src/components/icons/) while the
// node-type art direction is still being decided. Swap the two lines below
// back to <GameStar/>/<GameCap/> once that's settled; nothing else about
// the checkpoint-detection or preview-sheet wiring needs to change.
function NodeIcon({ isCheckpoint, size = 26 }) {
  const Icon = isCheckpoint ? GraduationCap : Dumbbell;
  return <Icon size={size} color="white" strokeWidth={2.5} />;
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
  return Array.from({ length: count }, (_, i) => ({
    x: CENTER_X + AMPLITUDE * Math.sin(i * 1.4),
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

function LessonNode({ lesson, status, moduleColor, isCheckpoint, x, y, energyEmpty, bright, partnerLogoUrl, onOpenLesson }) {
  const isLocked    = status === 'locked';
  const isCompleted = status === 'completed';
  const isAvailable = status === 'available';
  const isGated     = isAvailable && energyEmpty;
  const tint = isCompleted ? `color-mix(in srgb, ${moduleColor} 78%, #64748b)` : moduleColor;

  const handlePress = () => {
    if (isLocked) return;
    onOpenLesson({ lesson, status, isCheckpoint, moduleColor, isGated });
  };

  const labelColor = isLocked
    ? (bright ? '#94a3b8' : '#475569')
    : (bright ? '#334155' : '#cbd5e1');

  return (
    <div className="absolute flex flex-col items-center" style={{ left: x - R, top: y - R, width: NODE }}>
      <div className="relative shrink-0" style={{ width: NODE, height: NODE }}>
        {isAvailable && !isGated && (
          <span
            className="pulse-ring absolute rounded-full pointer-events-none"
            style={{ inset: -4, '--pulse-color': `${moduleColor}80` }}
          />
        )}
        <motion.button
          whileTap={!isLocked ? { scale: 0.9 } : {}}
          onClick={handlePress}
          disabled={isLocked}
          className="absolute inset-0 rounded-full flex items-center justify-center"
          style={{ opacity: isGated ? 0.6 : 1, ...sphereStyle(tint, isLocked) }}
          aria-label={lesson.title}
        >
        {isLocked
          ? <Lock size={26} color="#64748b" strokeWidth={2.5} />
          : <NodeIcon isCheckpoint={isCheckpoint} />}

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

      {/* Every node shows its own title underneath — the floating
          "start here" callout bubble was removed; this is now the only
          label, so it always renders (previously suppressed for the
          available node, which relied on the bubble for its title). */}
      <span
        className="mt-2 text-[11px] text-center font-semibold truncate"
        style={{ color: labelColor, maxWidth: NODE + 36 }}
      >
        {lesson.title}
      </span>
    </div>
  );
}

function ModuleSection({ module, partner, lessonOrder, completedLessons, moduleIndex, energyEmpty, bright, onOpenLesson }) {
  const { t } = useI18n();
  const completedCount = module.lessons.filter(l => completedLessons.includes(l.id)).length;
  const total = module.lessons.length;
  const pct   = total > 0 ? (completedCount / total) * 100 : 0;

  const statuses = module.lessons.map(l => getLessonStatus(l.id, lessonOrder, completedLessons));
  const points   = nodePositions(module.lessons.length);
  const pathD    = smoothPath(points);
  const doneCount = statuses.filter(s => s !== 'locked').length;
  const doneFrac  = points.length > 1 ? Math.max(0, (doneCount - 1) / (points.length - 1)) : (doneCount > 0 ? 1 : 0);
  const canvasHeight = points.length ? points[points.length - 1].y + R + 16 : 0;
  const trackColor = bright ? '#e2e8f0' : '#1b2436';

  return (
    <div className="mb-10">
      <div
        className="sticky top-14 lg:top-6 z-10 mx-4 rounded-2xl p-4 mb-6"
        style={{ background: module.color, boxShadow: `0 8px 20px -6px ${module.color}80` }}
      >
        <p className="text-white/70 text-[11px] font-extrabold uppercase tracking-widest">
          {t('learn.moduleLabel', { n: moduleIndex + 1 })}
        </p>
        <p className="text-white font-extrabold text-xl leading-tight">{module.title}</p>
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

        {module.lessons.map((lesson, i) => (
          <LessonNode
            key={lesson.id}
            lesson={lesson}
            status={statuses[i]}
            moduleColor={module.color}
            isCheckpoint={i === module.lessons.length - 1}
            x={points[i].x}
            y={points[i].y}
            energyEmpty={energyEmpty}
            bright={bright}
            partnerLogoUrl={partner?.logoUrl}
            onOpenLesson={onOpenLesson}
          />
        ))}
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
