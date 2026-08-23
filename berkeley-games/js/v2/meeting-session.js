// Special Meeting bottle episode, called from the Budget Garage
// (Reboot spec §54-§69).
//
// The meeting logic, renderer, tally and flame-to-black transition are reused
// from the v1.0 build, which the reboot preserves almost unchanged. What
// differs is where it is called from and where it returns to: the same garage
// session, same gap, same tentative allocations (§56, §69).

import {
  createMeetingState, beginMeeting, updateMeeting, canEndMeeting, canExtend,
  fiscalChanged,
  extendMeeting, endMeeting, canPander, pander, maybeRageQuit,
  canMegaPander, pickProposal, approveMegaPander, resolveConsent,
  formatClock, formatDurationClock, CREDIBILITY_EXHAUSTED_TEXT,
  CREDIBILITY_EXHAUSTED_VALUE, RAGE_QUIT_TEXT, RAGE_QUIT_SUBTEXT
} from '../meeting.js';
import { playTallyReveal } from '../tally.js';
import { addRecurringCommitment } from './state.js';

const $ = s => document.querySelector(s);
const money = v => `$${v.toFixed(1)}M`;

export function createMeetingSession({
  state, rng, audio, hud, reducedMotion, renderers, onReturn
}) {
  const meeting = createMeetingState();
  const politics = state.politics;

  const canvas = $('#meeting-canvas');
  const ctx = canvas.getContext('2d');
  const view = { width: 0, height: 0 };
  const meetingRenderer = renderers.meeting(ctx, view);
  const transition = renderers.transition(ctx, view);

  let raf = 0;
  let lastT = 0;
  let phase = 'meeting';        // 'meeting' | 'summary' | 'dissolve'
  let dissolveMs = 0;
  const gapAtEntry = state.budget.gapRemaining;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    view.width = Math.max(1, Math.round(rect.width));
    view.height = Math.max(1, Math.round(rect.height));
    canvas.width = view.width * dpr;
    canvas.height = view.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* ---------------- controls ---------------- */

  function refreshControls() {
    $('#meeting-clock').textContent = formatClock(meeting.clockMinutes);
    $('#meeting-comments').textContent = String(Math.floor(meeting.publicComments));
    $('#meeting-extensions').textContent = String(meeting.extensionsUsed);

    setMeter('#meter-voter', meeting.voterSentiment);
    setMeter('#meter-activist', meeting.activistSentiment);
    setMeter('#meter-credibility', meeting.credibility);
    setMeter('#meter-profile', politics.politicalProfile);

    $('#meeting-extend').hidden = !canExtend(meeting);
    $('#meeting-mega').hidden = !canMegaPander(meeting, politics);
    $('#meeting-pander').disabled = !canPander(meeting);
    $('#meeting-end').disabled = !canEndMeeting(meeting);
  }

  function setMeter(sel, value) {
    const v = Math.round(value);
    $(`${sel} i`).style.width = `${v}%`;
    $(`${sel} .meter-value`).textContent = String(v);
    $(sel).dataset.low = v <= 25 ? 'true' : 'false';
  }

  function onPander() {
    const step = pander(meeting, politics);
    if (!step) return;
    audio.applause?.(step.uses);
    flashDelta(step);
    if (step.exhausted) {
      $('#meeting-exhausted').textContent = CREDIBILITY_EXHAUSTED_TEXT;
      $('#meeting-exhausted').hidden = false;
      $('#meeting-pander').disabled = true;
      hud.announce('Credibility exhausted. Pandering no longer works.');
    }
    refreshControls();
  }

  function flashDelta(step) {
    const fx = document.createElement('div');
    fx.className = 'pander-fx';
    fx.innerHTML =
      `<span class="up">${step.activist > 0 ? `+${step.activist} ACTIVIST` : 'NO EFFECT'}</span>` +
      `<span class="down">${step.voter} VOTER</span>`;
    $('#meeting-ui').appendChild(fx);
    setTimeout(() => fx.remove(), 950);
  }

  function onExtend() {
    const step = extendMeeting(meeting, politics);
    audio.gavel?.();
    hud.announce(
      `Meeting extended. Activist sentiment up ${step.activist}, ` +
      `voter sentiment down ${Math.abs(step.voter)}. The budget gap does not move.`
    );
    refreshControls();
  }

  /** MEGA PANDER: political reward now, recurring cost next budget (§61, §62). */
  function onMega() {
    if (!canMegaPander(meeting, politics)) return;
    const proposal = pickProposal(rng);
    const modal = $('#mega-modal');
    $('#mega-program').textContent = proposal.label;
    $('#mega-cost').textContent = `${money(proposal.annualCost)} / YEAR`;
    modal.hidden = false;
    $('#mega-yes').focus();

    const close = approved => {
      modal.hidden = true;
      if (!approved) return;
      const r = approveMegaPander(meeting, politics, proposal);
      audio.cheer?.();
      hud.announce(
        `${proposal.label} approved at ${money(proposal.annualCost)} per year with no ` +
        `recurring funding identified. Activist sentiment up ${r.activist}, ` +
        `political profile up ${r.profile}. The budget gap does not move.`
      );
      askConsent(proposal);
      refreshControls();
    };
    $('#mega-yes').onclick = () => close(true);
    $('#mega-no').onclick = () => close(false);
  }

  function askConsent(proposal) {
    const modal = $('#consent-modal');
    modal.hidden = false;
    $('#consent-yes').focus();
    const close = onConsent => {
      modal.hidden = true;
      resolveConsent(meeting, politics, onConsent);
      // Same cost either way — consent buys process, not savings (§63).
      addRecurringCommitment(state, {
        label: proposal.label,
        annualCost: proposal.annualCost,
        adoptedOnConsent: onConsent
      });
      if (onConsent) {
        audio.stamp?.();
        const stamp = $('#consent-stamp');
        stamp.hidden = false;
        setTimeout(() => { stamp.hidden = true; }, 1700);
      }
      hud.announce(
        (onConsent ? 'Approved without discussion. ' : 'Approved after discussion. ') +
        `The annual cost is unchanged at ${money(proposal.annualCost)} per year.`
      );
      refreshControls();
    };
    $('#consent-yes').onclick = () => close(true);
    $('#consent-no').onclick = () => close(false);
  }

  /* ---------------- loop ---------------- */

  function step(now) {
    const dt = Math.min((now - lastT) / 1000, 1 / 20);
    lastT = now;

    if (phase === 'meeting') {
      const outcome = updateMeeting(meeting, dt);
      const rage = maybeRageQuit(meeting, politics, rng);
      if (rage) {
        audio.rageQuit?.();
        $('#meeting-ragequit .rq-title').textContent = RAGE_QUIT_TEXT;
        $('#meeting-ragequit .rq-sub').textContent = RAGE_QUIT_SUBTEXT;
        $('#meeting-ragequit').hidden = false;
        setTimeout(() => { $('#meeting-ragequit').hidden = true; }, 2400);
        hud.announce(
          `${RAGE_QUIT_TEXT} ${RAGE_QUIT_SUBTEXT}. Voter sentiment down ` +
          `${Math.abs(rage.voterDelta)}. The budget gap does not move.`
        );
      }
      refreshControls();
      ctx.clearRect(0, 0, view.width, view.height);
      meetingRenderer.draw(meeting, state, now, reducedMotion());
      if (outcome !== 'running') { conclude(); return; }
    } else if (phase === 'dissolve') {
      dissolveMs += dt * 1000;
      ctx.clearRect(0, 0, view.width, view.height);
      meetingRenderer.draw(meeting, state, now, reducedMotion());
      transition.draw(dissolveMs, reducedMotion());
      if (dissolveMs >= renderers.TRANSITION_TOTAL) { finish(); return; }
    }

    raf = requestAnimationFrame(step);
  }

  /**
   * A motion to end the meeting. It always fails, and the meeting carries on.
   * You cannot move your way out of this: the meeting ends when the meeting
   * ends. Moving again is free, and will also fail.
   */
  function moveToEnd() {
    if (motionPending) return;
    motionPending = true;
    motionsFailed += 1;
    const el = $('#motion-failed');
    el.hidden = false;
    audio.gavel?.();
    hud.announce(
      `Motion to end the meeting. The movement failed. ` +
      `${motionsFailed} failed motion${motionsFailed === 1 ? '' : 's'}.`);
    setTimeout(() => {
      el.hidden = true;
      motionPending = false;
    }, reducedMotion() ? 500 : 1400);
  }

  let motionPending = false;
  let motionsFailed = 0;

  /* ---------------- conclusion ---------------- */

  function conclude() {
    phase = 'summary';
    cancelAnimationFrame(raf);
    const summary = endMeeting(meeting, politics);

    // Assert the isolation rule rather than trusting it (§56, §102). MEGA
    // PANDER is the sanctioned exception: it books a future obligation, never
    // a change to this session's gap.
    if (fiscalChanged(meeting.fiscalSnapshot, state)) {
      console.error('Special Meeting moved the budget gap; it must not.');
    }

    audio.gavel?.();
    showTally(summary);
  }

  function showTally(summary) {
    $('#meeting-ui').hidden = true;
    const durationText = formatDurationClock(summary.meetingMinutes);
    const rows = [
      ['MEETING DURATION', durationText],
      ['PUBLIC COMMENTS', String(summary.publicComments)],
      ['EXTENSIONS USED', String(summary.extensionsUsed)],
      ['RAGE QUITS', String(summary.rageQuits ?? 0)],
      ['PANDER USES', String(summary.panderUses)],
      ['CREDIBILITY', summary.credibilityExhausted
        ? CREDIBILITY_EXHAUSTED_VALUE : `${summary.credibility}%`],
      ['ACTIVIST SENTIMENT', `${summary.activistSentiment}%`],
      ['VOTER SENTIMENT', `${summary.voterSentiment}%`]
    ];

    const tallyEl = $('#meeting-tally');
    tallyEl.dataset.receded = 'false';
    tallyEl.innerHTML = rows.map(([label]) =>
      `<div class="tally-row"><dt>${label}</dt><dd></dd></div>`).join('');
    const valueEls = [...tallyEl.querySelectorAll('dd')];

    const verdict = $('#meeting-verdict');
    verdict.hidden = true;
    $('#verdict-closed').hidden = true;
    $('#verdict-consolation').hidden = true;
    $('#verdict-added').hidden = true;
    $('#verdict-consent').hidden = true;

    const go = $('#meeting-summary-go');
    go.hidden = true;
    go.onclick = () => { $('#meeting-summary').hidden = true; beginDissolve(); };

    $('#meeting-summary').hidden = false;

    // The gap could not have moved: the meeting never touches it (§56, §102).
    const gapText = money(gapAtEntry);
    const run = playTallyReveal(
      {
        tally: tallyEl, verdict,
        after: $('#verdict-after'), before: $('#verdict-before'),
        gapAfter: $('#verdict-gap-after'), closed: $('#verdict-closed'),
        consolation: $('#verdict-consolation'),
        added: $('#verdict-added'), consent: $('#verdict-consent'), go
      },
      {
        fields: rows.map(([, value], i) => ({ el: valueEls[i], value })),
        durationText,
        gapBefore: gapText,
        gapAfter: gapText,
        addedPerYear: meeting.megaProposal ? meeting.megaProposal.annualCost : 0,
        onConsent: meeting.megaOnConsent === true
      },
      { tick: () => audio.tallyTick?.(), impact: () => audio.tallyImpact?.(), reducedMotion }
    );

    const onSkip = e => {
      if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
      run.skip();
    };
    $('#meeting-summary').addEventListener('click', onSkip);
    window.addEventListener('keydown', onSkip);
    run.promise.finally(() => {
      $('#meeting-summary').removeEventListener('click', onSkip);
      window.removeEventListener('keydown', onSkip);
    });
  }

  function beginDissolve() {
    phase = 'dissolve';
    dissolveMs = 0;
    $('#meeting-ui').hidden = false;
    audio.whoosh?.();
    lastT = performance.now();
    raf = requestAnimationFrame(step);
  }

  function finish() {
    cancelAnimationFrame(raf);
    audio.morning?.();
    onReturn();
  }

  /* ---------------- api ---------------- */

  return {
    start() {
      state.phase = 'meeting';
      politics.specialMeetingUsedThisYear = true;
      politics.totalSpecialMeetings += 1;

      document.querySelector('#meeting-screen').hidden = false;
      for (const s of document.querySelectorAll('.screen')) {
        if (s.id !== 'meeting-screen') s.hidden = true;
      }
      document.body.dataset.screen = 'meeting-screen';

      $('#meeting-ui').hidden = false;
      $('#meeting-summary').hidden = true;
      $('#meeting-exhausted').hidden = true;
      $('#motion-failed').hidden = true;
      motionPending = false;
      motionsFailed = 0;
      $('#meeting-ragequit').hidden = true;
      $('#mega-modal').hidden = true;
      $('#consent-modal').hidden = true;
      $('#consent-stamp').hidden = true;

      resize();
      window.addEventListener('resize', resize);

      $('#meeting-pander').onclick = onPander;
      $('#meeting-extend').onclick = onExtend;
      $('#meeting-mega').onclick = onMega;
      $('#meeting-end').onclick = () => { if (canEndMeeting(meeting)) moveToEnd(); };

      beginMeeting(meeting, state, politics, null, rng);

      hud.announce(
        'Special meeting begins. The budget work is frozen. ' +
        `Budget gap ${money(gapAtEntry)}, unchanged.`
      );
      refreshControls();
      lastT = performance.now();
      raf = requestAnimationFrame(step);
    },
    stop() { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); }
  };
}
