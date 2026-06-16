import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock, Star, Heart } from 'lucide-react';
import { useAuth, useContent, useBrightMode } from '../store.jsx';
import { getLessonOrder, getLessonStatus, computeLiveHearts, formatCountdown } from '../utils.js';

function NoHeartsBanner({ nextRefillMs, bright }) {
  const [ms, setMs] = useState(nextRefillMs || 0);
  useEffect(() => {
    const t = setInterval(() => setMs(m => Math.max(0, m - 1000)), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-4 mb-4 px-4 py-3 rounded-2xl flex items-center gap-3"
      style={{
        background: bright ? '#fef2f2' : '#2d1515',
        border: bright ? '1.5px solid rgba(239,68,68,0.3)' : '1.5px solid rgba(239,68,68,0.4)',
      }}
    >
      <Heart size={18} color="#ef4444" fill="#ef4444" />
      <div>
        <p className="font-bold text-sm" style={{ color: bright ? '#0f172a' : 'white' }}>Жашоолор бүттү!</p>
        <p className="text-xs" style={{ color: bright ? '#64748b' : '#94a3b8' }}>
          Кийинкиси <span className="font-semibold" style={{ color: bright ? '#0f172a' : 'white' }}>{formatCountdown(ms)}</span> ден кийин
        </p>
      </div>
    </motion.div>
  );
}

function LessonNode({ lesson, status, moduleColor, index, heartsEmpty, bright }) {
  const navigate = useNavigate();
  const isLocked    = status === 'locked';
  const isCompleted = status === 'completed';
  const isAvailable = status === 'available';
  const isGated     = isAvailable && heartsEmpty;

  const offsets = [0, 48, 72, 48, 0, -48, -72, -48];
  const shift   = offsets[index % offsets.length];

  const handlePress = () => {
    if (isLocked) return;
    navigate(`/lesson/${lesson.id}${isCompleted ? '?review=1' : ''}`);
  };

  const nodeStyle = isLocked
    ? {
        background: bright ? '#e2e8f0' : '#111827',
        border: bright ? '2.5px solid #cbd5e1' : '2.5px solid #1f2937',
        boxShadow: 'none',
      }
    : {
        background: bright
          ? `linear-gradient(145deg, #ffffff, #f1f5f9)`
          : `linear-gradient(145deg, #1a3050, #0f1e38)`,
        border: `2.5px solid ${moduleColor}50`,
        boxShadow: isAvailable && !isGated
          ? `0 0 0 6px ${moduleColor}18, 0 6px 24px ${moduleColor}30`
          : bright ? `0 4px 14px rgba(0,0,0,0.1)` : `0 4px 14px rgba(0,0,0,0.5)`,
      };

  const iconColor = isLocked || isGated ? (bright ? '#94a3b8' : '#374151') : moduleColor;

  return (
    <div className="flex flex-col items-center" style={{ marginLeft: `${shift}px` }}>
      <motion.button
        whileTap={!isLocked ? { scale: 0.9 } : {}}
        onClick={handlePress}
        disabled={isLocked}
        className={`w-[72px] h-[72px] rounded-full flex items-center justify-center ${isAvailable && !isGated ? 'pulse-ring' : ''}`}
        style={nodeStyle}
        aria-label={lesson.title}
      >
        {isLocked
          ? <Lock size={26} color={bright ? '#94a3b8' : '#374151'} strokeWidth={2.5} />
          : <Star size={28} color={iconColor} fill={iconColor} />
        }
      </motion.button>

      <span
        className="mt-2 text-xs text-center font-medium leading-tight"
        style={{
          color: isLocked
            ? (bright ? '#94a3b8' : '#374151')
            : isCompleted
            ? '#64748b'
            : (bright ? '#475569' : '#94a3b8'),
          maxWidth: '96px',
        }}
      >
        {lesson.title}
      </span>
    </div>
  );
}

function ModuleSection({ module, lessonOrder, completedLessons, moduleIndex, heartsEmpty, bright }) {
  const completedCount = module.lessons.filter(l => completedLessons.includes(l.id)).length;
  const total = module.lessons.length;
  const pct   = total > 0 ? (completedCount / total) * 100 : 0;

  return (
    <div className="mb-8">
      <div className="mx-4 rounded-2xl p-4 mb-6" style={{ background: module.color }}>
        <p className="text-white/70 text-[11px] font-extrabold uppercase tracking-widest mb-1">
          {moduleIndex + 1}-БӨЛҮМ
        </p>
        <p className="text-white font-extrabold text-xl leading-tight mb-3">{module.title}</p>
        <div className="flex items-center gap-3">
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

      <div className="flex flex-col items-center gap-2 px-4">
        {module.lessons.map((lesson, i) => {
          const status = getLessonStatus(lesson.id, lessonOrder, completedLessons);
          return (
            <div key={lesson.id} className="flex flex-col items-center w-full">
              <LessonNode
                lesson={lesson}
                status={status}
                moduleColor={module.color}
                index={i}
                heartsEmpty={heartsEmpty}
                bright={bright}
              />
              {i < module.lessons.length - 1 && (
                <div
                  className="mt-1 w-0.5 rounded-full"
                  style={{ height: '16px', background: `${module.color}20` }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function LearnPage() {
  const content = useContent();
  const { state } = useAuth();
  const { bright } = useBrightMode();
  const completedLessons = state?.completedLessons || [];

  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const { hearts, nextRefillMs } = computeLiveHearts(state);
  const heartsEmpty = hearts === 0;

  if (!content) {
    return (
      <div className="flex items-center justify-center h-64">
        <img src="/logo.png" alt="" className="w-16 h-16 rounded-full animate-pulse" />
      </div>
    );
  }

  const lessonOrder = getLessonOrder(content.modules);

  return (
    <div className="py-4 lg:max-w-[520px]">
      {heartsEmpty && <NoHeartsBanner nextRefillMs={nextRefillMs} bright={bright} />}

      {content.modules.map((module, i) => (
        <ModuleSection
          key={module.id}
          module={module}
          lessonOrder={lessonOrder}
          completedLessons={completedLessons}
          moduleIndex={i}
          heartsEmpty={heartsEmpty}
          bright={bright}
        />
      ))}
      <div className="h-4" />
    </div>
  );
}
