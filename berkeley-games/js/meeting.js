// Special Meeting Pit Stop logic (Pit Stop addendum).
//
// Fiscal isolation (addendum §25) is the load-bearing rule here: nothing in
// this module may move the live budget gap, debt service, lane wear, or the
// bridge count. It reads them only to prove, on the summary screen, that they
// did not move. The one sanctioned exception is MEGA PANDER, which books a
// *future* recurring obligation (Tightening addendum §37).

import {
  MEETING_TUNING as T, pressureTier, panderEffect,
  CREDIBILITY_EXHAUSTED_TEXT, CREDIBILITY_EXHAUSTED_VALUE,
  RAGE_QUIT_TEXT, RAGE_QUIT_SUBTEXT,
  MEGA_PANDER as MP, PROGRAM_PROPOSALS,
  PROFILE_GAIN_PER_PANDER, PROFILE_GAIN_PER_EXTENSION,
  MEGA_PANDER_TEXT, MEGA_PROMPT_TITLE, MEGA_FUNDING_LINE,
  CONSENT_TITLE, CONSENT_SUBTITLE, CONSENT_STAMP
} from './content/meeting.js';
import { clamp } from './state.js';

export function createMeetingState() {
  return {
    active: false,
    voterSentiment: 0,
    activistSentiment: 0,
    elapsedRealSeconds: 0,
    meetingMinutes: 0,
    clockMinutes: 0,
    publicComments: 0,
    extensionsUsed: 0,
    // PANDER / credibility (Pandering addendum §5, §14).
    credibility: 100,
    panderUses: 0,
    panderDisabled: false,
    exhaustedAt: 0,           // real seconds when credibility hit zero, for the banner
    // Pressure on the meeting room, not on a car (Bottle Episode §3, §7).
    crowdPressure: 0,
    rageQuitEligible: false,
    rageQuitOccurred: false,
    rageQuitAt: -1,
    // MEGA PANDER (Tightening addendum Part III).
    megaApproved: false,
    megaProposal: null,
    megaOnConsent: false,
    calmRemaining: 0,
    savedRoadState: null,
    // Proof the fiscal state did not move across the meeting (addendum §17).
    fiscalSnapshot: null
  };
}

/** Run-level political metrics that persist after the meeting (addendum §19). */
export function createPolitics() {
  return {
    voterSentiment: T.initialVoterSentiment,
    activistSentiment: T.initialActivistSentiment,
    specialMeetings: 0,
    meetingMinutes: 0,
    extensions: 0,
    panderUses: 0,
    credibilityExhausted: false,
    rageQuits: 0,
    // Political career metric (Tightening addendum §24).
    politicalProfile: 0,
    megaPandersApproved: 0,
    // On-demand cooldown (On-Demand addendum §6, §20).
    specialMeetingUsedThisFiscalYear: false,
    totalSpecialMeetingsCalled: 0
  };
}

/**
 * Snapshots whatever fiscal fields the host game actually has. v1.0 tracks a
 * per-bridge gap and lane wear; the reboot tracks a per-session gapRemaining
 * and no lanes. Reading both defensively keeps one isolation check honest
 * across both builds.
 */
function snapshotFiscal(gameState) {
  const b = gameState.budget ?? {};
  return {
    currentGap: b.currentGap,
    gapRemaining: b.gapRemaining,
    openingGap: b.openingGap,
    annualDebtService: b.annualDebtService,
    bridgeNumber: gameState.bridgeNumber,
    laneWear: gameState.laneWear ? { ...gameState.laneWear } : null
  };
}

/**
 * True if any protected value moved during the meeting.
 *
 * MEGA PANDER is the one sanctioned exception (Tightening addendum §37): it
 * books a *future* recurring obligation, which is why the check covers the
 * live gap and debt service but not `recurringCommitments`. Everything else in
 * the meeting must still be fiscally inert.
 */
export function fiscalChanged(snap, gameState) {
  if (!snap) return false;
  const b = gameState.budget;
  if (snap.currentGap !== b.currentGap) return true;
  if (snap.gapRemaining !== b.gapRemaining) return true;
  if (snap.openingGap !== b.openingGap) return true;
  if (snap.annualDebtService !== b.annualDebtService) return true;
  if (snap.bridgeNumber !== gameState.bridgeNumber) return true;
  if (snap.laneWear) {
    for (const k of Object.keys(snap.laneWear)) {
      if (snap.laneWear[k] !== gameState.laneWear[k]) return true;
    }
  }
  return false;
}

