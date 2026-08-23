// Neighboring-city cars (spec §20).
//
// Evidence discipline (§20.4): the pass-by is satire about *lane access*, not a
// factual claim that a named city funds itself through a named policy. Lane
// assignments are data here, and `claim` is intentionally null for every entry
// because no sourced policy comparison has been supplied yet. A car with
// `claim: null` renders its label and wave only — no policy text.

// Every car may use any Council-closed lane — that contrast is the joke, and
// the lane assignment carries no implication about how a city funds itself.
const CLOSED_LANE_POOL = [
  'prioritize', 'efficiency', 'alternativeDelivery', 'growTaxBase'
];

export const CITIES = [
  {
    id: 'albany',
    name: 'ALBANY',
    bodyColor: '#d8dee9',
    roofColor: '#9aa7bd',
    lanes: CLOSED_LANE_POOL,
    claim: null,
    evidenceId: null
  },
  {
    id: 'piedmont',
    name: 'PIEDMONT',
    bodyColor: '#e8dcc0',
    roofColor: '#bda98a',
    lanes: CLOSED_LANE_POOL,
    claim: null,
    evidenceId: null
  },
  {
    id: 'emeryville',
    name: 'EMERYVILLE',
    bodyColor: '#cfe0d4',
    roofColor: '#8fae9b',
    lanes: CLOSED_LANE_POOL,
    claim: null,
    evidenceId: null
  },
  {
    id: 'alameda',
    name: 'ALAMEDA',
    bodyColor: '#dcd2e4',
    roofColor: '#a396b5',
    lanes: CLOSED_LANE_POOL,
    claim: null,
    evidenceId: null
  }
];
