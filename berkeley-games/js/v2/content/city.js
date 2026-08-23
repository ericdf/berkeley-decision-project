// The persistent city: landmarks the player revisits every fiscal year, and
// the service states that make the budget visible (Reboot spec §39-§45, §78).
//
// Program labels are generic on purpose. Release 1 must not imply a real
// Berkeley program is low-priority (§92).

export const SERVICE_STATES = ['CLOSED', 'DEGRADED', 'STRAINED', 'HEALTHY'];

/** 3 healthy, 2 strained, 1 degraded, 0 closed (§40). */
export function serviceLabel(level) {
  return SERVICE_STATES[Math.max(0, Math.min(3, level))];
}

/**
 * The recurring tour route. Same order every year so the player builds a
 * memory of the place and notices what changed (§39, §78).
 */
export const LANDMARKS = [
  {
    id: 'neighborhood',
    name: 'RESIDENTIAL STREET',
    service: 'streets',
    at: 0.10,
    side: -1,
    kind: 'street'
  },
  {
    id: 'fire',
    name: 'FIRE STATION',
    service: 'fire',
    at: 0.24,
    side: -1,
    kind: 'building',
    closedSign: 'FIRE STATION — CLOSED',
    reducedSign: 'FIRE STATION — REDUCED COVERAGE'
  },
  {
    id: 'pool',
    name: 'PUBLIC POOL',
    service: 'pool',
    at: 0.38,
    side: 1,
    kind: 'building',
    closedSign: 'POOL CLOSED — BUDGET REDUCTION',
    reducedSign: 'POOL — REDUCED HOURS'
  },
  {
    id: 'library',
    name: 'LIBRARY',
    service: 'library',
    at: 0.52,
    side: -1,
    kind: 'building',
    closedSign: 'LIBRARY — CLOSED',
    reducedSign: 'LIBRARY — REDUCED HOURS'
  },
  {
    id: 'commercial',
    name: 'COMMERCIAL CORRIDOR',
    service: 'businessDistrict',
    at: 0.66,
    side: 0,
    kind: 'corridor'
  },
  {
    id: 'park',
    name: 'CIVIC PARK',
    service: 'parks',
    at: 0.80,
    side: 1,
    kind: 'park',
    closedSign: 'PARK SERVICES — SUSPENDED',
    reducedSign: 'PARK — REDUCED MAINTENANCE'
  },
  {
    id: 'program_site',
    name: 'PROGRAM OFFICE',
    service: 'discretionaryLoad',
    at: 0.92,
    side: -1,
    kind: 'program'
  }
];

// Shown at the discretionary site when PRIORITIZE trimmed it (§25, §44).
export const PRIORITIZE_SIGNS = [
  'PILOT NOT RENEWED',
  'PROGRAM CONSOLIDATED',
  'CONSULTANT CONTRACT ENDED',
  'FUNDS REASSIGNED',
  'INITIATIVE WOUND DOWN'
];

// Generic low-priority names (§92). Never a real program.
export const PROGRAM_LABELS = [
  'CITY PILOT',
  'NEW INITIATIVE',
  'CONSULTANT WORKSTREAM',
  'PROGRAM OFFICE',
  'DISCRETIONARY GRANT',
  'ADMINISTRATIVE PROGRAM'
];

export const ALT_DELIVERY_SIGN = 'SERVICE CONTINUES — PARTNER DELIVERY';
export const PAVING_SIGN = 'STREET RESURFACED';
export const DEFERRED_SIGN = 'PAVING DEFERRED';

/**
 * The order in which SLASH SERVICES damages the city (§34). Fire station first
 * because it is the loudest possible consequence, which is the point.
 */
export const SLASH_ORDER = ['fire', 'pool', 'library', 'parks', 'streets'];

// $M of gap each step of damage closes — slashing must always be able to
// finish the arithmetic (§33). Raised so a large forced cut costs the city
// fewer separate services in one year: the mode should degrade visibly year
// over year, not shutter everything at once.
export const SLASH_YIELD_PER_STEP = 3.0;

export const BUSINESS_STATES = ['MANY VACANCIES', 'STABLE', 'IMPROVING', 'ACTIVE'];

export function businessLabel(level) {
  return BUSINESS_STATES[Math.max(0, Math.min(3, level))];
}
