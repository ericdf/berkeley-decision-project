// Anthology shell: mission select and episode routing
// (Front Matter Revision §2, §3, §16, §19-§22).
//
// Episodes are independent. Nothing unlocks anything, nothing persists across
// them beyond optional local completion markers.

import { ANTHOLOGY, EPISODES, COMPLETION_KEY } from './content/anthology.js';
import { createAudio } from '../audio.js';

// Games are imported on demand rather than at boot. A game is a lot of code,
// and eager imports meant one unreachable module — a stale cache, a half-
// written file, a typo — silently blanked the whole menu with no error to
// show for it. Now a broken game fails only when you pick it, and says so.
const LOADERS = {
  'budget-quest': () => import('../episodes/budget-quest/budget-quest.js'),
  'how-berkeley': () => import('../episodes/how-berkeley/how-berkeley.js'),
  'hopkins': () => import('../episodes/hopkins/hopkins.js'),
  'sacramento': () => import('../episodes/sacramento/sacramento.js')
};

const $ = s => document.querySelector(s);

const audio = createAudio();
const liveEl = $('#aria-live');
const hud = {
  announce(text) {
    liveEl.textContent = text === liveEl.textContent ? `${text} ` : text;
  }
};
const reducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let current = null;

/* ------------------------------------------------------------------ */
/* Screens                                                             */
/* ------------------------------------------------------------------ */

function showScreen(id) {
  for (const s of document.querySelectorAll('.screen')) s.hidden = s.id !== id;
  document.body.dataset.screen = id;
  // There is always a visible way back, except on the menu itself.
  const quit = $('#quit-game');
  if (quit) quit.hidden = id === 'select-screen';
  $(`#${id} [data-autofocus]`)?.focus();
}

/* ------------------------------------------------------------------ */
/* Local completion markers (§20) — browser only, never an account      */
/* ------------------------------------------------------------------ */

function completed() {
  try { return JSON.parse(localStorage.getItem(COMPLETION_KEY) || '{}'); }
  catch { return {}; }
}

function markComplete(id, note) {
  try {
    const all = completed();
    all[id] = note || 'COMPLETED';
    localStorage.setItem(COMPLETION_KEY, JSON.stringify(all));
  } catch { /* storage unavailable; the game does not depend on it */ }
  buildSelect();
}

/* ------------------------------------------------------------------ */
/* Mission select                                                      */
/* ------------------------------------------------------------------ */

function buildSelect() {
  const done = completed();
  $('#episode-grid').innerHTML = EPISODES.map(ep => `
    <button type="button" class="episode-card" data-episode="${ep.id}"
            ${ep.status !== 'playable' ? 'disabled' : ''}>
      <span class="ep-title">${ep.title}</span>
      <span class="ep-hook">${ep.hook}</span>
      <span class="ep-desc">${ep.description}</span>
      <span class="ep-status">${
        ep.status !== 'playable' ? 'COMING SOON'
          : done[ep.id] ? done[ep.id] : 'PLAY'
      }</span>
    </button>`).join('');

  for (const card of document.querySelectorAll('.episode-card')) {
    card.onclick = () => launch(card.dataset.episode);
  }
  const first = document.querySelector('.episode-card:not([disabled])');
  if (first) first.dataset.autofocus = '';
}

/* ------------------------------------------------------------------ */
/* Episode routing                                                     */
/* ------------------------------------------------------------------ */

/**
 * Ask to leave. A game may guard against losing progress — Budget Quest
 * confirms before discarding a four-year term — so give it the chance to
 * handle this itself; otherwise return to the menu directly.
 */
function requestExit() {
  if (document.body.dataset.screen === 'select-screen') return;
  if (current?.requestExit?.()) return;   // the game is handling it
  backToSelect();
}

function backToSelect() {
  current?.stop?.();
  current = null;
  showScreen('select-screen');
  hud.announce(`${ANTHOLOGY.title}, ${ANTHOLOGY.edition}. ${ANTHOLOGY.action}.`);
}

