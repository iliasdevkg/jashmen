// admin-api/energy.js
//
// Replaces the old mistake-based hearts system. Per JASHMEN.pdf's "daily
// energy" model: a user gets `dailyFreeLessons` (admin-configurable via
// Module В, see contentStore.js#getLimits) genuine lesson completions per
// refill period — wrong answers inside a lesson no longer cost anything;
// the gate is checked once, before a completion is accepted.
//
// The refill period itself is admin-editable (`limits.energyRefillHours`,
// default 24). Periods are absolute slices of epoch time —
// floor(now / periodMs) — NOT a rolling timer anchored to each user's last
// lesson: that keeps every client's countdown ("энергия N саатта толот")
// derivable from the clock alone, with no extra state to sync, and at the
// default 24 h a period boundary IS UTC midnight, so the behaviour the
// calendar-day model had is preserved bit for bit.
//
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

// Default cap on coin-bought refills so energy always stays finite — actual
// cap is admin-editable (Task 12, contentStore.js#getLimits().maxBonusEnergyPerDay);
// this is only the fallback grantBonusEnergy() uses when no cap is passed in.
export const MAX_BONUS_PER_DAY = 3;

// Fallback refill period, used when no admin value is passed in. 24 h keeps
// the pre-interval calendar-day behaviour exactly.
export const DEFAULT_REFILL_HOURS = 24;

// Guard rails on the admin-editable value: at least an hour (below that the
// gate stops being a gate), at most a week.
export const MIN_REFILL_HOURS = 1;
export const MAX_REFILL_HOURS = 168;

function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

export function normalizeRefillHours(hours) {
  const n = Number(hours);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_REFILL_HOURS;
  return Math.min(MAX_REFILL_HOURS, Math.max(MIN_REFILL_HOURS, Math.round(n)));
}

export function refillPeriodMs(hours = DEFAULT_REFILL_HOURS) {
  return normalizeRefillHours(hours) * 3_600_000;
}

// Absolute period index. At 24 h this is exactly the UTC day number, which
// is what makes the migration below a no-op for anyone mid-day.
export function currentPeriod(hours = DEFAULT_REFILL_HOURS) {
  return Math.floor(Date.now() / refillPeriodMs(hours));
}

export function periodEndsAt(hours = DEFAULT_REFILL_HOURS) {
  const ms = refillPeriodMs(hours);
  return (Math.floor(Date.now() / ms) + 1) * ms;
}

// Rolls the per-period counters over the moment the stored period has
// passed. Called before every read AND every write so state never drifts
// stale.
function rollIfNewPeriod(state, hours) {
  const period = currentPeriod(hours);

  // Migration from the calendar-day model: states written before
  // energyPeriod existed carry only `energyDate`. One whose date is still
  // today is mid-period and must keep its counters (otherwise every user
  // gets a silent free refill the moment this deploys); an older one rolls
  // exactly as the calendar-day code would have rolled it.
  if (state.energyPeriod === undefined || state.energyPeriod === null) {
    state.energyPeriod = period;
    if (state.energyDate !== todayUTC()) {
      state.energyDate = todayUTC();
      state.lessonsToday = 0;
      state.bonusEnergyToday = 0;
    }
    if (typeof state.energyGivenToday !== 'number') state.energyGivenToday = 0;
    if (typeof state.supportEnergyToday !== 'number') state.supportEnergyToday = 0;
    if (typeof state.energySpentToday !== 'number') state.energySpentToday = 0;
    return;
  }

  if (state.energyPeriod !== period) {
    state.energyPeriod = period;
    state.energyDate = todayUTC();
    state.lessonsToday = 0;
    state.bonusEnergyToday = 0;
    state.energyGivenToday = 0;
    state.supportEnergyToday = 0;
    state.energySpentToday = 0;
  }
}

export function computeLiveEnergy(state, dailyFreeLessons, hours = DEFAULT_REFILL_HOURS) {
  if (!state) return { remaining: dailyFreeLessons, resetInMs: null };
  rollIfNewPeriod(state, hours);
  // Support energy given by university-league viewers stacks on top of the
  // free allowance the same way a coin-bought refill does, but is tracked
  // separately so the two caps never eat each other.
  const cap = dailyFreeLessons + (state.bonusEnergyToday || 0) + (state.supportEnergyToday || 0);
  // Energy a viewer gifted away is spent from the same pool as a lesson —
  // that is what makes the gift cost the giver something real. So is energy
  // spent on anything else the app sells for energy (a streak repair), which
  // is counted apart from `lessonsToday` so that number stays an honest
  // answer to "how many lessons did they finish".
  const used = (state.lessonsToday || 0)
    + (state.energyGivenToday || 0)
    + (state.energySpentToday || 0);
  const remaining = Math.max(0, cap - used);
  let resetInMs = null;
  if (remaining <= 0) resetInMs = periodEndsAt(hours) - Date.now();
  return { remaining, resetInMs };
}

// Called once per genuine (non-review) lesson completion — never on mistakes.
export function spendEnergy(state, hours = DEFAULT_REFILL_HOURS) {
  rollIfNewPeriod(state, hours);
  state.lessonsToday = (state.lessonsToday || 0) + 1;
}

// Energy spent on something that is not a lesson and not a gift — today,
// only a streak repair (routes.js#/u/me/streak/repair). The caller checks
// the balance first; this just records the spend.
export function spendEnergyOn(state, amount, hours = DEFAULT_REFILL_HOURS) {
  rollIfNewPeriod(state, hours);
  state.energySpentToday = (state.energySpentToday || 0) + Math.max(0, amount);
}

// Coin-bought refill, capped per period so it can't be farmed into infinite
// energy. Returns false if this period's bonus cap is already used up.
export function grantBonusEnergy(state, maxPerDay = MAX_BONUS_PER_DAY, hours = DEFAULT_REFILL_HOURS) {
  rollIfNewPeriod(state, hours);
  if ((state.bonusEnergyToday || 0) >= maxPerDay) return false;
  state.bonusEnergyToday = (state.bonusEnergyToday || 0) + 1;
  return true;
}

// ── University-league support energy ───────────────────────────────────────
//
// A viewer ("зритель") spends `amount` of their own energy to hand it to a
// student. Both sides roll first so a gift is always accounted to the
// current period, and the giver is capped at one gift per period.

export function canGiveSupportEnergy(state, amount, hours = DEFAULT_REFILL_HOURS, dailyFreeLessons = 0) {
  rollIfNewPeriod(state, hours);
  if (state.supportGivenPeriod === currentPeriod(hours)) return 'already';
  const { remaining } = computeLiveEnergy(state, dailyFreeLessons, hours);
  if (remaining < amount) return 'insufficient';
  return 'ok';
}

export function spendSupportEnergy(state, amount, hours = DEFAULT_REFILL_HOURS) {
  rollIfNewPeriod(state, hours);
  state.energyGivenToday = (state.energyGivenToday || 0) + amount;
  state.supportGivenPeriod = currentPeriod(hours);
}

export function receiveSupportEnergy(state, amount, hours = DEFAULT_REFILL_HOURS) {
  rollIfNewPeriod(state, hours);
  state.supportEnergyToday = (state.supportEnergyToday || 0) + amount;
}
