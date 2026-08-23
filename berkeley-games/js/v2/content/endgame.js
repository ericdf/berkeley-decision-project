// Higher Office escape and the Roosevelt Avenue easter egg (Reboot spec
// §71-§73, §104).

export const HIGHER_OFFICE = {
  // Reachable, not punishing (§71): profile is the gate, arcade skill is not.
  profileThreshold: 60,
  earliestYearIndex: 1,
  pickupWidth: 0.42,

  riseSeconds: 2.6,
  driverlessSeconds: 5.4,

  runLabel: 'RUN FOR HIGHER OFFICE!',
  // Exact and unadorned; no explanatory subtitle may follow (§72).
  escapeMessage: 'YOU ESCAPED TO HIGHER OFFICE'
};

export const ROOSEVELT = {
  chancePerTour: 0.18,
  promptTitle: 'PAVE ROOSEVELT AVENUE?',
  onlyOption: 'NEVER!',
  confirmation: 'POLICY CONTINUES',
  roadSign: 'ROOSEVELT AVE',
  confirmationMs: 900
};

export const ENDING = {
  termComplete: 'TERM COMPLETE'
};
