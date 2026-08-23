// Screen flow, menus, end states, evidence panel (spec §5, §24, §25, §29, §42).

import { LANES, LANE_KEYS, LANE_INDEX, COUNCIL_CLOSED_LANES } from './content/lanes.js';
import { EVIDENCE, PANEL_POINTS, PROJECT_LINK } from './content/evidence.js';
import { createGame } from './game.js';
import { createHud, formatMoney } from './hud.js';
import { createAudio } from './audio.js';
import { createInput } from './input.js';
import { DEFAULT_SEED } from './rng.js';
import { CAMPAIGN_BRIDGES } from './state.js';
import {
  formatClock, formatDuration, formatDurationClock,
  CREDIBILITY_EXHAUSTED_TEXT, CREDIBILITY_EXHAUSTED_VALUE,
  RAGE_QUIT_TEXT, RAGE_QUIT_SUBTEXT
} from './meeting.js';
import { playTallyReveal } from './tally.js';
import { ESCAPE_MESSAGE, SECRET_ENDING_KEY } from './content/higher-office.js';
import { ROOSEVELT, PROMPT_CONFIRMATION } from './content/roosevelt.js';

const HISCORE_KEY = 'bbd.hiscore';

const $ = sel => document.querySelector(sel);

const canvas = $('#game-canvas');
const audio = createAudio();
const hud = createHud(document.body);

let game = null;
let input = null;
let seenIntroFor = new Set();

const reducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ------------------------------------------------------------------ */
/* Screens                                                             */
/* ------------------------------------------------------------------ */

function showScreen(id) {
  for (const s of document.querySelectorAll('.screen')) {
    s.hidden = s.id !== id;
  }
  document.body.dataset.screen = id;
  const focusTarget = document.querySelector(`#${id} [data-autofocus]`);
  if (focusTarget) focusTarget.focus();
}

function showPlay() {
  for (const s of document.querySelectorAll('.screen')) s.hidden = true;
  document.body.dataset.screen = 'play';
}

/* ------------------------------------------------------------------ */
/* Starting a run                                                      */
/* ------------------------------------------------------------------ */

function startRun(mode) {
  if (game) { game.destroy(); game = null; }
  if (input) { input.destroy(); input = null; }
  meetingUi.close();
  rooseveltUi.close();
  $('#btn-call-meeting').hidden = true;
  hud.setHidden(false);
  hud.setDim(1);

  // First run of each mode uses the default seed so the two modes present the
  // same road (spec §8.3, §27). Replays randomise.
  const firstRun = !seenIntroFor.has(mode);
  const seed = firstRun ? DEFAULT_SEED : (Math.floor(Math.random() * 2 ** 31) >>> 0);
  seenIntroFor.add(mode);

  showPlay();
  document.body.dataset.mode = mode;

  game = createGame({
    canvas, hud, audio, mode, seed, reducedMotion, meetingUi, rooseveltUi,
    onEnd: showEndScreen
  });

  // Test hook: the harness drives the real game rather than a mock. Reading it
  // has no effect on play, and nothing writes to it.
  if (window.__BBD_TEST__) window.__BBD_GAME__ = game;

  // On-demand reality break (On-Demand addendum §3, §9). No confirmation
  // dialog: the button itself is the deliberate choice.
  $('#btn-call-meeting').onclick = e => {
    e.currentTarget.blur();
    game?.callMeeting();
  };

  input = createInput(canvas, {
    onLeft: () => game.left(),
    onRight: () => game.right(),
    onPause: () => togglePause(),
    onMute: () => toggleMute()
  }, game.laneRepeatMs);

  game.preview();
  showStartOverlay(mode, () => game.start());
}

/**
 * Pre-start scoreboard (spec §42). The seven lanes are listed like a record
 * board so every one is legible before the car moves, with Council Mode's
 * unavailable lanes struck through and stamped. On start, each row's label
 * flies out of the board and lands on the lane it belongs to.
 */
