// Budget Quest — deficit board content
// (Structural Deficit revision v3.1 §2, §4, §20, §21-§23).
//
// FACTUAL DISCIPLINE: every dollar value here is a prototype tuning value,
// not a sourced Berkeley figure. Options that name a real City line of
// business carry a `verify` list; see docs/SOURCING-BEFORE-RELEASE.md.
//
// The board is Missile Command. Missiles are the deficit (§2). Nothing here
// frames a group as an attacker — a missile is a dollar the City has
// committed and not funded.

export const money = v => `$${Math.abs(v) < 0.05 ? 0 : v.toFixed(1)}M`;

/* ------------------------------------------------------------------ */
/* The six bases being defended (§ board layout)                       */
/* ------------------------------------------------------------------ */

// Each base carries a recurring expense share and a permanent staffing
// level. Staffing is the recurring-cost engine (§4): a bigger permanent
// workforce makes every future compensation increase cost more.
export const FUNCTIONS = [
  {
    key: 'safety',
    name: 'PUBLIC SAFETY',
    short: 'SAFETY',
    baseExpense: 92,
    staff: 4,
    // EXIT is binary and dramatic (§23) — not everything can leave.
    exitable: false,
    exitReason: 'The City cannot exit public safety.'
  },
  {
    key: 'streets',
    name: 'STREETS & INFRASTRUCTURE',
    short: 'STREETS',
    baseExpense: 48,
    staff: 3,
    exitable: true,
    exitLabel: 'REGIONALIZE STREETS & INFRASTRUCTURE',
    exitSaving: 17,
    verify: ['realistic regional road-maintenance transfer terms and savings']
  },
  {
    key: 'basic',
    name: 'LIBRARIES, PARKS & BASIC SERVICES',
    short: 'LIB/PARKS',
    baseExpense: 54,
    staff: 4,
    exitable: true,
    exitLabel: 'MOVE TO PUBLIC-PRIVATE PARTNERSHIP',
    exitSaving: 19,
    verify: ['whether these are separately funded, and realistic partnership terms']
  },
  {
    key: 'admin',
    name: 'ADMINISTRATION',
    short: 'ADMIN',
    baseExpense: 40,
    staff: 3,
    exitable: true,
    exitLabel: 'SHARED REGIONAL ADMINISTRATION',
    exitSaving: 14,
    verify: ['shared-services arrangements and realistic administrative savings']
  },
  {
    key: 'health',
    name: 'HEALTH & HOMELESSNESS',
    short: 'HEALTH',
    baseExpense: 58,
    staff: 3,
    exitable: true,
    exitLabel: 'EXIT HEALTH SERVICES TO THE COUNTY',
    exitSaving: 21,
    verify: [
      'which health and homelessness functions the County already delivers',
      'the actual recurring City cost of those functions',
      'legal and contractual conditions on transfer'
    ]
  },
  {
    key: 'programs',
    name: 'LOCAL PROGRAMS & GRANTS',
    short: 'PROGRAMS',
    baseExpense: 38,
    staff: 2,
    exitable: true,
    exitLabel: 'END DIRECT CITY GRANTMAKING',
    exitSaving: 12,
    verify: ['grant program scale and any committed multi-year awards']
  }
];

export const FUNCTION_KEYS = FUNCTIONS.map(f => f.key);
export const fn = key => FUNCTIONS.find(f => f.key === key);

/** Service health, 0-4. The only per-base indicator (SCOPE is gone). */
export const MAX_PIPS = 4;
export const pips = n =>
  '●'.repeat(Math.max(0, n)) + '○'.repeat(Math.max(0, MAX_PIPS - n));

export const SERVICE_WORDS = ['GONE', 'MINIMAL', 'REDUCED', 'STRAINED', 'FULL'];

/* ------------------------------------------------------------------ */
/* Four political meters                                               */
/* ------------------------------------------------------------------ */

// §6: five compact meters. Nonprofit providers are separate from activists —
// they are contractors with revenue at stake, not only advocates. There is no
// SERVICE USERS meter: that impact is the bases visibly taking damage.
export const METERS = [
  { key: 'taxpayers', name: 'TAXPAYERS' },
  { key: 'unions', name: 'UNIONS' },
  { key: 'activists', name: 'ACTIVISTS' },
  { key: 'nonprofits', name: 'NONPROFITS' },
  { key: 'business', name: 'BUSINESS' }
];

