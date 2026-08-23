// Hopkins episode content (Hopkins Episode Spec).
//
// SOURCING (§42). Every factual claim below carries its state and citation.
// Claims marked `verified: false` render as unattributed paraphrase — the
// spec forbids silently altering a quote's wording, so an unconfirmed quote
// must not be attributed to a named person at all.
//
// Verified against the Berkeley Council record in ../council:
//   - 7-2 vote on Item 27, 2026-07-28  (scores/linked_votes.json, full roll call)
//   - the ~90-second reversal          (governance_failures.json, contrast_with_hopkins)
//   - Fire Chief testimony at 01:31:48; adoption at 06:15:05 (same file)

export const RECORD = {
  meeting: '2026-07-28 Regular Meeting, Item 27',
  itemTitle: 'Referral to Schedule Hopkins Street for Paving with Enhanced Safety',

  vote: {
    verified: true,
    tally: '7–2',
    ayes: 7,
    noes: 2,
    result: 'MOTION PASSES',
    source: 'scores/linked_votes.json — 2026-07-28 Item 27 roll call'
  },

  reversal: {
    verified: true,
    seconds: 90,
    // Paraphrase of the recorded conduct, not a quotation.
    summary: 'Voted for the analysis-first substitute, then ninety seconds ' +
             'after it failed voted to continue — without explanation.',
    source: 'governance_failures.json — contrast_with_hopkins'
  },

  fireReview: {
    verified: true,
    testimonyAt: '01:31:48',
    adoptedAt: '06:15:05',
    summary: 'The Fire Chief testified the adopted configuration had not been ' +
             'reviewed and needed 2–4 weeks once a complete design set existed. ' +
             'Council adopted the plan roughly four hours later.',
    source: 'governance_failures.json — hopkins_fire_review_2026'
  },

  /**
   * Verified by the project owner against the meeting record on 2026-08-22.
   *
   * Provenance note: unlike the other claims here, this one is not backed by a
   * file in ../council that this repo can point at — it was confirmed in a
   * session that is no longer open. Before public release, re-anchor it to the
   * transcript so the citation names a source the reader can check.
   */
  quote: {
    verified: true,
    text: 'I’d much rather let our professional staff evaluate the corridor ' +
          'comprehensively — informed by data and technical expertise.',
    speaker: 'CM TREGUB',
    attributionWhenVerified: 'CM TREGUB',
    // Retained as the fallback if this is ever set back to unverified.
    paraphrase: 'A councilmember argues the technical work should come first.',
    source: 'Owner-verified against the 2026-07-28 meeting record; ' +
            'transcript citation still to be attached'
  }
};

export const BANNERS = {
  first: 'STUDY THE ALTERNATIVES FIRST',
  second: 'ADOPT THE PLAN AS SUBMITTED'
};

export const TRANSITION_TITLE = 'The Hopkins of Tomorrow';

/** Each of the three games opens on the same card with its own subtitle. */
export const CHAPTERS = {
  crossing: 'Parking is hard. Let\u2019s go shopping!',
  emergency: 'Fire in the Hills!',
  collection: 'Trash Day!'
};

export const SCENES = {
  crossing: { title: 'CROSSING HOPKINS', seconds: 45,
              // Five knocks and the trip is over. The shops do not outlast it.
              maxHits: 5,
              failed: 'You didn\u2019t make it. Neither did the stores.' },
  market:   { title: 'MARKET', holdMs: 3200,
              closed: 'Thanks for letting us serve you all of these years',
              lease: 'FOR LEASE' },
  emergency:{ title: 'EMERGENCY RESPONSE', call: 'EMERGENCY CALL',
              timerLabel: 'RESPONSE TIMER STARTED', blockedSeconds: 9, seconds: 45,
              // Once the street locks up, this is all the time left.
              stalledSeconds: 10,
              // The truck never gets through. What it was answering burns.
              tooLate: 'TOO LATE',
              aftermath: 'The bikes keep going.' },
  collection:{ title: 'TRASH DAY SLALOM', seconds: 20,
               // Hitting a rider is the thing the corridor was supposed to
               // prevent. It is not played for laughs in the narration.
               riderHit: 'You hit a cyclist.' }
};

export const END = {
  heading: 'HOPKINS COMPLETE',
  tag: 'CORRIDOR COMPLETE'
};
