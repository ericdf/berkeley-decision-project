// Single Budget Gap fiscal model content (Tightening addendum Part I).
//
// One number the player has to close before each bridge. The recurring vs
// one-time distinction survives in how NEXT year's opening gap is computed,
// rather than as a second competing HUD value.

export const FIRST_FISCAL_YEAR = 2028;

/**
 * Predictable annual pressures, known at budget adoption, so they belong in the
 * opening forecast rather than firing as mid-cycle surprises
 * (Budget Cycle addendum §4, §5, §10).
 *
 * `labor: true` marks a pressure scaled by the workforce cost factor (§19).
 */
export const ANNUAL_PRESSURES = [
  { id: 'pension',        label: 'Pension costs',            base: 1.1, growth: 0.30 },
  { id: 'infrastructure', label: 'Infrastructure obligations', base: 0.9, growth: 0.25 },
  { id: 'union_scale',    label: 'Union pay-scale increase', base: 0.7, growth: 0.20, labor: true },
  { id: 'revenue',        label: 'Revenue weakness',         base: 0.5, growth: 0.15 }
];

/**
 * How the very first year's gap is composed. Purely presentational — the sum
 * must equal OPENING_GAP — but it teaches the forecast format before the
 * player has any history to inherit (Budget Cycle addendum §4, §5).
 */
export const FIRST_YEAR_LINES = [
  { label: 'Inherited structural gap',   amount: 2.2 },
  { label: 'Pension costs',              amount: 1.1 },
  { label: 'Infrastructure obligations', amount: 0.9 },
  { label: 'Union pay-scale increase',   amount: 0.8 }
];

// The opening gap of the very first fiscal year.
//
// Sized against what a year of play can actually deliver: 3-5 decision gates
// each net roughly $1M of closure after the shock they answer, so the lanes
// must be able to carry most of this on their own with one-time money closing
// a final sliver (addendum §7).
export const OPENING_GAP = 5.0;

export const BUDGET_TUNING = {
  // One-time relief must not be a complete strategy (addendum §7): the total
  // available in a year is capped as a fraction of that year's opening gap.
  oneTimeReliefCapFraction: 0.5,

  // Small tolerance so floating-point noise cannot fail a closed gap.
  gapTolerance: 1e-6,

  revealMs: 4200
};

/**
 * A lightweight stand-in for staffing exposure (addendum §16-§20). Deliberately
 * NOT a headcount simulator: one factor, hidden from the HUD, that scales
 * future labor increases. PRIORITIZE and EFFICIENCY shrink it.
 */
export const WORKFORCE = {
  initialFactor: 1.00,
  minFactor: 0.72,
  prioritizeReduction: 0.035,
  efficiencyReduction: 0.025
};

// Labor contract renegotiation (addendum §13-§15): agreed now, paid next year.
export const LABOR_CONTRACTS = [
  { id: 'labor_contract_01', label: 'LABOR CONTRACT RENEGOTIATED', grossAnnualIncrease: 3.4 },
  { id: 'labor_contract_02', label: 'LABOR CONTRACT RENEGOTIATED', grossAnnualIncrease: 2.6 },
  { id: 'labor_contract_03', label: 'LABOR CONTRACT RENEGOTIATED', grossAnnualIncrease: 4.1 }
];

export const CYCLE = {
  // Let the player read the opening gap before anything complicates it (§6).
  quietSecondsAfterOpening: 12,
  // Keep the road readable (§7, §27).
  minShocksPerYear: 2,
  maxShocksPerYear: 3,
  // At most one renegotiation per cycle, and not every cycle.
  laborContractChance: 0.55
};

export const LABELS = {
  gap: 'BUDGET GAP',
  priorRecurring: 'Prior recurring gap',
  debtService: 'Debt service',
  newProgram: 'New program commitment',
  consentItem: 'Consent item',
  recurringSavings: 'Recurring solutions adopted',
  oneTimeExpired: 'Prior one-time relief expired',
  laborContract: 'New labor contract'
};
