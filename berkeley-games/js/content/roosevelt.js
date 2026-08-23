// Roosevelt Avenue Easter Egg (Roosevelt Avenue addendum).
//
// A private running gag, deliberately rare and secondary: it must never become
// a recurring road label, a persistent HUD element, or a real mechanic (§1).

export const PROMPT_TITLE = 'PAVE ROOSEVELT AVENUE?';
export const PROMPT_ONLY_OPTION = 'NEVER!';
export const PROMPT_CONFIRMATION = 'POLICY CONTINUES';
export const ROAD_SIGN_TEXT = 'ROOSEVELT AVE';

export const ROOSEVELT = {
  // Rarity (addendum §3): ~5% of eligible runs, at most once.
  chancePerRun: 0.05,

  // Eligibility (addendum §4): normal highway driving only.
  minDecisionsMade: 1,
  minDistance: 700,

  confirmationMs: 900,
  maxInterruptionMs: 3000
};

// Debug override (addendum §15). MUST remain false in production.
export const DEBUG_FORCE_ROOSEVELT_PROMPT = false;
