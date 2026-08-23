// Budget Quest — structural deficit engine (v3.1).
//
// The whole game rests on three quantities (§2):
//
//     STRUCTURAL BALANCE = RECURRING REVENUE − RECURRING EXPENSE
//
// and one rule:
//
//     NO DEFICIT, NO MISSILES.
//
// Missiles are the deficit, not the expenses (§2). A cost increase creates
// missiles only to the extent it causes or enlarges a deficit (§3), and a
// structural fix that clears the deficit clears the sky (§5) — the game does
// not invent a wave to stay busy.

import {
  FUNCTIONS, FUNCTION_KEYS, METER_KEYS, MAX_PIPS, fn,
  CUTS, TAXES, PILOTS, RESISTANT
} from './content.js';

export const CAMPAIGN_YEARS = 4;
export const FIRST_YEAR = 2028;
export const SHIELDS_PER_YEAR = 2;

/** Recurring revenue the City starts with (§27). */
const OPENING_REVENUE = 300;

/**
 * A landed missile cuts the base's budget by its own value. One missile is
 * $1M, so a $1M hit removes $1M of funding — the arithmetic is the display,
 * and there is nothing to explain.
 */
export const UNITS_PER_PIP = 1;

/**
 * §7: every normal deficit missile is exactly $1M. A $30M deficit is 30
 * missiles; a $5M tax removes exactly 5. This mapping is visually and
 * mathematically exact, so nothing else may batch or scale it.
 */
export const MISSILE_UNIT = 1;

/* ------------------------------------------------------------------ */
/* Construction                                                        */
/* ------------------------------------------------------------------ */

export function createBoardState(mode = 'common', rng = Math.random) {
  const functions = {};
  for (const f of FUNCTIONS) {
    functions[f.key] = {
      staff: f.staff,
      expense: f.baseExpense,
      // What the service was funded at before anything happened to it, so the
      // display can show what has been taken away as well as what is left.
      openingExpense: f.baseExpense,
      cutTotal: 0,
      exited: false,
      shielded: false
    };
  }

  const mood = {};
  for (const k of METER_KEYS) mood[k] = 60;

  return {
    mode,
    rng,
    year: 0,
    fiscalYear: FIRST_YEAR,
    functions,
    mood,

    recurringRevenue: OPENING_REVENUE,
    transferCosts: 0,
    // Cumulative tax burden, held under the hood (§ "sophisticated stuff
    // should live under the hood"). It only surfaces as an event or as a
    // drag on what a further tax will actually yield.
    taxBurden: 0,

    // One-time money exposure (§11): a single binary state, not a dashboard.
    oneTimeDrawn: false,
    oneTimeAmount: 0,
    obligationYear: null,
    obligationResolved: false,

    missiles: [],
    shieldsLeft: SHIELDS_PER_YEAR,
    // Per-year tally of which mechanism absorbed how much deficit.
    absorbed: { structure: 0, onetime: 0, landed: 0 },
    // $1M units of shock a current surplus has already paid off this year.
    shockCovered: 0,

    usedCuts: [],
    usedTaxes: [],
    activePilots: [],
    pendingPilotChoice: null,

    events: [],
    yearLog: []
  };
}

/* ------------------------------------------------------------------ */
/* The three primary quantities (§2)                                   */
/* ------------------------------------------------------------------ */

export function recurringExpense(s) {
  let total = 0;
  for (const key of FUNCTION_KEYS) {
    const st = s.functions[key];
    if (st.exited) continue;
    total += st.expense;
  }
  // Pilots the player made permanent are part of the recurring structure.
  for (const p of s.activePilots) {
    if (p.permanent) total += p.permanentCost;
  }
  // Services transferred out still cost the City what it pays the receiving
  // agency — EXIT changes who delivers, not who is on the hook entirely.
  total += s.transferCosts || 0;
  return round1(total);
}

export const structuralBalance = s => round1(s.recurringRevenue - recurringExpense(s));

/**
 * Service level, derived from how much of a base's original funding survives.
 * Nothing stores it: the budget is the truth, and this is a reading of it.
 */
