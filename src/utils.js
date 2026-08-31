// Client mirror of admin-api/energy.js — same formula, kept in lockstep.
// Users get `dailyFreeLessons` genuine lesson completions per refill
// period, and the period length itself is admin-editable
// (content.limits.energyRefillHours). Periods are absolute slices of epoch
// time, so at the default 24 h a boundary is exactly UTC midnight — the
// behaviour the old calendar-day version had.
export const DEFAULT_REFILL_HOURS = 24;

export function normalizeRefillHours(hours) {
  const n = Number(hours);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_REFILL_HOURS;
  return Math.min(168, Math.max(1, Math.round(n)));
}

// The two numbers every energy call site needs, read from the global
// content payload in one place so no screen can drift onto a stale default.
export function energySettings(content) {
  return {
    dailyFreeLessons: content?.limits?.dailyFreeLessons ?? 3,
    energyRefillHours: normalizeRefillHours(content?.limits?.energyRefillHours),
  };
}

export function computeLiveEnergy(state, dailyFreeLessons = 3, energyRefillHours = DEFAULT_REFILL_HOURS) {
  if (!state) return { remaining: dailyFreeLessons, resetMs: null };
  const periodMs = normalizeRefillHours(energyRefillHours) * 3_600_000;
  const period = Math.floor(Date.now() / periodMs);
  // States written before the interval model carry only `energyDate`; for
  // those, "still today" is the best available reading of "still in the
  // current period" — and at 24 h it is the exact same thing.
  const samePeriod = state.energyPeriod != null
    ? state.energyPeriod === period
    : state.energyDate === new Date().toISOString().slice(0, 10);

  const lessonsToday = samePeriod ? (state.lessonsToday || 0) : 0;
  const bonusToday   = samePeriod ? (state.bonusEnergyToday || 0) : 0;
  // Energy handed over by university-league viewers stacks on the free
  // allowance; energy this user gifted away is spent from it.
  const supportToday = samePeriod ? (state.supportEnergyToday || 0) : 0;
  const givenToday   = samePeriod ? (state.energyGivenToday || 0) : 0;

  const cap = dailyFreeLessons + bonusToday + supportToday;
  const remaining = Math.max(0, cap - lessonsToday - givenToday);
  const resetMs = remaining <= 0 ? (period + 1) * periodMs - Date.now() : null;
  return { remaining, resetMs };
}

// "m:ss", or "h:mm:ss" once the countdown crosses an hour. Every call site
// feeds this the time until the next UTC midnight (up to ~24h), so a bare
// "m:ss" used to print nonsense like "548:47" instead of a readable
// "9:08:47" — see mobile/lib/src/core/logic.dart's copy, kept in lockstep.
export function formatCountdown(ms) {
  if (!ms || ms <= 0) return '0:00';
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
}

export function getCurrentLeague(xp, leagues) {
  if (!leagues?.length) return null;
  const sorted = [...leagues].sort((a, b) => b.minXp - a.minXp);
  return sorted.find(l => (xp || 0) >= l.minXp) || sorted[sorted.length - 1];
}

export function getLessonOrder(modules) {
  const order = [];
  for (const m of (modules || [])) {
    for (const l of (m.lessons || [])) order.push(l.id);
  }
  return order;
}

export function getLessonStatus(lessonId, lessonOrder, completedLessons) {
  const done = new Set(completedLessons || []);
  // Already-completed always wins, checked before the prev-lesson gate —
  // content is admin-editable now, so a lesson can get spliced in *ahead*
  // of one a user already finished. Gating on prev-completion first would
  // relock already-done lessons the moment their new predecessor shows up.
  if (done.has(lessonId)) return 'completed';
  const idx = lessonOrder.indexOf(lessonId);
  if (idx < 0) return 'locked';
  if (idx === 0) return 'available';
  const prev = lessonOrder[idx - 1];
  return done.has(prev) ? 'available' : 'locked';
}

// A lesson's cards are its authoritative content (theory/media/quiz, in
// order). Older/seed lessons only have a flat `questions` array — treat
// each of those as an all-quiz card list so nothing built before this
// existed has to change. Shared by LessonPage (plays the cards) and the
// Learn path's preview sheet (needs the quiz count before the lesson opens).
export function cardsOf(lesson) {
  if (lesson?.cards?.length) return lesson.cards;
  return (lesson?.questions || []).map(q => ({ type: 'quiz', ...q }));
}

export function quizCountOf(lesson) {
  return cardsOf(lesson).filter(c => c.type === 'quiz').length;
}

// Mirrors admin-api/routes.js's completeLesson reward formula for the
// ceiling case (zero mistakes, perfect bonus) — used only to preview
// "up to +N XP" before a lesson starts. The server remains the sole
// authority on the actual reward once the lesson is submitted.
export function maxLessonXp(lesson) {
  const baseXp = quizCountOf(lesson) * 10;
  return Math.round(baseXp * 1.2);
}

// Mirrors admin-api/contentStore.js#evaluateAchievementRule exactly — an
// achievement's unlock condition is data (`rule`), not a hardcoded id, so
// the admin panel can add unlimited new achievements with no code change.
export function evaluateAchievementRule(rule, ctx) {
  switch (rule?.type) {
    case 'lessons_completed':     return ctx.completedCount >= (rule.value || 0);
    case 'streak_days':           return ctx.streak >= (rule.value || 0);
    case 'xp_total':              return ctx.xp >= (rule.value || 0);
    case 'perfect_lesson':        return ctx.reward?.perfect === true && !ctx.reward?.isReview;
    case 'all_lessons_completed': return ctx.totalLessons > 0 && ctx.completedCount >= ctx.totalLessons;
    default: return false;
  }
}

// Returns list of achievement IDs newly earned (not already in user.state.achievements)
export function checkNewAchievements(userState, reward, allAchievements, totalLessons) {
  if (!userState || !allAchievements?.length) return [];
  const earned = new Set(userState.achievements || []);
  const ctx = {
    // Lifetime total — mirrors the server's rule engine in
    // admin-api/contentStore.js#checkNewAchievements.
    xp: userState.lifetimeXp || 0,
    streak: userState.streak || 0,
    completedCount: (userState.completedLessons || []).length,
    totalLessons,
    reward,
  };

  const newlyEarned = [];
  for (const ach of allAchievements) {
    if (earned.has(ach.id)) continue;
    if (evaluateAchievementRule(ach.rule, ctx)) newlyEarned.push(ach.id);
  }
  return newlyEarned;
}
