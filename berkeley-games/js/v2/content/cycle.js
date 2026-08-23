// Fiscal-year pressures, one-time measures, and tour events (Reboot spec §7,
// §8, §15, §48-§53, §86).
//
// Every dollar figure here is configurable game content. None is a sourced
// Berkeley fact and none may be presented as one (§91).

export const CAMPAIGN_YEARS = 4;          // §4
export const FIRST_FISCAL_YEAR = 2029;
// Sized against what each mode can actually raise: Common Sense can close it
// with a mix, while Council's three tools plus one-time relief fall short and
// force SLASH SERVICES, which is the whole contrast (§16, §32, §107).
export const FIRST_OPENING_GAP = 21.0;

/**
 * Recurring pressures applied at each new fiscal year. They grow, so standing
 * still is not enough (§52, §86). `labor: true` scales with the hidden
 * workforce cost factor (§27).
 */
export const ANNUAL_PRESSURES = [
  { id: 'pension',        label: 'Pension growth',             base: 1.5, growth: 0.30 },
  { id: 'infrastructure', label: 'Infrastructure liabilities',  base: 1.6, growth: 0.28 },
  { id: 'union_scale',    label: 'Union pay-scale increase',    base: 1.5, growth: 0.25, labor: true }
];

// One-time measures (§15). Together they must never close a whole year (§16).
export const ONE_TIME_MEASURES = [
  {
    id: 'workers_comp_holiday',
    label: "WORKERS' COMP HOLIDAY",
    amount: 3.2,
    note: 'One-time capacity. No recurring savings.',
    triggersRain: true,
    // Available once per campaign, not once per year.
    oncePerCampaign: true
  },
  {
    id: 'pension_trust_draw',
    label: 'PENSION TRUST DRAW',
    amount: 2.0,
    note: 'One-time capacity. No recurring savings.',
    triggersRain: true,
    oncePerCampaign: true
  },
  {
    id: 'fund_sweep',
    label: 'FUND BALANCE SWEEP',
    amount: 1.5,
    note: 'One-time capacity. No recurring savings.',
    triggersRain: false,
    oncePerCampaign: false
  }
];

export const RAINY_DAY_MESSAGE = 'RAINY DAY MONEY USED!';

/**
 * Events during the city tour. They never reopen the adopted budget; they
 * queue cost against the next one (§47, §48, §103).
 */
export const TOUR_EVENTS = [
  {
    id: 'homeless_union_lawsuits',
    label: 'HOMELESS UNION LAWSUITS',
    detail: 'Legal / settlement cost',
    nextYear: 1.2,
    recurring: false
  },
  {
    id: 'labor_contract',
    label: 'LABOR CONTRACT RENEGOTIATED',
    detail: 'New compensation package approved',
    nextYear: 3.4,
    recurring: true,
    labor: true
  },
  {
    id: 'construction_estimate',
    label: 'CONSTRUCTION ESTIMATE REVISED',
    detail: 'Capital estimate increased',
    nextYear: 1.0,
    recurring: false
  },
  {
    id: 'grant_expires',
    label: 'GRANT EXPIRES',
    detail: 'Outside funding ends',
    nextYear: 1.1,
    recurring: true
  },
  {
    id: 'settlement',
    label: 'SETTLEMENT EXPENSE',
    detail: 'Claim resolved above reserve',
    nextYear: 0.9,
    recurring: false
  }
];

export const LABELS = {
  priorRecurring: 'Prior recurring pressure',
  debtService: 'Debt service',
  recurringSavings: 'Prior recurring savings',
  recurringRevenue: 'Prior recurring revenue',
  taxBaseGrowth: 'Tax-base growth matured',
  newProgram: 'New program commitment',
  consentItem: 'Consent item',
  oneTimeExpired: 'One-time relief no longer available',
  laborContract: 'Prior labor contract'
};

export const WORKFORCE = {
  initialFactor: 1.0,
  minFactor: 0.74
};

export const TOUR = {
  secondsPerYear: 45,          // §77 (range 30-60)
  eventsPerTour: [1, 3],       // §77
  metresPerSecond: 34
};
