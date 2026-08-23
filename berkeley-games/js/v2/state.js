// Canonical reboot state and budget logic (Reboot spec §100-§103).
//
// One visible number: BUDGET GAP. The recurring/one-time distinction is taught
// by what carries into the next fiscal year, never by a second gauge (§6).

import {
  TOOLS, TOOL_KEYS, COUNCIL_ACTIVE, COUNCIL_NOT_ON_TABLE, COUNCIL_RHETORICAL,
  toolCapacity, debtServiceRate, depthBand, depthFraction, ALLOCATION_STEP,
  COUNCIL_APPETITE
} from './content/tools.js';
import {
  FIRST_FISCAL_YEAR, FIRST_OPENING_GAP, ANNUAL_PRESSURES, ONE_TIME_MEASURES,
  LABELS, WORKFORCE, CAMPAIGN_YEARS
} from './content/cycle.js';
import { SLASH_ORDER, SLASH_YIELD_PER_STEP } from './content/city.js';

export const GAP_EPSILON = 1e-6;

export function createGameState(mode) {
  return {
    mode,                                   // 'common' | 'council'
    fiscalYearIndex: 0,
    fiscalYear: FIRST_FISCAL_YEAR,
    phase: 'garage',                        // 'garage' | 'tour' | 'meeting' | 'ended'

    budget: {
      openingGap: FIRST_OPENING_GAP,
      gapRemaining: FIRST_OPENING_GAP,

      // Carried forward into later opening gaps.
      recurringSavings: 0,
      recurringRevenue: 0,
      annualDebtService: 0,
      taxBaseRamp: [],                      // growth maturing across future years

      nextYearPressures: [],                // {label, amount, recurring, labor}
      recurringCommitments: [],             // {label, annualCost, adoptedOnConsent}

      workforceCostFactor: WORKFORCE.initialFactor,
      oneTimeUsedThisYear: [],
      oneTimeUsedEver: [],
      oneTimeReliefThisYear: 0,
      lastReveal: null
    },

    // Tentative allocations for the session in progress, in $M.
    allocations: Object.fromEntries(TOOL_KEYS.map(k => [k, 0])),
    slashAllocation: 0,
    // How many prior fiscal years each tool was used in, which is what shrinks
    // its capacity (§83).
    toolYearsUsed: Object.fromEntries(TOOL_KEYS.map(k => [k, 0])),
    toolUsedThisYear: Object.fromEntries(TOOL_KEYS.map(k => [k, false])),

    city: {
      streets: 3, fire: 3, pool: 3, library: 3, parks: 3,
      businessDistrict: 1, discretionaryLoad: 3
    },
    // Tour-visible flags set at adoption, cleared each new year.
    tourFlags: { prioritized: false, altDelivery: false, paved: false, slashed: [] },

    politics: {
      voterSentiment: 70, activistSentiment: 70, credibility: 100,
      politicalProfile: 0,
      specialMeetingUsedThisYear: false, totalSpecialMeetings: 0,
      panderUses: 0, extensions: 0, rageQuits: 0,
      megaPanderCommitments: 0, credibilityExhausted: false
    },

    weather: { rainLevel: 0 },
    easterEggs: { rooseveltPromptSeen: false, higherOfficeEscaped: false },
    history: []                             // one entry per adopted budget
  };
}

/* ------------------------------------------------------------------ */
/* Tool availability                                                   */
/* ------------------------------------------------------------------ */

/**
 * How a tool behaves this run: 'active', 'off-table' (Council, §19), or
 * 'rhetorical' (Council GROW TAX BASE — warm words, $0, §21).
 */
export function toolStatus(state, key) {
  if (state.mode === 'common') return 'active';
  if (key === COUNCIL_RHETORICAL) return 'rhetorical';
  if (COUNCIL_NOT_ON_TABLE.includes(key)) return 'off-table';
  return COUNCIL_ACTIVE.includes(key) ? 'active' : 'off-table';
}

