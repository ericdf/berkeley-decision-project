// GET TO SACRAMENTO OR DIE TRYIN'
//
// Keep enough constituencies happy enough until Election Day. The win rule is
// coalition arithmetic, not universal popularity: a majority of all available
// approval points, however unevenly distributed (§5, §6).

import {
  CAMPAIGN, GROUPS, PANDER_SEQUENCE, GASLIGHT_SEQUENCE, OVERUSE_PENALTY, COPY
} from './content.js';

export function createSacramento({ root, audio, hud, reducedMotion, onExit }) {
  const state = GROUPS.map(g => ({
    ...g,
    approval: CAMPAIGN.startApproval,
    lastAction: null,
    consecutivePanders: 0,
    consecutiveGaslights: 0
  }));

  let daysLeft = CAMPAIGN.days;
  let running = false;
  let raf = 0;
  let lastT = 0;
  const nodes = new Map();

  const el = {
    days: root.querySelector('#sac-days'),
    coalition: root.querySelector('#sac-coalition'),
    coalitionBar: root.querySelector('#sac-coalition-bar'),
    groups: root.querySelector('#sac-groups'),
    result: root.querySelector('#sac-result'),
    resultText: root.querySelector('#sac-result-text'),
    resultSub: root.querySelector('#sac-result-sub'),
    resultDetail: root.querySelector('#sac-result-detail'),
    resultGo: root.querySelector('#sac-result-go')
  };

  /* ---------------- build ---------------- */

  function build() {
    el.groups.innerHTML = '';
    for (const g of state) {
      const node = document.createElement('div');
      node.className = 'sac-group';
      node.style.setProperty('--g-hue', String(g.hue));
      node.innerHTML = `
        <div class="sac-crowd" aria-hidden="true"></div>
        <span class="sac-name">${g.label}</span>
        <span class="sac-bar"><i></i></span>
        <span class="sac-value">55</span>
        <div class="sac-actions">
          <button type="button" class="sac-btn sac-pander"
                  aria-label="${COPY.pander} ${g.label}">${COPY.pander}</button>
          <button type="button" class="sac-btn sac-gaslight"
                  aria-label="${COPY.gaslight} ${g.label}">${COPY.gaslight}</button>
        </div>`;
      node.querySelector('.sac-pander').onclick = () => act(g, 'pander');
      node.querySelector('.sac-gaslight').onclick = () => act(g, 'gaslight');
      el.groups.appendChild(node);
      nodes.set(g.id, {
        node,
        bar: node.querySelector('.sac-bar i'),
        value: node.querySelector('.sac-value'),
        crowd: node.querySelector('.sac-crowd')
      });
      renderCrowd(node.querySelector('.sac-crowd'), g);
    }
  }

  /** A small cluster of generic silhouettes; no caricature (§13). */
  function renderCrowd(host, g) {
    host.innerHTML = Array.from({ length: 5 }, (_, i) =>
      `<span class="sac-figure" style="--i:${i}"></span>`).join('');
  }

  /* ---------------- actions ---------------- */

  function act(g, kind) {
    if (!running) return;
    const seq = kind === 'pander' ? PANDER_SEQUENCE : GASLIGHT_SEQUENCE;
    const streak = kind === 'pander' ? g.consecutivePanders : g.consecutiveGaslights;
    const gain = seq[Math.min(streak, seq.length - 1)];

    if (gain > 0) {
      g.approval = Math.min(100, g.approval + gain);
      audio.leverClick?.();
    } else {
      // Hammering a spent lever costs a little (§26).
      g.approval = Math.max(0, g.approval - OVERUSE_PENALTY);
      audio.pothole?.();
    }

    // Switching restores the other lever's effectiveness (§25).
    if (kind === 'pander') {
      g.consecutivePanders += 1;
      g.consecutiveGaslights = 0;
    } else {
      g.consecutiveGaslights += 1;
      g.consecutivePanders = 0;
    }
    g.lastAction = kind;

    hud.announce(
      `${g.label}: ${kind === 'pander' ? COPY.pander : COPY.gaslight}. ` +
      (gain > 0 ? `Approval up ${gain}.` : 'No effect — they have heard it.') +
      ` Now ${Math.round(g.approval)}.`
    );
    refresh();
  }

  /* ---------------- loop ---------------- */

  function step(now) {
    if (!running) return;
    const dt = Math.min((now - lastT) / 1000, 1 / 15);
    lastT = now;

    for (const g of state) {
      g.approval = Math.max(0, g.approval - g.decay * dt);
    }
    daysLeft -= dt / CAMPAIGN.secondsPerDay;

    if (daysLeft <= 0) { daysLeft = 0; refresh(); electionDay(); return; }
    refresh();
    raf = requestAnimationFrame(step);
  }

  function totals() {
    const points = state.reduce((a, g) => a + g.approval, 0);
    const max = state.length * 100;
    return { points, max, share: points / max };
  }

  function refresh() {
    const { points, max, share } = totals();
    el.days.textContent = `${Math.ceil(daysLeft)} ${COPY.daysLabel}`;
    el.coalition.textContent = `${COPY.coalition}: ${Math.round(share * 100)}%`;
    el.coalitionBar.style.width = `${share * 100}%`;
    el.coalitionBar.dataset.winning = share > 0.5 ? 'true' : 'false';

    for (const g of state) {
      const n = nodes.get(g.id);
      const v = Math.round(g.approval);
      n.bar.style.width = `${v}%`;
      n.value.textContent = String(v);
      // Never colour alone: the mood word carries the same information.
      n.node.dataset.mood = v >= 60 ? 'happy' : v >= 30 ? 'restless' : 'angry';
    }
  }

  /* ---------------- election ---------------- */

  function electionDay() {
    running = false;
    cancelAnimationFrame(raf);
    const { points, max, share } = totals();
    const won = points > max / 2;

    el.resultText.textContent = won ? COPY.win : COPY.lose;
    el.resultText.dataset.won = String(won);
    el.resultSub.textContent = won ? '' : COPY.loseSub;
    el.resultSub.hidden = won;
    // Report the arithmetic, not a fake vote percentage (§30).
    el.resultDetail.textContent =
      `${Math.round(points)} of ${max} approval points · ${Math.round(share * 100)}%`;
    el.result.hidden = false;
    el.resultGo.focus();
    audio[won ? 'cheer' : 'fall']?.();
    hud.announce(
      `${COPY.electionDay}. ${won ? COPY.win : COPY.lose + ' ' + COPY.loseSub} ` +
      `${Math.round(points)} of ${max} approval points.`
    );
  }

  /* ---------------- api ---------------- */

  el.resultGo.onclick = onExit;

  return {
    start() {
      build();
      refresh();
      el.result.hidden = true;
      running = true;
      lastT = performance.now();
      raf = requestAnimationFrame(step);
      hud.announce(
        `${CAMPAIGN.days} days to the election. Five constituencies. ` +
        'Approval decays if you ignore them. Alternate PANDER and GASLIGHT — ' +
        'repeating either one stops working.'
      );
    },
    stop() { running = false; cancelAnimationFrame(raf); }
  };
}
