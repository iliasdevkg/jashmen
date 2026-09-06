// src/components/StreakCalendar.jsx — the streak, on the profile.
//
// Two views of the same data, one tap apart: this week as a Su–Sa strip with
// a continuous bar under each run of studied days (the same visual the
// celebration screen uses, so the two read as one idea), and the last four
// weeks as a grid.
//
// The month view is a real calendar month now, with arrows either side of
// its name. It used to be a rolling four weeks, because the server kept only
// a trailing 30 days of `activeDays` and a month grid would have drawn empty
// squares for days nobody had the answer to and quietly called them "missed".
// The server keeps 400 days (routes.js), so paging back is honest — and the
// grid still greys out anything outside that window rather than claiming it.
import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Flame, ChevronLeft, ChevronRight, HeartCrack, Zap, Loader2 } from 'lucide-react';
import { useI18n, formatDays } from '../i18n.jsx';
import { STREAK } from '../utils.js';

const DAYS_IN_WEEK = 7;

/// How far back the server's `activeDays` reaches (routes.js). A day older
/// than this is unknown, not missed — the grid says so instead of guessing.
const HISTORY_DAYS = 400;

function isoUTC(date) {
  return date.toISOString().slice(0, 10);
}

// The Sunday that opens the week `weeksBack` weeks before the current one.
function weekStart(weeksBack = 0, now = new Date()) {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - d.getUTCDay() - weeksBack * DAYS_IN_WEEK);
  return d;
}

/// Every cell of the grid for `year`/`month`, Sunday-aligned: the days that
/// spill in from the neighbouring months are included so the weeks line up
/// under their headers, and marked so they can be dimmed.
function monthGrid(year, month) {
  const first = new Date(Date.UTC(year, month, 1));
  const start = new Date(first);
  start.setUTCDate(first.getUTCDate() - first.getUTCDay());

  const last = new Date(Date.UTC(year, month + 1, 0));
  const end = new Date(last);
  end.setUTCDate(last.getUTCDate() + (6 - last.getUTCDay()));

  const cells = [];
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    cells.push({ iso: isoUTC(d), inMonth: d.getUTCMonth() === month });
  }
  return cells;
}

function daysFrom(start, count) {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    return isoUTC(d);
  });
}

// Contiguous stretches of studied days, as [firstIndex, lastIndex] pairs —
// what turns seven separate dots into "these days connect".
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

/// The offer that appears on the day a run breaks: pay energy, get the
/// number back. It sits inside the streak card rather than as a modal
/// because it is not urgent enough to interrupt — it is a choice the
/// learner should see next to the calendar that explains it.
function RepairBanner({ repair, energy, busy, error, onRepair, bright, t }) {
  const affordable = energy >= repair.cost;
  const line = bright ? '#fecaca' : '#7f1d1d';

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="mx-4 mt-3.5 rounded-xl px-3.5 py-3"
      style={{ background: bright ? '#fef2f2' : '#2a1416', border: `1.5px solid ${line}` }}
    >
      <div className="flex items-start gap-2.5">
        <HeartCrack size={18} className="shrink-0 mt-0.5" color="#ef4444" />
        <div className="min-w-0 flex-1">
          <p className="font-bold text-[13px] leading-tight" style={{ color: bright ? '#991b1b' : '#fca5a5' }}>
            {t('profile.streakLostTitle', { n: repair.lost })}
          </p>
          <p className="text-[11.5px] mt-0.5 leading-snug" style={{ color: bright ? '#b91c1c' : '#f87171' }}>
            {t('profile.streakLostDesc', { cost: repair.cost })}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={onRepair}
        disabled={busy || !affordable}
        className="mt-2.5 w-full py-2 rounded-lg text-[12.5px] font-extrabold inline-flex items-center justify-center gap-1.5 transition-opacity disabled:opacity-45 disabled:cursor-not-allowed"
        style={{ background: STREAK.main, color: STREAK.ink }}
      >
        {busy
          ? <><Loader2 size={14} className="animate-spin" />{t('profile.streakRepairBusy')}</>
          : <><Zap size={14} fill="currentColor" />{t('profile.streakRepairCta', { cost: repair.cost })}</>}
      </button>

      {/* Why the button is dead, said once — not a tooltip nobody opens. */}
      {(!affordable || error) && (
        <p className="mt-1.5 text-[11px] font-semibold text-center" style={{ color: bright ? '#b91c1c' : '#f87171' }}>
          {error || t('profile.streakRepairNoEnergy')}
        </p>
      )}
    </motion.div>
  );
}

