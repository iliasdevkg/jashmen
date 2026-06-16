const MAX_HEARTS = 5;
const REFILL_MS = 20 * 60 * 1000; // 20 min per heart

export function computeLiveHearts(state) {
  if (!state) return { hearts: MAX_HEARTS, nextRefillMs: null };
  const hearts = state.hearts ?? MAX_HEARTS;
  const heartsRefilledAt = state.heartsRefilledAt || Date.now();
  if (hearts >= MAX_HEARTS) return { hearts: MAX_HEARTS, nextRefillMs: null };
  const elapsed = Math.max(0, Date.now() - heartsRefilledAt);
  const gain = Math.floor(elapsed / REFILL_MS);
  const current = Math.min(MAX_HEARTS, hearts + gain);
  const remaining = elapsed - gain * REFILL_MS;
  const nextRefillMs = current < MAX_HEARTS ? REFILL_MS - remaining : null;
  return { hearts: current, nextRefillMs };
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
  const idx = lessonOrder.indexOf(lessonId);
  if (idx < 0) return 'locked';
  if (idx === 0) return done.has(lessonId) ? 'completed' : 'available';
  const prev = lessonOrder[idx - 1];
  if (!done.has(prev)) return 'locked';
  return done.has(lessonId) ? 'completed' : 'available';
}

// Returns list of achievement IDs newly earned (not already in user.state.achievements)
export function checkNewAchievements(userState, reward, allAchievements, totalLessons) {
  if (!userState || !allAchievements?.length) return [];
  const earned = new Set(userState.achievements || []);
  const xp = userState.xp || 0;
  const streak = userState.streak || 0;
  const completed = (userState.completedLessons || []).length;

  const newlyEarned = [];
  for (const ach of allAchievements) {
    if (earned.has(ach.id)) continue;
    let qualifies = false;
    switch (ach.id) {
      case 'first':   qualifies = completed >= 1; break;
      case 'streak7': qualifies = streak >= 7; break;
      case 'xp100':   qualifies = xp >= 100; break;
      case 'xp1000':  qualifies = xp >= 1000; break;
      case 'perfect': qualifies = reward?.perfect === true && !reward?.isReview; break;
      case 'expert':  qualifies = totalLessons > 0 && completed >= totalLessons; break;
    }
    if (qualifies) newlyEarned.push(ach.id);
  }
  return newlyEarned;
}
