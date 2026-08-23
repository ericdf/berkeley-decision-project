// Evidence records (spec §28, §29, §40).
//
// `sourceUrl: null` means no final URL has been supplied yet. Records with
// `verified: false` render as "source pending" rather than as a sourced claim,
// and MUST NOT be presented as fact. Do not invent sources here.

export const EVIDENCE = [
  {
    id: 'workers_comp_holiday',
    label: "Workers' Comp contribution holiday",
    amount: 5.2,
    type: 'one_time',
    sourceLabel: 'City budget materials',
    sourceUrl: null,
    verified: false,
    note: 'One-time budget capacity; not a recurring structural solution.'
  },
  {
    id: 'pension_trust',
    label: 'Pension trust draw',
    amount: 3.0,
    type: 'one_time',
    sourceLabel: 'City budget materials',
    sourceUrl: null,
    verified: false,
    note: 'One-time budget capacity; does not change recurring revenue or expenditure.'
  }
];

export const EVIDENCE_BY_ID = Object.fromEntries(EVIDENCE.map(e => [e.id, e]));

// Link target for the supporting project, filled in when a final URL is supplied.
export const PROJECT_LINK = { label: 'Berkeley Decision Project', url: null };

// Static explanatory points for the "Why these lanes?" panel (spec §29).
export const PANEL_POINTS = [
  'This is a simplified editorial model of municipal budgeting, not an accounting simulator. The seven lanes are broad categories used to illustrate fiscal choices — not a claim that every budget problem can be solved interchangeably by every lane.',
  'Every fiscal tool has costs and limits. In this game that shows up as lane wear: the more a tool is used, the less it yields and the rougher the road gets. That represents finite political, economic, institutional, and operational capacity — not a precise economic model.',
  'One-time resources can improve a single year without fixing a recurring imbalance. In the game they close part of this year\u2019s BUDGET GAP and do nothing for the years that follow.',
  'Borrowing can solve a capital need while creating future debt service, which reduces structural balance in later periods.',
  'Named Berkeley amounts are stored as editable content records with source labels. Where a source URL has not yet been supplied, the panel says so rather than implying one exists.',
  'The neighboring-city cars are visual satire about which lanes are open, not sourced claims that those cities fund themselves in a particular way. Any factual policy comparison would carry an evidence entry.'
];
