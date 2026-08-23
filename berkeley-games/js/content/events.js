// Fiscal events (spec §13, §39). Pure tuning/content data — no rendering logic here.
//
// Response fields, per lane:
//   current    reduction to this year's budget gap ($M)
//   structural recurring improvement carried into future years ($M/yr)
//   debtService added recurring debt service ($M/yr), subtracted from structural over time
//   delayed    benefit arrives at the next bridge rather than immediately
//   wear       wear added to that lane (0-100 scale)
//   display    overhead lane-board text
//
// Amounts are illustrative game balance, not Berkeley budget claims (spec §40).

export const EVENTS = [
  {
    id: 'recurring_gap_01',
    label: 'RECURRING COSTS +$5M',
    type: 'operating',
    immediateImpact: -5,
    structuralImpact: -5,
    responses: {
      prioritize:          { current: +6, structural: +6, wear: 24, display: 'SAVE $6M/YR' },
      efficiency:          { current: +4, structural: +4, wear: 20, display: 'SAVE $4M/YR' },
      alternativeDelivery: { current: +3, structural: +3, wear: 20, display: 'SAVE $3M/YR' },
      growTaxBase:         { current: +2, structural: +3, delayed: true, wear: 18, display: '+$3M/YR LATER' },
      fees:                { current: +2, structural: +2, wear: 22, display: '+$2M/YR' },
      taxes:               { current: +7, structural: +7, wear: 30, display: '+$7M/YR' },
      borrow:              { current: +5, structural: -1, debtService: +1, wear: 28, display: '+$5M NOW / DEBT $1M/YR' }
    }
  },
  {
    id: 'revenue_shortfall_01',
    label: 'REVENUE SHORTFALL −$4M',
    type: 'revenue',
    immediateImpact: -4,
    structuralImpact: -4,
    responses: {
      prioritize:          { current: +5, structural: +5, wear: 22, display: 'SAVE $5M/YR' },
      efficiency:          { current: +4, structural: +4, wear: 22, display: 'SAVE $4M/YR' },
      alternativeDelivery: { current: +3, structural: +3, wear: 18, display: 'SAVE $3M/YR' },
      growTaxBase:         { current: +1, structural: +4, delayed: true, wear: 20, display: '+$4M/YR LATER' },
      fees:                { current: +3, structural: +3, wear: 24, display: '+$3M/YR' },
      taxes:               { current: +6, structural: +6, wear: 30, display: '+$6M/YR' },
      borrow:              { current: +4, structural: -0.8, debtService: +0.8, wear: 26, display: '+$4M NOW / DEBT $0.8M/YR' }
    }
  },
  {
    id: 'new_operating_cost_01',
    label: 'NEW OPERATING COST +$3M/YR',
    type: 'operating',
    immediateImpact: -3,
    structuralImpact: -3,
    responses: {
      prioritize:          { current: +4, structural: +4, wear: 20, display: 'SAVE $4M/YR' },
      efficiency:          { current: +3, structural: +3, wear: 18, display: 'SAVE $3M/YR' },
      alternativeDelivery: { current: +4, structural: +4, wear: 22, display: 'SAVE $4M/YR' },
      growTaxBase:         { current: +1, structural: +2, delayed: true, wear: 16, display: '+$2M/YR LATER' },
      fees:                { current: +2, structural: +2, wear: 20, display: '+$2M/YR' },
      taxes:               { current: +5, structural: +5, wear: 28, display: '+$5M/YR' },
      borrow:              { current: +3, structural: -0.6, debtService: +0.6, wear: 24, display: '+$3M NOW / DEBT $0.6M/YR' }
    }
  },
  {
    id: 'capital_repair_01',
    label: 'CAPITAL REPAIR $9M',
    type: 'capital',
    immediateImpact: -9,
    structuralImpact: 0,
    responses: {
      // A capital need is poorly served by recurring operating trims — the current-year
      // hole is large and only borrowing covers it outright (spec §16).
      prioritize:          { current: +7,  structural: +3, wear: 30, display: 'DEFER $7M' },
      efficiency:          { current: +6,  structural: +2, wear: 26, display: 'PHASE $6M' },
      alternativeDelivery: { current: +8,  structural: +2, wear: 28, display: 'PARTNER $8M' },
      growTaxBase:         { current: +2,  structural: +3, delayed: true, wear: 18, display: '+$3M/YR LATER' },
      fees:                { current: +6,  structural: +3, wear: 26, display: '+$3M/YR' },
      taxes:               { current: +9,  structural: +6, wear: 32, display: '+$6M/YR' },
      borrow:              { current: +11, structural: -1.5, debtService: +1.5, wear: 30, display: '+$11M NOW / DEBT $1.5M/YR' }
    }
  },
  {
    id: 'grant_expires_01',
    label: 'GRANT EXPIRES',
    type: 'revenue',
    immediateImpact: -2,
    structuralImpact: -3,
    responses: {
      prioritize:          { current: +4, structural: +4, wear: 22, display: 'SAVE $4M/YR' },
      efficiency:          { current: +3, structural: +3, wear: 20, display: 'SAVE $3M/YR' },
      alternativeDelivery: { current: +3, structural: +3, wear: 20, display: 'SAVE $3M/YR' },
      growTaxBase:         { current: +1, structural: +3, delayed: true, wear: 18, display: '+$3M/YR LATER' },
      fees:                { current: +2, structural: +2, wear: 22, display: '+$2M/YR' },
      taxes:               { current: +5, structural: +5, wear: 28, display: '+$5M/YR' },
      borrow:              { current: +3, structural: -0.7, debtService: +0.7, wear: 26, display: '+$3M NOW / DEBT $0.7M/YR' }
    }
  },
  {
    id: 'pension_costs_rise_01',
    label: 'PENSION COSTS RISE',
    type: 'operating',
    immediateImpact: -4,
    structuralImpact: -5,
    responses: {
      prioritize:          { current: +6, structural: +6, wear: 26, display: 'SAVE $6M/YR' },
      efficiency:          { current: +4, structural: +4, wear: 22, display: 'SAVE $4M/YR' },
      alternativeDelivery: { current: +3, structural: +3, wear: 20, display: 'SAVE $3M/YR' },
      growTaxBase:         { current: +1, structural: +3, delayed: true, wear: 18, display: '+$3M/YR LATER' },
      fees:                { current: +2, structural: +2, wear: 24, display: '+$2M/YR' },
      taxes:               { current: +7, structural: +7, wear: 32, display: '+$7M/YR' },
      borrow:              { current: +4, structural: -1, debtService: +1, wear: 28, display: '+$4M NOW / DEBT $1M/YR' }
    }
  },
  {
    id: 'construction_costs_rise_01',
    label: 'CONSTRUCTION COSTS RISE',
    type: 'capital',
    immediateImpact: -6,
    structuralImpact: -1,
    responses: {
      prioritize:          { current: +6, structural: +3, wear: 24, display: 'DESCOPE $6M' },
      efficiency:          { current: +5, structural: +3, wear: 22, display: 'VALUE ENG $5M' },
      alternativeDelivery: { current: +6, structural: +3, wear: 24, display: 'PARTNER $6M' },
      growTaxBase:         { current: +1, structural: +3, delayed: true, wear: 18, display: '+$3M/YR LATER' },
      fees:                { current: +4, structural: +3, wear: 24, display: '+$3M/YR' },
      taxes:               { current: +7, structural: +6, wear: 30, display: '+$7M/YR' },
      borrow:              { current: +8, structural: -0.9, debtService: +0.9, wear: 28, display: '+$8M NOW / DEBT $0.9M/YR' }
    }
  },
  {
    id: 'cost_growth_01',
    label: 'COST GROWTH +$6M/YR',
    type: 'operating',
    immediateImpact: -6,
    structuralImpact: -6,
    responses: {
      prioritize:          { current: +7, structural: +7, wear: 28, display: 'SAVE $7M/YR' },
      efficiency:          { current: +5, structural: +5, wear: 24, display: 'SAVE $5M/YR' },
      alternativeDelivery: { current: +4, structural: +4, wear: 22, display: 'SAVE $4M/YR' },
      growTaxBase:         { current: +2, structural: +4, delayed: true, wear: 20, display: '+$4M/YR LATER' },
      fees:                { current: +3, structural: +3, wear: 26, display: '+$3M/YR' },
      taxes:               { current: +8, structural: +8, wear: 34, display: '+$8M/YR' },
      borrow:              { current: +6, structural: -1.2, debtService: +1.2, wear: 30, display: '+$6M NOW / DEBT $1.2M/YR' }
    }
  }
];

export const EVENTS_BY_ID = Object.fromEntries(EVENTS.map(e => [e.id, e]));

// One-time money pickups (spec §17). Not lanes. Never structural.
// `triggersRainyDayWeather` opts a mechanism into the thunder/rain staging
// (Rainy-Day addendum §3). Any later one-time mechanism can opt in the same way.
export const ONE_TIME_PICKUPS = [
  {
    id: 'workers_comp_holiday',
    label: "WORKERS' COMP HOLIDAY",
    amount: 5.2,
    type: 'one_time',
    triggersRainyDayWeather: true,
    evidenceId: 'workers_comp_holiday'
  },
  {
    id: 'pension_trust',
    label: 'PENSION TRUST',
    amount: 3.0,
    type: 'one_time',
    triggersRainyDayWeather: true,
    evidenceId: 'pension_trust'
  }
];

// Preferred release-1 wording (Rainy-Day addendum §4). The narrower
// "RAINY DAY FUNDS DIVERTED!" is deliberately not used.
export const RAINY_DAY_MESSAGE = 'RAINY DAY MONEY USED!';

export const RAINY_DAY_STAGING = {
  beatMs: 500,          // pause after the fiscal reward, before the thunder
  messageMs: 1800,
  flashMs: 320
};
