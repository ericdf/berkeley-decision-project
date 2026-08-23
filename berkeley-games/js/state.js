// Fiscal state model and the rules that act on it (spec §11-§19, §23).
// This module is pure logic: it never touches the DOM or the canvas.

import { LANE_KEYS, COUNCIL_OPEN_LANES, COUNCIL_CLOSED_LANES } from './content/lanes.js';
import {
  FIRST_FISCAL_YEAR, ANNUAL_PRESSURES, OPENING_GAP, BUDGET_TUNING, LABELS,
  WORKFORCE, FIRST_YEAR_LINES
} from './content/budget.js';

export const WEAR_MAX = 100;
export const BRIDGE_TOLERANCE = 1e-6;
export const CAMPAIGN_BRIDGES = 6; // spec §25

export function createGameState(mode) {
  return {
    mode,                      // 'common' | 'council'
    bridgeNumber: 0,
    distance: 0,
    speed: 0,
    fiscalYear: FIRST_FISCAL_YEAR,

    /**
     * The single fiscal number the player manages (Tightening addendum §2).
     * `currentGap` must reach zero before the next bridge. The recurring vs
     * one-time distinction lives in how next year's `openingGap` is built,
     * not in a second HUD value.
     */
    budget: {
      openingGap: OPENING_GAP,
      currentGap: OPENING_GAP,

      // Carried into future opening gaps. Kept apart so a shock's ongoing
      // pressure and the player's ongoing fixes can be reported separately at
      // the year open rather than silently cancelling.
      recurringImprovement: 0,   // recurring savings + recurring new revenue
      recurringPressure: 0,      // ongoing cost added by this year's shocks
      annualDebtService: 0,
      recurringCommitments: [],  // {source, annualCost, adoptedOnConsent}

      // Recurring benefits that mature at the next fiscal year.
      pendingRecurring: [],

      oneTimeReliefTaken: 0,
      lastReveal: null,          // line items from the most recent year open

      // Labor mechanics (Budget Cycle addendum Parts IV-VI).
      // A single hidden factor stands in for staffing exposure; PRIORITIZE and
      // EFFICIENCY shrink it, and it scales future labor increases.
      workforceCostFactor: WORKFORCE.initialFactor,
      pendingLaborContract: 0,   // agreed this year, paid from next year
      recurringLaborCost: 0,     // matured contract increases
      shocksThisYear: []
    },

    rainLevel: 0,

    laneWear: Object.fromEntries(LANE_KEYS.map(k => [k, 0])),

    closedLanes: mode === 'council' ? [...COUNCIL_CLOSED_LANES] : [],
    score: 0,

    // Bookkeeping for end-screen summaries (spec §23, §24).
    lanesUsed: Object.fromEntries(LANE_KEYS.map(k => [k, 0])),
    oneTimeCollected: 0,
    oneTimeTotal: 0,
    decisionsMade: 0
  };
}

/**
 * The opening forecast for the very first fiscal year (Budget Cycle addendum
 * §4). Later years build theirs during `crossBridge`.
 */
export function buildOpeningForecast(state) {
  const b = state.budget;
  b.lastReveal = {
    fiscalYear: state.fiscalYear,
    lines: FIRST_YEAR_LINES.map(l => ({ ...l })),
    gap: b.openingGap
  };
  return b.lastReveal;
}

export function isLaneOpen(state, laneKey) {
  return !state.closedLanes.includes(laneKey);
}

export function isLaneFailed(state, laneKey) {
  return state.laneWear[laneKey] >= WEAR_MAX;
}

/** Lanes the player can actually commit a response in right now. */
export function usableLanes(state) {
  return LANE_KEYS.filter(k => isLaneOpen(state, k) && !isLaneFailed(state, k));
}

/** Wear tier for rendering and hazard density (spec §14). */
export function wearTier(wear) {
  if (wear >= WEAR_MAX) return 'failed';
  if (wear >= 95) return 'near-failure';
  if (wear >= 70) return 'badly-worn';
  if (wear >= 35) return 'worn';
  return 'healthy';
}

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Effectiveness declines with overuse (spec §15). */
export function effectivenessMultiplier(wear) {
  return clamp(1 - wear * 0.005, 0.5, 1.0);
}

/**
 * Apply a fiscal event's headline impact. Called when the event is announced,
 * before the player reaches the decision gate. A shock widens the gap.
 */
export function applyEventImpact(state, event) {
  const b = state.budget;
  // Both fields widen the same single gap now; a capital shock hits this year,
  // an operating shock hits this year and keeps hitting.
  b.currentGap += Math.abs(event.immediateImpact);
  if (event.structuralImpact) {
    b.recurringPressure += Math.abs(event.structuralImpact);
  }
}

