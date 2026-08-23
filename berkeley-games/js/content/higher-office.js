// Higher Office Escape content and tuning (Higher Office addendum).
//
// Release 1 is deliberately generic (addendum §25): no real officeholder's
// name, likeness, party, or office title appears anywhere in this feature.
// The satire is structural, not personal.

export const LABEL_RUN = 'RUN FOR HIGHER OFFICE!';
export const LABEL_WIN = 'WIN HIGHER OFFICE!';
export const LABEL_CANDIDATE = 'CANDIDATE';
export const LABEL_CAMPAIGN_OVER = 'CAMPAIGN OVER';

// The exact final message (addendum §2). No subtitle may be appended.
export const ESCAPE_MESSAGE = 'YOU ESCAPED TO HIGHER OFFICE';

export const HIGHER_OFFICE = {
  // Rarity (addendum §4): roughly 5% of eligible Council Mode runs.
  chancePerRun: 0.05,

  // Political Profile eligibility boost (Tightening addendum §25). A player who
  // panders and mega-panders has a materially easier path to higher office.
  profileThreshold: 60,
  profileMultiplier: 2,

  // Eligibility (addendum §5) — an escape hatch, never a reward for good
  // fiscal management, so these gate on pressure and elapsed play only.
  minBridgesCrossed: 0,
  minDecisionsMade: 2,
  minDistance: 900,

  // Campaign window: the WIN pickup must be taken inside this (addendum §9).
  // Demanding but fair (addendum §9, §20): the WIN pickup appears partway into
  // the window and must be reachable with normal lane-change timing.
  campaignWindowSeconds: 9,
  winPickupDelaySeconds: 4,

  // Campaign distraction (addendum §8): a modest attention cost, never fiscal.
  hazardVisibilityFactor: 0.92,
  laneChangeDelayFactor: 1.08,

  // Escape cinematic timings, in seconds (addendum §12, §14).
  riseSeconds: 2.6,
  // Long enough for the Roosevelt Avenue sign, the pothole impact, the flip,
  // the slide, and the flames to all read (Roosevelt addendum §10).
  driverlessSeconds: 5.4,
  messageHoldSeconds: 3.0
};

// Debug override (addendum §19). MUST remain false in production.
export const DEBUG_FORCE_HIGHER_OFFICE_EVENT = false;

export const SECRET_ENDING_KEY = 'bbd.endings.higherOffice';