function showStartOverlay(mode, onGo) {
  const overlay = $('#start-overlay');
  const council = mode === 'council';

  $('#start-overlay-mode').textContent = council
    ? 'CITY COUNCIL MODE — 3 OF 7 LANES OPEN'
    : 'COMMON SENSE MODE — ALL 7 LANES OPEN';

  const board = $('#startboard-lanes');
  board.innerHTML = LANES.map((lane, i) => {
    const closed = council && COUNCIL_CLOSED_LANES.includes(lane.key);
    return `<li class="sb-lane" data-closed="${closed}" data-lane="${i}"
                style="--lane-hue: hsl(${lane.hue} 70% 62%)">
      <span class="sb-rank">${i + 1}</span>
      <span class="sb-name">${lane.name}</span>
      <span class="sb-meaning">${lane.meaning}</span>
      ${closed ? '<span class="sb-stamp">NOT AVAILABLE IN COUNCIL MODE</span>' : ''}
    </li>`;
  }).join('');

  overlay.hidden = false;

  const go = () => {
    window.removeEventListener('keydown', onKey);
    $('#start-overlay-go').onclick = null;
    flyLaneLabels(council, () => { overlay.hidden = true; onGo(); });
  };
  const onKey = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } };
  $('#start-overlay-go').onclick = go;
  window.addEventListener('keydown', onKey);
  $('#start-overlay-go').focus();
}

/**
 * Fades the scoreboard and animates each lane label from its row onto the
 * matching lane of the road, so the player connects name to position before
 * the first decision gate.
 */
function flyLaneLabels(council, done) {
  const overlay = $('#start-overlay');
  const flight = $('#lane-flight');
  const reduce = reducedMotion();

  // Where each lane sits on screen, measured from the live renderer so the
  // labels land on the actual road rather than a guessed position.
  const targets = game ? game.laneScreenPositions() : null;
  if (!targets || reduce) {
    overlay.style.opacity = '0';
    setTimeout(() => { overlay.style.opacity = ''; done(); }, reduce ? 160 : 320);
    return;
  }

  const rows = [...document.querySelectorAll('.sb-lane')];
  flight.innerHTML = '';
  flight.hidden = false;

  const stageBox = $('#stage').getBoundingClientRect();

  rows.forEach(row => {
    const i = Number(row.dataset.lane);
    const nameEl = row.querySelector('.sb-name');
    const from = nameEl.getBoundingClientRect();
    const to = targets[i];
    if (!to) return;

    const el = document.createElement('div');
    el.className = 'flying-label';
    el.dataset.closed = row.dataset.closed;
    el.textContent = LANES[i].short;
    el.style.color = `hsl(${LANES[i].hue} 70% 62%)`;
    el.style.left = `${from.left - stageBox.left + from.width / 2}px`;
    el.style.top = `${from.top - stageBox.top + from.height / 2}px`;
    flight.appendChild(el);

    // Animate on the next frame so the start position is committed first.
    requestAnimationFrame(() => {
      el.style.transition =
        'left 900ms cubic-bezier(.35,.9,.3,1), top 900ms cubic-bezier(.35,.9,.3,1), opacity 320ms ease 780ms';
      el.style.left = `${to.x}px`;
      el.style.top = `${to.y}px`;
      el.style.opacity = '0';
    });
  });

  overlay.style.transition = 'opacity 420ms ease';
  overlay.style.opacity = '0';

  setTimeout(() => {
    flight.hidden = true;
    flight.innerHTML = '';
    overlay.style.opacity = '';
    overlay.style.transition = '';
    done();
  }, 1150);
}

/* ------------------------------------------------------------------ */
/* Special Meeting Pit Stop UI (Pit Stop addendum §8, §12, §17)        */
/* ------------------------------------------------------------------ */