/**
 * Commit the player's lane choice at a decision gate (spec §13.1).
 *
 * Recurring actions close part of this year's gap AND carry into future years.
 * Borrowing closes the gap now and adds debt service that reopens it later
 * (Tightening addendum §9, §10).
 */
export function commitResponse(state, event, laneKey) {
  const response = event.responses[laneKey];
  if (!response) return null;

  const b = state.budget;
  const mult = effectivenessMultiplier(state.laneWear[laneKey]);

  const current = (response.current || 0) * mult;
  const recurring = (response.structural || 0) * mult;
  const debtService = (response.debtService || 0) * mult;

  b.currentGap -= current;

  if (response.delayed) {
    // Grow-tax-base style: the recurring benefit matures next fiscal year.
    b.pendingRecurring.push({ lane: laneKey, amount: recurring });
  } else if (recurring) {
    b.recurringImprovement += recurring;
  }

  if (debtService) {
    // Helps now, hurts every year after (addendum §10).
    b.annualDebtService += debtService;
  }

  // PRIORITIZE and EFFICIENCY shrink recurring staffing exposure, so future
  // labor increases apply to a smaller base (addendum §17, §18).
  let workforceReduced = false;
  const reduction = laneKey === 'prioritize' ? WORKFORCE.prioritizeReduction
    : laneKey === 'efficiency' ? WORKFORCE.efficiencyReduction
    : 0;
  if (reduction) {
    const before = b.workforceCostFactor;
    b.workforceCostFactor = clamp(
      b.workforceCostFactor - reduction, WORKFORCE.minFactor, 1
    );
    workforceReduced = b.workforceCostFactor < before;
  }

  state.laneWear[laneKey] = clamp(
    state.laneWear[laneKey] + (response.wear || 0), 0, WEAR_MAX
  );
  state.lanesUsed[laneKey] += 1;
  state.decisionsMade += 1;

  return {
    laneKey,
    workforceReduced,
    current,
    recurring: response.delayed ? 0 : recurring,
    delayedRecurring: response.delayed ? recurring : 0,
    debtService,
    effectiveness: mult,
    wear: state.laneWear[laneKey],
    failed: isLaneFailed(state, laneKey),
    gap: b.currentGap
  };
}

/**
 * A mid-cycle shock: genuinely new information that widens this year's gap
 * (Budget Cycle addendum §7-§9). Not recurring unless configured otherwise.
 */
export function applyShock(state, shock) {
  const b = state.budget;
  b.currentGap += shock.amount;
  b.shocksThisYear.push({ id: shock.id, amount: shock.amount });
  return { amount: shock.amount, gap: b.currentGap };
}

/**
 * Labor contract renegotiation (addendum §13-§15).
 *
 * The whole point is the delay: agreeing to a package costs nothing today and
 * lands in full at the next opening forecast.
 */
export function renegotiateLaborContract(state, contract) {
  state.budget.pendingLaborContract += contract.grossAnnualIncrease;
  return {
    gross: contract.grossAnnualIncrease,
    // What it will actually cost once the workforce factor is applied.
    effective: contract.grossAnnualIncrease * state.budget.workforceCostFactor
  };
}

/**
 * One-time pickup (spec §17.1). Reduces this year's gap only, and is capped so
 * one-time money can never be a complete strategy (addendum §6, §7).
 *
 * Deliberately does NOT change the weather: the reward lands first and the
 * consequence follows a beat later (Rainy-Day addendum §22).
 */
export function collectOneTime(state, pickup) {
  const b = state.budget;
  const cap = b.openingGap * BUDGET_TUNING.oneTimeReliefCapFraction;
  const remaining = Math.max(0, cap - b.oneTimeReliefTaken);
  const applied = Math.min(pickup.amount, remaining);

  b.currentGap -= applied;
  b.oneTimeReliefTaken += applied;
  state.oneTimeCollected += 1;
  state.oneTimeTotal += applied;

  return {
    amount: applied,
    offered: pickup.amount,
    capped: applied < pickup.amount,
    triggersRain: pickup.triggersRainyDayWeather === true
  };
}

/** Rain rises by one level per qualifying mechanism (Rainy-Day addendum §5). */
export function raiseRainLevel(state) {
  state.rainLevel = clamp(state.rainLevel + 1, 0, 3);
  return state.rainLevel;
}

/**
 * A recurring obligation booked by MEGA PANDER (Tightening addendum §22, §38).
 * It does not touch the frozen in-meeting gap; it lands at the next year open.
 */
export function addRecurringCommitment(state, commitment) {
  state.budget.recurringCommitments.push(commitment);
  return commitment;
}

/** The bridge test is now simply: is the gap closed? (addendum §8). */
export function bridgeTest(state) {
  return state.budget.currentGap <= BUDGET_TUNING.gapTolerance;
}

