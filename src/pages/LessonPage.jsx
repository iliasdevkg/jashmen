import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Star, ShoppingBag, PlayCircle, Share2, Award, Zap, Trophy, CheckCircle2, Coins, Wallet } from 'lucide-react';
import { useAuth, useContent, useBrightMode } from '../store.jsx';
import { useI18n, localizedText } from '../i18n.jsx';
import { computeLiveEnergy, formatCountdown, checkNewAchievements, cardsOf } from '../utils.js';
import { generateShareCardBlob, shareOrDownload } from '../shareCard.js';
import * as api from '../api.js';

const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E'];
const ENERGY_ERROR_HINT = 'акысыз сабактарың бүттү';

function playSound(type) {
  try {
    const AudioCtx = window.AudioContext || (/** @type {any} */ (window)).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (type === 'correct') {
      [[523.25, 0], [783.99, 0.14]].forEach(([freq, t]) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.frequency.value = freq;
        g.gain.setValueAtTime(0.25, ctx.currentTime + t);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.35);
        o.start(ctx.currentTime + t);
        o.stop(ctx.currentTime + t + 0.35);
      });
    } else if (type === 'wrong') {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(220, ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(130, ctx.currentTime + 0.28);
      o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.18, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.32);
      o.start(); o.stop(ctx.currentTime + 0.32);
    } else if (type === 'complete') {
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.frequency.value = freq;
        const t = i * 0.11;
        g.gain.setValueAtTime(0.22, ctx.currentTime + t);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.4);
        o.start(ctx.currentTime + t);
        o.stop(ctx.currentTime + t + 0.4);
      });
    }
  } catch (_) {}
}

function findLesson(modules, id) {
  for (const m of (modules || [])) {
    for (const l of m.lessons) {
      if (l.id === id) return { lesson: l, module: m };
    }
  }
  return null;
}

// ── No energy ────────────────────────────────────────────────────────────────
function NoEnergyScreen({ onBack, onShop, resetMs, bright }) {
  const { t } = useI18n();
  const [ms, setMs] = useState(resetMs || 0);
  useEffect(() => {
    const timer = setInterval(() => setMs(m => Math.max(0, m - 1000)), 1000);
    return () => clearInterval(timer);
  }, []);
  const textPrimary = bright ? '#0f172a' : 'white';
  const textMuted   = bright ? '#64748b' : '#94a3b8';
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center min-h-[calc(100dvh-64px)] px-6 text-center"
    >
      <motion.div
        initial={{ scale: 0.5 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 280, damping: 22 }}
        className="mb-4"
      ><Zap size={72} color="#1CB0F6" fill="#1CB0F6" /></motion.div>
      <h2 className="font-extrabold text-xl mb-2" style={{ color: textPrimary }}>{t('lesson.noEnergyTitle')}</h2>
      <p className="text-sm mb-8 leading-relaxed" style={{ color: textMuted }}>
        {t('lesson.noEnergyDesc', { time: formatCountdown(ms) })}
      </p>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <motion.button whileTap={{ scale: 0.97 }} onClick={onShop}
          className="flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-white text-sm"
          style={{ background: '#1CB0F6' }}>
          <ShoppingBag size={18} /> {t('lesson.goToShop')}
        </motion.button>
        <button onClick={onBack}
          className="py-3 rounded-2xl font-semibold text-sm"
          style={{ background: bright ? '#e2e8f0' : '#1e293b', color: bright ? '#64748b' : '#94a3b8' }}>
          {t('lesson.goBack')}
        </button>
      </div>
    </motion.div>
  );
}