/** Remaining capacity a tool can still contribute in this session. */
export function availableCapacity(state, key) {
  if (toolStatus(state, key) !== 'active') return 0;
  const total = toolCapacity(TOOLS[key], state.toolYearsUsed[key]);
  return Math.max(0, total - state.allocations[key]);
}

export function totalCapacity(state, key) {
  if (toolStatus(state, key) !== 'active') return 0;
  const appetite = state.mode === 'council' ? COUNCIL_APPETITE : 1;
  return toolCapacity(
    TOOLS[key], state.toolYearsUsed[key], state.budget.openingGap, appetite
  );
}

/** Depth band and meter fraction for a tool's current allocation (§26). */
export function toolDepth(state, key) {
  const tool = TOOLS[key];
  const alloc = state.allocations[key];
  return {
    band: depthBand(tool, alloc, state.budget.openingGap),
    fraction: depthFraction(tool, alloc, state.budget.openingGap)
  };
}

/* ------------------------------------------------------------------ */
/* Allocation                                                          */
/* ------------------------------------------------------------------ */

function roundMoney(v) {
  return Math.round(v * 100) / 100;
}

/**
 * Moves a tool's allocation by `delta` steps, clamped to remaining capacity
 * and to the gap so the player can never over-allocate into a fake surplus
 * (§101). Returns the actual change applied.
 */
export function allocate(state, key, deltaSteps) {
  if (toolStatus(state, key) !== 'active') return 0;

  const step = ALLOCATION_STEP * deltaSteps;
  const current = state.allocations[key];
  const capacity = totalCapacity(state, key);

  let next = Math.max(0, Math.min(capacity, current + step));
  // Never allocate past zero gap; clamp the last increment to the exact
  // remainder so reaching $0 is always possible without overshoot (§14).
  const increase = next - current;
  if (increase > 0) next = current + Math.min(increase, state.budget.gapRemaining);

  const applied = roundMoney(next - current);
  if (Math.abs(applied) < 1e-9) return 0;

  state.allocations[key] = roundMoney(next);
  state.budget.gapRemaining = roundMoney(state.budget.gapRemaining - applied);
  return applied;
}

/** SLASH SERVICES: the punitive fallback that can always finish the job (§33). */
export function allocateSlash(state, deltaSteps) {
  const step = ALLOCATION_STEP * deltaSteps;
  const current = state.slashAllocation;
  let next = Math.max(0, current + step);
  const increase = next - current;
  if (increase > 0) next = current + Math.min(increase, state.budget.gapRemaining);

  const applied = roundMoney(next - current);
  if (Math.abs(applied) < 1e-9) return 0;

  state.slashAllocation = roundMoney(next);
  state.budget.gapRemaining = roundMoney(state.budget.gapRemaining - applied);
  return applied;
}

/** One-time measures reduce this year's gap and never recur (§15, §16). */
export function useOneTime(state, measure) {
  const b = state.budget;
  if (b.oneTimeUsedThisYear.includes(measure.id)) return null;
  if (measure.oncePerCampaign && b.oneTimeUsedEver.includes(measure.id)) return null;

  const applied = roundMoney(Math.min(measure.amount, b.gapRemaining));
  if (applied <= 0) return null;

  b.gapRemaining = roundMoney(b.gapRemaining - applied);
  b.oneTimeReliefThisYear = roundMoney(b.oneTimeReliefThisYear + applied);
  b.oneTimeUsedThisYear.push(measure.id);
  if (!b.oneTimeUsedEver.includes(measure.id)) b.oneTimeUsedEver.push(measure.id);

  return { amount: applied, capped: applied < measure.amount, triggersRain: measure.triggersRain };
}

export function canAdopt(state) {
  return state.budget.gapRemaining <= GAP_EPSILON;
}

export function raiseRain(state) {
  state.weather.rainLevel = Math.min(3, state.weather.rainLevel + 1);
  return state.weather.rainLevel;
}

/* ------------------------------------------------------------------ */
/* Adoption                                                            */
/* ------------------------------------------------------------------ */