/**
 * Advance to the next fiscal year after a successful crossing.
 *
 * This is where the recurring/one-time distinction becomes visible: recurring
 * choices reduce the new opening gap, one-time relief simply expires, and
 * accumulated pressures plus debt service and new programs widen it
 * (addendum §4, §5, §39).
 */
export function crossBridge(state) {
  const b = state.budget;
  state.bridgeNumber += 1;
  state.fiscalYear += 1;

  // Delayed recurring benefits mature now.
  for (const d of b.pendingRecurring) b.recurringImprovement += d.amount;
  b.pendingRecurring = [];

  const yearIndex = state.bridgeNumber;
  const lines = [];

  // Shown as separate lines that actually add up: what the year started with
  // plus what the shocks added, less what the player permanently fixed.
  const carried = b.openingGap + b.recurringPressure;
  const fixed = Math.min(b.recurringImprovement, carried);
  const priorRecurring = Math.max(0, carried - fixed);

  if (carried > 0) {
    lines.push({ label: LABELS.priorRecurring, amount: carried });
  }
  if (fixed > 0) {
    lines.push({ label: LABELS.recurringSavings, amount: -fixed, credit: true });
  }

  let opening = priorRecurring;

  // One-time relief does not carry: last year's borrowed breathing room is
  // simply gone, and saying so explains why a balanced year is not an easy
  // next year (addendum §22, §23).
  if (b.oneTimeReliefTaken > 0) {
    opening += b.oneTimeReliefTaken;
    lines.push({ label: LABELS.oneTimeExpired, amount: b.oneTimeReliefTaken });
  }

  // Predictable annual pressures, known at adoption (addendum §5).
  for (const p of ANNUAL_PRESSURES) {
    const gross = p.base + p.growth * (yearIndex - 1);
    // Labor pressures scale with the workforce cost base (addendum §19).
    const amount = p.labor ? gross * b.workforceCostFactor : gross;
    opening += amount;
    lines.push({ label: p.label, amount });
  }

  // A labor contract agreed last cycle matures now (addendum §15).
  if (b.pendingLaborContract > 0) {
    const effective = b.pendingLaborContract * b.workforceCostFactor;
    b.recurringLaborCost += effective;
    b.pendingLaborContract = 0;
    opening += effective;
    lines.push({ label: LABELS.laborContract, amount: effective });
  }

  if (b.annualDebtService > 0) {
    opening += b.annualDebtService;
    lines.push({ label: LABELS.debtService, amount: b.annualDebtService });
  }

  for (const c of b.recurringCommitments) {
    opening += c.annualCost;
    lines.push({
      // The consent callback is the sharper line when it applies (§31).
      label: c.adoptedOnConsent
        ? `${LABELS.consentItem} now costs`
        : LABELS.newProgram,
      amount: c.annualCost
    });
  }

  b.openingGap = opening;
  b.currentGap = opening;
  b.recurringImprovement = 0;
  b.recurringPressure = 0;
  b.oneTimeReliefTaken = 0;
  b.shocksThisYear = [];
  b.lastReveal = { fiscalYear: state.fiscalYear, lines, gap: opening };

  // Rain gradually clears after a bridge.
  state.rainLevel = clamp(state.rainLevel - 1, 0, 3);

  return state.bridgeNumber;
}

/** Pothole probability for a hazard opportunity in a lane (spec §37). */
export function potholeChance(wear) {
  return Math.max(0, (wear - 30) / 100);
}

/** Score: bridges first, then distance, unused capacity as tie-breaker (§23). */
export function computeScore(state) {
  const unusedCapacity = LANE_KEYS.reduce(
    (sum, k) => sum + (WEAR_MAX - state.laneWear[k]), 0
  ) / (LANE_KEYS.length * WEAR_MAX);
  return Math.round(
    state.bridgeNumber * 100000 +
    state.distance * 0.1 +
    unusedCapacity * 100
  );
}

export function summarize(state) {
  const lanesFailed = LANE_KEYS.filter(k => isLaneFailed(state, k));
  const lanesNeverAvailable = state.mode === 'council' ? [...COUNCIL_CLOSED_LANES] : [];
  return {
    mode: state.mode,
    bridges: state.bridgeNumber,
    distance: Math.round(state.distance),
    fiscalYear: state.fiscalYear,
    budgetGap: state.budget.currentGap,
    openingGap: state.budget.openingGap,
    oneTimeTotal: state.oneTimeTotal,
    debtService: state.budget.annualDebtService,
    recurringCommitments: state.budget.recurringCommitments.map(c => ({ ...c })),
    laneWear: { ...state.laneWear },
    lanesUsed: { ...state.lanesUsed },
    lanesFailed,
    lanesNeverAvailable,
    score: computeScore(state)
  };
}

export { COUNCIL_OPEN_LANES, COUNCIL_CLOSED_LANES };