function createMeetingUi() {
  const hudEl = $('#meeting-hud');
  const summaryEl = $('#meeting-summary');
  const extendBtn = $('#meeting-extend');
  const megaBtn = $('#meeting-mega');
  const panderBtn = $('#meeting-pander');
  const endBtn = $('#meeting-end');
  const exhaustedEl = $('#meeting-exhausted');
  const rageEl = $('#meeting-ragequit');
  const credibility = {
    root: $('#meter-credibility'),
    bar: $('#meter-credibility i'),
    val: $('#meter-credibility .meter-value')
  };
  const profile = {
    root: $('#meter-profile'),
    bar: $('#meter-profile i'),
    val: $('#meter-profile .meter-value')
  };
  const voter = { root: $('#meter-voter'), bar: $('#meter-voter i'), val: $('#meter-voter .meter-value') };
  const activist = { root: $('#meter-activist'), bar: $('#meter-activist i'), val: $('#meter-activist .meter-value') };

  let handlers = null;

  extendBtn.onclick = () => handlers?.onExtend?.();
  panderBtn.onclick = () => handlers?.onPander?.();
  megaBtn.onclick = () => handlers?.onMega?.();
  endBtn.onclick = () => handlers?.onEnd?.();

  /** Brief +ACTIVIST / −VOTER feedback so the tradeoff needs no explanation. */
  function flashPanderFx(step) {
    const fx = document.createElement('div');
    fx.className = 'pander-fx';
    fx.innerHTML =
      `<span class="up">${step.activist > 0 ? `+${step.activist} ACTIVIST` : 'NO EFFECT'}</span>` +
      `<span class="down">${step.voter} VOTER</span>`;
    hudEl.appendChild(fx);
    setTimeout(() => fx.remove(), 950);
  }

  function setMeter(m, value) {
    const v = Math.round(value);
    m.bar.style.width = `${v}%`;
    m.val.textContent = String(v);
    m.root.dataset.low = v <= 25 ? 'true' : 'false';
  }

  return {
    open(h) {
      handlers = h;
      hudEl.hidden = false;
      summaryEl.hidden = true;
      extendBtn.hidden = true;
      endBtn.disabled = true;
      panderBtn.disabled = false;
      panderBtn.removeAttribute('data-disabled-note');
      exhaustedEl.hidden = true;
      rageEl.hidden = true;
      megaBtn.hidden = true;
      $('#mega-modal').hidden = true;
      $('#consent-modal').hidden = true;
      $('#consent-stamp').hidden = true;
    },

    /**
     * The MEGA PANDER program modal (Tightening addendum §21). Resolves to
     * true (approve) or false, then optionally to a consent decision.
     */
    askMegaPander(proposal, onDecide) {
      const modal = $('#mega-modal');
      $('#mega-program').textContent = proposal.label;
      $('#mega-cost').textContent = `$${proposal.annualCost.toFixed(1)}M / YEAR`;
      modal.hidden = false;
      $('#mega-yes').focus();
      const close = approved => { modal.hidden = true; onDecide(approved); };
      $('#mega-yes').onclick = () => close(true);
      $('#mega-no').onclick = () => close(false);
    },

    askConsent(onDecide) {
      const modal = $('#consent-modal');
      modal.hidden = false;
      $('#consent-yes').focus();
      const close = onConsent => { modal.hidden = true; onDecide(onConsent); };
      $('#consent-yes').onclick = () => close(true);
      $('#consent-no').onclick = () => close(false);
    },

    showConsentStamp() {
      const stamp = $('#consent-stamp');
      stamp.hidden = false;
      setTimeout(() => { stamp.hidden = true; }, 1700);
    },

    /** Arcade banner for the rare RAGE QUIT event (Bottle Episode §14). */
    showRageQuit() {
      rageEl.querySelector('.rq-title').textContent = RAGE_QUIT_TEXT;
      rageEl.querySelector('.rq-sub').textContent = RAGE_QUIT_SUBTEXT;
      rageEl.hidden = false;
      setTimeout(() => { rageEl.hidden = true; }, 2400);
    },

    /** Called after a PANDER press so the UI can react (Pandering §16, §7). */
    panderFeedback(step) {
      flashPanderFx(step);
      if (step.exhausted) {
        exhaustedEl.textContent = CREDIBILITY_EXHAUSTED_TEXT;
        exhaustedEl.hidden = false;
        panderBtn.disabled = true;
        panderBtn.dataset.disabledNote = CREDIBILITY_EXHAUSTED_TEXT;
      }
    },

    update(meeting, gameState, flags) {
      $('#meeting-clock').textContent = formatClock(meeting.clockMinutes);
      $('#meeting-comments').textContent = String(Math.floor(meeting.publicComments));
      $('#meeting-duration').textContent = formatDuration(meeting.meetingMinutes);
      $('#meeting-extensions').textContent = String(meeting.extensionsUsed);
      setMeter(voter, meeting.voterSentiment);
      setMeter(activist, meeting.activistSentiment);

      const cred = Math.round(meeting.credibility);
      credibility.bar.style.width = `${cred}%`;
      credibility.val.textContent = String(cred);
      credibility.root.dataset.empty = cred <= 0 ? 'true' : 'false';

      const prof = Math.round(flags.politicalProfile ?? 0);
      profile.bar.style.width = `${prof}%`;
      profile.val.textContent = String(prof);

      extendBtn.hidden = !flags.canExtend;
      megaBtn.hidden = !flags.canMega;
      panderBtn.disabled = !flags.canPander;
      endBtn.disabled = !flags.canEnd;
    },

    /**
     * Staged completion sequence (Tally Reveal addendum). Labels land at once,
     * values type on one field at a time, then the fiscal verdict arrives
     * separately so the statistics read as setup and the gap as punchline.
     */
    showSummary(summary, onContinue) {
      hudEl.hidden = true;

      const durationText = formatDurationClock(summary.meetingMinutes);
      const rows = [
        ['MEETING DURATION', durationText],
        ['PUBLIC COMMENTS', String(summary.publicComments)],
        ['EXTENSIONS USED', String(summary.extensionsUsed)],
        ['RAGE QUITS', String(summary.rageQuits ?? 0)],
        ['PANDER USES', String(summary.panderUses)],
        ['CREDIBILITY',
          summary.credibilityExhausted
            ? CREDIBILITY_EXHAUSTED_VALUE
            : `${summary.credibility}%`],
        ['ACTIVIST SENTIMENT', `${summary.activistSentiment}%`],
        ['VOTER SENTIMENT', `${summary.voterSentiment}%`]
      ];

      // Labels render immediately; the value cells start empty (§3, §4).
      const tallyEl = $('#meeting-tally');
      tallyEl.dataset.receded = 'false';
      tallyEl.innerHTML = rows.map(([label]) => `
        <div class="tally-row">
          <dt>${label}</dt>
          <dd></dd>
        </div>`).join('');

      const valueEls = [...tallyEl.querySelectorAll('dd')];

      const verdict = $('#meeting-verdict');
      verdict.hidden = true;
      $('#verdict-closed').hidden = true;
      $('#verdict-added').hidden = true;
      $('#verdict-consent').hidden = true;
      $('#verdict-before').textContent = '';
      $('#verdict-gap-after').textContent = '';

      const go = $('#meeting-summary-go');
      go.hidden = true;
      go.onclick = () => { summaryEl.hidden = true; onContinue(); };

      summaryEl.hidden = false;

      const gapText = `$${Math.max(0, summary.gapBefore ?? 0).toFixed(1)}M`;
      const run = playTallyReveal(
        {
          tally: tallyEl,
          verdict,
          after: $('#verdict-after'),
          before: $('#verdict-before'),
          gapAfter: $('#verdict-gap-after'),
          closed: $('#verdict-closed'),
          added: $('#verdict-added'),
          consent: $('#verdict-consent'),
          go
        },
        {
          fields: rows.map(([, value], i) => ({ el: valueEls[i], value })),
          durationText,
          // Identical by construction: the meeting cannot move the gap.
          gapBefore: gapText,
          gapAfter: gapText,
          addedPerYear: summary.addedPerYear ?? 0,
          onConsent: summary.megaOnConsent === true
        },
        {
          tick: () => audio.tallyTick(),
          impact: () => audio.tallyImpact(),
          reducedMotion
        }
      );

      // Fast-forward the statistics only; the punchline still plays (§24).
      const onSkip = e => {
        if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
        run.skip();
      };
      summaryEl.addEventListener('click', onSkip);
      window.addEventListener('keydown', onSkip);
      run.promise.finally(() => {
        summaryEl.removeEventListener('click', onSkip);
        window.removeEventListener('keydown', onSkip);
      });
    },

    close() {
      hudEl.hidden = true;
      summaryEl.hidden = true;
      hudEl.style.opacity = '1';
      handlers = null;
    },

    /** Fades the meeting panel out as the dissolve begins. */
    setDim(alpha) {
      hudEl.style.opacity = String(alpha);
    },

    /** Shows the meeting panel again for the Phase A crowd compression. */
    reopenForDissolve() {
      summaryEl.hidden = true;
      hudEl.hidden = false;
    }
  };
}

