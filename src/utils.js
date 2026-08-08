// Client mirror of admin-api/energy.js#computeLiveEnergy — same formula,
// kept in lockstep. Replaces the old mistake-based hearts system: users get
// `dailyFreeLessons` (admin-configurable, see content.limits) genuine
// lesson completions per calendar day (UTC), resetting at midnight.
export function computeLiveEnergy(state, dailyFreeLessons = 3) {
  if (!state) return { remaining: dailyFreeLessons, resetMs: null };
  const today = new Date().toISOString().slice(0, 10);
  const sameDay = state.energyDate === today;
  const lessonsToday = sameDay ? (state.lessonsToday || 0) : 0;
  const bonusToday   = sameDay ? (state.bonusEnergyToday || 0) : 0;
  const cap = dailyFreeLessons + bonusToday;
  const remaining = Math.max(0, cap - lessonsToday);
  let resetMs = null;
  if (remaining <= 0) {
    const now = new Date();
    const nextMidnightUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
    resetMs = nextMidnightUTC - Date.now();
  }
  return { remaining, resetMs };
}

export function formatCountdown(ms) {
  if (!ms || ms <= 0) return '0:00';
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}:${String(s).padStart(2, '0')}`;
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
    xp: userState.xp || 0,
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
