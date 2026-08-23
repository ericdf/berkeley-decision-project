// HOW BERKELEY CAN YOU BE? — the Special Meeting as its own episode
// (Front Matter §7-§13).
//
// No garage or driving prologue: the player is in the room within seconds
// (§9). The fiscal anchor is a standing gap that exists before the meeting,
// stays put during it, and is still there afterwards (§10).

import { createMeetingSession } from '../../v2/meeting-session.js';
import { createMeetingRenderer } from '../../render-meeting.js';
import { createTransitionRenderer, transitionPhaseAt, TRANSITION_TOTAL }
  from '../../render-transition.js';
import { makeRng, DEFAULT_SEED } from '../../rng.js';

// Illustrative and configurable; not a live Berkeley figure (§10).
export const STANDING_GAP = 8.7;

/** A minimal host state: enough fiscal context for the punchline to land. */
function createEpisodeState() {
  return {
    fiscalYear: 2029,
    budget: {
      gapRemaining: STANDING_GAP,
      openingGap: STANDING_GAP,
      annualDebtService: 0,
      recurringCommitments: []
    },
    politics: {
      voterSentiment: 70, activistSentiment: 70, credibility: 100,
      politicalProfile: 0,
      specialMeetingUsedThisYear: false, totalSpecialMeetings: 0,
      panderUses: 0, extensions: 0, rageQuits: 0,
      megaPanderCommitments: 0, credibilityExhausted: false
    },
    weather: { rainLevel: 0 },
    phase: 'meeting'
  };
}

export function createHowBerkeley({ audio, hud, reducedMotion, onExit }) {
  const state = createEpisodeState();
  const rng = makeRng(DEFAULT_SEED ^ 0x484f5742);
  let session = null;

  return {
    start() {
      hud.announce(
        `Special meeting called. The city is carrying a budget gap of ` +
        `$${STANDING_GAP.toFixed(1)} million. Nothing you do in this room changes it.`
      );
      session = createMeetingSession({
        state, rng, audio, hud, reducedMotion,
        renderers: {
          meeting: createMeetingRenderer,
          transition: createTransitionRenderer,
          transitionPhaseAt, TRANSITION_TOTAL
        },
        onReturn: () => {
          // Standalone episode: the meeting ending is the episode ending.
          const added = state.budget.recurringCommitments
            .reduce((a, c) => a + c.annualCost, 0);
          onExit({
            profile: Math.round(state.politics.politicalProfile),
            voter: Math.round(state.politics.voterSentiment),
            gap: state.budget.gapRemaining,
            added
          });
        }
      });
      session.start();
    },
    stop() { session?.stop(); },
    get state() { return state; }
  };
}