/**
 * Roosevelt Avenue prompt UI (Roosevelt addendum §5-§7, §16). One actionable
 * option, keyboard accessible, dismissed with a brief bureaucratic note.
 */
function createRooseveltUi() {
  const promptEl = $('#roosevelt-prompt');
  const confirmEl = $('#roosevelt-confirm');
  const neverBtn = $('#roosevelt-never');
  let onDone = null;

  function choose() {
    if (!onDone) return;
    const done = onDone;
    onDone = null;
    promptEl.hidden = true;
    window.removeEventListener('keydown', onKey, true);

    confirmEl.textContent = PROMPT_CONFIRMATION;
    confirmEl.hidden = false;
    setTimeout(() => { confirmEl.hidden = true; }, ROOSEVELT.confirmationMs);
    done();
  }

  function onKey(e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); choose(); }
  }

  neverBtn.onclick = choose;

  return {
    open(done) {
      onDone = done;
      promptEl.hidden = false;
      confirmEl.hidden = true;
      window.addEventListener('keydown', onKey, true);
      neverBtn.focus();
    },
    close() {
      onDone = null;
      promptEl.hidden = true;
      confirmEl.hidden = true;
      window.removeEventListener('keydown', onKey, true);
    }
  };
}

const rooseveltUi = createRooseveltUi();