export function serviceLevel(st) {
  if (!st || st.exited) return 0;
  if (!st.openingExpense) return MAX_PIPS;
  // A pilot's funding counts toward the service whether it is still a pilot
  // or has been made permanent; the difference is who is paying for it.
  const f = (st.expense + (st.pilotLift || 0)) / st.openingExpense;
  if (f >= 0.97) return 4;
  if (f >= 0.82) return 3;
  if (f >= 0.6) return 2;
  if (f > 0.2) return 1;
  return 0;
}

/** Positive when the City is short. This is what becomes missiles. */
export const structuralDeficit = s => Math.max(0, -structuralBalance(s));

export const structuralSurplus = s => Math.max(0, structuralBalance(s));

/* ------------------------------------------------------------------ */
/* Missiles (§2, §15)                                                  */
/* ------------------------------------------------------------------ */

let seq = 0;

function makeMissile(kind, aimedAt) {
  return {
    id: `m${++seq}`,
    kind,                       // 'structural' | 'shock'
    // §8: no label, no per-missile dollar figure. Every missile is $1M of
    // uncovered deficit, and nothing more specific than that.
    amount: MISSILE_UNIT,
    remaining: MISSILE_UNIT,
    aimedAt,
    // Ballistic path, filled in by the wave controller (§15-§17).
    t: 0,
    originX: 0,
    arc: 0,
    releaseAt: 0,
    travel: 1,
    resolved: false,
    landed: false
  };
}

/**
 * One missile per $1M (§7), aimed across the bases still on the board. Aiming
 * happens before shields lock so the player can see what is coming at a base
 * and choose to protect it.
 */
function buildMissiles(s, total, kind) {
  const out = [];
  const count = Math.round(total / MISSILE_UNIT);
  if (count <= 0) return out;

  const live = FUNCTION_KEYS.filter(k => !s.functions[k].exited);
  if (!live.length) return out;

  // Deal round-robin from a rotating start so no base is always first in line.
  let i = Math.floor(s.rng() * live.length);
  for (let n = 0; n < count; n++) {
    out.push(makeMissile(kind, live[i % live.length]));
    i++;
  }
  return out;
}

/**
 * Compose the year's sky. Structural missiles come from the deficit and
 * nothing else (§2). If the structure is balanced the sky is clear (§5).
 */
export function composeWave(s) {
  const deficit = structuralDeficit(s);
  s.missiles = buildMissiles(s, deficit, 'structural');
  s.openingDeficit = deficit;
  s.absorbed = { structure: 0, onetime: 0, landed: 0 };
  s.shockCovered = 0;
  return s.missiles;
}

export const deficitRemaining = s =>
  round1(s.missiles.reduce((a, m) => a + (m.resolved || m.landed ? 0 : m.remaining), 0));

export const skyIsClear = s => deficitRemaining(s) <= 0.05;

/**
 * Launch shock missiles mid-year (§14). Used by the claims obligation and by
 * anything else that creates an unfunded cost during play.
 */
export function launchShock(s, amount) {
  const fresh = buildMissiles(s, amount, 'shock');
  // Shocks arrive during play, so they start descending immediately.
  for (const m of fresh) { m.releaseAt = 0; m.travel = 0.55; }
  s.missiles.push(...fresh);
  // A surplus pays what it can of the bill right away.
  reconcileSky(s);
  return fresh.filter(m => !m.resolved);
}

/* ------------------------------------------------------------------ */
/* Shields                                                             */
/* ------------------------------------------------------------------ */

export function toggleShield(s, key) {
  const st = s.functions[key];
  if (!st || st.exited) return false;
  if (st.shielded) { st.shielded = false; s.shieldsLeft++; return true; }
  if (s.shieldsLeft <= 0) return false;
  st.shielded = true;
  s.shieldsLeft--;
  return true;
}

export function clearShields(s) {
  for (const k of FUNCTION_KEYS) s.functions[k].shielded = false;
  s.shieldsLeft = SHIELDS_PER_YEAR;
}

/* ------------------------------------------------------------------ */
/* Landing (§ unmanaged deficit becomes a service reduction)           */
/* ------------------------------------------------------------------ */

