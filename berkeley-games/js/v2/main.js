// Screen flow for the canonical reboot (Reboot spec §3).
//
//   title -> opening reveal -> BUDGET GARAGE -> city tour -> rollover -> ...
//                                   |                 |
//                          Special Meeting     Higher Office escape

import {
  createGameState, buildFirstReveal, rolloverYear, isCampaignComplete,
  TOOL_KEYS, TOOLS
} from './state.js';
import { createGarageRenderer } from './render-garage.js';
import { createGarage } from './garage.js';
import { createTourRenderer } from './render-tour.js';
import { createTour } from './tour.js';
import { createEscapeRenderer } from '../render-escape.js';
import { createMeetingRenderer } from '../render-meeting.js';
import { createTransitionRenderer, transitionPhaseAt, TRANSITION_TOTAL }
  from '../render-transition.js';
import { createAudio } from '../audio.js';
import { makeRng, DEFAULT_SEED } from '../rng.js';
import { createMeetingSession } from './meeting-session.js';
import { HIGHER_OFFICE, ROOSEVELT, ENDING } from './content/endgame.js';
import { CAMPAIGN_YEARS } from './content/cycle.js';
import { serviceLabel, businessLabel } from './content/city.js';

const $ = sel => document.querySelector(sel);
const money = v => `$${v.toFixed(1)}M`;

const audio = createAudio();
const liveEl = $('#aria-live');
const hud = {
  announce(text) {
    liveEl.textContent = text === liveEl.textContent ? `${text} ` : text;
  }
};
const reducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let state = null;
let rng = null;
let garage = null;
let garageRenderer = null;
let tourRenderer = null;
let tourCtl = null;
let meeting = null;
let doorOpen = 0;
let garageRaf = 0;

/* ------------------------------------------------------------------ */
/* Screens                                                             */
/* ------------------------------------------------------------------ */

function showScreen(id) {
  for (const s of document.querySelectorAll('.screen')) s.hidden = s.id !== id;
  document.body.dataset.screen = id;
  $(`#${id} [data-autofocus]`)?.focus();
}

/* ------------------------------------------------------------------ */
/* Opening reveal (§7)                                                 */
/* ------------------------------------------------------------------ */

function showReveal(reveal, onContinue) {
  $('#reveal-title').textContent = `FY${reveal.fiscalYear} BUDGET`;
  $('#reveal-lines').innerHTML = reveal.lines.map(l => `
    <div>
      <dt>${l.label}</dt>
      <dd data-credit="${l.credit === true}">${l.amount < 0 ? '−' : '+'}$${Math.abs(l.amount).toFixed(1)}M</dd>
    </div>`).join('');
  $('#reveal-gap').textContent = money(reveal.gap);
  $('#reveal-go').onclick = onContinue;
  showScreen('reveal-screen');
  hud.announce(
    `Fiscal year ${reveal.fiscalYear}. Budget gap ${money(reveal.gap)}. ` +
    reveal.lines.map(l =>
      `${l.label} ${l.amount < 0 ? 'minus' : 'plus'} $${Math.abs(l.amount).toFixed(1)} million`
    ).join('. ') + '.'
  );
}

/* ------------------------------------------------------------------ */
/* Garage (§9-§14, §37)                                                */
/* ------------------------------------------------------------------ */

function openGarage() {
  showScreen('garage-screen');
  doorOpen = 0;
  $('.garage-body').dataset.retired = 'false';
  $('.garage-foot').dataset.retired = 'false';

  if (!garageRenderer) {
    garageRenderer = createGarageRenderer($('#garage-canvas'));
    window.addEventListener('resize', () => garageRenderer.resize());
  }
  garageRenderer.resize();

  garage = createGarage({
    root: document, state, audio, hud,
    onAdopt: onBudgetAdopted,
    onCallMeeting: startMeeting
  });

  hud.announce(
    `City Budget Garage, fiscal year ${state.fiscalYear}. ` +
    `Budget gap ${money(state.budget.gapRemaining)}. ` +
    'Assemble a package from the fiscal tools and reach zero to adopt.'
  );
  garageLoop();
}

