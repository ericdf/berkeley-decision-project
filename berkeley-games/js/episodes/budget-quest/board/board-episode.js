// Budget Quest — deficit board episode controller (v3.1).
//
// One screen, read in a glance:
//
//     DEFICIT $30M
//        ↓ missiles ↓
//     six Berkeley functions
//     CUT | TAX | EXIT | ONE-TIME MONEY
//
// with four political meters tucked to the side. Four fiscal years, a short
// briefing between them, then FOUR YEARS LATER.

import {
  createBoardState, composeWave, deficitRemaining, skyIsClear,
  structuralBalance, structuralDeficit, structuralSurplus, recurringExpense,
  toggleShield, landMissile, launchShock, reconcileSky,
  availableCuts, availableTaxes, availableExits,
  applyCut, applyTax, applyExit,
  useOneTimeMoney, payItBack, resolveObligation, ONE_TIME_DRAW, serviceLevel, round1,
  overtimeBands, applyAttrition, collapsedBloc, applyMood, canCut, canExit,
  startPilot, expiringPilots, decidePilot,
  rolloverYear, isComplete, summariseYear,
  SHIELDS_PER_YEAR, CAMPAIGN_YEARS
} from './board-state.js';
import {
  FUNCTIONS, FUNCTION_KEYS, METERS, MAX_PIPS, pips, money, fn,
  SERVICE_WORDS, RESISTANT, PILOTS, moodBand, moodWord, MISSILE_KINDS, BOMBS,
  BOMB_UNION_COST, METERS as ALL_METERS
} from './content.js';
import { createBoardRenderer } from './render-board.js';
import { createWave } from './wave.js';

const $ = s => document.querySelector(s);

