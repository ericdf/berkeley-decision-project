// GET TO SACRAMENTO OR DIE TRYIN' — tuning and copy
// (Sacramento Episode Spec §5-§8, §12-§26.)
//
// Constituencies are civic interests and political roles, never protected
// demographic identities (§13, §14).

export const CAMPAIGN = {
  days: 28,                    // §10
  secondsPerDay: 1.15,         // ~32s campaign
  startApproval: 55
};

export const GROUPS = [
  { id: 'homeowners', label: 'HOMEOWNERS',     decay: 1.6, hue: 28  },
  { id: 'renters',    label: 'RENTERS',        decay: 2.1, hue: 196 },
  { id: 'business',   label: 'BUSINESS OWNERS',decay: 1.9, hue: 46  },
  { id: 'activists',  label: 'ACTIVISTS',      decay: 2.9, hue: 320 },
  { id: 'employees',  label: 'PUBLIC EMPLOYEES',decay: 2.3, hue: 152 }
];

// Diminishing returns force alternation (§20, §23, §24).
export const PANDER_SEQUENCE = [12, 8, 4, 1, 0];
export const GASLIGHT_SEQUENCE = [10, 7, 3, 1, 0];

// Hammering a spent action costs a little (§26).
export const OVERUSE_PENALTY = 1.5;

export const COPY = {
  pander: 'PANDER',
  gaslight: 'GASLIGHT',
  win: 'YOU MADE IT TO SACRAMENTO',
  lose: 'YOU LOST!',
  loseSub: 'Back to City Council…',
  coalition: 'COALITION',
  daysLabel: 'DAYS TO ELECTION',
  electionDay: '0 DAYS'
};
