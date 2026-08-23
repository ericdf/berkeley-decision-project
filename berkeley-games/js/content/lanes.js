// Canonical seven-lane taxonomy (spec §7).
// Order is the on-road left-to-right order.

export const LANES = [
  {
    key: 'prioritize',
    name: 'PRIORITIZE',
    short: 'PRIORITIZE',
    kind: 'recurring',
    meaning: 'Reduce, stop, defer, or scale lower-priority recurring expenditures.',
    hue: 152
  },
  {
    key: 'efficiency',
    name: 'EFFICIENCY',
    short: 'EFFICIENCY',
    kind: 'recurring',
    meaning: 'Produce the same or substantially similar service at lower recurring cost.',
    hue: 176
  },
  {
    key: 'alternativeDelivery',
    name: 'ALT DELIVERY',
    short: 'ALT DELIVERY',
    kind: 'recurring',
    meaning: 'Change who provides a service or how it is delivered.',
    hue: 196
  },
  {
    key: 'growTaxBase',
    name: 'GROW TAX BASE',
    short: 'GROW BASE',
    kind: 'recurring',
    meaning: 'Increase underlying taxable economic activity rather than merely increasing tax rates.',
    hue: 96
  },
  {
    key: 'fees',
    name: 'FEES',
    short: 'FEES',
    kind: 'recurring',
    meaning: 'Increase or broaden user charges.',
    hue: 46
  },
  {
    key: 'taxes',
    name: 'TAXES',
    short: 'TAXES',
    kind: 'recurring',
    meaning: 'Increase tax revenue through a new tax, higher rate, or additional instrument.',
    hue: 22
  },
  {
    key: 'borrow',
    name: 'BORROW',
    short: 'BORROW',
    kind: 'debt',
    meaning: 'Use debt to finance capital needs, with future debt service.',
    hue: 320
  }
];

export const LANE_COUNT = LANES.length;
export const LANE_KEYS = LANES.map(l => l.key);
export const LANE_INDEX = Object.fromEntries(LANES.map((l, i) => [l.key, i]));

// Council Mode leaves only Fees, Taxes, Borrow open (spec §8.2).
export const COUNCIL_OPEN_LANES = ['fees', 'taxes', 'borrow'];
export const COUNCIL_CLOSED_LANES = LANE_KEYS.filter(k => !COUNCIL_OPEN_LANES.includes(k));

export const CLOSED_SIGN_TEXT = 'CLOSED — COUNCIL MODE';