export function createDeficitBoard({ audio, hud, reducedMotion, onExit }) {
  let state = null;
  let renderer = null;
  let wave = null;
  let raf = 0;
  let lastFrame = 0;
  let tileRects = {};
  let openMenu = null;
  let confirmingExit = false;
  // Highest overtime band already answered with a bomb this wave.
  let overtimeSeen = 0;
  let pendingAttrition = [];
  let collapsed = null;

  /**
   * Drop a consequence bomb on a service and flash what happened when it
   * lands. Nothing fiscal changes — this is the beat, not a line item.
   */
  function dropConsequence(key, bomb) {
    audio.whoosh?.();
    renderer.dropBomb(key, () => {
      audio.thunder?.();
      // Both bombs land on the people doing the work.
      applyMood(state, { unions: BOMB_UNION_COST / 5 });
      banner(bomb.text, 1700);
      toast(bomb.text,
        `${fn(key).name} · ${bomb.sub} · UNIONS ${BOMB_UNION_COST}`, 'bad');
      renderBases();
      renderMeters(['unions']);
      checkCollapse();
    });
    hud.announce(
      `${bomb.text}. ${fn(key).name}. ${bomb.sub}. Unions ${BOMB_UNION_COST}.`);
  }

  /**
   * A constituency at zero ends the term on the spot. Nothing about the rest
   * of the year matters once one of these has happened.
   */
  function checkCollapse() {
    if (collapsed) return false;
    const c = collapsedBloc(state);
    if (!c) return false;
    collapsed = c;
    wave?.stop();
    closeMenu();
    for (const t of impactTimers) clearTimeout(t);
    impactTimers = [];
    audio.rageQuit?.();
    setTimeout(() => showFinal(c), 900);
    return true;
  }

  /* ---------------------------------------------------------------- */
  /* Frame loop                                                        */
  /* ---------------------------------------------------------------- */

  function measureTiles() {
    const canvas = $('#board-canvas');
    if (!canvas) return;
    const cr = canvas.getBoundingClientRect();
    tileRects = {};
    for (const key of FUNCTION_KEYS) {
      const el = document.querySelector(`.base[data-fn="${key}"]`);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      tileRects[key] = { x: r.x - cr.x, y: r.y - cr.y, w: r.width, h: r.height };
    }
  }

  function loop(now) {
    const dt = lastFrame ? Math.min(0.1, (now - lastFrame) / 1000) : 0.016;
    lastFrame = now;
    measureTiles();
    renderer.draw(state, tileRects, dt);
    raf = requestAnimationFrame(loop);
  }

  /* ---------------------------------------------------------------- */
  /* Year flow                                                         */
  /* ---------------------------------------------------------------- */

  function beginYear(intro) {
    composeWave(state);
    renderAll();
    showBriefing(intro, () => runWave());
  }

  /** A very short between-year briefing — the numbers, not a lecture. */
  function showBriefing(intro, done) {
    const el = $('#briefing');
    $('#brief-year').textContent = `FY ${state.fiscalYear}`;

    const rows = [
      ['RECURRING REVENUE', money(state.recurringRevenue)],
      ['RECURRING EXPENSE', money(recurringExpense(state))]
    ];
    const bal = structuralBalance(state);
    $('#brief-rows').innerHTML = rows.map(([k, v]) =>
      `<div class="brief-row"><span>${k}</span><b>${v}</b></div>`).join('');

    const deficit = structuralDeficit(state);
    $('#brief-balance').textContent = deficit > 0
      ? `STRUCTURAL DEFICIT ${money(deficit)}`
      : `STRUCTURAL SURPLUS ${money(structuralSurplus(state))}`;
    $('#brief-balance').dataset.tone = deficit > 0 ? 'bad' : 'good';

    const notes = [];
    if (intro?.comp) {
      notes.push(`Scheduled compensation increase across ${intro.comp.staff} staffing units: +${money(intro.comp.total)}/yr.`);
    }
    if (intro?.attrition?.length) {
      notes.push(
        intro.attrition.map(a => `${fn(a.key).name} lost staff (${a.shortfall}% underfunded)`)
          .join('; ') + '.');
    }
    if (intro?.obligation) {
      notes.push(intro.obligation.funded
        ? 'CLAIMS DUE — paid from available balance.'
        : `CLAIMS DUE — the temporary cushion is underfunded. ` +
          `${money(intro.obligation.amount)} of ${MISSILE_KINDS.shock.label} incoming.`);
    }
    if (deficit <= 0) notes.push('No deficit, no missiles.');
    $('#brief-note').textContent = notes.join(' ');
    $('#brief-note').hidden = !notes.length;

    el.hidden = false;
    $('#brief-go').textContent = deficit > 0 ? 'TAKE THE BOARD' : 'CONTINUE';
    $('#brief-go').focus();
    $('#brief-go').onclick = () => { el.hidden = true; done(); };

    hud.announce(
      `Fiscal year ${state.fiscalYear}. Recurring revenue ${money(state.recurringRevenue)}. ` +
      `Recurring expense ${money(recurringExpense(state))}. ` +
      (deficit > 0
        ? `Structural deficit ${money(deficit)}. That is ${money(deficit)} of incoming missiles.`
        : `Structural surplus ${money(structuralSurplus(state))}. No deficit, no missiles.`) +
      ' ' + notes.join(' ')
    );
  }

  function runWave() {
    const clear = skyIsClear(state);
    overtimeSeen = overtimeBands(state);

    // Anyone who quit at rollover gets their bomb as the year opens.
    for (const a of pendingAttrition) dropConsequence(a.key, BOMBS.attrition);
    pendingAttrition = [];

    wave = createWave({
      state,
      onLand: (m, rec) => {
        renderer.flash(rec.key, rec.redirected);
        audio?.tallyImpact?.();
        const name = fn(rec.key).name;
        // A single $1M hit is small; only announce when a pip actually goes,
        // so the narration marks real consequences rather than every tick.
        const st = state.functions[rec.key];
        hud.announce(
          (rec.redirected
            ? `${money(rec.cut)} redirected away from a shielded service and cut from ${name}.`
            : `${money(rec.cut)} cut from ${name}.`) +
          ` Now funded at ${money(st.expense)}.`);
        toast(rec.redirected ? 'REDIRECTED' : 'FUNDING CUT',
          `${name} −${money(rec.cut)} → ${money(st.expense)}`,
          rec.redirected ? 'redirect' : 'bad');
        renderBases();
        renderHud();
        renderMeters();
        if (checkCollapse()) return;

        // Cutting public safety does not reduce the work. A bomb falls on it.
        const bands = overtimeBands(state);
        if (bands > overtimeSeen) {
          overtimeSeen = bands;
          dropConsequence('safety', BOMBS.overtime);
        }
      },
      onTick: t => { renderHud(t); checkCollapse(); },
      onArmed: () => {
        renderBases();
        renderHud();
        if (!skyIsClear(state)) {
          const n = state.missiles.filter(m => !m.resolved && !m.landed).length;
          banner(`DEFICIT: ${money(structuralDeficit(state))}`, 1200);
          hud.announce(`Shields locked. ${n} missiles incoming.`);
        }
      },
      onComplete: () => endYear()
    });
    wave.setReducedMotion(reducedMotion());
    wave.start(clear);

    if (clear) {
      banner('CLEAR SKIES', 1800);
      hud.announce('Clear skies. No deficit, no missiles.');
      // Nothing to descend, so the year is already over.
      setTimeout(() => { if (wave?.running) wave.finishNow(); }, 1900);
    } else {
      hud.announce(
        `Place your ${state.shieldsLeft} shields. A shield does not remove the deficit — ` +
        'it sends it to another service. Press Enter on a service to shield it, or ' +
        'S to launch the missiles now.');
    }
    renderAll();
  }

  let yearEndPending = false;

  /**
   * The controls are live only during a running year. Once the year is
   * resolving — or any modal owns the screen — they do nothing.
   */
  function canAct() {
    if (!state || !wave?.running) return false;
    for (const id of ['#resolve', '#final', '#pilot-modal', '#briefing',
                      '#tutorial', '#leave-confirm', '#impact']) {
      if (!$(id).hidden) return false;
    }
    return true;
  }

  function endYear() {
    // Never close a year out from under an open decision.
    if (openMenu || !$('#pilot-modal').hidden) { yearEndPending = true; return; }
    yearEndPending = false;
    wave?.stop();
    // Pilots reaching the end of their term need an affirmative decision.
    const expiring = expiringPilots(state);
    if (expiring.length) { askPilot(expiring[0]); return; }
    showResolve();
  }

  /* ---------------------------------------------------------------- */
  /* Pilots (§7, §8)                                                   */
  /* ---------------------------------------------------------------- */

  function askPilot(p) {
    const el = $('#pilot-modal');
    $('#pilot-name').textContent = p.label;
    $('#pilot-cost').textContent = `${money(p.permanentCost)} / YEAR`;
    const after = structuralBalance(state) - p.permanentCost;
    $('#pilot-effect').textContent = after < 0
      ? `Making it permanent puts the City ${money(-after)} in deficit.`
      : `The City can absorb it and still hold a ${money(after)} surplus.`;
    el.hidden = false;
    $('#pilot-no').focus();

    hud.announce(
      `The ${p.label} has reached the end of its term. Make it permanent? ` +
      `That adds ${money(p.permanentCost)} per year to recurring expense. ` +
      $('#pilot-effect').textContent);

    const finish = permanent => {
      el.hidden = true;
      const r = decidePilot(state, p.id, permanent);
      if (permanent) {
        toast('PILOT MADE PERMANENT', `${p.label} · +${money(p.permanentCost)}/YR`, 'future');
        hud.announce(`${p.label} is now permanent. Recurring expense up ${money(p.permanentCost)} per year.`);
      } else {
        toast('PILOT ENDS', `${p.label} · no recurring cost`, 'info');
        hud.announce(`${p.label} ends. No recurring expense was created.`);
      }
      renderAll();
      const more = expiringPilots(state);
      if (more.length) askPilot(more[0]); else showResolve();
    };
    $('#pilot-yes').onclick = () => finish(true);
    $('#pilot-no').onclick = () => finish(false);
  }

  /* ---------------------------------------------------------------- */
  /* Year end                                                          */
  /* ---------------------------------------------------------------- */

  function showResolve() {
    const sum = summariseYear(state);
    $('#resolve-title').textContent = `FY ${state.fiscalYear} CLOSED`;

    const rows = [
      ['OPENING DEFICIT', money(sum.openingDeficit)],
      ['CLEARED BY STRUCTURAL CHANGE', money(sum.structureCleared)],
      ['FINANCED WITH ONE-TIME MONEY', money(sum.oneTime)],
      ['LANDED AS SERVICE CUTS', money(sum.landed)]
    ];
    $('#resolve-rows').innerHTML = rows.map(([k, v]) =>
      `<div class="res-row"><dt>${k}</dt><dd>${v}</dd></div>`).join('');

    const bal = structuralBalance(state);
    $('#resolve-structure').innerHTML = [
      ['RECURRING REVENUE', money(state.recurringRevenue), ''],
      ['RECURRING EXPENSE', money(recurringExpense(state)), ''],
      [bal < 0 ? 'STRUCTURAL DEFICIT' : 'STRUCTURAL SURPLUS',
       money(Math.abs(bal)), bal < 0 ? 'bad' : 'good']
    ].map(([k, v, tone]) =>
      `<div class="res-row" data-tone="${tone}"><dt>${k}</dt><dd>${v}</dd></div>`).join('');

    $('#resolve-exposure').hidden = !state.oneTimeDrawn;
    if (state.oneTimeDrawn) {
      $('#resolve-exposure').textContent =
        'ONE-TIME MONEY DRAWN — a claim will come due within two years.';
    }

    const last = state.year + 1 >= CAMPAIGN_YEARS;
    $('#resolve-go').textContent = last ? 'FOUR YEARS LATER' : 'NEXT FISCAL YEAR';
    $('#resolve').hidden = false;
    $('#resolve-go').focus();
    audio?.adopt?.();

    $('#resolve-go').onclick = () => {
      $('#resolve').hidden = true;
      const intro = rolloverYear(state);
      pendingAttrition = intro.attrition || [];
      if (isComplete(state)) { showFinal(); return; }
      // A shock obligation launches into the new year's sky.
      composeWave(state);
      if (intro.obligation && !intro.obligation.funded) {
        const fired = launchShock(state, intro.obligation.amount);
        if (fired.length) {
          banner(MISSILE_KINDS.shock.label, 2200);
          toast('CLAIMS DUE',
            `${MISSILE_KINDS.shock.label} · ${fired.length} MISSILE${fired.length === 1 ? '' : 'S'}`,
            'bad');
        }
      }
      renderAll();
      showBriefing(intro, () => runWave());
    };

    hud.announce(
      `Fiscal year ${state.fiscalYear} closed. ` +
      rows.map(([k, v]) => `${k} ${v}`).join('. ') + '. ' +
      (bal < 0 ? `Structural deficit ${money(-bal)}.` : `Structural surplus ${money(bal)}.`));
  }

  /* ---------------------------------------------------------------- */
  /* FOUR YEARS LATER                                                  */
  /* ---------------------------------------------------------------- */

  /**
   * @param collapse the bloc that ended the term early, if one did. The
   *   summary is the same either way: what the City looks like now.
   */
  function showFinal(collapse) {
    state.phase = 'complete';
    $('#final-heading').textContent = collapse ? collapse.heading : 'FOUR YEARS LATER';
    $('#final-lede').textContent = collapse ? collapse.line : '';
    $('#final-lede').hidden = !collapse;
    $('#final').dataset.collapse = collapse ? 'true' : 'false';

    $('#final-bases').innerHTML = FUNCTIONS.map(f => {
      const st = state.functions[f.key];
      return `<div class="final-base" data-exited="${st.exited}">
        <span class="fb-name">${f.name}</span>
        <span class="fb-state">${st.exited
          ? 'NO LONGER A CITY SERVICE'
          : `${money(st.expense)} · ${SERVICE_WORDS[serviceLevel(st)]}` +
            (st.openingExpense - st.expense > 0.05
              ? ` (was ${money(st.openingExpense)})` : '')}</span>
      </div>`;
    }).join('');

    const bal = structuralBalance(state);
    const stats = [
      ['Recurring revenue', money(state.recurringRevenue)],
      ['Recurring expense', money(recurringExpense(state))],
      [bal < 0 ? 'Structural deficit' : 'Structural surplus', money(Math.abs(bal))],
      ['Services transferred out', String(FUNCTION_KEYS.filter(k => state.functions[k].exited).length)],
      ['One-time cushion', state.oneTimeDrawn ? 'DRAWN DOWN' : 'INTACT'],
      ['Budgets closed', String(state.yearLog.length)]
    ];
    $('#final-stats').innerHTML = stats.map(([k, v]) =>
      `<div class="stat"><dt>${k}</dt><dd>${v}</dd></div>`).join('');

    $('#final-meters').innerHTML = METERS.map(m => meterRow(m)).join('');
    // A term someone else finishes does not get the hopeful sign-off.
    $('.final-line').textContent = collapse
      ? 'SOMEBODY ELSE\u2019S BUDGET STARTS NOW.'
      : 'THE NEXT BUDGET STARTS NOW.';
    $('#final').hidden = false;
    $('#final-again').focus();
    $('#final-again').onclick = () => start(state.mode);
    $('#final-exit').onclick = () => onExit?.();

    hud.announce(
      (collapse ? `${collapse.heading}. ${collapse.line} ` : 'Four years later. ') +
      FUNCTIONS.map(f => {
        const st = state.functions[f.key];
        return st.exited
          ? `${f.name} is no longer a City service`
          : `${f.name} funded at ${money(st.expense)}, ${SERVICE_WORDS[serviceLevel(st)]}`;
      }).join('. ') + '. ' +
      (bal < 0 ? `The City is ${money(-bal)} in structural deficit.`
               : `The City holds a ${money(bal)} structural surplus.`) +
      ' The next budget starts now.');
  }

  /* ---------------------------------------------------------------- */
  /* Rendering                                                         */
  /* ---------------------------------------------------------------- */

  function renderAll() {
    renderHud();
    renderBases();
    renderControls();
    renderMeters();
  }

  function renderHud(tick) {
    $('#hud-year').textContent = `FY ${state.fiscalYear}`;
    const remaining = deficitRemaining(state);
    $('#hud-deficit').textContent = money(remaining);
    $('#hud-deficit').dataset.clear = String(remaining <= 0.05);

    const bal = structuralBalance(state);
    $('#hud-structural').textContent = bal < 0
      ? `STRUCTURAL DEFICIT ${money(-bal)}` : `STRUCTURAL SURPLUS ${money(bal)}`;
    $('#hud-structural').dataset.tone = bal < 0 ? 'bad' : 'good';

    const arming = tick?.arming ?? wave?.arming ?? false;
    $('#arming').hidden = !arming;
    if (arming) {
      $('#arming-count').textContent = Math.ceil(tick?.armingLeft ?? 0);
      $('#arming-shields').textContent = String(state.shieldsLeft);
    }
    $('#board-screen').dataset.arming = String(arming);
  }

  function renderBases() {
    const arming = wave?.arming ?? false;
    $('#bases').innerHTML = FUNCTIONS.map(f => {
      const st = state.functions[f.key];
      if (st.exited) {
        return `<div class="base base-exited" data-fn="${f.key}">
          <span class="base-name">${f.name}</span>
          <span class="base-gone">TRANSFERRED OUT</span>
        </div>`;
      }
      // The budget is the display. A missile is $1M and takes $1M out of the
      // service it lands on, so the number falling is the mechanic showing
      // its work — no pip arithmetic to infer.
      const level = serviceLevel(st);
      const cut = round1(st.openingExpense - st.expense - (st.pilotLift || 0));
      return `<div class="base" data-fn="${f.key}"
                   data-shielded="${st.shielded}" data-service="${level}">
        <span class="base-name">${f.name}</span>
        <span class="base-budget">
          <b>${money(st.expense + (st.pilotLift || 0))}</b>
          ${cut > 0.05 ? `<s>${money(st.openingExpense)}</s>` : ''}
          ${st.pilotLift ? `<i>+${money(st.pilotLift)} PILOT</i>` : ''}
        </span>
        <span class="base-service">
          <em>${SERVICE_WORDS[level]}</em>
          ${cut > 0.05 ? `<u>−${money(cut)}</u>` : ''}
          ${st.attrition ? `<s class="base-quit">${st.attrition} QUIT</s>` : ''}
          ${f.key === 'safety' && overtimeBands(state)
            ? '<s class="base-ot">OVERTIME</s>' : ''}
        </span>
        ${st.shielded ? '<span class="base-shield">SHIELDED</span>' : ''}
        <button type="button" class="base-btn" data-shield="${f.key}"
                ${arming ? '' : 'disabled'}
                aria-label="${st.shielded
                  ? `Remove the shield from ${f.name}. Funded at ${money(st.expense)}, ${SERVICE_WORDS[level]}.`
                  : `Shield ${f.name}. Funded at ${money(st.expense)}, ${SERVICE_WORDS[level]}. A shield sends the deficit to another service instead.`}">
          ${st.shielded ? 'UNSHIELD' : 'SHIELD'}
        </button>
      </div>`;
    }).join('');

    for (const b of document.querySelectorAll('[data-shield]')) {
      b.onclick = () => onShield(b.dataset.shield);
    }
  }

  function onShield(key) {
    if (!wave?.arming) return;
    const was = state.functions[key].shielded;
    if (!toggleShield(state, key)) {
      hud.announce('No shields left. Remove one to move it.');
      return;
    }
    audio?.leverClick?.();
    hud.announce(was
      ? `Shield removed from ${fn(key).name}. ${state.shieldsLeft} left.`
      : `${fn(key).name} shielded. Deficit aimed here goes to another service instead. ${state.shieldsLeft} left.`);
    renderBases();
    renderHud();
  }

  function renderControls() {
    // Update the label in place — replacing textContent would destroy the
    // button's name/sub/key spans.
    $('#ctl-onetime .ctl-name').textContent = state.oneTimeDrawn
      ? 'PATCH DRAWN' : 'ONE-TIME PATCH';
    $('#ctl-onetime .ctl-sub').textContent = state.oneTimeDrawn
      ? 'a claim is coming' : 'clears missiles, changes nothing';
    $('#ctl-onetime').disabled = state.oneTimeDrawn;
    $('#ctl-onetime').dataset.armed = String(state.oneTimeDrawn);
    // PAY IT BACK is contextual, not a fifth permanent control (§16).
    $('#ctl-payback').hidden = !state.oneTimeDrawn;

    // Council mode simply does not have these two.
    $('#ctl-cut').hidden = !canCut(state);
    $('#ctl-exit').hidden = !canExit(state);
    $('#ctl-cut').disabled = !availableCuts(state).length;
    $('#ctl-tax').disabled = !availableTaxes(state).length;
    $('#ctl-exit').disabled = !availableExits(state).length;
  }

  function meterRow(m, changed) {
    const v = Math.round(state.mood[m.key]);
    const band = moodBand(v);
    const word = moodWord(m.key, v);
    return `<div class="meter-row" data-meter="${m.key}" data-band="${band}"
                 ${v <= 0 ? 'data-zero="true"' : ''}
                 ${changed ? 'data-changed="true"' : ''}
                 aria-label="${m.name} ${v}${word ? `, ${word.toLowerCase()}` : ''}">
      <span class="meter-name">${m.name}${word ? `<em> · ${word}</em>` : ''}</span>
      <span class="meter-track"><i style="width:${v}%"></i></span>
      <span class="meter-val">${v}</span>
    </div>`;
  }

  /** @param changedKeys meters to flash, because an action just moved them. */
  function renderMeters(changedKeys) {
    const set = new Set(changedKeys || []);
    $('#meters').innerHTML = METERS.map(m => meterRow(m, set.has(m.key))).join('');
    if (set.size) {
      setTimeout(() => {
        for (const el of document.querySelectorAll('.meter-row[data-changed]')) {
          el.removeAttribute('data-changed');
        }
      }, 900);
    }
  }

  /* ---------------------------------------------------------------- */
  /* Controls (§20-§25)                                                */
  /* ---------------------------------------------------------------- */

  function openOptions(kind) {
    if (!canAct()) return;
    closeMenu();
    const el = $('#option-menu');
    let title, items;

    if (kind === 'cut') {
      title = 'CUT PROGRAM — REDUCE A RECURRING EXPENSE';
      items = availableCuts(state).map(c => ({
        id: c.id,
        head: c.label,
        sub: `${fn(c.fnKey).name} · ${c.detail}`,
        effect: `−${money(c.saving)}/YR RECURRING EXPENSE`,
        mood: c.mood,
        warn: c.serviceDelta ? 'SERVICE −1' : null,
        proto: !!c.verify,
        blocked: state.mood.unions < RESISTANT && (c.staffDelta || 0) < 0
          ? 'LABOR RELATIONS TOO POOR' : null
      }));
    } else if (kind === 'tax') {
      title = 'IMPOSE TAX — RAISE RECURRING REVENUE';
      items = availableTaxes(state).map(t => ({
        id: t.id,
        head: t.label,
        sub: t.detail,
        effect: `+${money(t.revenue)}/YR RECURRING REVENUE`,
        mood: t.mood,
        proto: !!t.verify,
        blocked: state.mood.taxpayers < RESISTANT ? 'TAXPAYERS WILL NOT WEAR IT' : null
      }));
    } else if (kind === 'exit') {
      title = 'TRANSFER PROGRAM — ANOTHER AGENCY RUNS IT';
      items = availableExits(state).map(f => ({
        id: f.key,
        head: f.exitLabel,
        sub: `Another agency delivers it. The City stops running it.`,
        effect: `−${money(f.exitSaving)}/YR NET RECURRING EXPENSE`,
        mood: { unions: -4, taxpayers: +2, activists: -2, nonprofits: -2 },
        warn: 'THE SERVICE LEAVES THE BOARD',
        proto: !!f.verify
      }));
    } else if (kind === 'pilot') {
      title = 'LAUNCH PILOT — TEMPORARY BY DEFAULT';
      items = PILOTS
        .filter(p => !state.activePilots.some(x => x.id === p.id) &&
                     !state.functions[p.fnKey].exited)
        .map(p => ({
          id: p.id,
          head: p.label,
          sub: `${fn(p.fnKey).name} · Ends after one year unless you make it permanent.`,
          effect: 'NO RECURRING COST WHILE IT IS A PILOT',
          mood: p.mood,
          proto: !!p.verify
        }));
    }

    if (!items.length) {
      hud.announce('No options left there.');
      toast('NOTHING AVAILABLE', title, 'info');
      return;
    }

    $('#option-title').textContent = title;
    $('#option-list').innerHTML = items.map(it => `
      <button type="button" class="option" data-option="${it.id}"
              ${it.blocked ? 'disabled' : ''}
              aria-label="${optionAria(it)}">
        <span class="opt-head">${it.head}</span>
        <span class="opt-sub">${it.sub}</span>
        <span class="opt-effect">${it.effect}</span>
        <span class="opt-tags">
          ${Object.entries(it.mood || {}).filter(([, v]) => v).map(([k, v]) => {
            const nm = METERS.find(x => x.key === k)?.name || k;
            return `<i data-dir="${v > 0 ? 'up' : 'down'}">${nm} ${(v > 0 ? '▲' : '▼').repeat(Math.min(3, Math.abs(v)))}</i>`;
          }).join('')}
          ${it.warn ? `<i data-dir="warn">${it.warn}</i>` : ''}
          ${it.proto ? '<i data-dir="proto">PROTOTYPE VALUE</i>' : ''}
          ${it.blocked ? `<i data-dir="blocked">${it.blocked}</i>` : ''}
        </span>
      </button>`).join('');

    el.hidden = false;
    openMenu = kind;
    wave?.setPaused(true);
    $('#option-list button:not([disabled])')?.focus();
    hud.announce(`${title}. ${items.length} options. The wave is paused.`);

    for (const b of el.querySelectorAll('[data-option]')) {
      b.onclick = () => choose(kind, b.dataset.option);
    }
    $('#option-cancel').onclick = () => { closeMenu(); hud.announce('Cancelled.'); };
  }

  function optionAria(it) {
    const bits = [it.head, it.sub.replace(/\.$/, ''), it.effect];
    for (const [k, v] of Object.entries(it.mood || {})) {
      if (!v) continue;
      const nm = METERS.find(x => x.key === k)?.name || k;
      bits.push(`${nm} ${v > 0 ? 'up' : 'down'}`);
    }
    if (it.warn) bits.push(it.warn);
    if (it.proto) bits.push('prototype value, sourcing required before release');
    if (it.blocked) bits.push(`unavailable: ${it.blocked}`);
    return bits.join('. ') + '.';
  }

  function closeMenu() {
    $('#option-menu').hidden = true;
    if (openMenu) { openMenu = null; wave?.setPaused(false); }
    if (yearEndPending) endYear();
  }

  function choose(kind, id) {
    // Snapshot sentiment so the overlay can report exactly what changed (§24).
    const before = { ...state.mood };

    let r;
    if (kind === 'cut') r = applyCut(state, id);
    else if (kind === 'tax') r = applyTax(state, id);
    else if (kind === 'exit') r = applyExit(state, id);
    else if (kind === 'pilot') r = startPilot(state, id);

    closeMenu();
    if (!r.ok) {
      hud.announce(`Cannot do that: ${r.reason}.`);
      toast('CANNOT DO THAT', r.reason, 'bad');
      return;
    }
    audio?.stamp?.();

    const cleared = r.cleared || [];
    let head, lines;
    if (kind === 'cut') {
      head = r.option.label;
      lines = [`−${money(r.option.saving)}/YR RECURRING EXPENSE`];
    } else if (kind === 'tax') {
      head = r.option.label;
      lines = [`+${money(r.option.revenue)}/YR RECURRING REVENUE`];
    } else if (kind === 'exit') {
      head = r.option.exitLabel;
      lines = [`−${money(r.option.exitSaving)}/YR NET RECURRING EXPENSE`];
    } else {
      head = `PILOT STARTED — ${r.pilot.label}`;
      lines = ['NO RECURRING COST WHILE IT IS A PILOT'];
    }

    resolveAction({ head, lines, cleared, before });
  }

  /* ---------------------------------------------------------------- */
  /* Action resolution (§21-§28)                                       */
  /* ---------------------------------------------------------------- */

  /**
   * The canonical causal beat:
   *   freeze -> fiscal impact -> CONSTITUENCY SENTIMENT IMPACT ->
   *   missiles removed/launched -> values recede to their meters -> resume.
   *
   * @param head     the action's name
   * @param lines    fiscal result lines, most important first
   * @param cleared  missiles removed by this action
   * @param launched missiles created by this action
   * @param before   sentiment snapshot taken before the action applied
   * @param extra    optional trailing note (exposure, cushion state)
   */
  function resolveAction({ head, lines, cleared = [], launched = [], before, extra }) {
    wave?.setFrozen(true);

    const el = $('#impact');
    $('#impact-head').textContent = head;

    const count = cleared.length || launched.length;
    const countLine = cleared.length
      ? `${cleared.length} MISSILE${cleared.length === 1 ? '' : 'S'} ELIMINATED`
      : launched.length
        ? `${launched.length} NEW MISSILE${launched.length === 1 ? '' : 'S'}`
        : null;

    $('#impact-lines').innerHTML =
      lines.map(l => `<span class="impact-line">${l}</span>`).join('') +
      (countLine
        ? `<span class="impact-count" data-dir="${cleared.length ? 'down' : 'up'}">${countLine}</span>`
        : '');

    // §23: the heading is exactly this, and §24: only affected groups appear.
    const deltas = before
      ? METERS
        .map(m => ({ m, d: Math.round(state.mood[m.key] - before[m.key]) }))
        .filter(x => x.d !== 0)
      : [];

    $('#impact-sentiment').hidden = !deltas.length;
    $('#impact-rows').innerHTML = deltas.map(x =>
      `<span class="impact-delta" data-meter="${x.m.key}" data-dir="${x.d > 0 ? 'up' : 'down'}">
         <b>${x.m.name}</b><i>${x.d > 0 ? '+' : ''}${x.d}</i>
       </span>`).join('');

    $('#impact-extra').hidden = !extra;
    if (extra) $('#impact-extra').textContent = extra;

    el.hidden = false;
    $('#board-screen').dataset.resolving = 'true';

    hud.announce(
      `${head}. ${lines.join('. ')}. ` +
      (countLine ? `${countLine}. ` : '') +
      (deltas.length
        ? 'Constituency sentiment impact. ' +
          deltas.map(x => `${x.m.name} ${x.d > 0 ? 'up' : 'down'} ${Math.abs(x.d)}`).join('. ') + '. '
        : '') +
      (extra ? extra + ' ' : '') +
      structuralLine());

    const reduced = reducedMotion();
    // §28: roughly 1.5-2.5s total, or near-instant under reduced motion.
    const readMs = reduced ? 300 : 1500;
    const recedeMs = reduced ? 100 : 700;

    // §27: the missiles change while the readout is up, so the number on
    // screen and the number leaving the sky are visibly the same event.
    const burstAt = reduced ? 0 : 500;
    impactTimers.push(setTimeout(() => {
      for (const m of cleared) {
        const p = renderer.pointAt(m, tileRects);
        renderer.burst(p.x, p.y, '#7ee787');
      }
      if (cleared.length) audio?.tallyTick?.();
    }, burstAt));

    // §26: the sentiment values travel to their meters, which then animate.
    impactTimers.push(setTimeout(() => {
      for (const row of document.querySelectorAll('.impact-delta')) {
        const target = document.querySelector(`.meter-row[data-meter="${row.dataset.meter}"]`);
        if (!target) { row.dataset.state = 'gone'; continue; }
        const a = row.getBoundingClientRect();
        const b = target.getBoundingClientRect();
        row.style.setProperty('--dx', `${b.x + b.width / 2 - (a.x + a.width / 2)}px`);
        row.style.setProperty('--dy', `${b.y + b.height / 2 - (a.y + a.height / 2)}px`);
        row.dataset.state = 'recede';
      }
      renderMeters(deltas.map(x => x.m.key));
    }, readMs));

    impactTimers.push(setTimeout(() => {
      el.hidden = true;
      $('#board-screen').dataset.resolving = 'false';
      wave?.setFrozen(false);
      renderAll();
      checkClear();
    }, readMs + recedeMs));

    // Clicking through accelerates the hold once it has been seen (§28).
    el.onclick = () => finishImpact({ el, cleared, deltas });
  }

  let impactTimers = [];

  function finishImpact({ el, cleared, deltas }) {
    for (const t of impactTimers) clearTimeout(t);
    impactTimers = [];
    for (const m of cleared) {
      const p = renderer.pointAt(m, tileRects);
      renderer.burst(p.x, p.y, '#7ee787');
    }
    renderMeters(deltas?.map(x => x.m.key));
    el.hidden = true;
    el.onclick = null;
    $('#board-screen').dataset.resolving = 'false';
    wave?.setFrozen(false);
    renderAll();
    if (checkCollapse()) return;
    checkClear();
  }

  function structuralLine() {
    const bal = structuralBalance(state);
    return bal < 0
      ? `Structural deficit now ${money(-bal)}.`
      : `The City now holds a ${money(bal)} structural surplus.`;
  }

  /** §5: if the deficit is gone, so is the sky. Do not manufacture a wave. */
  function checkClear() {
    if (!wave?.running) return;
    if (openMenu) return;
    if (deficitRemaining(state) > 0.05) return;
    banner('CLEAR SKIES', 1600);
    hud.announce('Clear skies. The deficit is gone.');
    setTimeout(() => {
      if (wave?.running && !openMenu && deficitRemaining(state) <= 0.05) wave.finishNow();
    }, 1700);
  }

  function doOneTime() {
    if (!canAct()) return;
    const before = { ...state.mood };
    const r = useOneTimeMoney(state);
    if (!r.ok) { hud.announce(r.reason); return; }
    audio?.thunder?.();

    // §29: the fiscal result, then the cushion state.
    resolveAction({
      head: `ONE-TIME MONEY: ${money(r.cleared)}`,
      lines: ['RECURRING REVENUE AND EXPENSE UNCHANGED'],
      cleared: r.removed,
      before,
      extra: 'TEMPORARY CUSHION DRAWN DOWN — a claim comes due within two years.'
    });
  }

  function doPayBack() {
    if (!canAct()) return;
    const before = { ...state.mood };
    const r = payItBack(state);
    if (!r.ok) { hud.announce(r.reason); return; }
    audio?.stamp?.();

    // §30: surplus absorbs what it can; the rest launches as new missiles.
    const lines = [];
    if (r.covered > 0.05) lines.push(`SURPLUS ABSORBED: ${money(r.covered)}`);
    lines.push(r.shortfall > 0.05
      ? `NEW DEFICIT: ${money(r.shortfall)}`
      : 'FULLY ABSORBED BY CURRENT SURPLUS');

    // New missiles need paths before they are drawn.
    if (r.launched.length) wave?.relayout();

    resolveAction({
      head: 'TEMPORARY CUSHION RESTORED',
      lines,
      launched: r.launched,
      before,
      extra: 'The future claim is funded.'
    });
  }

  /* ---------------------------------------------------------------- */
  /* Transient UI                                                      */
  /* ---------------------------------------------------------------- */

  let bannerTimer = null;
  function banner(text, ms) {
    const el = $('#banner');
    el.textContent = text;
    el.hidden = false;
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => { el.hidden = true; }, ms);
  }

  let toastTimer = null;
  function toast(title, detail, tone) {
    const el = $('#toast');
    $('#toast-title').textContent = title;
    $('#toast-detail').textContent = detail || '';
    el.dataset.tone = tone || 'info';
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 3600);
  }

  /* ---------------------------------------------------------------- */
  /* Input                                                             */
  /* ---------------------------------------------------------------- */

  function onKey(e) {
    if (document.body.dataset.screen !== 'board-screen') return;

    if (e.key === 'Escape') {
      if (openMenu) {
        e.preventDefault(); e.stopPropagation();
        closeMenu(); hud.announce('Cancelled.');
        return;
      }
      // Mid-run, ask before discarding the term. Once FOUR YEARS LATER is up
      // there is nothing left to lose, so leaving is immediate.
      if (state && $('#final').hidden && !confirmingExit) {
        e.preventDefault(); e.stopPropagation();
        confirmExit();
        return;
      }
    }

    if (openMenu) return;

    const k = e.key.toLowerCase();
    if (k === 'c' && !$('#ctl-cut').hidden && !$('#ctl-cut').disabled) {
      e.preventDefault(); openOptions('cut');
    }
    else if (k === 't' && !$('#ctl-tax').disabled) { e.preventDefault(); openOptions('tax'); }
    else if (k === 'x' && !$('#ctl-exit').hidden && !$('#ctl-exit').disabled) {
      e.preventDefault(); openOptions('exit');
    }
    else if (k === 'o' && !$('#ctl-onetime').disabled) { e.preventDefault(); doOneTime(); }
    else if (k === 'b' && !$('#ctl-payback').hidden) { e.preventDefault(); doPayBack(); }
    else if (k === 's' && wave?.arming) { e.preventDefault(); wave.armNow(); }
    else if (k === 'p' && wave?.running && !wave.arming) {
      e.preventDefault();
      const paused = wave.togglePause();
      $('#ctl-pause').textContent = paused ? 'RESUME' : 'PAUSE';
      $('#board-screen').dataset.paused = String(paused);
      hud.announce(paused ? 'Paused. No penalty.' : 'Resumed.');
    }
  }

  function confirmExit() {
    confirmingExit = true;
    const wasPaused = wave?.paused;
    wave?.setPaused(true);
    const el = $('#leave-confirm');
    $('#leave-title').textContent = 'LEAVE THIS TERM?';
    $('#leave-sub').textContent = 'The budgets you have closed will not be saved.';
    el.hidden = false;
    $('#leave-yes').focus();
    hud.announce('Leave this term? Progress will be lost.');
    const close = leave => {
      el.hidden = true;
      confirmingExit = false;
      if (leave) { stop(); onExit?.(); }
      else { if (!wasPaused) wave?.setPaused(false); hud.announce('Still in office.'); }
    };
    $('#leave-yes').onclick = () => close(true);
    $('#leave-no').onclick = () => close(false);
  }

  /* ---------------------------------------------------------------- */
  /* Lifecycle                                                         */
  /* ---------------------------------------------------------------- */

  function start(mode, rng) {
    stop();
    state = createBoardState(mode, rng || Math.random);
    for (const id of ['#final', '#resolve', '#briefing', '#option-menu',
                      '#pilot-modal', '#leave-confirm', '#toast', '#banner',
                      '#impact']) {
      $(id).hidden = true;
    }
    $('#board-screen').dataset.resolving = 'false';
    for (const t of impactTimers) clearTimeout(t);
    impactTimers = [];
    confirmingExit = false;
    openMenu = null;

    if (!renderer) {
      renderer = createBoardRenderer($('#board-canvas'));
      window.addEventListener('resize', () => { renderer.resize(); measureTiles(); });
      window.addEventListener('keydown', onKey, true);
      $('#ctl-cut').onclick = () => openOptions('cut');
      $('#ctl-tax').onclick = () => openOptions('tax');
      $('#ctl-exit').onclick = () => openOptions('exit');
      $('#ctl-onetime').onclick = doOneTime;
      $('#ctl-payback').onclick = doPayBack;
      $('#ctl-pilot').onclick = () => openOptions('pilot');
      $('#ctl-pause').onclick = () => {
        if (!wave?.running) return;
        const paused = wave.togglePause();
        $('#ctl-pause').textContent = paused ? 'RESUME' : 'PAUSE';
        $('#board-screen').dataset.paused = String(paused);
      };
      $('#arming-go').onclick = () => wave?.armNow();
    }
    renderer.resize();
    cancelAnimationFrame(raf);
    lastFrame = 0;
    raf = requestAnimationFrame(loop);

    showTutorial(() => beginYear(null));
  }

  /** §26: the tutorial carries the abstraction, briefly. */
  function showTutorial(done) {
    const el = $('#tutorial');
    el.hidden = false;
    $('#tut-go').focus();
    $('#tut-go').onclick = () => { el.hidden = true; done(); };
    hud.announce(
      'Missiles are deficits. Recurring expenses above recurring revenue create missiles. ' +
      'CUT lowers recurring expense. TAX raises recurring revenue. ' +
      'EXIT removes an entire City responsibility and its recurring cost. ' +
      'ONE-TIME MONEY clears missiles now without changing the recurring structure — ' +
      'if that cushion is gone when a future obligation arrives, new missiles appear. ' +
      'PAY IT BACK restores the cushion, but you must fund it now. ' +
      'Pilots expire unless you choose to make them permanent.');
  }

  function stop() {
    wave?.stop();
    for (const t of impactTimers) clearTimeout(t);
    impactTimers = [];
    cancelAnimationFrame(raf);
    clearTimeout(bannerTimer);
    clearTimeout(toastTimer);
  }

  const api = {
    start, stop,
    get state() { return state; },
    /**
     * The shell's quit control routes here so leaving mid-term asks first.
     * @returns true when this game has taken responsibility for the exit.
     */
    requestExit() {
      if (!state || confirmingExit) return true;
      if (!$('#final').hidden) return false;   // term over; nothing to lose
      confirmExit();
      return true;
    }
  };
  if (window.__BBD_TEST__) {
    api.__wave = () => wave;
    api.__arm = () => wave?.armNow();
    api.__bomb = (key, kind) => dropConsequence(key, BOMBS[kind] || BOMBS.overtime);
  }
  return api;
}