function garageLoop() {
  cancelAnimationFrame(garageRaf);
  const step = now => {
    garageRenderer.draw(state, now, doorOpen, reducedMotion());
    garageRaf = requestAnimationFrame(step);
  };
  garageRaf = requestAnimationFrame(step);
}

function onBudgetAdopted(flags) {
  hud.announce(
    `Budget adopted for fiscal year ${state.fiscalYear}. ` +
    (flags.slashed.length
      ? `${flags.slashed.length} service cut${flags.slashed.length === 1 ? '' : 's'} applied. `
      : 'No services were cut. ') +
    'The garage door opens.'
  );
  garage.flash('BUDGET ADOPTED', 2000);
  $('.garage-body').dataset.retired = 'true';
  $('.garage-foot').dataset.retired = 'true';

  const t0 = performance.now();
  const dur = reducedMotion() ? 400 : 1800;
  const raise = now => {
    doorOpen = Math.min(1, (now - t0) / dur);
    if (doorOpen < 1) requestAnimationFrame(raise);
    else setTimeout(startTour, 350);
  };
  requestAnimationFrame(raise);
}

/* ------------------------------------------------------------------ */
/* City tour (§38-§48)                                                 */
/* ------------------------------------------------------------------ */

function startTour() {
  cancelAnimationFrame(garageRaf);
  showScreen('tour-screen');
  $('#tour-year').textContent = `FY${state.fiscalYear}`;
  $('#tour-card').hidden = true;

  if (!tourRenderer) {
    tourRenderer = createTourRenderer($('#tour-canvas'));
    window.addEventListener('resize', () => tourRenderer.resize());
  }
  tourRenderer.resize();

  tourCtl = createTour({
    state, rng, renderer: tourRenderer, audio, hud,
    ui: {
      updateProgress: f => { $('#tour-progress-bar').style.width = `${f * 100}%`; },
      showEventCard,
      showRoosevelt
    },
    onFinish: endTour,
    onEscape: startEscape
  });
  tourCtl.setReducedMotion(reducedMotion());
  tourCtl.start();

  hud.announce(
    `Driving through the city. ${describeCity()}`
  );
}

let cardTimer = null;
function showEventCard(ev) {
  $('#tour-card-label').textContent = ev.label;
  $('#tour-card-detail').textContent = ev.detail;
  $('#tour-card-cost').textContent =
    `NEXT BUDGET: +${money(ev.nextYear)}${ev.recurring ? '/YR' : ''}`;
  $('#tour-card').hidden = false;
  clearTimeout(cardTimer);
  cardTimer = setTimeout(() => { $('#tour-card').hidden = true; }, 3200);
}

function showRoosevelt(done) {
  const prompt = $('#roosevelt-prompt');
  const confirm = $('#roosevelt-confirm');
  prompt.hidden = false;
  $('#roosevelt-never').focus();
  hud.announce('Pave Roosevelt Avenue? Only available response: Never.');

  const choose = () => {
    prompt.hidden = true;
    window.removeEventListener('keydown', onKey, true);
    confirm.textContent = ROOSEVELT.confirmation;
    confirm.hidden = false;
    setTimeout(() => { confirm.hidden = true; }, ROOSEVELT.confirmationMs);
    hud.announce(ROOSEVELT.confirmation);
    done();
  };
  const onKey = e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); choose(); }
  };
  $('#roosevelt-never').onclick = choose;
  window.addEventListener('keydown', onKey, true);
}

function describeCity() {
  const c = state.city;
  const parts = [];
  for (const [key, label] of [['fire', 'Fire station'], ['pool', 'Pool'], ['library', 'Library']]) {
    parts.push(`${label} ${serviceLabel(c[key]).toLowerCase()}`);
  }
  parts.push(`streets ${serviceLabel(c.streets).toLowerCase()}`);
  parts.push(`commercial corridor ${businessLabel(c.businessDistrict).toLowerCase()}`);
  return parts.join('. ') + '.';
}