const meetingUi = createMeetingUi();

/* ------------------------------------------------------------------ */
/* Pause and mute                                                      */
/* ------------------------------------------------------------------ */

function togglePause() {
  if (!game) return;
  const paused = game.togglePause();
  $('#pause-overlay').hidden = !paused;
  // Deliberately not focusing RESUME: space is now a pause toggle, and a
  // focused button would also consume it, so one press would pause and resume
  // in the same keystroke. The overlay stays keyboard-reachable by Tab.
  if (!paused) $('#btn-pause').blur();
}

function toggleMute() {
  const muted = audio.toggleMute();
  for (const btn of document.querySelectorAll('[data-mute]')) {
    btn.textContent = muted ? 'SOUND OFF' : 'SOUND ON';
    btn.setAttribute('aria-pressed', String(muted));
  }
  hud.announce(muted ? 'Sound off.' : 'Sound on.');
}

/* ------------------------------------------------------------------ */
/* End screens (spec §24, §25)                                         */
/* ------------------------------------------------------------------ */

function showEndScreen(result) {
  const { summary } = result;
  const council = summary.mode === 'council';

  const escaped = result.type === 'higherOffice';

  let heading, lede;
  if (escaped) {
    // The message is exact and takes no explanatory subtitle (addendum §2, §15).
    heading = ESCAPE_MESSAGE;
    lede = '';
  } else if (result.type === 'cliff') {
    heading = 'FISCAL CLIFF';
    lede = "You got to the bridge. The recurring budget didn't.";
  } else if (result.type === 'complete') {
    heading = 'BUDGET STABLE';
    lede = 'You used more than one road and reached the end with options left.';
  } else {
    heading = 'YOU RAN OUT OF ROAD';
    const laneName = LANES[result.laneIndex]?.name ?? 'that';
    const wear = Math.round(summary.laneWear[result.laneKey] ?? 0);
    lede = `${laneName} lane wear: ${wear}%`;
  }

  $('#end-heading').textContent = heading;
  // Win and loss headings must not share the failure colour.
  $('#end-heading').dataset.outcome =
    escaped ? 'escape' : result.type === 'complete' ? 'win' : 'loss';
  $('#end-lede').textContent = lede;
  $('#end-lede').hidden = !lede;

  const stats = [
    ['Fiscal year', `FY${summary.fiscalYear}`],
    ['Budget gap at end', `$${Math.max(0, summary.budgetGap).toFixed(1)}M`],
    ['One-time money used', `$${summary.oneTimeTotal.toFixed(1)}M`],
    ['Debt service added', `$${summary.debtService.toFixed(1)}M/yr`],
    ['Bridges crossed', String(summary.bridges)],
    ['Distance', `${Math.round(summary.distance)} m`]
  ];
  if (summary.recurringCommitments?.length) {
    const total = summary.recurringCommitments.reduce((a, c) => a + c.annualCost, 0);
    const onConsent = summary.recurringCommitments.filter(c => c.adoptedOnConsent).length;
    stats.push(['New recurring programs',
      `$${total.toFixed(1)}M/yr${onConsent ? ` (${onConsent} on consent)` : ''}`]);
  }
  if (summary.lanesFailed.length) {
    stats.push(['Lanes failed', summary.lanesFailed.map(k => LANES[LANE_INDEX[k]].name).join(', ')]);
  }
  if (council) {
    stats.push(['Lanes never available', String(summary.lanesNeverAvailable.length)]);
  }

  $('#end-stats').innerHTML = stats
    .map(([k, v]) => `<div class="stat"><dt>${k}</dt><dd>${v}</dd></div>`)
    .join('');
  // On an escape the numbers stay visible — the budget was not solved and the
  // record should show that — but under a neutral heading, never a score.
  $('#end-stats').dataset.context = escaped ? 'escape' : 'run';

  // Lane wear readout — this is the "you wore out your toolbox" moment.
  $('#end-lanes').innerHTML = LANE_KEYS.map(k => {
    const lane = LANES[LANE_INDEX[k]];
    const wear = Math.round(summary.laneWear[k]);
    const closed = summary.lanesNeverAvailable.includes(k);
    const used = summary.lanesUsed[k];
    const label = closed ? 'NEVER OPENED' : wear >= 100 ? 'FAILED' : `${wear}% worn`;
    return `<div class="end-lane" data-closed="${closed}" data-failed="${wear >= 100}">
      <span class="end-lane-name">${lane.short}</span>
      <span class="end-lane-bar"><i style="width:${closed ? 0 : wear}%"></i></span>
      <span class="end-lane-label">${label}${!closed && used ? ` · used ${used}×` : ''}</span>
    </div>`;
  }).join('');

  // Special-meeting activity (Pit Stop addendum §20). Only shown if a meeting
  // actually happened, and framed as a strictly fiscal metric.
  const pol = summary.politics;
  const polEl = $('#end-politics');
  if (pol && pol.specialMeetings > 0) {
    polEl.hidden = false;
    polEl.innerHTML = `
      <h2 class="end-subhead">Special meetings</h2>
      <dl class="stats">
        ${[
          ['Special meetings called', String(pol.specialMeetings)],
          ['Meeting hours', formatDuration(pol.meetingMinutes)],
          ['Extensions', String(pol.extensions)],
          ['PANDER uses', String(pol.panderUses)],
          ['Credibility exhausted', pol.credibilityExhausted ? 'Yes' : 'No'],
          ['Rage quits observed', String(pol.rageQuits)],
          ['MEGA PANDER approvals', String(pol.megaPandersApproved)],
          ['Political profile', `${pol.politicalProfile}%`],
          ['Final voter sentiment', `${pol.voterSentiment}%`],
          ['Final activist sentiment', `${pol.activistSentiment}%`]
        ].map(([k, v]) => `<div class="stat"><dt>${k}</dt><dd>${v}</dd></div>`).join('')}
      </dl>
      <p class="end-meeting-zero">BUDGET GAP CLOSED BY SPECIAL MEETINGS: <b>$0</b></p>`;
  } else {
    polEl.hidden = true;
    polEl.innerHTML = '';
  }

  const councilNote = $('#end-council-note');
  if (council) {
    councilNote.hidden = false;
    councilNote.textContent = result.type === 'crash'
      ? 'Four other lanes were never opened.'
      : '4 fiscal lanes were still closed.';
  } else {
    councilNote.hidden = true;
  }

  // Buttons (spec §24.1).
  const primary = $('#end-primary');
  const secondary = $('#end-secondary');
  if (escaped) {
    primary.textContent = 'PLAY AGAIN';
    primary.onclick = () => startRun(summary.mode);
    secondary.textContent = 'TRY COMMON SENSE MODE';
    secondary.onclick = () => startRun('common');
  } else if (council) {
    primary.textContent = 'TRY COMMON SENSE MODE';
    primary.onclick = () => startRun('common');
    secondary.textContent = 'PLAY COUNCIL MODE AGAIN';
    secondary.onclick = () => startRun('council');
  } else {
    primary.textContent = 'PLAY AGAIN';
    primary.onclick = () => startRun('common');
    secondary.textContent = 'TRY CITY COUNCIL MODE';
    secondary.onclick = () => startRun('council');
  }

  // Local high score only — never leaves the browser (spec §3.3, §23).
  // An escape is not ranked as a fiscal result (Higher Office addendum §27).
  if (escaped) {
    const firstTime = recordSecretEnding();
    $('#end-hiscore').textContent = firstTime
      ? 'ENDING FOUND: HIGHER OFFICE ESCAPE  ·  SECRET ENDING DISCOVERED'
      : 'ENDING FOUND: HIGHER OFFICE ESCAPE';
  } else {
    const best = recordHiScore(summary);
    $('#end-hiscore').textContent = best
      ? `Best this browser: ${best.bridges} bridge${best.bridges === 1 ? '' : 's'}`
      : '';
  }

  hud.announce(`${heading}. ${lede}. Bridges crossed: ${summary.bridges}.`);
  showScreen('end-screen');
}