export function landMissile(s, m) {
  if (m.resolved || m.landed) return null;

  let key = m.aimedAt;
  let redirected = false;
  if (key && (s.functions[key].shielded || s.functions[key].exited)) {
    const alt = pickTarget(s, key);
    if (alt) { key = alt; redirected = true; }
    else key = null;
  }
  if (!key) key = pickAny(s);
  if (!key) { m.landed = true; m.resolved = true; m.by = 'landed'; return null; }

  const st = s.functions[key];
  m.landed = true;
  m.resolved = true;
  m.by = 'landed';
  m.landedOn = key;
  s.absorbed.landed = round1(s.absorbed.landed + m.remaining);

  // The hit comes straight out of the base's budget. This is the whole
  // mechanic: unfunded deficit lands somewhere, and where it lands, that
  // service loses exactly that much money.
  const before = st.expense;
  st.expense = Math.max(0, round1(st.expense - m.remaining));
  const cut = round1(before - st.expense);
  st.cutTotal = round1((st.cutTotal || 0) + cut);

  // Unfunded cuts land on people, and almost everyone dislikes the result.
  // The exception is public safety: cutting it is the one reduction some
  // activists have been asking for, so it moves them the other way.
  const per = cut * 0.16;
  applyMood(s, {
    taxpayers: -per,
    unions: -per * 1.4,          // these are jobs
    nonprofits: -per * 1.2,      // and contracts
    activists: key === 'safety' ? +per * 1.2 : -per * 1.2,
    business: (key === 'streets' || key === 'safety') ? -per * 1.2 : -per * 0.5
  });

  return { key, cut, redirected, amount: m.remaining };
}

function pickTarget(s, avoid) {
  const cands = FUNCTION_KEYS.filter(k =>
    k !== avoid && !s.functions[k].exited && !s.functions[k].shielded &&
    s.functions[k].expense > 0);
  if (!cands.length) return null;
  return cands.sort((a, b) => s.functions[b].expense - s.functions[a].expense)[0];
}

function pickAny(s) {
  const cands = FUNCTION_KEYS.filter(k => !s.functions[k].exited);
  if (!cands.length) return null;
  return cands.sort((a, b) => s.functions[b].expense - s.functions[a].expense)[0];
}

/**
 * Retire missiles once the structure improves. When a CUT, TAX or EXIT
 * shrinks the deficit, the corresponding missiles leave the sky (§5) —
 * they were only ever the deficit made visible.
 */
export function reconcileSky(s) {
  const target = structuralDeficit(s);
  const live = s.missiles.filter(m => !m.resolved && !m.landed);
  const structural = live.filter(m => m.kind === 'structural');
  const cleared = [];

  // A shock is a one-off bill, so a City running a surplus simply pays it.
  // §15 keeps shocks outside the structural arithmetic, which is right while
  // there is a deficit — but a City $60M in surplus taking claim fire it can
  // obviously cover reads as a bug, not as consequence.
  const surplus = structuralSurplus(s);
  if (surplus > 0) {
    let cover = Math.floor(surplus / MISSILE_UNIT) - (s.shockCovered || 0);
    for (const m of live) {
      if (cover <= 0) break;
      if (m.kind !== 'shock') continue;
      m.remaining = 0;
      m.resolved = true;
      m.by = 'structure';
      s.absorbed.structure = round1(s.absorbed.structure + MISSILE_UNIT);
      s.shockCovered = (s.shockCovered || 0) + 1;
      cleared.push(m);
      cover--;
    }
  }

  // §7: one missile is $1M, so the live count *is* the deficit. Remove whole
  // missiles until the two agree again — intercepting the most imminent
  // threats first, which is what closing a gap should feel like.
  let excess = structural.length - Math.round(target / MISSILE_UNIT);
  const order = structural.slice().sort((a, b) => (b.t || 0) - (a.t || 0));
  for (const m of order) {
    if (excess <= 0) break;
    m.remaining = 0;
    m.resolved = true;
    m.by = 'structure';
    s.absorbed.structure = round1(s.absorbed.structure + MISSILE_UNIT);
    cleared.push(m);
    excess--;
  }
  return cleared;
}

/* ------------------------------------------------------------------ */
/* CUT (§21)                                                           */
/* ------------------------------------------------------------------ */

export function availableCuts(s) {
  return CUTS.filter(c =>
    !s.usedCuts.includes(c.id) && !s.functions[c.fnKey].exited);
}

