// Special Meeting Pit Stop content (Pit Stop addendum §7, §15, §17).
//
// Signs are deliberately generic and deliberately contradictory: the scene
// conveys political intensity, not agreement, and release 1 must not name any
// real conflict (addendum §27).

/**
 * The sign that fills the frame at the end of the meeting. The citation is
 * shown because the line is quoted, not invented.
 */
export const FINAL_SIGN = {
  text: 'Just here for a quick mega-feed',
  citation: 'What We Do in the Shadows, s1e2'
};

export const PROTEST_SIGNS = [
  'WE DEMAND ACTION',
  'LISTEN TO US',
  'DO SOMETHING',
  'NOT IN MY NAME',
  'SHAME',
  'TAKE A STAND',
  'PASS THE RESOLUTION',
  'NO MORE DELAY',
  'HEAR US',
  'THANK YOU COUNCIL'
];

// The roadside offramp is superseded by the on-demand CALL SPECIAL MEETING
// control (On-Demand addendum §8), so no exit signage is used any more.
export const CALL_MEETING_TITLE = 'CALL SPECIAL MEETING';
export const CALL_MEETING_SUBTEXT = 'Need a break from adult decisions?';

// Tuning (addendum §9, §10, §12, §13, §16). Sentiments are 0-100.
export const MEETING_TUNING = {
  initialVoterSentiment: 70,
  initialActivistSentiment: 75,
  entryActivistBonus: 10,

  // The addendum's per-second rates are expressed in meeting-time terms; the
  // pit stop itself lasts 8-30 real seconds, so they are scaled up to keep the
  // same relationship (activist becomes urgent first) while ensuring the
  // EXTEND button is actually reachable inside the maximum duration.
  voterDecayPerSecond: 1.4,
  activistDecayPerSecond: 3.6,

  // Must sit above where activist sentiment stands when END unlocks, or the
  // crisis lever appears after the player already has a way out.
  extendButtonThreshold: 55,

  // Diminishing returns on repeated extensions (addendum §13).
  extensions: [
    { activist: +35, voter: -15, minutes: 75 },
    { activist: +25, voter: -18, minutes: 75 },
    { activist: +15, voter: -22, minutes: 75 }
  ],
  // Any extension past the configured list.
  extensionFallback: { activist: +8, voter: -25, minutes: 75 },

  // The button says EXTEND MEETING TO MIDNIGHT, so the first extension takes
  // the clock to midnight however early it is — a 75-minute bump from 9:30 PM
  // made the label a lie. Later extensions run past it into the small hours.
  midnightMinutes: 24 * 60,
  pastMidnightMinutes: 55,

  // PANDER (Pandering addendum §4-§7). The small lever: modest activist gain,
  // steady voter cost, and a finite credibility budget that never regenerates.
  panderCredibilityCost: 20,
  panderMinutes: 10,
  panderCalmSeconds: 1.2,

  minDurationSeconds: 8,
  maxDurationSeconds: 30,

  // Meeting clock starts somewhere in the early evening.
  clockStartMinMinutes: 18 * 60,      // 6:00 PM
  clockStartMaxMinutes: 19 * 60 + 30, // 7:30 PM
  // Paced so a full meeting with a couple of extensions lands just past
  // midnight — which is the entire point of the button's label.
  clockMinutesPerSecond: 7,

  publicCommentsPerSecond: 7,

  // RAGE QUIT (Bottle Episode addendum §11-§15): a rare, uncontrollable
  // meeting event the player can never trigger deliberately.
  rageQuitChance: 0.08,
  rageQuitEarliestFraction: 0.25,   // of the minimum meeting duration
  rageQuitVoterDelta: -8,
  rageQuitActivistJitter: 4,

  // Real-time seconds of relief after an extension before rocking resumes.
  calmAfterExtendSeconds: 3.5
};

/**
 * PANDER effect for the nth use, 0-indexed (Pandering addendum §6).
 * Activist benefit falls with each use; voter cost never falls.
 */
export function panderEffect(use) {
  return {
    activist: Math.max(0, 8 - use * 2),
    voter: -Math.min(6, 3 + use)
  };
}

// The spelling of this message is normative (Pandering addendum §7).
export const CREDIBILITY_EXHAUSTED_TEXT = 'CREDIBILITY EXHUASTED!';
// The tally shows the status word alone (Tally Reveal addendum §11). Both
// spellings are the intentional normative typo.
export const CREDIBILITY_EXHAUSTED_VALUE = 'EXHUASTED';

/**
 * Crowd-pressure tiers driven by activist sentiment (Bottle Episode addendum
 * §7). This supersedes the earlier car-jostling tiers: the pressure now acts
 * on the meeting room, not on a vehicle.
 */
export function pressureTier(activistSentiment) {
  if (activistSentiment > 50) return 'ordinary';
  if (activistSentiment >= 30) return 'louder';
  if (activistSentiment >= 15) return 'pressing';
  if (activistSentiment >= 1) return 'intense';
  return 'full';
}

export const RAGE_QUIT_TEXT = 'RAGE QUIT!';
export const RAGE_QUIT_SUBTEXT = 'COUNCILMEMBER DEPARTED';

/* ------------------------------------------------------------------ */
/* MEGA PANDER (Tightening addendum Part III & IV)                     */
/* ------------------------------------------------------------------ */

export const MEGA_PANDER_TEXT = 'MEGA PANDER';
export const MEGA_PROMPT_TITLE = 'COMMIT TO NEW PROGRAM?';
export const MEGA_FUNDING_LINE = 'Recurring funding identified: NONE';
export const CONSENT_TITLE = 'PUT IT ON CONSENT?';
export const CONSENT_SUBTITLE = 'Skip debate. Keep momentum.';
export const CONSENT_STAMP = 'APPROVED WITHOUT DISCUSSION';

// Generic program names only: no real Berkeley program may be named without
// source verification (addendum §35).
export const PROGRAM_PROPOSALS = [
  { id: 'new_community_program', label: 'NEW COMMUNITY PROGRAM', annualCost: 3.5 },
  { id: 'new_city_initiative',   label: 'NEW CITY INITIATIVE',   annualCost: 2.5 },
  { id: 'new_support_program',   label: 'NEW SUPPORT PROGRAM',   annualCost: 4.0 },
  { id: 'new_office_program',    label: 'NEW OFFICE / PROGRAM',  annualCost: 2.0 },
  { id: 'new_pilot_ongoing',     label: 'NEW PILOT — ONGOING',   annualCost: 5.0 }
];

export const MEGA_PANDER = {
  // Eligibility (addendum §19). Credibility is deliberately NOT required: a
  // large concrete commitment still lands even after cheap pandering stops.
  activistBelow: 60,
  minElapsedSeconds: 5,
  maxPerMeeting: 1,
  maxPerRun: 2,

  // Political reward (addendum §23).
  activistGain: 40,
  profileGain: 30,
  voterCost: -5,
  calmSeconds: 5,

  // Consent fast-track (addendum §28).
  consent: { activist: 10, profile: 10, voter: 0, minutes: 5 },
  // Debated path (addendum §30): same cost, more process.
  discuss: { activist: 0, profile: 2, voter: -5, minutes: 30 }
};

// Political Profile (addendum §24). A run-level career metric, 0-100.
export const PROFILE_GAIN_PER_PANDER = 2;
export const PROFILE_GAIN_PER_EXTENSION = 4;