// ── Option button ──────────────────────────────────────────────────────────────
function OptionBtn({ text, onClick, state: s, index, bright }) {
  const dark = {
    idle:    { bg: '#1e293b', border: 'rgba(255,255,255,0.12)', color: 'white',   labelBg: '#334155', labelColor: '#94a3b8' },
    correct: { bg: '#16301d', border: '#58CC02',                color: '#58CC02', labelBg: '#1a4025', labelColor: '#58CC02' },
    wrong:   { bg: '#2d1515', border: '#FF4B4B',                color: '#FF4B4B', labelBg: '#3d1515', labelColor: '#FF4B4B' },
  };
  const light = {
    idle:    { bg: '#ffffff', border: '#e2e8f0',   color: '#0f172a', labelBg: '#f1f5f9', labelColor: '#64748b' },
    correct: { bg: '#f0fdf4', border: '#58CC02',   color: '#15803d', labelBg: '#dcfce7', labelColor: '#16a34a' },
    wrong:   { bg: '#fef2f2', border: '#FF4B4B',   color: '#dc2626', labelBg: '#fee2e2', labelColor: '#dc2626' },
  };
  const st = (bright ? light : dark)[s] || (bright ? light : dark).idle;

  return (
    <motion.button
      whileTap={s === 'idle' ? { scale: 0.97 } : {}}
      onClick={s === 'idle' ? onClick : undefined}
      className="w-full px-4 rounded-2xl text-sm font-semibold text-left flex items-center gap-3"
      style={{
        background: st.bg,
        border: `2px solid ${st.border}`,
        color: st.color,
        minHeight: '56px',
        paddingTop: '14px',
        paddingBottom: '14px',
      }}
    >
      <span
        className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
        style={{ background: st.labelBg, color: st.labelColor }}
      >
        {OPTION_LABELS[index] ?? index + 1}
      </span>
      <span className="leading-snug">{text}</span>
    </motion.button>
  );
}

// ── Theory / Media cards ─────────────────────────────────────────────────────
// "Тип «Введение / Рассказ»" and "Тип «Медиа-Инфо»" from the manifest — pure
// content, no answer to check, just a "Далее" button straight through.
function TheoryCard({ card, moduleColor, bright, onContinue, isLast, submitting }) {
  const { t, locale } = useI18n();
  const bg     = bright ? '#eff6ff' : '#0d1626';
  const border = bright ? `${moduleColor}60` : `${moduleColor}35`;
  const text   = bright ? '#0f172a' : 'white';
  const title  = localizedText(card.title, locale);
  return (
    <div className="flex-1 flex flex-col">
      <div className="rounded-2xl p-5 mb-5 flex-1" style={{ background: bg, border: `2px solid ${border}` }}>
        {card.imageUrl && (
          <img src={card.imageUrl} alt="" className="w-full rounded-xl mb-4 object-cover" style={{ maxHeight: '40dvh' }} />
        )}
        {title && (
          <p className="font-extrabold text-lg mb-2" style={{ color: moduleColor }}>{title}</p>
        )}
        <p className="text-base leading-relaxed whitespace-pre-line" style={{ color: text }}>{localizedText(card.body, locale)}</p>
      </div>
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={onContinue}
        disabled={submitting}
        className="w-full py-4 rounded-2xl font-bold text-white text-base disabled:opacity-60"
        style={{ background: moduleColor }}
      >
        {submitting ? t('common.loading') : isLast ? t('common.finish') : t('common.continue')}
      </motion.button>
    </div>
  );
}

function MediaCard({ card, moduleColor, bright, onContinue, isLast, submitting }) {
  const { t, locale } = useI18n();
  const cardBg = bright ? '#ffffff' : '#1e293b';
  const border = bright ? '#e2e8f0' : '#334155';
  const text   = bright ? '#0f172a' : 'white';
  const muted  = bright ? '#64748b' : '#94a3b8';
  const caption = localizedText(card.caption, locale);
  return (
    <div className="flex-1 flex flex-col">
      <div className="rounded-2xl overflow-hidden mb-5 flex-1" style={{ background: cardBg, border: `1.5px solid ${border}` }}>
        {card.mediaType === 'video' ? (
          <video src={card.url} controls playsInline className="w-full aspect-video bg-black" />
        ) : card.url ? (
          <img src={card.url} alt={caption} className="w-full object-cover" style={{ maxHeight: '55dvh' }} />
        ) : (
          <div className="w-full aspect-video flex items-center justify-center" style={{ color: muted }}>
            <PlayCircle size={40} />
          </div>
        )}
        {caption && (
          <p className="text-sm leading-relaxed p-4" style={{ color: text }}>{caption}</p>
        )}
      </div>
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={onContinue}
        disabled={submitting}
        className="w-full py-4 rounded-2xl font-bold text-white text-base disabled:opacity-60"
        style={{ background: moduleColor }}
      >
        {submitting ? t('common.loading') : isLast ? t('common.finish') : t('common.continue')}
      </motion.button>
    </div>
  );
}