export function applyCut(s, id) {
  const c = CUTS.find(x => x.id === id);
  if (!c) return { ok: false, reason: 'NO SUCH OPTION' };
  if (s.usedCuts.includes(id)) return { ok: false, reason: 'ALREADY DONE' };
  if (s.functions[c.fnKey].exited) return { ok: false, reason: 'NO LONGER A CITY SERVICE' };
  if (s.mood.unions < RESISTANT && (c.staffDelta || 0) < 0) {
    return { ok: false, reason: 'LABOR RELATIONS TOO POOR' };
  }

  const st = s.functions[c.fnKey];
  st.expense = round1(st.expense - c.saving);
  if (c.staffDelta) st.staff = Math.max(0, st.staff + c.staffDelta);
  // A card that improves or degrades a service does it with money.
  if (c.serviceDelta) {
    st.expense = Math.max(0, round1(st.expense + c.serviceDelta * (st.openingExpense * 0.1)));
  }
  applyMood(s, c.mood);
  s.usedCuts.push(id);
  s.events.push({ year: s.fiscalYear, kind: 'cut', id, saving: c.saving });

  return { ok: true, option: c, cleared: reconcileSky(s) };
}

/* ------------------------------------------------------------------ */
/* TAX (§22)                                                           */
/* ------------------------------------------------------------------ */

export function availableTaxes(s) {
  return TAXES.filter(t => !s.usedTaxes.includes(t.id));
}

/**
 * §22: do not artificially nerf taxes. The yield is the stated figure; a high
 * cumulative burden costs the City commercially, not arithmetically.
 */
export function applyTax(s, id) {
  const t = TAXES.find(x => x.id === id);
  if (!t) return { ok: false, reason: 'NO SUCH OPTION' };
  if (s.usedTaxes.includes(id)) return { ok: false, reason: 'ALREADY LEVIED' };
  if (s.mood.taxpayers < RESISTANT) return { ok: false, reason: 'TAXPAYERS WILL NOT WEAR IT' };

  s.recurringRevenue = round1(s.recurringRevenue + t.revenue);
  s.taxBurden += t.burden;
  applyMood(s, t.mood);
  s.usedTaxes.push(id);
  s.events.push({ year: s.fiscalYear, kind: 'tax', id, revenue: t.revenue });

  return { ok: true, option: t, cleared: reconcileSky(s) };
}

/* ------------------------------------------------------------------ */
/* EXIT (§23)                                                          */
/* ------------------------------------------------------------------ */

export function availableExits(s) {
  return FUNCTIONS.filter(f => f.exitable && !s.functions[f.key].exited);
}

/**
 * §23: EXIT may legitimately wipe out the entire structural deficit and is
 * not capped to keep missiles on screen. If another provider continues the
 * service, users do not automatically suffer — so service level is not
 * reduced; the base simply leaves the board.
 */
export function applyExit(s, key) {
  const f = fn(key);
  if (!f || !f.exitable) return { ok: false, reason: f?.exitReason || 'CANNOT EXIT' };
  const st = s.functions[key];
  if (st.exited) return { ok: false, reason: 'ALREADY TRANSFERRED' };

  st.exited = true;
  st.shielded = false;
  st.exitedExpense = st.expense;
  // §23's saving is net of what the City still pays the receiving agency.
  // That residual stays on the books as a transfer payment.
  s.transferCosts = round1((s.transferCosts || 0) + (st.expense - f.exitSaving));
  applyMood(s, { unions: -4, taxpayers: +2, activists: -2, nonprofits: -2 });
  s.events.push({ year: s.fiscalYear, kind: 'exit', id: key, saving: f.exitSaving });

  // Any missiles already aimed at a departed base need somewhere to go.
  for (const m of s.missiles) {
    if (!m.resolved && !m.landed && m.aimedAt === key) m.aimedAt = pickAny(s);
  }

  return { ok: true, option: f, cleared: reconcileSky(s) };
}

/* ------------------------------------------------------------------ */
/* ONE-TIME MONEY (§9-§14, §24)                                        */
/* ------------------------------------------------------------------ */

/** One generic mechanic (§9) — no per-instrument taxonomy. */
export const ONE_TIME_DRAW = 5;

/**
 * §10: clears current missiles, changes nothing structural, creates exposure.
 * §12: guarantees a follow-on obligation within 1-2 fiscal years.
 */
