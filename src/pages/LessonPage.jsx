import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Star, ShoppingBag, PlayCircle, Share2, Award, Zap, Trophy, CheckCircle2, Coins, Wallet } from 'lucide-react';
import { useAuth, useContent, useBrightMode } from '../store.jsx';
import { useI18n, localizedText, formatGrouped } from '../i18n.jsx';
import { energySettings, computeLiveEnergy, formatCountdown, checkNewAchievements, cardsOf } from '../utils.js';
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

// The coin/XP sound that plays over the reward burst, right behind the
// "correct" chime above (which stays — the two are deliberately layered).
// Unlike the three synthesised cues this is a real clip, so it gets one
// lazily-created element reused for every play: constructing an Audio per
// answer leaks decoders on a long lesson.
let coinAudio = null;
function playCoinSound() {
  try {
    if (!coinAudio) {
      coinAudio = new Audio('/sounds/coin_xp.mp3');
      coinAudio.preload = 'auto';
      coinAudio.volume = 0.8;
    }
    coinAudio.currentTime = 0;
    // Autoplay policies reject this until the page has been interacted
    // with; by the time a question is answered it has been, but a rejected
    // promise still has to be swallowed or it surfaces as an unhandled one.
    coinAudio.play()?.catch?.(() => {});
  } catch (_) {}
}

// ── Reward burst ───────────────────────────────────────────────────────────
//
// Coins fly to the coin counter and XP badges to the XP counter, the way
// Zogo does it. Positions are read from the live chips at spawn time
// (getBoundingClientRect) rather than guessed, so the arcs stay correct on
// any viewport and in either orientation.

const COIN_COUNT = 9;
const XP_COUNT = 8;
// Matches mobile's RewardBurstOverlay exactly (reward_burst.dart), so a coin
// takes the same time to reach the counter on both clients.
const BURST_MS = 950;

function buildBurst(seq, originRect, coinRect, xpRect) {
  if (!originRect) return [];
  const ox = originRect.left + originRect.width / 2;
  const oy = originRect.top + originRect.height / 2;
  const particles = [];

  const push = (kind, i, count, targetRect) => {
    if (!targetRect) return;
    // Deterministic spread rather than Math.random: the fan reads as
    // designed motion instead of noise, and it never re-renders differently.
    const spread = (i / Math.max(1, count - 1) - 0.5) * 2; // -1 … 1
    const delay = i * 0.045;
    particles.push({
      id: `${kind}-${seq}-${i}`,
      kind,
      seq,
      // Later particles start later and travel proportionally faster, so the
      // whole fan converges on the counter at the same moment.
      travel: BURST_MS / 1000 - delay,
      from: { x: ox + spread * 46, y: oy + Math.abs(spread) * 26 },
      to: { x: targetRect.left + targetRect.width / 2, y: targetRect.top + targetRect.height / 2 },
      delay,
    });
  };

  for (let i = 0; i < COIN_COUNT; i++) push('coin', i, COIN_COUNT, coinRect);
  for (let i = 0; i < XP_COUNT; i++) push('xp', i, XP_COUNT, xpRect);
  return particles;
}

function BurstLayer({ particles }) {
  return (
    <div className="fixed inset-0 z-40 pointer-events-none" aria-hidden="true">
      {particles.map(p => (
        <motion.div
          key={p.id}
          initial={{ x: p.from.x, y: p.from.y, scale: 0.4, opacity: 0 }}
          animate={{
            x: p.to.x,
            // A slightly different curve on y than on x is what bends the
            // straight line into an arc — no path maths needed.
            y: p.to.y,
            scale: [0.4, 1.1, 1, 0.55],
            opacity: [0, 1, 1, 0],
          }}
          // Every property is pinned to an explicit tween. Framer defaults
          // transforms to a SPRING, which ignored `duration` and flung the
          // coins to the counter in ~320ms while the fade still ran the full
          // 900 — that mismatch is what made the web burst look hurried next
          // to the mobile one. Each particle's travel is also shortened by
          // its own stagger so the whole fan lands together on BURST_MS,
          // exactly as reward_burst.dart does it.
          transition={{
            x: { type: 'tween', duration: p.travel, delay: p.delay, ease: 'easeInOut' },
            y: { type: 'tween', duration: p.travel, delay: p.delay, ease: 'easeIn' },
            scale: {
              type: 'tween', duration: p.travel, delay: p.delay,
              times: [0, 0.18, 0.7, 1], ease: 'easeOut',
            },
            opacity: {
              type: 'tween', duration: p.travel, delay: p.delay,
              times: [0, 0.12, 0.72, 1], ease: 'linear',
            },
          }}
          className="absolute top-0 left-0"
          style={{ marginLeft: -13, marginTop: -13 }}
        >
          {p.kind === 'coin' ? (
            <span
              className="flex items-center justify-center rounded-full"
              style={{
                width: 26, height: 26,
                background: 'radial-gradient(circle at 34% 30%, #FFE082 0%, #FFC107 55%, #E8A200 100%)',
                boxShadow: '0 2px 6px rgba(0,0,0,0.35)',
              }}
            >
              <Coins size={13} color="#8A5A00" strokeWidth={2.6} />
            </span>
          ) : (
            <span
              className="flex items-center justify-center rounded-[7px] text-[10px] font-black text-white"
              style={{ width: 26, height: 22, background: '#1B6EF3', boxShadow: '0 2px 6px rgba(0,0,0,0.35)' }}
            >
              XP
            </span>
          )}
        </motion.div>
      ))}
    </div>
  );
}

