// Budget Garage interaction (Reboot spec §11-§14, §19, §32-§37).
//
// Builds one package from many tools at once — levers, not exclusive gates.
// Every control is a keyboard-operable step control rather than a drag target
// (§96), and the ADOPT gate refuses to open above zero (§36).

import {
  TOOLS, TOOL_KEYS, toolStatus, availableCapacity, totalCapacity, toolDepth,
  allocate, allocateSlash, useOneTime, canAdopt, adoptBudget, raiseRain
} from './state.js';
import {
  NOT_ON_TABLE_TEXT, RHETORIC_TEXT, RHETORIC_RESULT, RHETORIC_FLASH,
  ALLOCATION_STEP
} from './content/tools.js';
import { ONE_TIME_MEASURES, RAINY_DAY_MESSAGE } from './content/cycle.js';

const money = v => `$${v.toFixed(1)}M`;

export function createGarage({ root, state, audio, hud, onAdopt, onCallMeeting }) {
  const el = {
    gap: root.querySelector('#garage-gap'),
    gapNote: root.querySelector('#garage-gap-note'),
    year: root.querySelector('#garage-year'),
    tools: root.querySelector('#garage-tools'),
    oneTime: root.querySelector('#garage-onetime'),
    slash: root.querySelector('#garage-slash'),
    slashValue: root.querySelector('#garage-slash-value'),
    adopt: root.querySelector('#garage-adopt'),
    adoptNote: root.querySelector('#garage-adopt-note'),
    meeting: root.querySelector('#garage-call-meeting'),
    flash: root.querySelector('#garage-flash')
  };

  let flashTimer = null;
  const stations = new Map();

  /* ---------------- construction ---------------- */

  function buildStations() {
    el.tools.innerHTML = '';
    for (const key of TOOL_KEYS) {
      const tool = TOOLS[key];
      const status = toolStatus(state, key);

      const node = document.createElement('div');
      node.className = 'station';
      node.dataset.status = status;
      node.style.setProperty('--tool-hue', String(tool.hue));
      node.innerHTML = `
        <div class="station-head">
          <span class="station-name">${tool.name}</span>
          <span class="station-badge"></span>
        </div>
        <p class="station-blurb">${tool.blurb}</p>
        <div class="station-meter"><i></i></div>
        <div class="station-row">
          <button type="button" class="step" data-dir="-1"
                  aria-label="Decrease ${tool.name} by ${money(ALLOCATION_STEP)}">−</button>
          <span class="station-alloc" aria-live="off">$0.0M / $0.0M</span>
          <button type="button" class="step" data-dir="1"
                  aria-label="Increase ${tool.name} by ${money(ALLOCATION_STEP)}">+</button>
        </div>
        <p class="station-note"></p>`;

      const dec = node.querySelector('[data-dir="-1"]');
      const inc = node.querySelector('[data-dir="1"]');
      dec.onclick = () => step(key, -1);
      inc.onclick = () => step(key, +1);

      el.tools.appendChild(node);
      stations.set(key, {
        node, dec, inc,
        badge: node.querySelector('.station-badge'),
        meter: node.querySelector('.station-meter i'),
        alloc: node.querySelector('.station-alloc'),
        note: node.querySelector('.station-note')
      });
    }
  }

  function buildOneTime() {
    el.oneTime.innerHTML = '';
    for (const measure of ONE_TIME_MEASURES) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'onetime';
      btn.dataset.id = measure.id;
      btn.innerHTML = `
        <span class="onetime-label">${measure.label}</span>
        <span class="onetime-amount">−${money(measure.amount)}</span>
        <span class="onetime-note">${measure.note}</span>`;
      btn.onclick = () => takeOneTime(measure);
      el.oneTime.appendChild(btn);
    }
  }

  /* ---------------- actions ---------------- */

  function step(key, dir) {
    const status = toolStatus(state, key);

    // Council's business-growth station: warm words, no movement (§21).
    if (status === 'rhetorical') {
      if (dir > 0) {
        audio.leverClick?.();
        flash(RHETORIC_FLASH);
        hud.announce(`${TOOLS[key].name}: ${RHETORIC_RESULT}. The budget gap does not move.`);
      }
      return;
    }
    if (status !== 'active') return;

    const applied = allocate(state, key, dir);
    if (applied === 0) {
      // Say why nothing happened rather than failing silently.
      if (dir > 0) {
        const why = state.budget.gapRemaining <= 0
          ? 'The gap is already closed.'
          : `${TOOLS[key].name} has no capacity left this year.`;
        hud.announce(why);
      }
      return;
    }
    audio.leverClick?.();
    hud.announce(
      `${TOOLS[key].name} ${applied > 0 ? 'up' : 'down'} ${money(Math.abs(applied))}. ` +
      `Gap remaining ${money(state.budget.gapRemaining)}.`
    );
    refresh();
  }

  function takeOneTime(measure) {
    const r = useOneTime(state, measure);
    if (!r) return;

    audio.pickup?.();
    hud.announce(
      `${measure.label}: gap down ${money(r.amount)} this year only. ` +
      `Gap remaining ${money(state.budget.gapRemaining)}.`
    );
    refresh();

    // Reward first, consequence a beat later (§17).
    if (r.triggersRain) {
      setTimeout(() => {
        audio.thunder?.();
        raiseRain(state);
        flash(RAINY_DAY_MESSAGE, 2200, 'storm');
        hud.announce(`${RAINY_DAY_MESSAGE} It starts raining outside the garage.`);
        refresh();
      }, 520);
    }
  }

  function stepSlash(dir) {
    const applied = allocateSlash(state, dir);
    if (applied === 0) return;
    audio.slash?.();
    hud.announce(
      `Service cuts ${applied > 0 ? 'up' : 'down'} ${money(Math.abs(applied))}. ` +
      `Gap remaining ${money(state.budget.gapRemaining)}.`
    );
    refresh();
  }

  function flash(text, ms = 1600, tone = 'info') {
    el.flash.textContent = text;
    el.flash.dataset.tone = tone;
    el.flash.dataset.show = 'true';
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => { el.flash.dataset.show = 'false'; }, ms);
  }

  /* ---------------- rendering ---------------- */

  function refresh() {
    const gap = Math.max(0, state.budget.gapRemaining);
    const closed = canAdopt(state);

    el.year.textContent = `FY${state.fiscalYear}`;
    el.gap.textContent = money(gap);
    el.gap.dataset.closed = closed ? 'true' : 'false';
    el.gapNote.textContent = closed
      ? 'balanced — you can adopt this budget'
      : 'you have to get to zero';

    for (const key of TOOL_KEYS) {
      const tool = TOOLS[key];
      const s = stations.get(key);
      const status = toolStatus(state, key);
      const alloc = state.allocations[key];
      const cap = totalCapacity(state, key);

      s.node.dataset.status = status;

      if (status === 'off-table') {
        // The contrast is that these were not pursued, not that they are
        // mathematically trivial (§38).
        s.badge.textContent = NOT_ON_TABLE_TEXT;
        s.alloc.textContent = 'Potential savings: SUBSTANTIAL';
        s.meter.style.width = '0%';
        s.note.textContent = '';
        s.dec.disabled = true;
        s.inc.disabled = true;
        continue;
      }
      if (status === 'rhetorical') {
        s.badge.textContent = RHETORIC_RESULT;
        s.alloc.textContent = RHETORIC_TEXT;
        s.meter.style.width = '0%';
        s.note.textContent = 'Long-term opportunity: SUBSTANTIAL';
        s.dec.disabled = true;
        s.inc.disabled = false;
        continue;
      }

      const { band, fraction } = toolDepth(state, key);

      // Depth, not a bar that fills to a token ceiling (§25, §26).
      s.badge.textContent = band ? band.label : '';
      s.alloc.textContent = alloc > 0 ? money(alloc) : `up to ${money(cap)}`;
      s.meter.style.width = `${fraction * 100}%`;
      s.dec.disabled = alloc <= 0;
      s.inc.disabled = availableCapacity(state, key) <= 0 || closed;

      // Surface the consequence the player is signing up for (§13).
      if (key === 'borrow' && alloc > 0) {
        const depth = Math.min(1, alloc / (state.budget.openingGap * tool.capacityFactor));
        const rate = tool.debtServiceRate
          + tool.debtServiceEscalation * state.toolYearsUsed[key]
          + (tool.depthSurcharge ?? 0) * depth;
        s.note.textContent = `next year: +${money(alloc * rate)}/yr debt service`;
      } else if (key === 'growTaxBase' && alloc > 0) {
        const now = alloc * tool.currentYearShare;
        const mature = alloc * tool.matureMultiplier;
        s.note.textContent =
          `this budget ${money(now)} · mature +${money(mature)}/yr`;
      } else if (band?.note) {
        s.note.textContent = band.note;
      } else if (state.toolYearsUsed[key] > 0) {
        s.note.textContent = 'capacity reduced by earlier use';
      } else {
        s.note.textContent = '';
      }
    }

    // One-time measures.
    for (const measure of ONE_TIME_MEASURES) {
      const btn = el.oneTime.querySelector(`[data-id="${measure.id}"]`);
      const usedThisYear = state.budget.oneTimeUsedThisYear.includes(measure.id);
      const spent = measure.oncePerCampaign &&
        state.budget.oneTimeUsedEver.includes(measure.id);
      btn.disabled = usedThisYear || spent || closed;
      btn.dataset.used = usedThisYear || spent ? 'true' : 'false';
      btn.querySelector('.onetime-note').textContent = spent && !usedThisYear
        ? 'already used — not available again'
        : usedThisYear ? 'applied to this budget' : measure.note;
    }

    // Slash control.
    el.slashValue.textContent = money(state.slashAllocation);
    el.slash.dataset.active = state.slashAllocation > 0 ? 'true' : 'false';

    // Adoption gate (§36).
    el.adopt.disabled = !closed;
    el.adoptNote.textContent = closed ? '' : 'YOU HAVE TO GET TO ZERO';

    // Special Meeting, Council Mode only, once per year (§55).
    const canMeet = state.mode === 'council' &&
      !state.politics.specialMeetingUsedThisYear;
    el.meeting.hidden = state.mode !== 'council';
    el.meeting.disabled = !canMeet;
    el.meeting.querySelector('.csm-sub').textContent = canMeet
      ? 'Need a break from adult decisions?'
      : 'SPECIAL MEETING ALREADY USED THIS YEAR';
  }

  /* ---------------- wiring ---------------- */

  el.slash.querySelector('[data-dir="-1"]').onclick = () => stepSlash(-1);
  el.slash.querySelector('[data-dir="1"]').onclick = () => stepSlash(+1);
  el.adopt.onclick = () => {
    if (!canAdopt(state)) return;
    audio.adopt?.();
    const flags = adoptBudget(state);
    onAdopt(flags);
  };
  el.meeting.onclick = e => { e.currentTarget.blur(); onCallMeeting(); };

  buildStations();
  buildOneTime();
  refresh();

  return { refresh, flash };
}