// ── Result screen ──────────────────────────────────────────────────────────────
function ResultScreen({ reward, earnedAchievements, isReview, onContinue, bright, userName, lessonTitle, totalQuestions = 0, correctCount = 0 }) {
  const { t, locale } = useI18n();
  const [sharing, setSharing] = useState(false);
  const bg          = bright ? '#f8fafc' : '#0f172a';
  const textPrimary = bright ? '#0f172a' : 'white';
  const textMuted   = bright ? '#64748b' : '#94a3b8';
  const cardBg      = bright ? '#ffffff' : '#1e293b';
  const cardBorder  = bright ? '#e2e8f0' : 'transparent';
  const trackBg     = bright ? '#e2e8f0' : '#1e293b';
  const perfect     = !!reward?.perfect;
  const accuracyPct = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
  const allCorrect  = totalQuestions > 0 && correctCount >= totalQuestions;
  const accentColor = allCorrect ? '#58CC02' : '#1CB0F6';

  const handleShare = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      const blob = await generateShareCardBlob({
        userName, lessonTitle, xp: reward?.xp || 0, coins: reward?.coins || 0, perfect: reward?.perfect,
      });
      await shareOrDownload(blob, {
        title: 'JashMen',
        text: t('lesson.shareText', { lesson: lessonTitle, xp: reward?.xp || 0 }),
      });
    } catch (err) {
      console.error(err);
    } finally {
      setSharing(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="fixed inset-0 flex flex-col items-center justify-center px-6 z-50"
      style={{ background: bg }}
    >
      <div className="relative mb-4 flex items-center justify-center">
        {/* A soft celebratory halo behind the emoji — gold when perfect,
            module-blue otherwise; a slow breathing pulse, never distracting. */}
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: [1, 1.15, 1], opacity: [0.35, 0.5, 0.35] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute w-28 h-28 rounded-full"
          style={{ background: perfect ? 'radial-gradient(circle, #FFD70055, transparent 70%)' : 'radial-gradient(circle, #1CB0F644, transparent 70%)' }}
        />
        <motion.div
          initial={{ scale: 0, rotate: -15 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 18, delay: 0.05 }}
          className="relative"
        >
          {perfect
            ? <Trophy size={88} color="#FFD700" fill="#FFD700" />
            : <CheckCircle2 size={88} color="#58CC02" fill="#58CC02" stroke={bright ? '#f8fafc' : '#0f172a'} strokeWidth={1.5} />}
        </motion.div>
      </div>

      <motion.h2
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
        className="text-2xl font-extrabold mb-1" style={{ color: textPrimary }}>
        {perfect ? t('lesson.resultPerfect') : t('lesson.resultGood')}
      </motion.h2>
      <p className="text-sm mb-6 text-center" style={{ color: textMuted }}>
        {isReview ? t('lesson.reviewDone') : t('lesson.lessonDone')}
      </p>

      {totalQuestions > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}
          className="w-full max-w-sm mb-6"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: textMuted }}>
              {t('lesson.accuracyLabel')}
            </span>
            <span className="text-sm font-extrabold" style={{ color: allCorrect ? '#58CC02' : textPrimary }}>
              {correctCount}/{totalQuestions} · {accuracyPct}%
            </span>
          </div>
          <div className="h-2.5 rounded-full overflow-hidden" style={{ background: trackBg }}>
            <motion.div
              initial={{ width: 0 }} animate={{ width: `${accuracyPct}%` }}
              transition={{ delay: 0.28, duration: 0.6, ease: 'easeOut' }}
              className="h-full rounded-full"
              style={{ background: accentColor }}
            />
          </div>
        </motion.div>
      )}

      {!isReview && (
        <div className="flex gap-4 mb-6">
          <div className="flex flex-col items-center gap-1.5">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: cardBg, border: `1.5px solid ${cardBorder}` }}>
              <Star size={26} color="#FFD700" fill="#FFD700" />
            </div>
            <span className="font-bold text-sm" style={{ color: textPrimary }}>+{reward?.xp || 0} XP</span>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: cardBg, border: `1.5px solid ${cardBorder}` }}>
              <Coins size={26} color="#FFD700" fill="#FFD700" />
            </div>
            <span className="font-bold text-sm" style={{ color: textPrimary }}>+{reward?.coins || 0}</span>
          </div>
          {reward?.perfect && (
            <div className="flex flex-col items-center gap-1.5">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{ background: bright ? '#f0fdf4' : '#16301d', border: '1.5px solid #58CC02' }}>
                <Check size={26} color="#58CC02" />
              </div>
              <span className="font-bold text-sm" style={{ color: '#58CC02' }}>{t('lesson.perfectBadge')}</span>
            </div>
          )}
        </div>
      )}

      {earnedAchievements?.length > 0 && (
        <div className="w-full mb-6">
          <p className="text-center text-xs mb-2 font-semibold uppercase tracking-wide" style={{ color: textMuted }}>
            {t('lesson.newAchievement')}
          </p>
          <div className="flex flex-col gap-2">
            {earnedAchievements.map(ach => (
              <motion.div key={ach.id}
                initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
                className="flex items-center gap-3 px-4 py-3 rounded-2xl"
                style={{ background: cardBg, border: '1.5px solid #FFD700' }}>
                {ach.iconUrl
                  ? <img src={ach.iconUrl} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0" />
                  : <Award size={22} color="#FFD700" className="shrink-0" />}
                <div>
                  <p className="font-bold text-sm" style={{ color: textPrimary }}>{localizedText(ach.title, locale)}</p>
                  <p className="text-xs" style={{ color: textMuted }}>{localizedText(ach.desc, locale)} · +{ach.xp} XP</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      <div className="w-full max-w-sm flex flex-col gap-3">
        {!isReview && (
          <motion.button
            whileTap={{ scale: 0.97 }} onClick={handleShare} disabled={sharing}
            className="w-full py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
            style={{
              background: bright ? '#eff6ff' : 'rgba(28,176,246,0.1)',
              border: '1.5px solid rgba(28,176,246,0.4)',
              color: '#1CB0F6',
            }}>
            <Share2 size={16} />
            {sharing ? t('common.loading') : t('lesson.share')}
          </motion.button>
        )}
        <motion.button
          whileTap={{ scale: 0.97 }} onClick={onContinue}
          className="w-full py-4 rounded-2xl font-bold text-white text-base"
          style={{ background: '#58CC02' }}>
          {t('common.continue')}
        </motion.button>
      </div>
    </motion.div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function LessonPage() {
  const { id: lessonId }  = useParams();
  const [searchParams]    = useSearchParams();
  const isReview          = searchParams.get('review') === '1';
  const navigate          = useNavigate();
  const content           = useContent();
  const { token, user, state, updateUser } = useAuth();
  const { bright } = useBrightMode();
  const { t, locale } = useI18n();

  const soundEnabled = state?.settings?.sound !== false;
  const dailyFreeLessons = content?.limits?.dailyFreeLessons ?? 3;

  const found   = content ? findLesson(content.modules, lessonId) : null;
  const { lesson, module: mod } = found || {};
  const cards         = lesson ? cardsOf(lesson) : [];
  const quizCount     = cards.filter(c => c.type === 'quiz').length;
  const totalLessons  = (content?.modules || []).reduce((a, m) => a + m.lessons.length, 0);

  const { resetMs: initResetMs } = computeLiveEnergy(state, dailyFreeLessons);

  const [qIdx,        setQIdx]        = useState(0);
  const [deck,        setDeck]        = useState(null);
  const [selected,    setSelected]    = useState(null);
  const [answered,    setAnswered]    = useState(false);
  const [mistakes,    setMistakes]    = useState(0);
  // Distinct quiz cards missed at least once — the end-of-lesson accuracy
  // summary ("N/total correct") is first-try, so re-queued retries (Task 7)
  // don't retroactively count as correct. Keyed by original index in `cards`.
  const [missed,      setMissed]      = useState(() => new Set());
  const [shake,       setShake]       = useState(false);
  const [phase,       setPhase]       = useState('quiz');
  const [reward,      setReward]      = useState(null);
  const [earnedAchs,  setEarnedAchs]  = useState([]);
  const [submitting,  setSubmitting]  = useState(false);
  const shakeTimer = useRef(null);
  const startLogged = useRef(false);

  // Task 7 — a wrong quiz answer re-queues that question to the end of the
  // deck, and the lesson can't be finished until every question has been
  // answered correctly at least once (Duolingo-style "repeat"). `deck` is
  // the live play order: it starts as the lesson's cards and grows each time
  // a question is missed. The `mistakes` tally is deliberately untouched, so
  // scoring and the "perfect" flag still reflect first-try accuracy. Reset
  // whenever the lesson changes or its cards first arrive from the API.
  const activeDeck = deck ?? cards;
  useEffect(() => {
    if (cards.length) {
      setDeck(cards);
      setQIdx(0);
      setSelected(null);
      setAnswered(false);
      setMistakes(0);
      setMissed(new Set());
    }
    // cards.length flips 0→N exactly once per lesson; lessonId change is a
    // route param swap that does NOT remount this component, so it must
    // reset here too.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId, cards.length]);

  useEffect(() => {
    if (!isReview && computeLiveEnergy(state, dailyFreeLessons).remaining === 0) setPhase('noenergy');
  }, []);

  // Fire-and-forget analytics — never let telemetry affect the quiz itself.
  useEffect(() => {
    if (startLogged.current || !lesson || isReview) return;
    startLogged.current = true;
    api.logEvent(token, 'lesson_start', { lessonId }).catch(() => {});
  }, [lesson, isReview, token, lessonId]);

  const currentCard = activeDeck[qIdx];
  const isQuiz = currentCard?.type === 'quiz';
  // Analytics index = this question's position among the ORIGINAL quiz cards.
  // Re-queued cards are the same object reference, so indexOf still resolves
  // to the question's first appearance rather than its retry slot.
  const quizIndex = isQuiz ? cards.filter(c => c.type === 'quiz').indexOf(currentCard) : -1;

  const handleSelect = useCallback((idx) => {
    if (answered || !currentCard) return;
    setSelected(idx);
    setAnswered(true);
    const correct = idx === currentCard.a;
    if (correct) {
      if (soundEnabled) playSound('correct');
    } else {
      if (soundEnabled) playSound('wrong');
      // First-try accuracy: remember this question was missed at least once,
      // keyed by its original position so Task 7 re-queues don't erase it.
      const origIdx = cards.indexOf(currentCard);
      setMissed(prev => (prev.has(origIdx) ? prev : new Set(prev).add(origIdx)));
      if (!isReview) {
        setMistakes(m => m + 1);
        setShake(true);
        clearTimeout(shakeTimer.current);
        shakeTimer.current = setTimeout(() => setShake(false), 450);
      }
    }
    if (!isReview) {
      api.logEvent(token, 'question_answered', { lessonId, questionIndex: quizIndex, correct }).catch(() => {});
    }
  }, [answered, currentCard, isReview, soundEnabled, token, lessonId, quizIndex]);

  const handleContinue = useCallback(async () => {
    // Re-queue a missed question to the end so it comes back around. Review
    // mode learns too, but doesn't affect the (unused) reward, so we re-queue
    // there as well for the same "answer it right to move on" contract.
    const wasWrongQuiz = currentCard?.type === 'quiz' && selected !== currentCard.a;
    const base = deck ?? cards;
    const nextDeck = wasWrongQuiz ? [...base, currentCard] : base;
    if (nextDeck !== base) setDeck(nextDeck);
    else if (deck === null) setDeck(base);

    if (qIdx < nextDeck.length - 1) {
      setQIdx(i => i + 1);
      setSelected(null);
      setAnswered(false);
      return;
    }
    if (soundEnabled) playSound('complete');
    setSubmitting(true);
    try {
      const { user: u, reward: r } = await api.completeLesson(token, lessonId, mistakes, isReview);
      const newAchIds = checkNewAchievements(u.state, r, content?.achievements || [], totalLessons);
      let final = u;
      if (newAchIds.length > 0) {
        const merged   = [...new Set([...(u.state?.achievements || []), ...newAchIds])];
        const xpBonus  = newAchIds.reduce((s, id) => s + (content?.achievements?.find(a => a.id === id)?.xp || 0), 0);
        final = await api.patchState(token, { achievements: merged, xp: (u.state?.xp || 0) + xpBonus });
        setEarnedAchs(newAchIds.map(id => content?.achievements?.find(a => a.id === id)).filter(Boolean));
      }
      updateUser(final);
      setReward(r);
      setPhase('done');
    } catch (e) {
      console.error(e);
      if (String(e.message || '').includes(ENERGY_ERROR_HINT)) {
        setPhase('noenergy');
      } else {
        setReward({ xp: 0, coins: 0, perfect: mistakes === 0, isReview });
        setPhase('done');
      }
    } finally {
      setSubmitting(false);
    }
  }, [qIdx, deck, cards, currentCard, selected, token, lessonId, mistakes, isReview, content, totalLessons, updateUser, soundEnabled]);

  if (!lesson) return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <p className="text-sm" style={{ color: bright ? '#64748b' : '#94a3b8' }}>{t('lesson.notFound')}</p>
      <button onClick={() => navigate('/learn')} className="text-[#1CB0F6] text-sm font-medium">{t('lesson.backArrow')}</button>
    </div>
  );

  if (phase === 'noenergy') return (
    <NoEnergyScreen resetMs={initResetMs} bright={bright}
      onBack={() => navigate('/learn')}
      onShop={() => navigate('/shop')} />
  );

  if (phase === 'done') return (
    <ResultScreen reward={reward} earnedAchievements={earnedAchs}
      isReview={isReview} onContinue={() => navigate('/learn')} bright={bright}
      userName={user?.name} lessonTitle={localizedText(lesson?.title, locale)}
      totalQuestions={quizCount} correctCount={Math.max(0, quizCount - missed.size)} />
  );

  const moduleColor    = mod?.color || '#1CB0F6';
  const progress       = activeDeck.length > 0 ? (qIdx / activeDeck.length) * 100 : 0;
  const isCorrect      = selected === currentCard?.a;
  // A wrong quiz answer will re-queue, so this is NOT the real last step even
  // if it's the last deck slot — keep the button on "Continue", not "Finish".
  const willRequeue    = answered && isQuiz && selected !== currentCard?.a;
  const isLastCard     = qIdx === activeDeck.length - 1 && !willRequeue;
  const explanation    = localizedText(currentCard?.explanation, locale);

  const pageBg         = bright ? '#f8fafc' : '#0f172a';
  const qBlockBg       = bright ? '#eff6ff' : '#0d1626';
  const qBlockBorder   = bright ? `${moduleColor}60` : `${moduleColor}35`;
  const qTextColor     = bright ? '#0f172a' : 'white';
  const counterColor   = bright ? '#64748b' : '#64748b';
  const progressTrack  = bright ? '#e2e8f0' : '#1e293b';
  const closeBtnBg     = bright ? '#e2e8f0' : '#1e293b';
  const closeBtnColor  = bright ? '#64748b' : '#94a3b8';

  return (
    <div
      className="flex flex-col px-4 pt-4 pb-6 lg:max-w-[600px] lg:mx-auto lg:pt-8"
      style={{ background: pageBg, minHeight: 'calc(100dvh - 56px)' }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={() => navigate('/learn')}
          className="w-9 h-9 flex items-center justify-center rounded-xl shrink-0"
          style={{ background: closeBtnBg }}
        >
          <X size={18} color={closeBtnColor} />
        </button>
        <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ background: progressTrack }}>
          <motion.div
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.35 }}
            className="h-full rounded-full"
            style={{ background: moduleColor }}
          />
        </div>
      </div>

      {/* Module label */}
      <p className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider mb-0.5" style={{ color: moduleColor }}>
        <Wallet size={12} strokeWidth={2.5} /> {localizedText(mod?.title, locale).toUpperCase()}
      </p>
      <p className="text-xs mb-5" style={{ color: counterColor }}>{t('lesson.stepCounter', { current: qIdx + 1, total: activeDeck.length })}</p>

      {!isQuiz ? (
        <AnimatePresence mode="wait">
          <motion.div key={qIdx}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.18 }}
            className="flex-1 flex flex-col"
          >
            {currentCard.type === 'media'
              ? <MediaCard card={currentCard} moduleColor={moduleColor} bright={bright} onContinue={handleContinue} isLast={isLastCard} submitting={submitting} />
              : <TheoryCard card={currentCard} moduleColor={moduleColor} bright={bright} onContinue={handleContinue} isLast={isLastCard} submitting={submitting} />
            }
          </motion.div>
        </AnimatePresence>
      ) : (
        <>
          {/* Question + Options */}
          <AnimatePresence mode="wait">
            <motion.div key={qIdx}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.18 }}
            >
              <div
                className={`rounded-2xl p-5 mb-5 ${shake ? 'shake' : ''}`}
                style={{ background: qBlockBg, border: `2px solid ${qBlockBorder}` }}
              >
                {currentCard?.imageUrl && (
                  <img src={currentCard.imageUrl} alt="" className="w-full rounded-xl mb-3 object-cover" style={{ maxHeight: '30dvh' }} />
                )}
                <p className="font-semibold text-base leading-relaxed" style={{ color: qTextColor }}>
                  {localizedText(currentCard?.q, locale)}
                </p>
              </div>

              <div className="flex flex-col gap-3">
                {(currentCard?.opts || []).map((opt, i) => {
                  let s = 'idle';
                  if (answered) {
                    if (i === currentCard.a) s = 'correct';
                    else if (i === selected) s = 'wrong';
                  }
                  return (
                    <OptionBtn key={i} text={localizedText(opt, locale)} onClick={() => handleSelect(i)} state={s} index={i} bright={bright} />
                  );
                })}
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Feedback + Continue */}
          <AnimatePresence>
            {answered && (
              <motion.div
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 50, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 38 }}
                className="mt-4"
              >
                <div
                  className="rounded-2xl px-4 py-3 mb-3 flex items-start gap-2"
                  style={{
                    background: isCorrect
                      ? (bright ? '#f0fdf4' : '#16301d')
                      : (bright ? '#fef2f2' : '#2d1515'),
                    border: `1.5px solid ${isCorrect ? '#58CC02' : '#FF4B4B'}`,
                  }}
                >
                  {isCorrect
                    ? <Check size={18} color="#58CC02" className="shrink-0 mt-0.5" />
                    : <X     size={18} color="#FF4B4B" className="shrink-0 mt-0.5" />
                  }
                  <p className="text-sm font-semibold leading-snug"
                    style={{ color: isCorrect ? (bright ? '#15803d' : '#58CC02') : (bright ? '#dc2626' : '#FF4B4B') }}>
                    {isCorrect
                      ? t('lesson.correct')
                      : t('lesson.correctAnswerIs', { answer: localizedText(currentCard?.opts?.[currentCard?.a], locale) })}
                  </p>
                </div>

                {/* Optional explanation authored per question in the admin
                    panel — the "why". Shown after answering (right or wrong)
                    so a correct guess still learns and a wrong one understands. */}
                {explanation && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.08 }}
                    className="rounded-2xl px-4 py-3 mb-3"
                    style={{
                      background: bright ? '#f8fafc' : '#0d1626',
                      border: `1.5px solid ${bright ? '#e2e8f0' : '#1e293b'}`,
                    }}
                  >
                    <p className="text-[11px] font-extrabold uppercase tracking-widest mb-1" style={{ color: moduleColor }}>
                      {t('lesson.explanation')}
                    </p>
                    <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: bright ? '#334155' : '#cbd5e1' }}>
                      {explanation}
                    </p>
                  </motion.div>
                )}

                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleContinue}
                  disabled={submitting}
                  className="w-full py-4 rounded-2xl font-bold text-white text-base disabled:opacity-60"
                  style={{ background: isCorrect ? '#58CC02' : '#1CB0F6' }}
                >
                  {submitting
                    ? t('common.loading')
                    : isLastCard
                    ? t('common.finish')
                    : t('common.continue')}
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}
