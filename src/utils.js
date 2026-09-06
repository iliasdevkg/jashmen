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
  // Energy spent on something that is not a lesson — today, a streak repair.
  const spentToday   = samePeriod ? (state.energySpentToday || 0) : 0;

  const cap = dailyFreeLessons + bonusToday + supportToday;
  const remaining = Math.max(0, cap - lessonsToday - givenToday - spentToday);
  const resetMs = remaining <= 0 ? (period + 1) * periodMs - Date.now() : null;
  return { remaining, resetMs };
}

// The pending streak-repair offer, or null — the client mirror of
// routes.js#streakRepairOffer. A broken run can be bought back with energy
// on the day it broke and no later, so this reads `streakLostAt` against
// today's UTC date rather than trusting a flag the server set hours ago.
// An admin cost of 0 means the offer does not exist at all.
export function streakRepairOffer(state, content) {
  const cost = parseInt(content?.limits?.streakRepairEnergy, 10);
  if (!Number.isFinite(cost) || cost <= 0) return null;
  if (!state?.streakLost) return null;
  if (state.streakLostAt !== new Date().toISOString().slice(0, 10)) return null;
  return { lost: state.streakLost, cost };
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

// Every card type the learner is GRADED on — the exact set the server pays
// for (admin-api/contentStore.js#GRADED_CARD_TYPES). `theory` and `media`
// are read-through, so they are worth no XP on either side.
export const GRADED_CARD_TYPES = new Set(['quiz', 'match', 'build']);

export function isGradedCard(card) {
  return GRADED_CARD_TYPES.has(card?.type);
}

// How many cards in this lesson actually pay out. The server's
// gradedCountOf() counts off `cards` and falls back to the legacy flat
// `questions` array; cardsOf() already performs that same fallback (every
// legacy question becomes a quiz card), so filtering it here gives the
// identical number — which is the point: the "up to +N XP" preview must
// promise exactly what completeLesson will pay.
export function gradedCountOf(lesson) {
  return cardsOf(lesson).filter(isGradedCard).length;
}

// The historic name. It predates `match`/`build`, so it no longer counts
// only quizzes — but LearnPage and LessonPreviewSheet import it, and the
// number they want is precisely the graded count, so it stays as an alias
// rather than becoming a second, wrong definition.
export const quizCountOf = gradedCountOf;

// Mirrors admin-api/routes.js's completeLesson reward formula for the
// ceiling case (zero mistakes, perfect bonus) — used only to preview
// "up to +N XP" before a lesson starts. The server remains the sole
// authority on the actual reward once the lesson is submitted.
export function maxLessonXp(lesson, limits) {
  // The two numbers came from the Лимиттер tab; hardcoding them here meant
  // an admin could raise the XP per question and the preview would still
  // promise the old figure while the server paid the new one. Defaults match
  // routes.js's own fallbacks so a limits fetch that hasn't landed yet still
  // previews something sane.
  const perQuestion = limits?.xpPerQuestion ?? 10;
  const perfectPct  = limits?.xpPerfectBonusPct ?? 20;
  const baseXp = gradedCountOf(lesson) * perQuestion;
  return baseXp + Math.round(baseXp * (perfectPct / 100));
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

// ── Streak colours ─────────────────────────────────────────────────────────
//
// The streak burns blue. Kept in one place rather than typed into the six
// components that draw it — the header chip, the sidebar, the right panel,
// the league row, the profile card and the celebration screen — so that
// "change the streak's colour" stays a single edit.
//
// Deliberately NOT the app's existing #1CB0F6: that blue already means
// energy and lessons, and a streak that wears it becomes unreadable next to
// them. This one is deeper and more saturated. The core is lighter than the
// body for the same reason a real flame's hottest part is: it reads as fire.
export const STREAK = {
  main: '#2E6BFF',   // labels, the active tab, today's ring
  soft: '#4C8DFF',   // the small chips, where a deep blue would go muddy
  flameTop: '#3D7BFF',
  flameBottom: '#1B4FD8',
  coreTop: '#A8CCFF',
  coreBottom: '#4E9BFF',
  barFrom: '#3E8DFF',
  barTo: '#7FB4FF',
  ink: '#062A66',    // text sitting on a filled day
};
