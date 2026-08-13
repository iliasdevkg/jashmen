// src/pages/OnboardingPage.jsx — Task 9: a first-launch-only intro shown
// before AuthPage, so a brand-new visitor understands what JashMen is
// before being asked to sign up. Never shown again once dismissed (App.jsx
// persists that in localStorage) — a returning user always lands straight
// on AuthPage/the app, exactly as before this existed.
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PiggyBank, BookOpen, Trophy, Gift } from 'lucide-react';
import { useI18n, LANGUAGES } from '../i18n.jsx';

const SLIDES = [
  { icon: PiggyBank, color: '#58CC02', key: 'slide1' },
  { icon: BookOpen,  color: '#1CB0F6', key: 'slide2' },
  { icon: Trophy,    color: '#FFD700', key: 'slide3' },
  { icon: Gift,      color: '#CE82FF', key: 'slide4' },
];

export default function OnboardingPage({ onDone }) {
  const { t, locale, setLocale } = useI18n();
  const [index, setIndex] = useState(0);
  const isLast = index === SLIDES.length - 1;

  const next = () => {
    if (isLast) onDone();
    else setIndex(i => i + 1);
  };

  const handleDragEnd = (_, info) => {
    if (info.offset.x < -60) next();
    else if (info.offset.x > 60 && index > 0) setIndex(i => i - 1);
  };

  return (
    <div className="fixed inset-0 flex flex-col z-50" style={{ background: '#0f172a' }}>
      {/* Language picker (top-left) + skip (top-right) */}
      <div className="flex items-center justify-between px-5 pt-5 shrink-0">
        <div className="flex gap-1.5">
          {LANGUAGES.map(l => (
            <button
              key={l.code}
              onClick={() => setLocale(l.code)}
              aria-label={l.label}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-base transition-all"
              style={locale === l.code
                ? { background: 'rgba(28,176,246,0.15)', border: '1.5px solid #1CB0F6' }
                : { background: '#1e293b', border: '1.5px solid transparent' }}
            >
              {l.flag}
            </button>
          ))}
        </div>
        {!isLast && (
          <button onClick={onDone} className="text-sm font-semibold px-2 py-1" style={{ color: '#64748b' }}>
            {t('onboarding.skip')}
          </button>
        )}
      </div>

      {/* Slide */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.15}
            onDragEnd={handleDragEnd}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="cursor-grab active:cursor-grabbing"
          >
            <motion.div
              initial={{ scale: 0.6, rotate: -8 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.05 }}
              className="mb-6 mx-auto flex items-center justify-center rounded-[32px] select-none"
              style={{
                width: 128,
                height: 128,
                background: `${SLIDES[index].color}1a`,
                border: `1.5px solid ${SLIDES[index].color}40`,
                boxShadow: `0 0 60px -8px ${SLIDES[index].color}80`,
              }}
            >
              {(() => {
                const Icon = SLIDES[index].icon;
                return <Icon size={56} color={SLIDES[index].color} strokeWidth={1.8} />;
              })()}
            </motion.div>
            <h2 className="text-2xl font-extrabold text-white mb-3">
              {t(`onboarding.${SLIDES[index].key}.title`)}
            </h2>
            <p className="text-sm leading-relaxed max-w-xs mx-auto" style={{ color: '#94a3b8' }}>
              {t(`onboarding.${SLIDES[index].key}.desc`)}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Dots + CTA */}
      <div className="px-6 pb-10 shrink-0">
        <div className="flex justify-center gap-2 mb-6">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              aria-label={`${i + 1}`}
              className="rounded-full transition-all duration-300"
              style={{
                width: i === index ? 22 : 6,
                height: 6,
                background: i === index ? '#1CB0F6' : '#334155',
              }}
            />
          ))}
        </div>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={next}
          className="w-full py-4 rounded-2xl font-bold text-white text-base"
          style={{ background: '#58CC02' }}
        >
          {isLast ? t('onboarding.getStarted') : t('onboarding.next')}
        </motion.button>
      </div>
    </div>
  );
}