export function beginMeeting(meeting, gameState, politics, savedRoadState, rng) {
  meeting.active = true;
  meeting.elapsedRealSeconds = 0;
  meeting.meetingMinutes = 0;
  meeting.publicComments = 0;
  meeting.extensionsUsed = 0;
  // Credibility is per-meeting and never regenerates within one (§8).
  meeting.credibility = 100;
  meeting.panderUses = 0;
  meeting.panderDisabled = false;
  meeting.exhaustedAt = 0;
  meeting.crowdPressure = 0;
  meeting.calmRemaining = 0;
  meeting.rageQuitEligible = false;
  meeting.rageQuitOccurred = false;
  meeting.rageQuitAt = -1;
  meeting.megaApproved = false;
  meeting.megaProposal = null;
  meeting.megaOnConsent = false;
  meeting.savedRoadState = savedRoadState;
  meeting.fiscalSnapshot = snapshotFiscal(gameState);

  // Carry sentiment across meetings within a run.
  meeting.voterSentiment = politics.voterSentiment;
  meeting.activistSentiment = clamp(
    politics.activistSentiment + T.entryActivistBonus, 0, 100
  );

  meeting.clockMinutes = Math.floor(
    rng.range(T.clockStartMinMinutes, T.clockStartMaxMinutes)
  );

  politics.specialMeetings += 1;
  return meeting;
}

/**
 * Advance the meeting. Returns 'running' or a reason the meeting should end.
 * Never touches fiscal state.
 */
export function updateMeeting(meeting, dt) {
  meeting.elapsedRealSeconds += dt;

  meeting.voterSentiment = clamp(
    meeting.voterSentiment - T.voterDecayPerSecond * dt, 0, 100
  );
  meeting.activistSentiment = clamp(
    meeting.activistSentiment - T.activistDecayPerSecond * dt, 0, 100
  );

  meeting.clockMinutes += T.clockMinutesPerSecond * dt;
  meeting.meetingMinutes += T.clockMinutesPerSecond * dt;
  meeting.publicComments += T.publicCommentsPerSecond * dt;

  if (meeting.calmRemaining > 0) meeting.calmRemaining -= dt;

  // Crowd pressure rises as activist sentiment falls, suppressed just after an
  // extension so the relief is legible (Pit Stop §12, Bottle Episode §7).
  const tier = pressureTier(meeting.activistSentiment);
  const target = tier === 'ordinary' ? 0
    : tier === 'louder' ? 0.22
    : tier === 'pressing' ? 0.55
    : tier === 'intense' ? 0.85
    : 1;
  const suppressed = meeting.calmRemaining > 0 ? target * 0.12 : target;
  meeting.crowdPressure += (suppressed - meeting.crowdPressure) * Math.min(1, dt * 3);

  if (meeting.elapsedRealSeconds >= T.maxDurationSeconds) return 'time';
  if (meeting.voterSentiment <= 0) return 'voters';
  return 'running';
}

export function canEndMeeting(meeting) {
  return meeting.elapsedRealSeconds >= T.minDurationSeconds;
}

export function canExtend(meeting) {
  return meeting.activistSentiment <= T.extendButtonThreshold;
}

/** Extend the meeting (addendum §12, §13). Fiscal state is untouched. */
export function extendMeeting(meeting, politics) {
  const step = T.extensions[meeting.extensionsUsed] ?? T.extensionFallback;
  meeting.activistSentiment = clamp(meeting.activistSentiment + step.activist, 0, 100);
  meeting.voterSentiment = clamp(meeting.voterSentiment + step.voter, 0, 100);

  // The button promises midnight, so the first extension delivers midnight
  // whatever the clock says. Each one after that runs further into the small
  // hours, which is the joke: the meeting was never going to end at midnight
  // either.
  const target = meeting.clockMinutes < T.midnightMinutes
    ? T.midnightMinutes
    : meeting.clockMinutes + T.pastMidnightMinutes;
  const jump = Math.max(step.minutes, target - meeting.clockMinutes);
  meeting.clockMinutes += jump;
  meeting.meetingMinutes += jump;
  meeting.extensionsUsed += 1;
  step.appliedMinutes = jump;
  meeting.calmRemaining = T.calmAfterExtendSeconds;
  politics.extensions += 1;
  politics.politicalProfile = clamp(
    politics.politicalProfile + PROFILE_GAIN_PER_EXTENSION, 0, 100
  );
  // Deliberately does NOT touch credibility, panderUses, or panderDisabled:
  // extending never gives the small lever back (Pandering addendum §12).
  return step;
}