export default function StreakCalendar({
  streak = 0,
  activeDays = [],
  bright,
  repair = null,
  energy = 0,
  repairBusy = false,
  repairError = '',
  onRepair,
}) {
  const { t, locale } = useI18n();
  const [view, setView] = useState('week');

  const today = isoUTC(new Date());
  const activeSet = useMemo(() => new Set(activeDays), [activeDays]);

  const week = useMemo(() => daysFrom(weekStart(0), DAYS_IN_WEEK), []);

  // Which month the grid is showing. 0 is this one; -1 is last month.
  const [monthOffset, setMonthOffset] = useState(0);
  const now = new Date();
  const cursor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + monthOffset, 1));
  const monthCells = useMemo(
    () => monthGrid(cursor.getUTCFullYear(), cursor.getUTCMonth()),
    [cursor.getUTCFullYear(), cursor.getUTCMonth()], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // The oldest day the server can still answer for. Anything before it is
  // drawn as unknown rather than as a missed day.
  const horizon = useMemo(() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - HISTORY_DAYS);
    return isoUTC(d);
  }, []);

  // Paging stops where the data does in one direction and at this month in
  // the other — there is nothing to see in the future.
  const canGoBack = monthCells.some(c => c.inMonth && c.iso >= horizon);
  const canGoNext = monthOffset < 0;

  const monthName = new Intl.DateTimeFormat(
    locale === 'ky' ? 'ru' : locale, // Intl has no Kyrgyz month names
    { month: 'long', year: 'numeric', timeZone: 'UTC' },
  ).format(cursor);

  const monthDays = monthCells.filter(c => c.inMonth).map(c => c.iso);
  const days = view === 'week' ? week : monthDays;
  const studied = days.filter(d => activeSet.has(d)).length;

  const weekActive = week.map(d => activeSet.has(d));
  const runs = useMemo(() => activeRuns(weekActive), [weekActive.join()]); // eslint-disable-line react-hooks/exhaustive-deps

  const cardBg   = bright ? '#ffffff' : '#1e293b';
  const cardLine = bright ? '#e2e8f0' : '#334155';
  const textPri  = bright ? '#0f172a' : '#ffffff';
  const textMut  = bright ? '#64748b' : '#94a3b8';
  const emptyDay = bright ? '#eef2f7' : '#0f172a';

  const TABS = [
    { key: 'week',  label: t('profile.streakWeek') },
    { key: 'month', label: t('profile.streakMonth') },
  ];

  return (
    <div className="rounded-2xl overflow-hidden mb-5" style={{ background: cardBg, border: `1.5px solid ${cardLine}` }}>
      <div className="flex items-center gap-2.5 px-4 pt-4">
        <Flame size={22} color={STREAK.main} fill={STREAK.main} />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm leading-tight" style={{ color: textPri }}>
            {formatDays(streak, locale)}
          </p>
          <p className="text-xs" style={{ color: textMut }}>{t('profile.streakSub')}</p>
        </div>

        {/* Two tabs rather than a dropdown: with exactly two views, a menu
            costs a tap and hides the choice. */}
        <div className="flex p-0.5 rounded-xl shrink-0" style={{ background: bright ? '#f1f5f9' : '#0f172a' }}>
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setView(tab.key)}
              aria-pressed={view === tab.key}
              className="px-3 py-1.5 rounded-[10px] text-[11.5px] font-bold transition-colors"
              style={view === tab.key
                ? { background: STREAK.main, color: '#fff' }
                : { color: textMut }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {repair && (
          <RepairBanner
            key="repair"
            repair={repair}
            energy={energy}
            busy={repairBusy}
            error={repairError}
            onRepair={onRepair}
            bright={bright}
            t={t}
          />
        )}
      </AnimatePresence>

      <div className="px-4 pt-3.5 pb-4">
        {view === 'month' && (
          <div className="flex items-center justify-between mb-2.5">
            <button
              type="button"
              onClick={() => setMonthOffset(o => o - 1)}
              disabled={!canGoBack}
              aria-label={t('profile.streakPrevMonth')}
              className="w-7 h-7 rounded-lg grid place-items-center disabled:opacity-25 transition-opacity"
              style={{ background: bright ? '#f1f5f9' : '#0f172a', color: textMut }}
            >
              <ChevronLeft size={15} />
            </button>
            <span className="text-[12.5px] font-bold capitalize" style={{ color: textPri }}>
              {monthName}
            </span>
            <button
              type="button"
              onClick={() => setMonthOffset(o => o + 1)}
              disabled={!canGoNext}
              aria-label={t('profile.streakNextMonth')}
              className="w-7 h-7 rounded-lg grid place-items-center disabled:opacity-25 transition-opacity"
              style={{ background: bright ? '#f1f5f9' : '#0f172a', color: textMut }}
            >
              <ChevronRight size={15} />
            </button>
          </div>
        )}
        <div className="grid grid-cols-7 gap-1 mb-1.5">
          {Array.from({ length: DAYS_IN_WEEK }, (_, i) => (
            <span key={i} className="text-center text-[11px] font-bold" style={{ color: textMut }}>
              {t(`streak.dow${i}`)}
            </span>
          ))}
        </div>

        {view === 'week' ? (
          // One continuous bar per run, with the day marks on top of it.
          <div className="relative" style={{ height: 34 }}>
            {runs.map(([from, to]) => (
              <motion.div
                key={`${from}-${to}`}
                initial={{ scaleX: 0.4, opacity: 0 }}
                animate={{ scaleX: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className="absolute top-0 rounded-full origin-left"
                style={{
                  height: 34,
                  left: `${(from / DAYS_IN_WEEK) * 100}%`,
                  width: `${((to - from + 1) / DAYS_IN_WEEK) * 100}%`,
                  background: `linear-gradient(90deg,${STREAK.barFrom} 0%,${STREAK.barTo} 100%)`,
                }}
              />
            ))}
            <div className="relative grid grid-cols-7 gap-1" style={{ height: 34 }}>
              {week.map((iso, i) => {
                const on = activeSet.has(iso);
                const isToday = iso === today;
                const future = iso > today;
                return (
                  <span
                    key={iso}
                    title={iso}
                    className="rounded-full grid place-items-center text-[11px] font-extrabold"
                    style={{
                      background: on ? 'transparent' : emptyDay,
                      opacity: future ? 0.45 : 1,
                      color: on ? STREAK.ink : textMut,
                      boxShadow: isToday && !on ? `inset 0 0 0 1.5px ${STREAK.main}` : 'none',
                    }}
                  >
                    {on ? '✓' : Number(iso.slice(8))}
                  </span>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-1">
            {monthCells.map(({ iso, inMonth }) => {
              const on = activeSet.has(iso);
              const isToday = iso === today;
              const future = iso > today;
              // Older than the server keeps: we genuinely do not know, so it
              // must not look like a day the learner skipped.
              const unknown = iso < horizon;
              return (
                <span
                  key={iso}
                  title={unknown ? `${iso} — ${t('profile.streakNoData')}` : iso}
                  className="aspect-square rounded-lg grid place-items-center text-[11px] font-extrabold"
                  style={{
                    background: on ? `linear-gradient(160deg,${STREAK.barTo},${STREAK.main})` : emptyDay,
                    opacity: !inMonth ? 0.22 : future || unknown ? 0.4 : 1,
                    color: on ? STREAK.ink : textMut,
                    boxShadow: isToday ? `inset 0 0 0 1.5px ${STREAK.main}` : 'none',
                    ...(unknown && !on ? { border: `1px dashed ${cardLine}`, background: 'transparent' } : null),
                  }}
                >
                  {Number(iso.slice(8))}
                </span>
              );
            })}
          </div>
        )}

        <p className="mt-3 text-[12px] font-semibold" style={{ color: textMut }}>
          {t('profile.streakStudied', { n: studied, total: days.length })}
        </p>
      </div>
    </div>
  );
}