async function launch(id) {
  current?.stop?.();
  current = null;

  const load = LOADERS[id];
  if (!load) return;

  let mod;
  try {
    mod = await load();
  } catch (err) {
    // A game that will not load is a broken game, not a broken anthology.
    console.error(`Could not load "${id}":`, err);
    showLoadFailure(id);
    return;
  }

  if (id === 'budget-quest') {
    showScreen('mode-screen');
    const quest = mod.createBudgetQuest({
      hud, audio,
      // Budget Quest's meeting button is a cross-link now (§23).
      onExit: target => target === 'how-berkeley' ? launch('how-berkeley') : backToSelect()
    });
    current = quest;
    $('#btn-common').onclick = () => quest.start('common');
    $('#btn-council').onclick = () => quest.start('council');
    return;
  }

  if (id === 'how-berkeley') {
    showScreen('meeting-screen');
    current = mod.createHowBerkeley({
      audio, hud, reducedMotion,
      onExit: r => {
        markComplete('how-berkeley', `PROFILE ${r.profile}%`);
        backToSelect();
      }
    });
    current.start();
    return;
  }

  if (id === 'hopkins') {
    showScreen('hopkins-screen');
    // start() measures the canvas, so it must run after the screen is shown.
    current = mod.createHopkins({
      canvas: $('#hopkins-canvas'), audio, hud, reducedMotion,
      ui: hopkinsUi(),
      onExit: () => { markComplete('hopkins', 'COMPLETED'); backToSelect(); }
    });
    current.start();
    return;
  }

  if (id === 'sacramento') {
    showScreen('sac-screen');
    current = mod.createSacramento({
      root: document, audio, hud, reducedMotion,
      onExit: () => { markComplete('sacramento', 'RAN'); backToSelect(); }
    });
    current.start();
    return;
  }
}

/** Say so on screen, rather than appearing to ignore the click. */
function showLoadFailure(id) {
  const ep = EPISODES.find(e => e.id === id);
  const el = $('#load-error');
  $('#load-error-name').textContent = ep ? ep.title : id;
  el.hidden = false;
  $('#load-error-go').focus();
  $('#load-error-go').onclick = () => { el.hidden = true; };
  hud.announce(
    `${ep ? ep.title : id} could not be loaded. Try reloading the page. ` +
    'The other games are still available.');
}

/* ------------------------------------------------------------------ */
/* Hopkins presentation hooks                                          */
/* ------------------------------------------------------------------ */

function hopkinsUi() {
  let capTimer = null;
  return {
    caption(text, ms = 2000) {
      const el = $('#hopkins-caption');
      el.textContent = text;
      el.hidden = false;
      clearTimeout(capTimer);
      capTimer = setTimeout(() => { el.hidden = true; }, ms);
    },
    showHint(text) { $('#hopkins-hint').textContent = text; },
    showTally(heading, rows, tag, onGo) {
      $('#hopkins-tally-head').textContent = heading;
      $('#hopkins-tally-rows').innerHTML = rows.map(([k, v]) =>
        `<div class="tally-row"><dt>${k}</dt><dd>${v}</dd></div>`).join('');
      $('#hopkins-tag').textContent = tag;
      $('#hopkins-tally').hidden = false;
      $('#hopkins-go').onclick = () => { $('#hopkins-tally').hidden = true; onGo(); };
      $('#hopkins-go').focus();
    }
  };
}

/* ------------------------------------------------------------------ */
/* Boot                                                                */
/* ------------------------------------------------------------------ */

function init() {
  try {
    buildSelect();
  } catch (err) {
    // The menu is the one thing that must always render.
    console.error('Could not build the game list:', err);
  }

  for (const btn of document.querySelectorAll('[data-back]')) {
    btn.onclick = backToSelect;
  }

  // The persistent quit control. Games that guard against losing progress
  // handle Escape themselves, so route through the same path they do.
  $('#quit-game').onclick = () => requestExit();
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

  // Escape always returns to the anthology. A game may intercept it first —
  // Budget Quest asks before abandoning a four-year term — in which case this
  // never fires, because that handler stops propagation.
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape' && document.body.dataset.screen !== 'select-screen') {
      backToSelect();
    }
  });

  showScreen('select-screen');
}

init();

if (window.__BBD_TEST__) {
  window.__EHC__ = { launch, backToSelect, get current() { return current; } };
}