/** Records the secret ending locally only (addendum §28). Never leaves the browser. */
function recordSecretEnding() {
  try {
    if (localStorage.getItem(SECRET_ENDING_KEY)) return false;
    localStorage.setItem(SECRET_ENDING_KEY, '1');
    return true;
  } catch {
    return false;   // storage unavailable — the ending still displays
  }
}

function recordHiScore(summary) {
  try {
    const raw = localStorage.getItem(HISCORE_KEY);
    const prev = raw ? JSON.parse(raw) : null;
    const next = { bridges: summary.bridges, score: summary.score };
    if (!prev || next.score > prev.score) {
      localStorage.setItem(HISCORE_KEY, JSON.stringify(next));
      return next;
    }
    return prev;
  } catch {
    return null;   // storage unavailable — the game does not depend on it
  }
}

/* ------------------------------------------------------------------ */
/* Evidence / About panel (spec §29)                                   */
/* ------------------------------------------------------------------ */

function buildEvidencePanel() {
  $('#evidence-points').innerHTML = PANEL_POINTS.map(p => `<li>${p}</li>`).join('');

  $('#evidence-lanes').innerHTML = LANES.map(l =>
    `<div class="ev-lane"><strong>${l.name}</strong><span>${l.meaning}</span></div>`
  ).join('');

  $('#evidence-records').innerHTML = EVIDENCE.map(r => {
    const src = r.sourceUrl
      ? `<a href="${r.sourceUrl}" target="_blank" rel="noopener noreferrer">${r.sourceLabel}</a>`
      : `${r.sourceLabel} <em>(source URL pending — treat as illustrative)</em>`;
    return `<li><strong>${r.label}</strong> — $${r.amount.toFixed(1)}M ${r.type.replace('_', '-')}.
      <span class="ev-note">${r.note}</span>
      <span class="ev-src">Source: ${src}</span></li>`;
  }).join('');

  const link = $('#evidence-project');
  if (PROJECT_LINK.url) {
    link.innerHTML = `<a href="${PROJECT_LINK.url}" target="_blank" rel="noopener noreferrer">${PROJECT_LINK.label}</a>`;
  } else {
    link.textContent = `${PROJECT_LINK.label} — link to be supplied.`;
  }
}