/**
 * Locks the package in: stores recurring effects, future liabilities, and the
 * damage that service slashing did to the city (§37).
 */
export function adoptBudget(state) {
  const b = state.budget;
  const flags = { prioritized: false, altDelivery: false, paved: false, slashed: [] };

  for (const key of TOOL_KEYS) {
    const amount = state.allocations[key];
    if (amount <= 0) continue;
    const tool = TOOLS[key];

    state.toolYearsUsed[key] += 1;
    state.toolUsedThisYear[key] = true;

    switch (tool.kind) {
      case 'recurring':
        if (key === 'fees' || key === 'taxes') b.recurringRevenue += amount;
        else b.recurringSavings += amount;
        break;
      case 'delayed': {
        // Large opportunity, slow realisation (§16, §17): a slice lands this
        // year, the rest ramps toward maturity over the following years.
        const now = amount * tool.currentYearShare;
        b.recurringRevenue += now;
        b.taxBaseRamp.push({
          remaining: amount * tool.matureMultiplier - now,
          perYear: (amount * tool.matureMultiplier - now) / 3
        });
        break;
      }
      case 'debt': {
        const depth = depthFraction(tool, amount, b.openingGap);
        b.annualDebtService +=
          amount * debtServiceRate(tool, state.toolYearsUsed[key] - 1, depth);
        break;
      }
    }

    if (tool.reducesDiscretionary) {
      state.city.discretionaryLoad = Math.max(0, state.city.discretionaryLoad - 1);
      flags.prioritized = true;
    }
    if (tool.workforceRelief) {
      b.workforceCostFactor = Math.max(
        WORKFORCE.minFactor, b.workforceCostFactor - tool.workforceRelief
      );
    }
    if (key === 'alternativeDelivery') flags.altDelivery = true;
    if (key === 'growTaxBase') {
      state.city.businessDistrict = Math.min(3, state.city.businessDistrict + 1);
    }
    if (tool.enablesStreetWork) flags.paved = true;
  }

  // Service slashing damages core services in a configured order (§34).
  if (state.slashAllocation > 0) {
    let steps = Math.ceil(state.slashAllocation / SLASH_YIELD_PER_STEP);
    for (const service of SLASH_ORDER) {
      while (steps > 0 && state.city[service] > 0) {
        state.city[service] -= 1;
        flags.slashed.push(service);
        steps -= 1;
      }
      if (steps <= 0) break;
    }
  }

  // Protected maintenance means the street actually gets paved (§79).
  if (state.city.streets >= 3 && !flags.slashed.includes('streets')) flags.paved = true;

  state.tourFlags = flags;
  state.history.push({
    fiscalYear: state.fiscalYear,
    allocations: { ...state.allocations },
    slash: state.slashAllocation,
    oneTime: b.oneTimeReliefThisYear
  });

  state.phase = 'tour';
  return flags;
}

/* ------------------------------------------------------------------ */
/* Tour events and rollover                                            */
/* ------------------------------------------------------------------ */

/** Tour events queue against the next budget; they never reopen this one (§103). */
export function queueNextYearPressure(state, entry) {
  state.budget.nextYearPressures.push(entry);
  return entry;
}

export function addRecurringCommitment(state, commitment) {
  state.budget.recurringCommitments.push(commitment);
  return commitment;
}

/**
 * Builds the next fiscal year's opening gap and the reveal that explains it
 * (§85). The line items must sum to the stated gap.
 */