// The live counters the burst flies into. Bumping on arrival is what makes
// Walks a counter to its new value one unit at a time, starting only when
// the burst actually lands.
//
// Before this, the number changed the instant the answer was judged — so the
// coins spent a second flying into a total that had already moved, which made
// the whole animation read as decoration. Now the coin arrives and *then* the
// number climbs, one step per unit: 1, 2, 3, 4, 5.
//
// A decrease (spending energy) or a jump too large to be a reward (the
// session's state loading in) snaps instead of crawling.
function useTickUp(target, { delay = 0, stepMs = 62, enabled = true }) {
  const [shown, setShown] = useState(target);
  const shownRef = useRef(target);

  const set = useCallback((v) => { shownRef.current = v; setShown(v); }, []);

  useEffect(() => {
    const from = shownRef.current;
    const delta = target - from;
    if (delta === 0) return undefined;
    if (!enabled || delta < 0 || delta > 200) { set(target); return undefined; }

    let i = 0;
    let interval = null;
    const start = setTimeout(() => {
      interval = setInterval(() => {
        i += 1;
        set(from + i);
        if (i >= delta) clearInterval(interval);
      }, stepMs);
    }, delay);

    return () => { clearTimeout(start); if (interval) clearInterval(interval); };
  }, [target, delay, stepMs, enabled, set]);

  return shown;
}

