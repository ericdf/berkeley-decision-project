// The canonical seven fiscal tools (Reboot spec §12, §83).
//
// Overload is now diminishing capacity, not pavement wear: each use of a tool
// leaves less useful capacity behind, and BORROW additionally charges more
// future debt service each time. Wear art is flavour only (§84).

export const TOOL_KEYS = [
  'prioritize', 'efficiency', 'alternativeDelivery',
  'growTaxBase', 'fees', 'taxes', 'borrow'
];

/**
 * Capacity is expressed as depth, not a token ceiling (Tool Capacity Revision
 * §1-§6). The four structural tools can each close most or all of a typical
 * gap if the player leans on them hard enough; what rises with depth is
 * political and implementation difficulty, not a wall.
 *
 * `depthBands` are fractions of the year's opening gap. `capacityFactor` is
 * the multiple of the opening gap a tool can theoretically reach.
 */
export const TOOLS = {
  prioritize: {
    key: 'prioritize',
    name: 'PRIORITIZE',
    blurb: 'End or consolidate lower-priority recurring commitments.',
    // Can carry a whole gap on its own (§7).
    capacityFactor: 1.0,
    decay: 0.92,
    minCapacityFactor: 0.35,
    depthBands: [
      { upTo: 0.17, label: 'LOWER-PRIORITY COMMITMENTS', note: 'Core services protected' },
      { upTo: 0.50, label: 'HARDER CHOICES',             note: 'Broader consolidation' },
      { upTo: 1.00, label: 'DEEP PRIORITIZATION',        note: 'Politically painful' }
    ],
    kind: 'recurring',
    reducesDiscretionary: true,
    workforceRelief: 0.030,
    hue: 152
  },
  efficiency: {
    key: 'efficiency',
    name: 'EFFICIENCY',
    blurb: 'Same service, lower recurring cost.',
    capacityFactor: 0.9,
    decay: 0.90,
    minCapacityFactor: 0.30,
    depthBands: [
      { upTo: 0.17, label: 'EARLY EFFICIENCY',  note: 'Procurement, workflow, vacancies' },
      { upTo: 0.50, label: 'MID-DEPTH',         note: 'Management layers, reorganisation' },
      { upTo: 1.00, label: 'DEEP EFFICIENCY',   note: 'Operating-model change, real risk' }
    ],
    kind: 'recurring',
    workforceRelief: 0.026,
    hue: 176
  },
  alternativeDelivery: {
    key: 'alternativeDelivery',
    name: 'ALT DELIVERY',
    blurb: 'Another provider delivers the service.',
    capacityFactor: 0.85,
    decay: 0.90,
    minCapacityFactor: 0.30,
    depthBands: [
      { upTo: 0.17, label: 'SHARED BACK OFFICE', note: 'Service continues' },
      { upTo: 0.50, label: 'SELECTED FUNCTIONS', note: 'Partner delivery' },
      { upTo: 1.00, label: 'MAJOR SERVICE AREAS', note: 'Regional / county delivery' }
    ],
    kind: 'recurring',
    hue: 196
  },
  growTaxBase: {
    key: 'growTaxBase',
    name: 'GROW TAX BASE',
    blurb: 'Grow taxable activity. Pays off over time.',
    // Large opportunity, slow realisation (§16, §17).
    capacityFactor: 0.9,
    decay: 0.95,
    minCapacityFactor: 0.40,
    depthBands: [
      { upTo: 0.17, label: 'MODEST STRATEGY', note: 'Small ramp' },
      { upTo: 0.50, label: 'REAL STRATEGY',   note: 'Meaningful ramp' },
      { upTo: 1.00, label: 'LARGE STRATEGY',  note: 'Years to mature' }
    ],
    kind: 'delayed',
    // Only a fraction lands this year; the rest ramps over later years.
    currentYearShare: 0.22,
    matureMultiplier: 1.6,
    improvesBusinessDistrict: true,
    hue: 96
  },
  fees: {
    key: 'fees',
    name: 'FEES',
    blurb: 'Broaden or raise user charges.',
    // Deliberately the most constrained of the seven (§20).
    capacityFactor: 0.22,
    decay: 0.68,
    minCapacityFactor: 0.05,
    kind: 'recurring',
    hue: 46
  },
  taxes: {
    key: 'taxes',
    name: 'TAXES',
    blurb: 'New or higher tax revenue.',
    // A real large-capacity tool, not a punishment button (§21, §22).
    capacityFactor: 0.75,
    decay: 0.72,
    minCapacityFactor: 0.15,
    depthBands: [
      { upTo: 0.17, label: 'MODEST INCREASE', note: '' },
      { upTo: 0.50, label: 'SUBSTANTIAL',     note: 'Political burden rises' },
      { upTo: 1.00, label: 'HEAVY',           note: 'Little capacity left after' }
    ],
    kind: 'recurring',
    hue: 22
  },
  borrow: {
    key: 'borrow',
    name: 'BORROW',
    blurb: 'Debt now. Debt service every year after.',
    capacityFactor: 0.7,
    decay: 0.90,
    minCapacityFactor: 0.20,
    kind: 'debt',
    // Compounds with depth as well as with reuse (§24).
    debtServiceRate: 0.11,
    debtServiceEscalation: 0.035,
    depthSurcharge: 0.06,
    enablesStreetWork: true,
    hue: 320
  }
};