/**
 * RAGE QUIT (Bottle Episode addendum §11-§15). A rare random meeting event the
 * player cannot trigger. Voter sentiment clearly falls; the activist reaction
 * is deliberately ambiguous because different activists react differently.
 * Fiscal state is never touched.
 */
export function maybeRageQuit(meeting, politics, rng) {
  if (meeting.rageQuitOccurred) return null;

  // Never immediately on entry, and only once crowd pressure is nontrivial.
  const earliest = T.minDurationSeconds * T.rageQuitEarliestFraction;
  if (meeting.elapsedRealSeconds < earliest) return null;
  if (meeting.crowdPressure < 0.15) return null;

  meeting.rageQuitEligible = true;
  // Rolled per second of eligibility so the chance lands across the meeting.
  if (!rng.chance(T.rageQuitChance * 0.06)) return null;

  meeting.rageQuitOccurred = true;
  meeting.rageQuitAt = meeting.elapsedRealSeconds;

  const voterDelta = T.rageQuitVoterDelta;
  const jitter = T.rageQuitActivistJitter;
  const activistDelta = rng.range(-jitter, jitter);

  meeting.voterSentiment = clamp(meeting.voterSentiment + voterDelta, 0, 100);
  meeting.activistSentiment = clamp(meeting.activistSentiment + activistDelta, 0, 100);
  politics.rageQuits = (politics.rageQuits || 0) + 1;

  // Deliberately does NOT touch credibility, extensions, or the fiscal state,
  // and never disables a political control (addendum §17).
  return { voterDelta, activistDelta };
}

export function canPander(meeting) {
  return meeting.active && !meeting.panderDisabled;
}

/**
 * PANDER (Pandering addendum §4, §15). Small activist gain, steady voter cost,
 * and credibility spent permanently. Fiscal state is never touched.
 */
export function pander(meeting, politics) {
  if (!canPander(meeting)) return null;

  const step = panderEffect(meeting.panderUses);
  meeting.activistSentiment = clamp(meeting.activistSentiment + step.activist, 0, 100);
  meeting.voterSentiment = clamp(meeting.voterSentiment + step.voter, 0, 100);
  meeting.clockMinutes += T.panderMinutes;
  meeting.meetingMinutes += T.panderMinutes;
  meeting.credibility = clamp(meeting.credibility - T.panderCredibilityCost, 0, 100);
  meeting.panderUses += 1;
  politics.panderUses += 1;
  politics.politicalProfile = clamp(
    politics.politicalProfile + PROFILE_GAIN_PER_PANDER, 0, 100
  );

  // A meaningful activist jump buys a moment of calm from the crowd (§10).
  if (step.activist > 0) {
    meeting.calmRemaining = Math.max(meeting.calmRemaining, T.panderCalmSeconds);
  }

  let exhausted = false;
  if (meeting.credibility <= 0) {
    meeting.credibility = 0;
    meeting.panderDisabled = true;
    meeting.exhaustedAt = meeting.elapsedRealSeconds;
    politics.credibilityExhausted = true;
    exhausted = true;
  }

  return { ...step, exhausted, uses: meeting.panderUses };
}

/**
 * MEGA PANDER eligibility (Tightening addendum §19).
 *
 * Note it deliberately does NOT require credibility: cheap symbolic pandering
 * can be exhausted while a large concrete commitment still generates
 * enthusiasm. It also never refills the PANDER credibility meter (§33).
 */
export function canMegaPander(meeting, politics) {
  return meeting.active
    && !meeting.megaApproved
    && meeting.activistSentiment < MP.activistBelow
    && meeting.elapsedRealSeconds >= MP.minElapsedSeconds
    && (politics.megaPandersApproved ?? 0) < MP.maxPerRun;
}

/** Picks the program this meeting would commit to, deterministically. */
export function pickProposal(rng) {
  return PROGRAM_PROPOSALS[Math.floor(rng.next() * PROGRAM_PROPOSALS.length)];
}