export function rolloverYear(state) {
  const b = state.budget;
  state.fiscalYearIndex += 1;
  state.fiscalYear += 1;

  const lines = [];
  const yearIndex = state.fiscalYearIndex;

  // Whatever recurring pressure was not permanently solved carries forward.
  //
  // Service cuts are real recurring reductions, so they offset the carry too —
  // otherwise a slashing year inherits its whole gap again on top of fresh
  // pressure and the mode dies in one cliff rather than degrading (§86).
  const cutsLastYear = state.history.length
    ? state.history[state.history.length - 1].slash : 0;
  const carried = Math.max(
    0, b.openingGap - b.recurringSavings - b.recurringRevenue - cutsLastYear
  );
  if (carried > 0) lines.push({ label: LABELS.priorRecurring, amount: carried });
  let opening = carried;

  const credit = (label, amount) => {
    if (amount <= 0) return;
    opening -= amount;
    lines.push({ label, amount: -amount, credit: true });
  };

  for (const p of ANNUAL_PRESSURES) {
    const gross = p.base + p.growth * (yearIndex - 1);
    const amount = p.labor ? gross * b.workforceCostFactor : gross;
    opening += amount;
    lines.push({ label: p.label, amount });
  }

  if (b.annualDebtService > 0) {
    opening += b.annualDebtService;
    lines.push({ label: LABELS.debtService, amount: b.annualDebtService });
  }

  // Queued tour events land now.
  for (const p of b.nextYearPressures) {
    opening += p.amount;
    lines.push({ label: p.label, amount: p.amount });
    if (p.recurring && p.labor) b.workforceCostFactor = b.workforceCostFactor; // no-op, kept explicit
  }
  b.nextYearPressures = [];

  for (const c of b.recurringCommitments) {
    opening += c.annualCost;
    lines.push({
      label: c.adoptedOnConsent ? LABELS.consentItem : LABELS.newProgram,
      amount: c.annualCost
    });
  }

  // One-time relief simply is not there any more (§53, §87).
  if (b.oneTimeReliefThisYear > 0) {
    opening += b.oneTimeReliefThisYear;
    lines.push({ label: LABELS.oneTimeExpired, amount: b.oneTimeReliefThisYear });
  }

  // Tax-base investment matures a step at a time (§17).
  let matured = 0;
  for (const ramp of b.taxBaseRamp) {
    const step = Math.min(ramp.perYear, ramp.remaining);
    ramp.remaining -= step;
    matured += step;
  }
  b.taxBaseRamp = b.taxBaseRamp.filter(r => r.remaining > 0.01);
  if (matured > 0) {
    b.recurringRevenue += matured;
    credit(LABELS.taxBaseGrowth, matured);
  }

  opening = roundMoney(Math.max(0, opening));

  b.openingGap = opening;
  b.gapRemaining = opening;
  b.oneTimeUsedThisYear = [];
  b.oneTimeReliefThisYear = 0;
  b.lastReveal = { fiscalYear: state.fiscalYear, lines, gap: opening };

  state.allocations = Object.fromEntries(TOOL_KEYS.map(k => [k, 0]));
  state.slashAllocation = 0;
  state.toolUsedThisYear = Object.fromEntries(TOOL_KEYS.map(k => [k, false]));
  state.politics.specialMeetingUsedThisYear = false;
  state.tourFlags = { prioritized: false, altDelivery: false, paved: false, slashed: [] };
  state.phase = 'garage';

  // Rain eases between years but does not vanish.
  state.weather.rainLevel = Math.max(0, state.weather.rainLevel - 1);

  return b.lastReveal;
}

/**
 * Counted in adopted budgets rather than rollovers, because the check happens
 * at the end of a tour — before the next year has been built.
 */
export function isCampaignComplete(state) {
  return state.history.length >= CAMPAIGN_YEARS;
}

/** Opening reveal for the very first year, which has no history to inherit. */
export function buildFirstReveal(state) {
  const b = state.budget;
  b.lastReveal = {
    fiscalYear: state.fiscalYear,
    lines: [
      { label: 'Inherited recurring gap', amount: 14.4 },
      { label: 'Pension growth', amount: 2.0 },
      { label: 'Infrastructure liabilities', amount: 2.5 },
      { label: 'Union pay-scale increase', amount: 2.1 }
    ],
    gap: b.openingGap
  };
  return b.lastReveal;
}

export { TOOLS, TOOL_KEYS, ONE_TIME_MEASURES, ALLOCATION_STEP };