export const METER_KEYS = METERS.map(m => m.key);

/** Below this a bloc resists the actions that hurt it further. */
export const RESISTANT = 20;

/**
 * Sentiment bands. A bloc turns yellow while it is still workable but
 * clearly unhappy, and red once it is hostile enough to block your options.
 * The word on the meter carries the same information as the colour.
 */
export const WARN = 45;

export function moodBand(v) {
  // At RESISTANT the bloc is already blocking cards, so it reads red there,
  // not one point below it.
  if (v <= RESISTANT) return 'bad';
  if (v < WARN) return 'warn';
  return 'ok';
}

export const MOOD_WORD = { ok: '', warn: 'RESTLESS', bad: 'HOSTILE' };

/**
 * A bloc at zero has stopped negotiating. Unions at zero are on strike, which
 * is a different fact about the city than merely being hostile.
 */
export const MOOD_ZERO_WORD = {
  unions: 'ON STRIKE!',
  taxpayers: 'IN REVOLT',
  activists: 'IN THE STREETS',
  nonprofits: 'WALKED AWAY',
  business: 'LEAVING TOWN'
};

export function moodWord(key, v) {
  if (v <= 0) return MOOD_ZERO_WORD[key] || MOOD_WORD.bad;
  return MOOD_WORD[moodBand(v)];
}

/* ------------------------------------------------------------------ */
/* CUT targets (§21)                                                   */
/* ------------------------------------------------------------------ */

// CUT is not a generic efficiency button (§21): each option names a concrete
// recurring commitment and says what it costs politically.
export const CUTS = [
  {
    id: 'freeze-hiring',
    fnKey: 'admin',
    label: 'HOLD ADMINISTRATIVE VACANCIES',
    detail: 'Leave budgeted positions unfilled and redistribute the work.',
    saving: 4,
    staffDelta: -1,
    serviceDelta: 0,
    mood: { taxpayers: +1, unions: -2 }
  },
  {
    id: 'reduce-management',
    fnKey: 'admin',
    label: 'REDUCE MANAGEMENT LAYERS',
    detail: 'Flatten supervisory tiers rather than cutting front-line staff.',
    saving: 6,
    staffDelta: -1,
    serviceDelta: 0,
    mood: { taxpayers: +2, unions: -2 }
  },
  {
    id: 'end-grants',
    fnKey: 'programs',
    label: 'DO NOT RENEW DISCRETIONARY GRANTS',
    detail: 'Discretionary awards end at the close of their term.',
    saving: 7,
    serviceDelta: -1,
    mood: { taxpayers: +2, activists: -2, nonprofits: -3 }
  },
  {
    id: 'reduce-hours',
    fnKey: 'basic',
    label: 'REDUCE BRANCH & FACILITY HOURS',
    detail: 'Fewer open hours at libraries, pools and community centres.',
    saving: 6,
    staffDelta: -1,
    serviceDelta: -1,
    mood: { taxpayers: +1, unions: -2, activists: -1 }
  },
  {
    id: 'defer-paving',
    fnKey: 'streets',
    label: 'DEFER THE PAVING PROGRAM',
    detail: 'The streets can wait. The streets always wait.',
    saving: 5,
    serviceDelta: -1,
    mood: { taxpayers: +1, business: -2 }
  },
  {
    id: 'shrink-shelter',
    fnKey: 'health',
    label: 'REDUCE SHELTER & OUTREACH CONTRACTS',
    detail: 'Fewer contracted beds and outreach hours.',
    saving: 8,
    serviceDelta: -1,
    mood: { taxpayers: +2, activists: -2, nonprofits: -3 },
    verify: ['actual shelter and outreach contract values']
  },
  {
    id: 'civilianize',
    fnKey: 'safety',
    label: 'CIVILIANIZE NON-SWORN FUNCTIONS',
    detail: 'Move desk and analysis work to civilian staff.',
    saving: 5,
    staffDelta: -1,
    serviceDelta: 0,
    mood: { taxpayers: +2, unions: -2 },
    verify: ['which functions are already civilianized and realistic savings']
  }
];