// the coins feel like they landed rather than just faded out.
function HudChip({ innerRef, icon, value, color, bumpKey }) {
  return (
    <div ref={innerRef} className="flex items-center gap-1.5">
      {icon}
      <motion.span
        key={bumpKey}
        initial={{ scale: 1 }}
        animate={{ scale: [1, 1.22, 1] }}
        transition={{ duration: 0.34, ease: 'easeOut' }}
        className="text-[15px] font-black tabular-nums leading-none"
        style={{ color }}
      >
        {value}
      </motion.span>
    </div>
  );
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
  const animationsEnabled = state?.settings?.animations !== false;
  const { dailyFreeLessons, energyRefillHours } = energySettings(content);

  const found   = content ? findLesson(content.modules, lessonId) : null;
  const { lesson, module: mod } = found || {};
  const cards         = lesson ? cardsOf(lesson) : [];
  const quizCount     = cards.filter(c => c.type === 'quiz').length;
  const totalLessons  = (content?.modules || []).reduce((a, m) => a + m.lessons.length, 0);

  const { resetMs: initResetMs } = computeLiveEnergy(state, dailyFreeLessons, energyRefillHours);

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

  // ── Reward burst ─────────────────────────────────────────────────────
  // The counters are optimistic: XP and coins are only actually awarded
  // when the lesson completes, so these mirror the server's own formula
  // (contentStore.js#limits) closely enough for a live HUD and are then
  // replaced by the real numbers on the result screen.
  const [particles,   setParticles]   = useState([]);
  const [sessionXp,   setSessionXp]   = useState(0);
  const [sessionCoins, setSessionCoins] = useState(0);
  const coinChipRef = useRef(null);
  const xpChipRef   = useRef(null);
  const burstOrigin = useRef(null);
  const burstSeq    = useRef(0);
  const burstTimers = useRef([]);
  useEffect(() => () => burstTimers.current.forEach(clearTimeout), []);

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
    if (!isReview && computeLiveEnergy(state, dailyFreeLessons, energyRefillHours).remaining === 0) setPhase('noenergy');
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

  // Coins fly to the coin chip, XP badges to the XP chip, and the counters
  // tick up as they land. Skipped entirely when animations are off — the
  // sound still plays, since that's a separate setting.
  const rewardBurst = useCallback(() => {
    const lim = content?.limits || {};
    const perQuestion = lim.xpPerQuestion ?? 10;
    const coinGoal = mistakes === 0 ? (lim.coinsPerfectLesson ?? 10) : (lim.coinsNormalLesson ?? 5);

    setSessionXp(x => x + perQuestion);
    setSessionCoins(c => Math.min(coinGoal, c + 1));
    if (soundEnabled) {
      // The new clip layers over the "correct" chime rather than replacing
      // it — the short delay is what lets both be heard.
      const t = setTimeout(playCoinSound, 190);
      burstTimers.current.push(t);
    }
    if (!animationsEnabled) return;

    const seq = burstSeq.current++;
    const next = buildBurst(
      seq,
      burstOrigin.current?.getBoundingClientRect(),
      coinChipRef.current?.getBoundingClientRect(),
      xpChipRef.current?.getBoundingClientRect(),
    );
    if (!next.length) return;
    setParticles(prev => [...prev, ...next]);
    const timer = setTimeout(
      () => setParticles(prev => prev.filter(p => p.seq !== seq)),
      BURST_MS + 500,
    );
    burstTimers.current.push(timer);
  }, [content, mistakes, soundEnabled, animationsEnabled]);

  const handleSelect = useCallback((idx) => {
    if (answered || !currentCard) return;
    setSelected(idx);
    setAnswered(true);
    const correct = idx === currentCard.a;
    if (correct) {
      if (soundEnabled) playSound('correct');
      // A review earns nothing, so it gets the chime but no reward burst —
      // flying coins that credit nobody would be a lie.
      if (!isReview) rewardBurst();
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
  }, [answered, currentCard, isReview, soundEnabled, token, lessonId, quizIndex, rewardBurst]);

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
        final = await api.patchState(token, { achievements: merged, xp: (u.state?.lifetimeXp || 0) + xpBonus });
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

  // Optimistic during the lesson, replaced by the server's numbers the
  // moment the result screen mounts.
  const liveCoins  = (state?.coins || 0) + sessionCoins;
  // The lifetime total, not either league's score: this pill has to climb
  // whether the points are landing on the general board or a campus one
  // (admin-api/routes.js#awardXp).
  const liveXp     = (state?.lifetimeXp || 0) + sessionXp;
  const liveEnergy = computeLiveEnergy(state, dailyFreeLessons, energyRefillHours).remaining;

  // The displayed counters lag the real ones by exactly the burst's flight
  // time, then climb one unit per step. Coins go up by one per question, so
  // that is a single beat; XP arrives ten at a time and gets a faster step so
  // the whole run still finishes inside a second.
  const shownCoins = useTickUp(liveCoins, { delay: BURST_MS - 140, stepMs: 95, enabled: animationsEnabled });
  const shownXp    = useTickUp(liveXp,    { delay: BURST_MS - 140, stepMs: 52, enabled: animationsEnabled });

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
      {/* Live counters — the targets the reward burst flies into, which is
          why they live here rather than only in the app header (which the
          lesson player replaces). */}
      <div className="flex items-center justify-between mb-3 px-0.5">
        <HudChip
          innerRef={coinChipRef}
          bumpKey={shownCoins}
          value={formatGrouped(shownCoins)}
          color={qTextColor}
          icon={
            <span
              className="flex items-center justify-center rounded-full shrink-0"
              style={{ width: 21, height: 21, background: 'radial-gradient(circle at 34% 30%, #FFE082 0%, #FFC107 55%, #E8A200 100%)' }}
            >
              <Coins size={11} color="#8A5A00" strokeWidth={2.6} />
            </span>
          }
        />
        <HudChip
          bumpKey={liveEnergy}
          value={liveEnergy}
          color={qTextColor}
          icon={<Zap size={17} color="#38BDF8" fill="#38BDF8" />}
        />
        <HudChip
          innerRef={xpChipRef}
          bumpKey={shownXp}
          value={formatGrouped(shownXp)}
          color={qTextColor}
          icon={
            <span
              className="flex items-center justify-center rounded-[6px] text-[9.5px] font-black text-white shrink-0"
              style={{ width: 23, height: 19, background: '#1B6EF3' }}
            >
              XP
            </span>
          }
        />
      </div>

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
                ref={burstOrigin}
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

      <BurstLayer particles={particles} />
    </div>
  );
}
