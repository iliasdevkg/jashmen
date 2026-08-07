// admin-api/hearts.js
//
// Server-side mirror of src/utils.js#computeLiveHearts. Hearts regenerate
// passively over time, so the "true" count is always derived from a stored
// base value + an anchor timestamp rather than kept in sync via a timer.
// Keep this in lockstep with the frontend copy — it's the same formula.

export const MAX_HEARTS = 5;
export const REFILL_MS = 20 * 60 * 1000; // 20 min per heart

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

// Persists a new hearts value and resets the regen anchor to now. Any write
// to `hearts` must go through this — leaving a stale heartsRefilledAt would
// let computeLiveHearts hand out regen credit that was never earned.
export function setHearts(state, newHearts) {
  state.hearts = Math.max(0, Math.min(MAX_HEARTS, newHearts));
  state.heartsRefilledAt = Date.now();
}
