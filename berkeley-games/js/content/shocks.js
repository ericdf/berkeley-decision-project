// Mid-cycle budget shocks (Budget Cycle addendum Part III).
//
// A shock is genuinely NEW information that arrives after the opening forecast.
// Predictable annual pressures (pension growth, scheduled union pay increases,
// infrastructure inflation) belong in the opening forecast instead — firing
// them mid-cycle would double-count them and make the road feel like a stream
// of random popups (§7, §10).
//
// Every amount here is configurable game content. None of it is a sourced
// Berkeley figure and none may be presented as one (§9).

export const SHOCKS = [
  {
    id: 'sales_tax_forecast_down',
    label: 'SALES TAX FORECAST DOWN',
    detail: 'Revenue forecast revised',
    amount: 1.2
  },
  {
    id: 'homeless_union_lawsuits',
    label: 'HOMELESS UNION LAWSUITS',
    detail: 'Legal / settlement costs',
    amount: 1.2
  },
  {
    id: 'emergency_repair',
    label: 'EMERGENCY REPAIR',
    detail: 'Unplanned infrastructure failure',
    amount: 1.5
  },
  {
    id: 'grant_expires',
    label: 'GRANT EXPIRES',
    detail: 'Outside funding ends',
    amount: 1.0
  },
  {
    id: 'bridge_repair_estimate',
    // A revised estimate is a real surprise; generic construction inflation is
    // predictable and lives in the opening forecast instead (§10).
    label: 'BRIDGE REPAIR ESTIMATE REVISED',
    detail: 'Capital estimate increased',
    amount: 1.4
  },
  {
    id: 'settlement_expense',
    label: 'SETTLEMENT EXPENSE',
    detail: 'Claim resolved above reserve',
    amount: 1.1
  },
  {
    id: 'service_cost_growth',
    label: 'SERVICE COSTS EXCEED BUDGET',
    detail: 'Unexpected operating growth',
    amount: 1.3
  },
  {
    id: 'revenue_decline',
    label: 'SUDDEN REVENUE DECLINE',
    detail: 'Receipts below projection',
    amount: 1.6
  }
];

export const SHOCKS_BY_ID = Object.fromEntries(SHOCKS.map(s => [s.id, s]));
