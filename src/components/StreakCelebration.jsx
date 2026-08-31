// The streak screen — shown once on the day the streak actually moves
// (store.jsx gates it on the daily claim's `claimed` flag, so a reload
// doesn't replay it).
//
// The week strip is the part `streak` alone can't answer: which days of
// THIS week were studied. That comes from state.activeDays, a trailing
// window of ISO dates the daily claim appends to (admin-api/routes.js).
import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Check, Star } from 'lucide-react';
import { useI18n } from '../i18n.jsx';

const SPRING = { type: 'spring', stiffness: 300, damping: 30 };
const DAYS_IN_WEEK = 7;

// activeDays are UTC calendar dates (the server's own day boundary), so the
// week has to be built in UTC too — a local-time week would shift the
// strip by a day for anyone east of Greenwich.
function isoUTC(date) {
  return date.toISOString().slice(0, 10);
}

function weekDates(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  start.setUTCDate(start.getUTCDate() - start.getUTCDay()); // back to Sunday
  return Array.from({ length: DAYS_IN_WEEK }, (_, i) => {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    return isoUTC(d);
  });
}

// Contiguous runs of studied days, so the strip draws one continuous bar
// per run instead of seven disconnected pills.
function activeRuns(active) {
  const runs = [];
  let start = -1;
  active.forEach((on, i) => {
    if (on && start === -1) start = i;
    if ((!on || i === active.length - 1) && start !== -1) {
      runs.push([start, on ? i : i - 1]);
      start = -1;
    }
  });
  return runs;
}

function Flame() {
  return (
    <svg viewBox="0 0 100 110" width="152" height="167" aria-hidden="true">
      <defs>
        <linearGradient id="streak-flame-outer" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFA000" />
          <stop offset="100%" stopColor="#FF8A00" />
        </linearGradient>
        <linearGradient id="streak-flame-core" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFE083" />
          <stop offset="100%" stopColor="#FFC400" />
        </linearGradient>
      </defs>
      <path
        d="M50 34 C 44 20 36 10 30 2 C 28 20 20 28 14 42 C 6 60 10 86 28 98 C 40 106 60 106 72 98 C 90 86 94 60 86 42 C 80 28 72 20 70 2 C 64 10 56 20 50 34 Z"
        fill="url(#streak-flame-outer)"
      />
      <path
        d="M50 50 C 43 62 37 70 37 80 C 37 92 43 100 50 105 C 57 100 63 92 63 80 C 63 70 57 62 50 50 Z"
        fill="url(#streak-flame-core)"
      />
    </svg>
  );
}

export default function StreakCelebration({ streak, activeDays = [], bright, onDismiss }) {
  const { t } = useI18n();

  const week = useMemo(() => weekDates(), []);
  const activeSet = useMemo(() => new Set(activeDays), [activeDays]);
  const active = week.map(d => activeSet.has(d));
  const todayIndex = week.indexOf(isoUTC(new Date()));
  const studied = active.filter(Boolean).length;
  const runs = useMemo(() => activeRuns(active), [active.join()]); // eslint-disable-line react-hooks/exhaustive-deps

  const message = studied >= DAYS_IN_WEEK
    ? t('streak.perfectWeekDone')
    : studied >= 5 ? t('streak.perfectWeekClose')
    : studied >= 3 ? t('streak.perfectWeekHalf')
    : t('streak.perfectWeekStart');

  const bg       = bright ? '#f8fafc' : '#141F25';
  const cardBg   = bright ? '#ffffff' : '#1B2830';
  const cardLine = bright ? '#e2e8f0' : '#2B3A44';
  const textPri  = bright ? '#0f172a' : '#ffffff';
  const textMut  = bright ? '#64748b' : '#8A9BA6';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="streak-count"
      className="fixed inset-0 z-[60] flex flex-col items-center justify-between px-6 pt-14 pb-8 overflow-y-auto"
      style={{ background: bg }}
    >
      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-[420px]">
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ ...SPRING, delay: 0.05 }}
        >
          <Flame />
        </motion.div>

        <motion.p
          id="streak-count"
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ ...SPRING, delay: 0.16 }}
          className="text-[76px] font-black leading-none tabular-nums"
          style={{ color: textPri, marginTop: -8, letterSpacing: '-0.02em' }}
        >
          {streak}
        </motion.p>

        <motion.p
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ ...SPRING, delay: 0.24 }}
          className="mt-1.5 text-[22px] font-black"
          style={{ color: '#FF9600' }}
        >
          {t('streak.dayStreak')}
        </motion.p>

        <motion.div
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ ...SPRING, delay: 0.32 }}
          className="w-full mt-8 rounded-2xl overflow-hidden"
          style={{ background: cardBg, border: `2px solid ${cardLine}` }}
        >
          <div className="px-4 pt-4 pb-4">
            <div className="grid grid-cols-7 gap-1">
              {week.map((iso, i) => (
                <span
                  key={iso}
                  className="text-center text-[13px] font-bold"
                  style={{ color: i === todayIndex ? '#FF9600' : textMut }}
                >
                  {t(`streak.dow${i}`)}
                </span>
              ))}
            </div>

            <div className="relative mt-2" style={{ height: 34 }}>
              {/* One continuous bar per run of studied days — the visual
                  the design uses to say "these days connect". */}
              {runs.map(([from, to]) => (
                <div
                  key={`${from}-${to}`}
                  className="absolute top-0 rounded-full"
                  style={{
                    height: 34,
                    left: `${(from / DAYS_IN_WEEK) * 100}%`,
                    width: `${((to - from + 1) / DAYS_IN_WEEK) * 100}%`,
                    background: 'linear-gradient(90deg,#FFC800 0%,#FFD84D 100%)',
                  }}
                />
              ))}
              <div className="relative grid grid-cols-7 gap-1" style={{ height: 34 }}>
                {week.map((iso, i) => {
                  const on = active[i];
                  const isLast = i === DAYS_IN_WEEK - 1;
                  return (
                    <span key={iso} className="flex items-center justify-center">
                      {on ? (
                        <Check size={18} strokeWidth={4} color={bright ? '#8A6400' : '#3B2C00'} />
                      ) : isLast ? (
                        <Star size={22} strokeWidth={2.5} color="#FFC800" />
                      ) : (
                        <span
                          className="rounded-full"
                          style={{ width: 22, height: 22, background: bright ? '#e2e8f0' : '#39474F' }}
                        />
                      )}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="px-4 py-3.5 text-center" style={{ borderTop: `2px solid ${cardLine}` }}>
            <p className="text-[14px] font-semibold" style={{ color: textPri }}>{message}</p>
          </div>
        </motion.div>
      </div>

      <motion.button
        type="button"
        onClick={onDismiss}
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ ...SPRING, delay: 0.4 }}
        whileTap={{ scale: 0.97 }}
        className="w-full max-w-[420px] mt-8 py-4 rounded-2xl text-[15px] font-black tracking-wide text-white shrink-0"
        style={{ background: '#1CB0F6', boxShadow: '0 4px 0 #1899D6' }}
      >
        {t('streak.continue')}
      </motion.button>
    </motion.div>
  );
}