export function useOneTimeMoney(s) {
  if (s.oneTimeDrawn) return { ok: false, reason: 'ALREADY DRAWN DOWN' };

  // §10: removes exactly as many missiles as millions drawn — no more.
  let toRemove = Math.round(ONE_TIME_DRAW / MISSILE_UNIT);
  const removed = [];
  // Take the nearest missiles first: this is money spent on today's problem.
  const live = s.missiles
    .filter(m => !m.resolved && !m.landed)
    .sort((a, b) => (b.t || 0) - (a.t || 0));
  for (const m of live) {
    if (toRemove <= 0) break;
    m.remaining = 0;
    m.resolved = true;
    m.by = 'onetime';
    s.absorbed.onetime = round1(s.absorbed.onetime + MISSILE_UNIT);
    removed.push(m);
    toRemove--;
  }

  s.oneTimeDrawn = true;
  s.oneTimeAmount = ONE_TIME_DRAW;
  // §12: 1 or 2 years out, so the player knows it is coming but not when.
  s.obligationYear = s.fiscalYear + (s.rng() < 0.5 ? 1 : 2);
  s.obligationResolved = false;
  s.events.push({ year: s.fiscalYear, kind: 'onetime', amount: ONE_TIME_DRAW });

  return { ok: true, cleared: removed.length * MISSILE_UNIT, removed };
}

/**
 * §17: repayment must be funded now. Existing surplus absorbs it; whatever
 * the surplus cannot cover becomes missiles immediately.
 */
export function payItBack(s) {
  if (!s.oneTimeDrawn) return { ok: false, reason: 'NOTHING TO RESTORE' };

  const surplus = structuralSurplus(s);
  const owed = s.oneTimeAmount;
  const covered = Math.min(surplus, owed);
  const shortfall = round1(owed - covered);

  s.oneTimeDrawn = false;
  s.oneTimeAmount = 0;
  s.obligationResolved = true;
  s.events.push({ year: s.fiscalYear, kind: 'payback', owed, covered, shortfall });

  const launched = shortfall > 0.05
    ? launchShock(s, shortfall)
    : [];

  return { ok: true, owed, covered, shortfall, launched };
}

/**
 * §13: the obligation only bites if the cushion is still drawn down.
 * Called at the start of a year whose fiscalYear matches obligationYear.
 */
export function resolveObligation(s) {
  if (s.obligationYear !== s.fiscalYear) return null;
  if (s.obligationResolved) return null;

  s.obligationResolved = true;

  if (!s.oneTimeDrawn) {
    // §13: paid from available balance, no missiles.
    return { funded: true, amount: 0 };
  }

  // §13: the shock need not equal the original draw exactly.
  const amount = round1(s.oneTimeAmount * (0.7 + s.rng() * 0.5));
  s.oneTimeDrawn = false;
  s.oneTimeAmount = 0;
  return { funded: false, amount };
}

/* ------------------------------------------------------------------ */
/* Pilots (§7, §8)                                                     */
/* ------------------------------------------------------------------ */

/** Start a pilot. Temporary by default — it costs nothing recurring. */
export function startPilot(s, id) {
  const p = PILOTS.find(x => x.id === id);
  if (!p) return { ok: false, reason: 'NO SUCH PILOT' };
  if (s.activePilots.some(x => x.id === id)) return { ok: false, reason: 'ALREADY RUNNING' };
  if (s.functions[p.fnKey].exited) return { ok: false, reason: 'NO LONGER A CITY SERVICE' };

  s.activePilots.push({
    ...p,
    startedYear: s.fiscalYear,
    endsYear: s.fiscalYear + 1,
    permanent: false
  });
  // A pilot lifts service only while it is running. Damage done in an earlier
  // year is not undone by starting one — the lift is borrowed, and it goes
  // back when the pilot ends unless the player pays to keep it.
  const st = s.functions[p.fnKey];
  // Funded from outside the recurring base, so it lifts the service without
  // touching recurring expense until the player makes it permanent (§7). The
  // lift is exactly the cost the card advertises.
  st.pilotLift = round1((st.pilotLift || 0) + p.permanentCost);
  applyMood(s, p.mood);
  s.events.push({ year: s.fiscalYear, kind: 'pilot-start', id });
  return { ok: true, pilot: p };
}

/** Pilots that have reached the end of their term and need a decision. */
export function expiringPilots(s) {
  return s.activePilots.filter(p => !p.permanent && p.endsYear <= s.fiscalYear);
}

/**
 * §8: the permanence is the choice. YES adds recurring expense — and only
 * creates missiles if that expense creates or enlarges a deficit.
 */