/**
 * Council Mode political ceiling.
 *
 * The revision is explicit that taxes and borrowing are large-capacity tools
 * and must not be drawn small (§21, §22) — so the Council contrast cannot come
 * from shrinking them globally. It comes from what this council will actually
 * carry: a narrow toolbox reaches its political limit well before its
 * arithmetic one, which is why SLASH SERVICES still has to finish the job
 * (Reboot §32, §107).
 */
export const COUNCIL_APPETITE = 0.36;

// Council Mode: only these three actually move the gap (§19).
export const COUNCIL_ACTIVE = ['fees', 'taxes', 'borrow'];
// Present, but explicitly not on the table.
export const COUNCIL_NOT_ON_TABLE = ['prioritize', 'efficiency', 'alternativeDelivery'];
// Present, produces warm words and $0 (§21).
export const COUNCIL_RHETORICAL = 'growTaxBase';

export const NOT_ON_TABLE_TEXT = 'NOT ON THE TABLE';
export const RHETORIC_TEXT = '“WE’RE WORKING ON IT.”';
export const RHETORIC_RESULT = 'THIS BUDGET: $0';
export const RHETORIC_FLASH = 'STRONG COMMITMENT TO BUSINESS GROWTH';

export const ALLOCATION_STEP = 0.5;   // §14

/**
 * Capacity scales with the size of the problem, so a large gap never makes the
 * structural tools look token (§4, §22). Prior years of use still erode it.
 */
export function toolCapacity(tool, yearsUsed, openingGap, appetite = 1) {
  const base = openingGap * tool.capacityFactor * appetite;
  const floor = openingGap * tool.minCapacityFactor * appetite;
  return Math.max(floor, base * Math.pow(tool.decay, yearsUsed));
}

/** Which depth band an allocation currently sits in (§26, §32). */
export function depthBand(tool, allocation, openingGap) {
  if (!tool.depthBands || openingGap <= 0) return null;
  const f = allocation / openingGap;
  for (const band of tool.depthBands) {
    if (f <= band.upTo) return band;
  }
  return tool.depthBands[tool.depthBands.length - 1];
}

/** 0-1 depth for the meter; deliberately not a "full at capacity" bar (§25). */
export function depthFraction(tool, allocation, openingGap) {
  if (openingGap <= 0) return 0;
  return Math.min(1, allocation / (openingGap * tool.capacityFactor));
}

/**
 * Debt service per $M borrowed. Escalates with reuse across years and, within
 * a single budget, with how deeply the player borrows (§24).
 */
export function debtServiceRate(tool, yearsUsed, depthFraction = 0) {
  return tool.debtServiceRate
    + tool.debtServiceEscalation * yearsUsed
    + (tool.depthSurcharge ?? 0) * depthFraction;
}
