// admin-api/energy.js
//
// Replaces the old mistake-based hearts system. Per JASHMEN.pdf's "daily
// energy" model: a user gets `dailyFreeLessons` (admin-configurable via
// Module В, see contentStore.js#getLimits) genuine lesson completions per
// calendar day (UTC) — wrong answers inside a lesson no longer cost
// anything; the gate is checked once, before a completion is accepted.
// Extra energy can be bought with coins (see the 'energy_refill' shop item
// handled in routes.js#/u/me/buy) — a stand-in for the PDF's "watch an ad"
// bypass. This is a deliberate, honest substitution, not a shortcut: real
// rewarded-video ad SDKs (AdMob, Unity Ads, IronSource...) need a signed-up
// publisher account and a server-side reward callback (SSV) that only the
// ad network can issue — no amount of code here can fake that without
// those credentials. When you have them, the integration point is exactly
// one function: add a `POST /u/me/energy/watch-ad` route that verifies the
// network's SSV callback (their docs cover the signature check) and calls
// grantBonusEnergy(state) on success — same function the coin purchase
// already calls, same MAX_BONUS_PER_DAY cap applies automatically. Nothing
// else in the energy system needs to change.

export const MAX_BONUS_PER_DAY = 3; // cap on coin-bought refills so energy always stays finite

function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

// Rolls the per-day counters over the moment the stored date has passed.
// Called before every read AND every write so state never drifts stale.
function rollIfNewDay(state) {
  const today = todayUTC();
  if (state.energyDate !== today) {
    state.energyDate = today;
    state.lessonsToday = 0;
    state.bonusEnergyToday = 0;
  }
}

export function computeLiveEnergy(state, dailyFreeLessons) {
  if (!state) return { remaining: dailyFreeLessons, resetInMs: null };
  rollIfNewDay(state);
  const cap = dailyFreeLessons + (state.bonusEnergyToday || 0);
  const remaining = Math.max(0, cap - (state.lessonsToday || 0));
  let resetInMs = null;
  if (remaining <= 0) {
    const now = new Date();
    const nextMidnightUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
    resetInMs = nextMidnightUTC - Date.now();
  }
  return { remaining, resetInMs };
}

// Called once per genuine (non-review) lesson completion — never on mistakes.
export function spendEnergy(state) {
  rollIfNewDay(state);
  state.lessonsToday = (state.lessonsToday || 0) + 1;
}

// Coin-bought refill, capped per day so it can't be farmed into infinite
// energy. Returns false if today's bonus cap is already used up.
export function grantBonusEnergy(state) {
  rollIfNewDay(state);
  if ((state.bonusEnergyToday || 0) >= MAX_BONUS_PER_DAY) return false;
  state.bonusEnergyToday = (state.bonusEnergyToday || 0) + 1;
  return true;
}