export function decidePilot(s, id, makePermanent) {
  const p = s.activePilots.find(x => x.id === id);
  if (!p) return { ok: false, reason: 'NO SUCH PILOT' };

  if (!makePermanent) {
    // §7: the normal outcome. Temporary cost disappears, nothing recurring —
    // and the borrowed service lift goes with it.
    s.activePilots = s.activePilots.filter(x => x.id !== id);
    const st = s.functions[p.fnKey];
    st.pilotLift = Math.max(0, round1((st.pilotLift || 0) - p.permanentCost));
    s.events.push({ year: s.fiscalYear, kind: 'pilot-end', id });
    return { ok: true, permanent: false, pilot: p };
  }

  // Made permanent: the lift is now bought and paid for with recurring money,
  // so it stops being borrowed.
  // Bought outright. recurringExpense already sums permanent pilots, so the
  // cost must not also be added to the base — the lift simply stops being
  // borrowed and the tile keeps crediting it through pilotLift.
  p.permanent = true;
  const st = s.functions[p.fnKey];
  if (p.staffDelta) st.staff += p.staffDelta;
  applyMood(s, p.mood);
  s.events.push({ year: s.fiscalYear, kind: 'pilot-permanent', id, cost: p.permanentCost });

  const deficitAfter = structuralDeficit(s);
  return { ok: true, permanent: true, pilot: p, deficitAfter };
}

/* ------------------------------------------------------------------ */
/* Meters                                                              */
/* ------------------------------------------------------------------ */

export function applyMood(s, deltas) {
  if (!deltas) return;
  for (const [k, v] of Object.entries(deltas)) {
    if (!(k in s.mood)) continue;
    s.mood[k] = clamp(s.mood[k] + v * 5, 0, 100);
  }
}

/* ------------------------------------------------------------------ */
/* Year end and rollover                                               */
/* ------------------------------------------------------------------ */

export function summariseYear(s) {
  const a = s.absorbed || { structure: 0, onetime: 0, landed: 0 };
  const landed = a.landed;
  const structureCleared = a.structure;
  const oneTime = a.onetime;
  return {
    fiscalYear: s.fiscalYear,
    openingDeficit: s.openingDeficit || 0,
    landed,
    structureCleared,
    oneTime,
    revenue: s.recurringRevenue,
    expense: recurringExpense(s),
    balance: structuralBalance(s),
    exposed: s.oneTimeDrawn
  };
}

/**
 * Scheduled compensation increase. §4: it scales with the staffing base that
 * exists when it occurs, so a bigger permanent workforce costs more later.
 */
export function applyCompensationIncrease(s) {
  const staff = FUNCTION_KEYS
    .filter(k => !s.functions[k].exited)
    .reduce((a, k) => a + s.functions[k].staff, 0);
  // A full-staffed City sees roughly a 5% annual increase — enough that
  // labour cost is the pressure driving the game forward, not a rounding
  // error. Because it scales with the staffing base, every EXIT permanently
  // shrinks next year's increase too: that is the whole lesson of §4.
  const perStaff = 0.95;
  const total = round1(staff * perStaff);
  // Spread across the bases that still employ people.
  for (const k of FUNCTION_KEYS) {
    const st = s.functions[k];
    if (st.exited || !st.staff) continue;
    const rise = round1(st.staff * perStaff);
    st.expense = round1(st.expense + rise);
    st.openingExpense = round1(st.openingExpense + rise);
  }
  applyMood(s, { unions: +1 });
  return { staff, total };
}

export function rolloverYear(s) {
  s.yearLog.push(summariseYear(s));
  clearShields(s);
  // Service damage carries. A function stripped in one budget cycle stays
  // stripped: nothing repairs it but an explicit investment.
  s.year++;
  s.fiscalYear++;

  // Business responds to the tax burden it is carrying and to the state of
  // the city it operates in — under the hood, surfacing only as the meter.
  if (s.taxBurden >= 5) applyMood(s, { business: -1 });

  const comp = applyCompensationIncrease(s);
  const obligation = resolveObligation(s);

  return { comp, obligation };
}

export const isComplete = s => s.year >= CAMPAIGN_YEARS;

/* ------------------------------------------------------------------ */
/* Utilities                                                           */
/* ------------------------------------------------------------------ */

export const round1 = v => Math.round(v * 10) / 10;
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
