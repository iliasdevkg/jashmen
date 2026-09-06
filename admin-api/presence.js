// admin-api/presence.js — who is using the app right now.
//
// Deliberately in memory and nowhere else. "Online" is a fact about the last
// couple of minutes: it has no value after a restart, nobody needs its
// history, and writing a timestamp to db.json on every authenticated request
// would turn a read-heavy app into a write-heavy one for a number that is
// stale a minute later.
//
// `state.lastActiveDate` already answers "did they study today", at day
// granularity, and stays where it is. This answers a different question.

/// userId → epoch ms of the last authenticated request.
const seen = new Map();

/// How long after a request someone still counts as online. Two minutes:
/// the clients poll and navigate often enough that a real session refreshes
/// well inside it, and it is short enough that a closed tab drops off while
/// the operator is still looking at the screen.
export const ONLINE_WINDOW_MS = 2 * 60 * 1000;

/// A cap on the map, so a long-lived process cannot accumulate one entry per
/// account that ever signed in. Well above any plausible concurrent load —
/// this is a leak guard, not a limit on how many people may be online.
const MAX_TRACKED = 20_000;

export function touch(userId) {
  if (!userId) return;
  seen.set(userId, Date.now());
  if (seen.size > MAX_TRACKED) sweep();
}

/// Drops everyone whose window has expired. Called when the map grows past
/// the cap and on every read, so the size is bounded by actual traffic
/// rather than by history.
function sweep() {
  const cutoff = Date.now() - ONLINE_WINDOW_MS;
  for (const [id, ts] of seen) {
    if (ts < cutoff) seen.delete(id);
  }
}

/// Ids seen within [windowMs], most recent first.
export function onlineIds(windowMs = ONLINE_WINDOW_MS) {
  sweep();
  const cutoff = Date.now() - windowMs;
  return [...seen.entries()]
    .filter(([, ts]) => ts >= cutoff)
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);
}

/// When [userId] was last seen, or null. Lets the admin show "3 мүнөт мурун"
/// beside someone who has just dropped out of the window.
export function lastSeen(userId) {
  return seen.get(userId) ?? null;
}

export function onlineCount(windowMs = ONLINE_WINDOW_MS) {
  return onlineIds(windowMs).length;
}