/* ------------------------------------------------------------------ */
/* Modal plumbing                                                      */
/* ------------------------------------------------------------------ */

function openModal(id) {
  const m = document.getElementById(id);
  m.hidden = false;
  m.dataset.returnFocus = document.activeElement?.id ?? '';
  m.querySelector('[data-autofocus]')?.focus();
}

function closeModal(id) {
  const m = document.getElementById(id);
  m.hidden = true;
  const back = m.dataset.returnFocus && document.getElementById(m.dataset.returnFocus);
  if (back) back.focus();
}

/* ------------------------------------------------------------------ */
/* Wiring                                                              */
/* ------------------------------------------------------------------ */

function init() {
  buildEvidencePanel();

  $('#btn-common').onclick = () => startRun('common');
  $('#btn-council').onclick = () => startRun('council');
  $('#btn-how').onclick = () => openModal('how-modal');
  $('#btn-why').onclick = () => openModal('evidence-modal');
  $('#end-why').onclick = () => openModal('evidence-modal');
  $('#end-menu').onclick = () => { if (game) { game.destroy(); game = null; } showScreen('title-screen'); };

  for (const btn of document.querySelectorAll('[data-mute]')) {
    btn.onclick = toggleMute;
    btn.textContent = audio.muted ? 'SOUND OFF' : 'SOUND ON';
    btn.setAttribute('aria-pressed', String(audio.muted));
  }

  for (const btn of document.querySelectorAll('[data-close-modal]')) {
    btn.onclick = () => closeModal(btn.dataset.closeModal);
  }

  $('#pause-resume').onclick = () => togglePause();
  $('#pause-quit').onclick = () => {
    if (game) { game.destroy(); game = null; }
    $('#pause-overlay').hidden = true;
    showScreen('title-screen');
  };
  $('#btn-pause').onclick = e => { e.currentTarget.blur(); togglePause(); };

  window.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const open = document.querySelector('.modal:not([hidden])');
    if (open) { closeModal(open.id); e.stopPropagation(); }
  }, true);

  window.addEventListener('resize', () => { if (game) game.resize(); });
  window.addEventListener('orientationchange', () => { if (game) game.resize(); });

  // Portrait hint — a suggestion, never a block (spec §33).
  const portrait = window.matchMedia('(orientation: portrait) and (max-width: 820px)');
  const syncPortrait = () => { $('#rotate-hint').hidden = !portrait.matches; };
  portrait.addEventListener('change', syncPortrait);
  syncPortrait();
  $('#rotate-dismiss').onclick = () => { $('#rotate-hint').hidden = true; };

  $('#campaign-length').textContent = String(CAMPAIGN_BRIDGES);
  $('#council-closed-count').textContent = String(COUNCIL_CLOSED_LANES.length);

  showScreen('title-screen');
}

init();