/* ------------------------------------------------------------------ */
/* TAX options (§22)                                                   */
/* ------------------------------------------------------------------ */

// Taxes can be powerful enough to solve a large deficit (§22). They are not
// nerfed; the cost is political and, at high cumulative burden, commercial.
export const TAXES = [
  {
    id: 'sales-tax',
    label: '0.5% SALES TAX',
    detail: 'Recurring general revenue from taxable sales.',
    revenue: 14,
    burden: 2,
    mood: { taxpayers: -3, business: -1 },
    verify: ['rate authority, base, and realistic yield']
  },
  {
    id: 'parcel-tax',
    label: 'SERVICES PARCEL TAX',
    detail: 'A per-parcel levy dedicated to maintaining services.',
    revenue: 11,
    burden: 2,
    mood: { taxpayers: -3, activists: +1 },
    verify: ['parcel-tax authority, exemptions, and realistic yield']
  },
  {
    id: 'business-tax',
    label: 'BUSINESS LICENSE TAX INCREASE',
    detail: 'Higher gross-receipts rates on larger businesses.',
    revenue: 9,
    burden: 1,
    mood: { taxpayers: +1, business: -3, activists: +1 },
    verify: ['gross-receipts structure and realistic yield']
  },
  {
    id: 'utility-tax',
    label: 'UTILITY USERS TAX ADJUSTMENT',
    detail: 'Recurring revenue from utility consumption.',
    revenue: 7,
    burden: 1,
    mood: { taxpayers: -2, business: -1 },
    verify: ['utility users tax rate and base']
  },
  {
    id: 'transfer-tax',
    label: 'PROPERTY TRANSFER TAX INCREASE',
    detail: 'A higher rate on property sales above a threshold.',
    revenue: 8,
    burden: 2,
    mood: { taxpayers: -2, business: -2 },
    verify: ['transfer tax rate, threshold, and volatility of the yield']
  }
];

/* ------------------------------------------------------------------ */
/* Pilots (§7, §8)                                                     */
/* ------------------------------------------------------------------ */

// A pilot is temporary by default and ends unless the player affirmatively
// makes it permanent (§7). There is no automatic conversion.
export const PILOTS = [
  {
    id: 'crisis-response',
    fnKey: 'safety',
    label: 'NON-POLICE CRISIS RESPONSE PILOT',
    permanentCost: 3,
    staffDelta: 1,
    mood: { activists: +3, unions: +1, taxpayers: -1 },
    verify: ['actual pilot scale and cost if this is modelled on a real program']
  },
  {
    id: 'street-cleaning',
    fnKey: 'streets',
    label: 'ENHANCED STREET CLEANING PILOT',
    permanentCost: 2,
    staffDelta: 1,
    mood: { business: +3, activists: +1, taxpayers: -1 }
  },
  {
    id: 'youth-programs',
    fnKey: 'programs',
    label: 'YOUTH PROGRAMMING PILOT',
    permanentCost: 2,
    staffDelta: 1,
    mood: { activists: +2, nonprofits: +2, taxpayers: -1 }
  },
  {
    id: 'shelter-beds',
    fnKey: 'health',
    label: 'EXPANDED SHELTER PILOT',
    permanentCost: 4,
    staffDelta: 1,
    mood: { activists: +3, nonprofits: +2, business: +1, taxpayers: -2 }
  }
];

/* ------------------------------------------------------------------ */
/* Missile sources (§15)                                               */
/* ------------------------------------------------------------------ */

// Only two sources exist. Everything else changes the recurring structure
// and therefore changes how many structural missiles the deficit produces.
export const MISSILE_KINDS = {
  structural: {
    label: 'STRUCTURAL DEFICIT',
    tone: '#ff6b5e'
  },
  shock: {
    // Named for what it is: the bill the drawn-down cushion should have paid.
    label: 'UNFUNDED WORKERS\u2019 COMP CLAIM',
    short: 'UNFUNDED CLAIM',
    tone: '#ffa657',
    verify: ["whether workers' compensation is the right instrument here, " +
             'and the scale of a realistic self-insured claim']
  }
};