/* ------------------------------------------------------------------ */
/* Rollover (§85)                                                      */
/* ------------------------------------------------------------------ */

function endTour() {
  if (isCampaignComplete(state)) { showTermComplete(); return; }
  const reveal = rolloverYear(state);
  showReveal(reveal, openGarage);
}

/* ------------------------------------------------------------------ */
/* Special Meeting (§54-§69)                                           */
/* ------------------------------------------------------------------ */

function startMeeting() {
  cancelAnimationFrame(garageRaf);
  meeting = createMeetingSession({
    state, rng, audio, hud, reducedMotion,
    renderers: {
      meeting: createMeetingRenderer,
      transition: createTransitionRenderer,
      transitionPhaseAt, TRANSITION_TOTAL
    },
    onReturn: () => {
      // Back to the same session, same gap, same allocations (§69).
      showScreen('garage-screen');
      garage.refresh();
      garageLoop();
      hud.announce(
        `Good morning. Budget gap ${money(state.budget.gapRemaining)}, unchanged. ` +
        (state.weather.rainLevel > 0 ? 'It is still raining. ' : '') +
        'You still have to finish the budget.'
      );
    }
  });
  meeting.start();
}

/* ------------------------------------------------------------------ */
/* Higher Office escape (§72)                                          */
/* ------------------------------------------------------------------ */

function startEscape() {
  state.easterEggs.higherOfficeEscaped = true;
  showScreen('escape-screen');
  $('#escape-message').hidden = true;
  $('#escape-actions').hidden = true;

  const canvas = $('#escape-canvas');
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const view = { width: rect.width, height: rect.height };
  const escapeRenderer = createEscapeRenderer(ctx, view);
  const below = { rainLevel: state.weather.rainLevel };

  audio.escape?.();
  hud.announce(
    'You rise away from Berkeley. Below, the Berkeley Budget car keeps going with no one in it.'
  );

  const t0 = performance.now();
  const total = HIGHER_OFFICE.riseSeconds + HIGHER_OFFICE.driverlessSeconds;
  const step = now => {
    const t = (now - t0) / 1000;
    ctx.clearRect(0, 0, view.width, view.height);
    escapeRenderer.draw(t, { rise: HIGHER_OFFICE.riseSeconds }, below, now);
    if (t < total) requestAnimationFrame(step);
    else {
      $('#escape-message').textContent = HIGHER_OFFICE.escapeMessage;
      $('#escape-message').hidden = false;
      $('#escape-actions').hidden = false;
      $('#escape-again').focus();
      hud.announce(HIGHER_OFFICE.escapeMessage);
    }
  };
  requestAnimationFrame(step);
  $('#escape-again').onclick = () => showScreen('title-screen');
}

/* ------------------------------------------------------------------ */
/* Term complete (§88, §89)                                            */
/* ------------------------------------------------------------------ */

