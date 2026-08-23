// HUD (spec §22). DOM overlay rather than canvas text, so it stays crisp,
// selectable, and screen-reader accessible.

import { LANES, LANE_KEYS } from './content/lanes.js';
import { wearTier } from './state.js';

export function formatMoney(m) {
  const sign = m >= 0 ? '+' : '−';
  return `${sign}$${Math.abs(m).toFixed(1)}M`;
}

export function createHud(root) {
  const el = {
    fy: root.querySelector('#hud-fy'),
    gap: root.querySelector('#hud-gap'),
    gapNote: root.querySelector('#hud-gap-note'),
    bridgeDist: root.querySelector('#hud-bridge-dist'),
    bridges: root.querySelector('#hud-bridges'),
    lanes: root.querySelector('#hud-lanes'),
    banner: root.querySelector('#hud-banner'),
    candidate: root.querySelector('#hud-candidate'),
    live: root.querySelector('#aria-live'),
    callMeeting: root.querySelector('#btn-call-meeting'),
    reveal: root.querySelector('#year-reveal'),
    revealTitle: root.querySelector('#year-reveal-title'),
    revealLines: root.querySelector('#year-reveal-lines'),
    revealGap: root.querySelector('#year-reveal-gap')
  };

  // Build the seven-segment lane condition strip once.
  const segments = LANES.map(lane => {
    const seg = document.createElement('div');
    seg.className = 'lane-seg';
    seg.innerHTML = `
      <span class="lane-seg-name">${lane.short}</span>
      <span class="lane-seg-bar"><i></i></span>
      <span class="lane-seg-status"></span>`;
    el.lanes.appendChild(seg);
    return {
      root: seg,
      bar: seg.querySelector('i'),
      status: seg.querySelector('.lane-seg-status')
    };
  });

  let bannerTimer = null;
  let lastLive = '';

  const rootEl = root.querySelector('#hud');

  return {
    /** Hides the whole road HUD, e.g. during the Higher Office escape. */
    setHidden(hidden) {
      rootEl.hidden = hidden;
      if (hidden) el.banner.dataset.show = 'false';
    },

    /**
     * Fades the HUD during scene transitions so an overlay dissolve is not
     * printed behind a fully opaque HUD.
     */
    setDim(alpha) {
      rootEl.style.opacity = String(alpha);
    },

    /**
     * Syncs the on-demand Special Meeting control (On-Demand addendum §5, §18,
     * §22, §23). Visible only in Council Mode; disabled with an explanation
     * once the year's meeting has been used.
     */
    setCallMeeting({ show, enabled, pressure }) {
      const btn = el.callMeeting;
      btn.hidden = !show;
      if (!show) return;
      btn.disabled = !enabled;
      btn.dataset.pressure = enabled ? pressure : 'normal';
      const sub = btn.querySelector('.csm-sub');
      if (enabled) {
        sub.textContent = 'Need a break from adult decisions?';
        btn.setAttribute('aria-label',
          'Call Special Meeting. Need a break from adult decisions?');
      } else {
        sub.textContent = 'SPECIAL MEETING ALREADY USED THIS YEAR';
        btn.setAttribute('aria-label',
          'Call Special Meeting unavailable. Special Meeting already used this fiscal year.');
      }
    },

    update(state, activeLane, candidateLabel = null, bridgeMetres = null) {
      // Higher Office campaign indicator (addendum §7).
      el.candidate.hidden = !candidateLabel;
      if (candidateLabel) el.candidate.textContent = candidateLabel;

      el.fy.textContent = `FY${state.fiscalYear}`;

      // One primary fiscal number (Tightening addendum §2, §11).
      const gap = state.budget.currentGap;
      const closed = gap <= 0.0001;
      el.gap.textContent = closed ? '$0.0M' : `$${gap.toFixed(1)}M`;
      el.gap.dataset.sign = closed ? 'pos' : 'neg';
      el.gapNote.textContent = closed
        ? 'balanced — bridge will hold'
        : 'close it before the bridge';

      el.bridgeDist.textContent = bridgeMetres == null
        ? '—'
        : `${(bridgeMetres / 1609).toFixed(1)} MI`;
      el.bridges.textContent = String(state.bridgeNumber);

      segments.forEach((seg, i) => {
        const key = LANE_KEYS[i];
        const wear = state.laneWear[key];
        const closedLane = state.closedLanes.includes(key);
        const tier = wearTier(wear);
        seg.bar.style.width = `${wear}%`;
        seg.root.dataset.tier = tier;
        seg.root.dataset.closed = closedLane ? 'true' : 'false';
        seg.root.dataset.active = i === activeLane ? 'true' : 'false';
        // Never color-only: each state also carries a text/symbol marker (§32).
        seg.status.textContent = closedLane ? '✕ CLOSED'
          : tier === 'failed' ? '✕ FAILED'
          : `${Math.round(wear)}%`;
      });
    },

    /**
     * The annual reveal: how the new year's gap was built (addendum §5, §39).
     * Concise and self-dismissing.
     */
    showYearReveal(reveal, ms, onDone) {
      el.revealTitle.textContent = `FY${reveal.fiscalYear} BUDGET CYCLE`;
      el.revealLines.innerHTML = reveal.lines.map(l => `
        <div class="yr-line" data-credit="${l.credit === true}">
          <dt>${l.label}</dt>
          <dd>${l.amount < 0 ? '−' : '+'}$${Math.abs(l.amount).toFixed(1)}M</dd>
        </div>`).join('');
      el.revealGap.textContent = `$${Math.max(0, reveal.gap).toFixed(1)}M`;
      el.reveal.hidden = false;
      setTimeout(() => { el.reveal.hidden = true; onDone?.(); }, ms);
    },

    /** @param {string} [tone] 'reject' styles the banner as a refusal. */
    banner(text, ms = 2200, tone = 'info') {
      el.banner.textContent = text;
      el.banner.dataset.show = 'true';
      el.banner.dataset.tone = tone;
      clearTimeout(bannerTimer);
      bannerTimer = setTimeout(() => { el.banner.dataset.show = 'false'; }, ms);
    },

    /** Announce important state changes to assistive tech (spec §32). */
    announce(text) {
      if (text === lastLive) text += ' ';
      lastLive = text;
      el.live.textContent = text;
    }
  };
}
