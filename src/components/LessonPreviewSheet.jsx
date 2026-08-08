// Bottom sheet that opens when a path node is tapped, before anything
// navigates — shows what the lesson actually is (type chip, title,
// question count, potential reward) and lets the player commit to one
// truthful action: start it fresh, review it again if it's already done,
// or go buy energy if today's free lessons are used up. Exactly one
// primary CTA per state — never a decorative second button that dead-ends.
import { motion } from 'framer-motion';
import { X, Dumbbell, GraduationCap } from 'lucide-react';
import { useI18n } from '../i18n.jsx';
import { quizCountOf, maxLessonXp } from '../utils.js';

// Same placeholder-icon note as LearnPage.jsx's NodeIcon — plain lucide
// glyphs standing in for the custom GameStar/GameCap tokens (src/components/
// icons/) while the node-type art direction is still being decided.

export default function LessonPreviewSheet({ lesson, status, isCheckpoint, isGated, moduleColor, onStart, onReview, onGoShop, onClose, bright }) {
  const { t } = useI18n();
  if (!lesson) return null;

  const isCompleted = status === 'completed';
  const quizCount = quizCountOf(lesson);
  const maxXp = maxLessonXp(lesson);

  // Same surface/border tokens as every other dark-mode card+dismiss-button
  // pair in this app (ShopPage's RedeemedCodeModal, LessonPage's
  // ResultScreen): #1e293b panel, #334155 for anything that needs to sit
  // on top of it with contrast.
  const sheetBg = bright ? '#ffffff' : '#1e293b';
  const textPri = bright ? '#0f172a' : 'white';
  const textMut = bright ? '#64748b' : '#94a3b8';
  const pillBg  = bright ? '#f1f5f9' : 'rgba(255,255,255,0.06)';
  const closeBg = bright ? '#f1f5f9' : '#334155';

  const description = isCompleted
    ? t('lesson.previewCompletedDesc')
    : isGated
    ? t('lesson.previewGatedDesc')
    : t('lesson.previewAvailableDesc', { n: quizCount, xp: maxXp });

  const ctaLabel = isCompleted ? t('lesson.previewReview') : isGated ? t('lesson.goToShop') : t('lesson.previewStart');
  const handleCta = isCompleted ? onReview : isGated ? onGoShop : onStart;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 340, damping: 32 }}
        onClick={e => e.stopPropagation()}
        className="relative w-full max-w-sm rounded-t-[28px] sm:rounded-[28px] sm:mb-6 px-6 pt-3"
        style={{
          background: sheetBg,
          boxShadow: '0 -12px 40px rgba(0,0,0,0.35)',
          paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))',
        }}
      >
        <div className="flex justify-center mb-4">
          <span className="w-10 h-1.5 rounded-full" style={{ background: bright ? '#e2e8f0' : 'rgba(255,255,255,0.15)' }} />
        </div>

        <button
          onClick={onClose}
          aria-label={t('common.close')}
          className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center"
          style={{ background: closeBg }}
        >
          <X size={15} color={textMut} />
        </button>

        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: moduleColor }}>
            {isCheckpoint ? <GraduationCap size={18} color="white" strokeWidth={2.5} /> : <Dumbbell size={18} color="white" strokeWidth={2.5} />}
          </div>
          <span className="font-extrabold text-[11px] uppercase tracking-widest" style={{ color: moduleColor }}>
            {isCheckpoint ? t('lesson.previewCheckpoint') : t('lesson.previewLesson')}
          </span>
        </div>

        <h3 className="font-extrabold text-xl leading-snug mb-2" style={{ color: textPri }}>{lesson.title}</h3>
        <p className="text-sm leading-relaxed mb-5" style={{ color: textMut }}>{description}</p>

        <div className="flex items-center gap-2 mb-6">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-lg" style={{ background: pillBg, color: textMut }}>
            {t('lesson.previewQuestions', { n: quizCount })}
          </span>
          {isCompleted ? (
            <span
              className="text-xs font-bold px-2.5 py-1 rounded-lg flex items-center gap-1"
              style={{ background: bright ? '#f0fdf4' : '#16301d', color: '#58CC02' }}
            >
              ✓ {t('lesson.previewCompletedBadge')}
            </span>
          ) : isGated ? (
            <span
              className="text-xs font-bold px-2.5 py-1 rounded-lg flex items-center gap-1"
              style={{ background: bright ? '#fef2f2' : '#2d1515', color: '#FF4B4B' }}
            >
              ⚡ {t('lesson.previewNoEnergyBadge')}
            </span>
          ) : (
            <span
              className="text-xs font-bold px-2.5 py-1 rounded-lg"
              style={{ background: bright ? '#fffbeb' : 'rgba(255,215,0,0.12)', color: bright ? '#B45309' : '#FFD700' }}
            >
              {t('lesson.previewXpUpTo', { xp: maxXp })}
            </span>
          )}
        </div>

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleCta}
          className="w-full py-4 rounded-2xl font-bold text-white text-base"
          style={{ background: isGated ? '#1CB0F6' : moduleColor }}
        >
          {ctaLabel}
        </motion.button>
      </motion.div>
    </motion.div>
  );
}