function showTermComplete() {
  const c = state.city;
  const b = state.budget;
  const cuts = state.history.reduce((a, h) => a + h.slash, 0);

  $('#end-heading').textContent = ENDING.termComplete;
  $('#end-lede').textContent = cuts > 0
    ? `You balanced ${state.history.length} budgets and cut ${money(cuts)} of services to do it.`
    : `You balanced ${state.history.length} budgets without cutting a single service.`;

  const rows = [
    ['Streets', c.streets], ['Fire', c.fire], ['Pool', c.pool],
    ['Library', c.library], ['Parks', c.parks]
  ];
  $('#end-city').innerHTML = rows.map(([name, lvl]) => `
    <div class="end-city-row" data-level="${lvl}">
      <span class="end-city-name">${name}</span>
      <span class="end-city-bar"><i style="width:${(lvl / 3) * 100}%"></i></span>
      <span class="end-city-state">${serviceLabel(lvl)}</span>
    </div>`).join('') + `
    <div class="end-city-row" data-level="${c.businessDistrict}">
      <span class="end-city-name">Commercial</span>
      <span class="end-city-bar"><i style="width:${(c.businessDistrict / 3) * 100}%"></i></span>
      <span class="end-city-state">${businessLabel(c.businessDistrict)}</span>
    </div>`;

  const remaining = TOOL_KEYS
    .filter(k => TOOLS[k].kind !== 'delayed')
    .map(k => `${TOOLS[k].name} ${state.toolYearsUsed[k]}×`)
    .join(', ');

  const stats = [
    ['Budgets balanced', String(state.history.length)],
    ['Services cut', money(cuts)],
    ['Debt service', `${money(b.annualDebtService)}/yr`],
    ['Recurring savings', `${money(b.recurringSavings)}/yr`],
    ['Recurring revenue', `${money(b.recurringRevenue)}/yr`],
    ['Future commitments', `${money(b.recurringCommitments.reduce((a, x) => a + x.annualCost, 0))}/yr`],
    ['Political profile', `${Math.round(state.politics.politicalProfile)}%`],
    ['Voter sentiment', `${Math.round(state.politics.voterSentiment)}%`],
    ['Tool use', remaining]
  ];
  $('#end-stats').innerHTML = stats
    .map(([k, v]) => `<div class="stat"><dt>${k}</dt><dd>${v}</dd></div>`).join('');

  $('#end-again').onclick = () => startRun(state.mode);
  $('#end-other').onclick = () => startRun(state.mode === 'common' ? 'council' : 'common');

  showScreen('end-screen');
  hud.announce(`${ENDING.termComplete}. ${$('#end-lede').textContent} ${describeCity()}`);
}

/* ------------------------------------------------------------------ */
/* Input                                                               */
/* ------------------------------------------------------------------ */

function bindTourInput() {
  const set = v => tourCtl?.setSteer(v);
  window.addEventListener('keydown', e => {
    if (document.body.dataset.screen !== 'tour-screen') return;
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') { set(-1); e.preventDefault(); }
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') { set(1); e.preventDefault(); }
  });
  window.addEventListener('keyup', e => {
    if (['ArrowLeft', 'ArrowRight', 'a', 'A', 'd', 'D'].includes(e.key)) set(0);
  });
  const canvas = $('#tour-canvas');
  canvas.addEventListener('pointerdown', e => {
    const r = canvas.getBoundingClientRect();
    set(e.clientX - r.left < r.width / 2 ? -1 : 1);
  });
  window.addEventListener('pointerup', () => set(0));
  window.addEventListener('blur', () => set(0));
}

/* ------------------------------------------------------------------ */
/* Boot                                                                */
/* ------------------------------------------------------------------ */

function startRun(mode) {
  tourCtl?.stop();
  cancelAnimationFrame(garageRaf);
  state = createGameState(mode);
  rng = makeRng(DEFAULT_SEED + (mode === 'council' ? 1 : 0));
  showReveal(buildFirstReveal(state), openGarage);
}

function init() {
  $('#btn-common').onclick = () => startRun('common');
  $('#btn-council').onclick = () => startRun('council');
  $('#btn-how').onclick = () => hud.announce(
    'Close the budget gap to zero in the garage, then drive through the city your budget created.'
  );

  for (const btn of document.querySelectorAll('[data-mute]')) {
    btn.onclick = () => {
      const muted = audio.toggleMute();
      for (const b of document.querySelectorAll('[data-mute]')) {
        b.textContent = muted ? 'SOUND OFF' : 'SOUND ON';
        b.setAttribute('aria-pressed', String(muted));
      }
    };
    btn.textContent = audio.muted ? 'SOUND OFF' : 'SOUND ON';
    btn.setAttribute('aria-pressed', String(audio.muted));
  }

  bindTourInput();
  showScreen('title-screen');
}

init();

if (window.__BBD_TEST__) {
  window.__BBD_V2__ = {
    get state() { return state; },
    get garage() { return garage; },
    get tour() { return tourCtl; },
    get meeting() { return meeting; }
  };
}