/**
 * Approve a MEGA PANDER program (addendum §22, §23). Huge immediate political
 * reward; the recurring obligation is booked by the caller and only bites at
 * the next fiscal-year open. Returns the political deltas for feedback.
 */
export function approveMegaPander(meeting, politics, proposal) {
  meeting.megaApproved = true;
  meeting.megaProposal = proposal;

  meeting.activistSentiment = clamp(meeting.activistSentiment + MP.activistGain, 0, 100);
  meeting.voterSentiment = clamp(meeting.voterSentiment + MP.voterCost, 0, 100);
  politics.politicalProfile = clamp(politics.politicalProfile + MP.profileGain, 0, 100);
  politics.megaPandersApproved = (politics.megaPandersApproved ?? 0) + 1;

  // The room relaxes completely for a moment — this reads as a political win.
  meeting.calmRemaining = Math.max(meeting.calmRemaining, MP.calmSeconds);

  return {
    activist: MP.activistGain,
    profile: MP.profileGain,
    voter: MP.voterCost,
    proposal
  };
}

/**
 * The consent fast-track (addendum §26-§30). Same recurring cost either way —
 * consent buys process, not savings.
 */
export function resolveConsent(meeting, politics, onConsent) {
  const step = onConsent ? MP.consent : MP.discuss;
  meeting.megaOnConsent = onConsent;

  meeting.activistSentiment = clamp(meeting.activistSentiment + step.activist, 0, 100);
  meeting.voterSentiment = clamp(meeting.voterSentiment + step.voter, 0, 100);
  politics.politicalProfile = clamp(politics.politicalProfile + step.profile, 0, 100);
  meeting.clockMinutes += step.minutes;
  meeting.meetingMinutes += step.minutes;

  return { ...step, onConsent };
}

export function endMeeting(meeting, politics) {
  meeting.active = false;
  politics.voterSentiment = meeting.voterSentiment;
  politics.activistSentiment = meeting.activistSentiment;
  politics.meetingMinutes += meeting.meetingMinutes;
  return {
    publicComments: Math.floor(meeting.publicComments),
    meetingMinutes: Math.round(meeting.meetingMinutes),
    voterSentiment: Math.round(meeting.voterSentiment),
    activistSentiment: Math.round(meeting.activistSentiment),
    extensionsUsed: meeting.extensionsUsed,
    panderUses: meeting.panderUses,
    credibility: Math.round(meeting.credibility),
    credibilityExhausted: meeting.panderDisabled,
    rageQuits: meeting.rageQuitOccurred ? 1 : 0,
    megaApproved: meeting.megaApproved,
    megaProposal: meeting.megaProposal,
    megaOnConsent: meeting.megaOnConsent,
    politicalProfile: Math.round(politics.politicalProfile)
  };
}

/** Format the meeting wall clock, e.g. 2291 -> "11:11 PM" (addendum §14). */
export function formatClock(totalMinutes) {
  const m = Math.floor(totalMinutes) % (24 * 60);
  let h = Math.floor(m / 60);
  const mins = Math.floor(m % 60);
  const suffix = h >= 12 && h < 24 ? 'PM' : 'AM';
  let h12 = h % 12;
  if (h12 === 0) h12 = 12;
  return `${h12}:${String(mins).padStart(2, '0')} ${suffix}`;
}

/**
 * Duration as a clock-style "6:47" (Tally Reveal addendum §7, §15). The tally
 * reveals this character by character, so it must be short text.
 */
export function formatDurationClock(totalMinutes) {
  const m = Math.max(0, Math.round(totalMinutes));
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
}

/** Format a duration in minutes as "6h 44m" (addendum §17). */
export function formatDuration(totalMinutes) {
  const m = Math.max(0, Math.round(totalMinutes));
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}

export {
  pressureTier, CREDIBILITY_EXHAUSTED_TEXT, CREDIBILITY_EXHAUSTED_VALUE,
  RAGE_QUIT_TEXT, RAGE_QUIT_SUBTEXT,
  MEGA_PANDER_TEXT, MEGA_PROMPT_TITLE, MEGA_FUNDING_LINE,
  CONSENT_TITLE, CONSENT_SUBTITLE, CONSENT_STAMP
};
