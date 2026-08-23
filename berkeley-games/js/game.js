// Core game loop (spec §10, §13, §18, §19, §20, §38).

import { LANES, LANE_COUNT, LANE_KEYS, LANE_INDEX, COUNCIL_OPEN_LANES } from './content/lanes.js';
import {
  EVENTS, ONE_TIME_PICKUPS, RAINY_DAY_MESSAGE, RAINY_DAY_STAGING
} from './content/events.js';
import { CITIES } from './content/cities.js';
import {
  createGameState, commitResponse, applyEventImpact, collectOneTime, raiseRainLevel,
  addRecurringCommitment, applyShock, renegotiateLaborContract, buildOpeningForecast,
  bridgeTest, crossBridge, isLaneOpen, isLaneFailed, summarize,
  CAMPAIGN_BRIDGES, computeScore
} from './state.js';
import { makeRng, DEFAULT_SEED } from './rng.js';
import {
  buildCourse, updateHazards, ensureFailedLaneCraters, pruneHazards,
  checkHazardCollision, SEGMENT_LENGTH, DRAW_DISTANCE, laneCenterOffset
} from './physics.js';
import { createRenderer } from './render.js';
import { createMeetingRenderer } from './render-meeting.js';
import {
  createMeetingState, createPolitics, beginMeeting, updateMeeting,
  canEndMeeting, canExtend, extendMeeting, endMeeting, fiscalChanged,
  canPander, pander, maybeRageQuit,
  canMegaPander, pickProposal, approveMegaPander, resolveConsent
} from './meeting.js';
import {
  MEETING_TUNING, RAGE_QUIT_TEXT, RAGE_QUIT_SUBTEXT
} from './content/meeting.js';
import { createEscapeRenderer } from './render-escape.js';
import {
  createTransitionRenderer, transitionPhaseAt, TRANSITION_TOTAL, TRANSITION_PHASES
} from './render-transition.js';
import {
  HIGHER_OFFICE as HO, DEBUG_FORCE_HIGHER_OFFICE_EVENT,
  LABEL_RUN, LABEL_WIN, LABEL_CANDIDATE, LABEL_CAMPAIGN_OVER
} from './content/higher-office.js';
import {
  ROOSEVELT as RV, DEBUG_FORCE_ROOSEVELT_PROMPT, PROMPT_CONFIRMATION
} from './content/roosevelt.js';
import {
  BUDGET_TUNING, CYCLE, LABOR_CONTRACTS
} from './content/budget.js';
import { SHOCKS } from './content/shocks.js';

// ~80 mph. The earlier 78 m/s was 174 mph, which left only 4-6 s between
// decision gates against the 8-14 s the spec asks for — far too fast to read
// seven lane boards, let alone enjoy the joke on them (spec §38).
const BASE_SPEED = 36;              // metres/sec
const SPEED_STEP = 0.05;            // +5% per bridge (spec §38)
const LANE_CHANGE_MS = 220;         // spec §9

// Holding left/right steps lane by lane at this cadence, so crossing several
// lanes does not require several precisely-timed taps.
const LANE_REPEAT_MS = 150;

// Barrier bounce (replaces the fatal closed-lane collision).
const BOUNCE_MS = 420;
const BARRIER_MESSAGE = 'COMMON SENSE IS NOT AVAILABLE IN COUNCIL MODE!';
const GATE_COMMIT_WINDOW = 6;       // metres either side of the gate plane
const BRIDGE_SPAN = 90;             // metres of bridge deck
const GAP_START_FRACTION = 0.45;    // where a failed span stops
// Wide enough that the void still reads as a void from the far approach; a
// short chasm leaves visible ground beyond the barricade, which makes a broken
// bridge look like ordinary road.
const CANYON_OVERHANG = 260;

export function createGame({ canvas, hud, audio, mode, seed = DEFAULT_SEED,
                             reducedMotion, onEnd, meetingUi, rooseveltUi }) {
  const renderer = createRenderer(canvas);
  const rng = makeRng(seed);
  const state = createGameState(mode);
  state.timeOfDay = 'day';

  // Both modes generate the same course from the same seed (spec §8.3).
  const { plan } = buildCourse(rng, EVENTS, ONE_TIME_PICKUPS, {
    bridges: CAMPAIGN_BRIDGES,
    shocks: SHOCKS,
    laborContracts: LABOR_CONTRACTS,
    cycle: CYCLE,
    speed: BASE_SPEED
  });

  // The hazard RNG is separate so identical courses stay identical even though
  // wear-driven pothole draws differ between modes.
  const hazardRng = makeRng(seed ^ 0x9e3779b9);
  const trafficRng = makeRng(seed ^ 0x5bf03635);

  // --- Player ---
  const openLanes = mode === 'council' ? COUNCIL_OPEN_LANES : LANE_KEYS;
  let laneIndex = LANE_INDEX[openLanes[Math.floor(openLanes.length / 2)]];
  let laneFrom = laneIndex;
  let laneChangeStart = -Infinity;
  let laneOffset = 0;               // -1..1 interpolation between lanes

  // --- Run bookkeeping ---
  let playerZ = 0;
  let speed = BASE_SPEED;
  let speedMultiplier = 1;
  let hazards = [];
  let hazardCursor = 0;
  let neighbors = [];
  let signs = [];
  let signCursor = 0;
  let activePickups = [];
  let running = false;
  let paused = false;
  let ended = false;
  let lastT = 0;
  let shake = 0;
  let fall = null;                  // {t} while driving off the cliff
  let announcedBridge = -1;
  let lightning = null;             // {t} during the rainy-day flash
  let cycleHold = false;            // true while an opening forecast is showing
  let bounce = null;                // {t, dir} while rebounding off a barrier
  let lastBounceAt = -Infinity;

  // Special Meeting Pit Stop (Pit Stop addendum). The meeting freezes the road
  // rather than saving and reloading it: playerZ simply stops advancing and no
  // road system updates, so position, hazards and the next bridge are exactly
  // where they were by construction (addendum §18, §24).
  const meeting = createMeetingState();
  const politics = createPolitics();
  const meetingRenderer = createMeetingRenderer(renderer.ctx, renderer.view);
  let meetingSummaryOpen = false;
  const transitionRenderer = createTransitionRenderer(renderer.ctx, renderer.view);
  let returnTransition = null;      // {ms} during the flame -> black -> morning return
  // Fairness window after the fade-in, while the player cannot yet steer
  // (Rainy-Day addendum §16).
  let returnProtectionMs = 0;
  const RETURN_PROTECTION_MS = 900;

  // Higher Office Escape (Higher Office addendum). Council Mode only, rare,
  // and at most one opportunity per run. Purely an escape hatch: it never
  // touches the fiscal model (addendum §6, §8).
  const campaign = {
    eligible: false,
    offered: false,
    active: false,
    windowRemaining: 0,
    distractionActive: false,
    winPickupSpawned: false,
    winPickupCollected: false,
    resolved: false
  };
  const escapeRenderer = createEscapeRenderer(renderer.ctx, renderer.view);
  let escape = null;                // {t, below} during the escape cinematic
  let runPickup = null;             // the RUN FOR HIGHER OFFICE! road pickup
  let winPickup = null;             // the WIN HIGHER OFFICE! road pickup
  // Rarity is drawn from the seeded stream so runs stay reproducible (§19).
  const higherOfficeRoll = rng.next();

  // Roosevelt Avenue Easter egg (Roosevelt addendum §14). Rare, once per run,
  // and fiscally inert — it exists purely to set up the ending callback.
  const roosevelt = {
    promptEligible: false,
    promptOffered: false,
    promptSeen: false,
    neverSelected: false,
    active: false
  };
  const rooseveltRoll = rng.next();
  const gateState = new Map();      // gate -> 'pending' | 'announced' | 'committed'
  let currentBridge = null;         // {z0, z1, intact, index}

  // Pickups become road objects once their z is generated.
  for (const item of plan) {
    if (item.kind === 'pickup') {
      // Place pickups only in lanes the player can actually reach.
      const lanePool = openLanes.filter(k => !state.closedLanes.includes(k));
      const key = lanePool[Math.floor(rng.next() * lanePool.length)];
      activePickups.push({ z: item.z, lane: LANE_INDEX[key], pickup: item.pickup, taken: false });
    }
  }

  seedRoadsideSigns();

  /* ---------------------------------------------------------------- */
  /* Roadside satire signs (spec §21) — occasional, never constant.    */
  /* ---------------------------------------------------------------- */

  function seedRoadsideSigns() {
    for (const item of plan) {
      if (item.kind === 'bridge') {
        signs.push({ z: item.z - 320, side: 1, text: 'BUDGET BRIDGE\n1000 FT', warn: false });
        signs.push({ z: item.z - 180, side: -1, text: 'BALANCED BUDGET\nREQUIRED', warn: true });
        signs.push({ z: item.z - 60, side: 1, text: 'FISCAL CLIFF', warn: true });
      }
    }
    if (mode === 'council') {
      signs.push({ z: 90, side: -1, text: '4 LANES\nCLOSED', warn: true });
    }
    signs.push({ z: 140, side: 1, text: 'MORE REVENUE →', warn: false });
  }

  function maybeAddWearSign() {
    // One "PAVEMENT CONDITION: AT RISK" per run, the first time a lane goes bad.
    if (signCursor > 0) return;
    const bad = LANE_KEYS.some(k => state.laneWear[k] >= 70);
    if (!bad) return;
    signCursor = 1;
    signs.push({ z: playerZ + 300, side: -1, text: 'PAVEMENT CONDITION\nAT RISK', warn: true });
  }

  /* ---------------------------------------------------------------- */
  /* Lane movement (spec §9)                                           */
  /* ---------------------------------------------------------------- */

  function tryMove(dir) {
    if (!running || paused || ended || fall) return;
    if (meeting.active || meetingSummaryOpen || returnTransition || escape) return;
    const target = laneIndex + dir;
    if (target < 0 || target >= LANE_COUNT) return;

    const key = LANE_KEYS[target];

    if (!isLaneOpen(state, key)) {
      // The spec's §9 default is a fatal barrier collision. Ending the run for
      // *looking* at a closed lane punishes the exact curiosity the mode is
      // trying to provoke, so the car bounces off the barricade instead — the
      // lane stays unreachable, and the rejection is the joke.
      bounceOffBarrier(key, dir);
      return;
    }

    laneFrom = laneIndex;
    laneIndex = target;
    laneChangeStart = performance.now();
    audio.laneChange();
    hud.announce(`Lane: ${LANES[target].name}`);
  }

  /**
   * Barrier bounce (replaces the fatal §9 collision).
   *
   * The car lurches at the closed lane, is thrown back, and keeps driving. No
   * fiscal state changes and no lane change is committed.
   */
  function bounceOffBarrier(laneKey, dir) {
    const now = performance.now();
    // Ignore repeats while a bounce is already playing, so holding the key
    // does not stack shakes into an unreadable mess.
    if (now - lastBounceAt < BOUNCE_MS) return;
    lastBounceAt = now;

    bounce = { t: 0, dir };
    if (!reducedMotion()) shake = Math.max(shake, 14);
    audio.barrier();

    hud.banner(BARRIER_MESSAGE, 1800, 'reject');
    hud.announce(
      `${LANES[LANE_INDEX[laneKey]].name} is closed in Council Mode. ${BARRIER_MESSAGE}`
    );
  }

  function updateLaneAnimation(now) {
    const dur = LANE_CHANGE_MS *
      (campaign.distractionActive ? HO.laneChangeDelayFactor : 1);
    const t = (now - laneChangeStart) / dur;
    if (t >= 1) { laneOffset = 0; laneFrom = laneIndex; return; }
    const e = easeInOut(Math.max(t, 0));
    laneOffset = (laneFrom - laneIndex) * (1 - e);
  }

  /**
   * The camera sits over the lane the player is actually in.
   *
   * This deliberately tracks 1:1. Damping it (an earlier attempt to keep the
   * road framed) made the HUD and the view disagree: the lane strip would read
   * BORROW while the road still looked centred. With the current projection the
   * whole road stays on screen at full follow, so there is nothing to trade.
   */
  function cameraX() {
    let x = laneCenterOffset(laneIndex) + laneOffset * (2 / LANE_COUNT);

    // A quick lurch toward the barrier followed by a hard spring back. Peaks
    // early and decays, so it reads as being rejected rather than steered.
    if (bounce) {
      const p = bounce.t / BOUNCE_MS;
      const kick = Math.sin(p * Math.PI) * Math.exp(-p * 2.2);
      x += bounce.dir * kick * (1.15 / LANE_COUNT);
    }
    return x;
  }

  /* ---------------------------------------------------------------- */
  /* Decision gates (spec §13)                                         */
  /* ---------------------------------------------------------------- */

  function updateGates() {
    for (const item of plan) {
      if (item.kind !== 'gate') continue;
      const status = gateState.get(item) ?? 'pending';
      const dz = item.z - playerZ;

      // Announce the shock and apply its headline impact on approach.
      if (status === 'pending' && dz < 300) {
        gateState.set(item, 'announced');
        applyEventImpact(state, item.event);
        hud.banner(item.event.label);
        hud.announce(`Fiscal event: ${item.event.label}. Choose a lane.`);
        audio.gate();
      }

      // Commit whichever lane the player is in as they pass the gate plane.
      if (status !== 'committed' && dz <= GATE_COMMIT_WINDOW && dz > -60) {
        if (dz > -GATE_COMMIT_WINDOW) continue;   // not through it yet
        gateState.set(item, 'committed');
        commitAtGate(item);
      }
    }
  }

  function commitAtGate(gate) {
    const key = LANE_KEYS[laneIndex];

    if (isLaneFailed(state, key)) {
      // Driving a failed lane through a gate means no response is available;
      // the crater collision normally ends the run before this fires.
      hud.banner('LANE FAILED — NO RESPONSE');
      hud.announce(`${LANES[laneIndex].name} lane has failed. No response committed.`);
      return;
    }

    const result = commitResponse(state, gate.event, key);
    if (!result) return;

    const parts = [];
    if (result.current) parts.push(`GAP −$${result.current.toFixed(1)}M`);
    if (result.recurring) parts.push(`RECURRING −$${result.recurring.toFixed(1)}M/YR`);
    if (result.delayedRecurring) parts.push(`−$${result.delayedRecurring.toFixed(1)}M/YR NEXT YEAR`);
    if (result.debtService) parts.push(`DEBT SERVICE −$${result.debtService.toFixed(1)}M/YR`);
    if (result.effectiveness < 0.999) parts.push(`${Math.round(result.effectiveness * 100)}% EFFECTIVE`);

    hud.banner(`${LANES[laneIndex].name}: ${parts.join('  ·  ')}`, 2600);
    hud.announce(`${LANES[laneIndex].name} committed. ${parts.join('. ')}.`);
    maybeAddWearSign();
  }

  /* ---------------------------------------------------------------- */
  /* Mid-cycle shocks and labor contracts (Budget Cycle addendum)      */
  /* ---------------------------------------------------------------- */

  const cycleItems = new Set();

  /**
   * Fires shocks and labor renegotiations as the player reaches them. Both are
   * announcements rather than decisions: a shock widens the gap now, a labor
   * contract costs nothing now and everything next year.
   */
  function updateCycleEvents() {
    for (const item of plan) {
      if (item.kind !== 'shock' && item.kind !== 'labor') continue;
      if (cycleItems.has(item)) continue;
      if (item.z > playerZ) continue;
      cycleItems.add(item);

      if (item.kind === 'shock') {
        const r = applyShock(state, item.shock);
        audio.gate();
        hud.banner(
          `${item.shock.label}  GAP +$${item.shock.amount.toFixed(1)}M`, 2600, 'reject'
        );
        hud.announce(
          `${item.shock.label}. ${item.shock.detail}, plus ` +
          `$${item.shock.amount.toFixed(1)} million. Budget gap now ` +
          `$${r.gap.toFixed(1)} million.`
        );
      } else {
        const r = renegotiateLaborContract(state, item.contract);
        audio.gavel();
        hud.banner(
          `${item.contract.label}  NEXT YEAR: +$${r.gross.toFixed(1)}M/YR`, 3000
        );
        hud.announce(
          `${item.contract.label}. New compensation package approved. ` +
          `Next year plus $${r.gross.toFixed(1)} million per year. ` +
          'This year\u2019s budget gap is unchanged.'
        );
      }
    }
  }

  /* ---------------------------------------------------------------- */
  /* Bridges (spec §18)                                                */
  /* ---------------------------------------------------------------- */

  function updateBridges() {
    for (const item of plan) {
      if (item.kind !== 'bridge') continue;
      const dz = item.z - playerZ;

      // Resolve the structural test well before the deck, so the player can
      // see from a distance whether the span is there (spec §18.1, §18.4).
      if (dz < 420 && dz > 0 && announcedBridge < item.index) {
        announcedBridge = item.index;
        const intact = bridgeTest(state);
        currentBridge = {
          z0: item.z,
          z1: item.z + BRIDGE_SPAN,
          gapStart: item.z + BRIDGE_SPAN * GAP_START_FRACTION,
          intact, index: item.index, resolved: false
        };
        hud.announce(
          intact
            ? `Budget bridge ${item.index + 1}: budget gap closed. Bridge intact.`
            : `Budget bridge ${item.index + 1}: budget gap $${state.budget.currentGap.toFixed(1)} million still open. The bridge is out.`
        );
      }

      // Crossing.
      if (currentBridge && currentBridge.index === item.index && !currentBridge.resolved) {
        if (currentBridge.intact && playerZ > currentBridge.z1) {
          currentBridge.resolved = true;
          const n = crossBridge(state);
          // A new fiscal year restores the one-meeting allowance (§19).
          politics.specialMeetingUsedThisFiscalYear = false;
          speedMultiplier *= (1 + SPEED_STEP);
          audio.bridgeCross();
          audio.setRain(state.rainLevel);
          currentBridge = null;

          // How the new year's gap was built (Tightening addendum §5, §39).
          const reveal = state.budget.lastReveal;
          cycleHold = true;
          hud.showYearReveal(reveal, BUDGET_TUNING.revealMs, () => { cycleHold = false; });
          hud.announce(
            `Bridge ${n} crossed. Fiscal year ${state.fiscalYear} opens with a budget gap of ` +
            `$${reveal.gap.toFixed(1)} million. ` +
            reveal.lines.map(l =>
              `${l.label} ${l.amount < 0 ? 'minus' : 'plus'} $${Math.abs(l.amount).toFixed(1)} million`
            ).join('. ') + '.'
          );
        } else if (!currentBridge.intact) {
          // The gap begins partway across the span (spec §18.4).
          if (playerZ > currentBridge.gapStart) {
            currentBridge.resolved = true;
            startFall();
          }
        }
      }
    }
  }

  function startFall() {
    if (fall) return;
    fall = { t: 0 };
    audio.fall();
    hud.announce('The bridge is out. Driving off the fiscal cliff.');
  }

  /* ---------------------------------------------------------------- */
  /* Neighbor cars (spec §20)                                          */
  /* ---------------------------------------------------------------- */

  let nextNeighborZ = 260;

  function updateNeighbors(dt) {
    if (state.closedLanes.length > 0 && playerZ > nextNeighborZ) {
      nextNeighborZ = playerZ + trafficRng.range(320, 620);

      // Never two cars from the same city on screen at once, and never two in
      // the same lane — a duplicated label reads as a rendering bug.
      const onScreen = new Set(neighbors.map(c => c.id));
      const busyLanes = new Set(neighbors.map(c => c.lane));
      const available = CITIES.filter(c => !onScreen.has(c.id));

      if (available.length) {
        const city = available[Math.floor(trafficRng.next() * available.length)];
        // Only lanes the player cannot use — that contrast is the joke (§20.2).
        const pool = city.lanes.filter(
          k => state.closedLanes.includes(k) && !busyLanes.has(LANE_INDEX[k])
        );
        if (pool.length) {
          const key = pool[Math.floor(trafficRng.next() * pool.length)];
          neighbors.push({
            id: city.id,
            z: playerZ - trafficRng.range(30, 90),
            lane: LANE_INDEX[key],
            name: city.name,
            bodyColor: city.bodyColor,
            roofColor: city.roofColor,
            speed: speed * trafficRng.range(1.10, 1.22),
            announced: false,
            passed: false
          });
        }
      }
    }

    for (const car of neighbors) {
      car.z += car.speed * dt;
      if (!car.passed && car.z > playerZ + 12) {
        car.passed = true;
        audio.pass();
        hud.announce(`${car.name} passes in the closed ${LANES[car.lane].name} lane. The driver waves.`);
      }
    }
    // Neighbor cars never collide with the player (spec §20.3) — no test here.
    neighbors = neighbors.filter(c => c.z < playerZ + DRAW_DISTANCE * SEGMENT_LENGTH + 100);
  }

  /* ---------------------------------------------------------------- */
  /* Pickups (spec §17)                                                */
  /* ---------------------------------------------------------------- */

  function updatePickups() {
    for (const p of activePickups) {
      if (p.taken) continue;
      // A generous z-window: the pickup is optional flavour, and missing the
      // required rainy-day beat on a one-frame timing miss would be worse than
      // making it easy to take.
      if (Math.abs(p.z - playerZ) < 14 && p.lane === laneIndex) {
        p.taken = true;
        const r = collectOneTime(state, p.pickup);

        // Step 1: the reward lands first (Rainy-Day addendum §4, §22).
        // No modal — the joke has to be immediate and visual (spec §17.2).
        audio.pickup();
        hud.banner(
          r.amount > 0
            ? `${p.pickup.label}  GAP −$${r.amount.toFixed(1)}M`
            : `${p.pickup.label}  NO ONE-TIME CAPACITY LEFT`,
          2400
        );
        hud.announce(
          r.amount > 0
            ? `${p.pickup.label}: budget gap down ${r.amount.toFixed(1)} million this year only. ` +
              (r.capped ? 'One-time capacity for this year is now exhausted. ' : '') +
              'Next year opens from the recurring position.'
            : `${p.pickup.label}: no one-time capacity left this year.`
        );

        // Steps 2-5: a beat, then thunder, the message, and the rain.
        if (r.triggersRain) scheduleRainyDayStaging();
      }
    }
  }

  /**
   * The rainy-day beat (Rainy-Day addendum §4). Never starts the rain before
   * the fiscal reward has registered — short-term benefit first, consequence
   * second.
   */
  function scheduleRainyDayStaging() {
    setTimeout(() => {
      if (ended) return;
      lightning = { t: 0 };
      if (!reducedMotion()) shake = Math.max(shake, 10);
      audio.thunder();
      hud.banner(RAINY_DAY_MESSAGE, RAINY_DAY_STAGING.messageMs);
      const level = raiseRainLevel(state);
      audio.setRain(level);
      hud.announce(`${RAINY_DAY_MESSAGE} It starts raining.`);
    }, RAINY_DAY_STAGING.beatMs);
  }

  /* ---------------------------------------------------------------- */
  /* Roosevelt Avenue Easter Egg (Roosevelt addendum)                  */
  /* ---------------------------------------------------------------- */

  /**
   * Offers the one-option municipal prompt (Roosevelt addendum §4-§7). Only
   * during ordinary highway driving, never inside another modal scene, and
   * never more than once per run.
   */
  function updateRoosevelt() {
    if (roosevelt.promptOffered || roosevelt.active) return;
    if (meeting.active || meetingSummaryOpen || returnTransition) return;
    if (campaign.active || escape || fall || currentBridge) return;
    if (state.decisionsMade < RV.minDecisionsMade || playerZ < RV.minDistance) return;

    roosevelt.promptEligible = true;
    roosevelt.promptOffered = true;
    if (!DEBUG_FORCE_ROOSEVELT_PROMPT && rooseveltRoll >= RV.chancePerRun) return;

    roosevelt.active = true;
    roosevelt.promptSeen = true;
    paused = true;                    // a brief, safe interruption
    hud.announce('Pave Roosevelt Avenue? Only available response: Never.');
    rooseveltUi?.open(() => {
      roosevelt.neverSelected = true;
      roosevelt.active = false;
      paused = false;
      lastT = performance.now();
      hud.announce(PROMPT_CONFIRMATION);
      requestAnimationFrame(step);
      // No fiscal, sentiment, wear, score, or road change of any kind (§8).
    });
  }

  /* ---------------------------------------------------------------- */
  /* Higher Office Escape (Higher Office addendum)                     */
  /* ---------------------------------------------------------------- */

  /**
   * Eligibility (addendum §5). Deliberately gated on elapsed play and local
   * pressure, never on good fiscal performance — this is an escape hatch, not
   * a reward for balancing the budget.
   */
  function updateCampaignEligibility() {
    if (campaign.eligible || campaign.offered || mode !== 'council') return;
    if (meeting.active || meetingSummaryOpen) return;
    const underPressure =
      state.budget.currentGap > 0 ||
      LANE_KEYS.some(k => state.laneWear[k] >= 35);
    const played =
      state.decisionsMade >= HO.minDecisionsMade &&
      playerZ >= HO.minDistance &&
      state.bridgeNumber >= HO.minBridgesCrossed;
    if (played && underPressure) campaign.eligible = true;
  }

  /** Spawns the rare RUN FOR HIGHER OFFICE! pickup (addendum §4, §6, §20). */
  function maybeOfferCampaign() {
    if (!campaign.eligible || campaign.offered) return;
    // Political Profile materially improves the path to higher office
    // (Tightening addendum §25): the same actions that make the budget worse
    // make the career easier.
    const profileBoost = politics.politicalProfile >= HO.profileThreshold
      ? HO.profileMultiplier : 1;
    const chance = HO.chancePerRun * profileBoost;
    const wins = DEBUG_FORCE_HIGHER_OFFICE_EVENT || higherOfficeRoll < chance;
    campaign.offered = true;                 // at most one offer per run
    if (!wins) return;

    // Spawn in an open, unfailed lane, comfortably ahead so it is reachable
    // with normal lane-change timing (addendum §20).
    const lane = pickReachableLane();
    if (lane === -1) return;
    runPickup = { z: playerZ + 240, lane, taken: false, kind: 'run' };
  }

  function pickReachableLane() {
    const options = LANE_KEYS
      .map((k, i) => ({ k, i }))
      .filter(({ k }) => isLaneOpen(state, k) && !isLaneFailed(state, k));
    if (!options.length) return -1;
    // Prefer something within a couple of lane changes of the player.
    options.sort((a, b) => Math.abs(a.i - laneIndex) - Math.abs(b.i - laneIndex));
    return options[Math.min(1, options.length - 1)].i;
  }

  function updateCampaign(dt) {
    updateCampaignEligibility();
    maybeOfferCampaign();

    // RUN pickup.
    if (runPickup && !runPickup.taken) {
      if (Math.abs(runPickup.z - playerZ) < 14 && runPickup.lane === laneIndex) {
        runPickup.taken = true;
        campaign.active = true;
        campaign.distractionActive = true;
        campaign.windowRemaining = HO.campaignWindowSeconds;
        audio.fanfare();
        hud.banner(LABEL_RUN, 2000);
        hud.announce(`${LABEL_RUN} Campaign window open. No fiscal value changed.`);
      } else if (runPickup.z < playerZ - 30) {
        runPickup = null;                    // missed; no second offer (§11)
      }
    }

    if (!campaign.active) return;

    campaign.windowRemaining -= dt;

    // WIN pickup appears partway through the window (addendum §9).
    if (!campaign.winPickupSpawned &&
        campaign.windowRemaining <= HO.campaignWindowSeconds - HO.winPickupDelaySeconds) {
      campaign.winPickupSpawned = true;
      const lane = pickReachableLane();
      if (lane !== -1) {
        // Placed just far enough ahead to demand a deliberate lane move.
        winPickup = { z: playerZ + 150, lane, taken: false, kind: 'win' };
        hud.announce(`${LABEL_WIN} has appeared. Reach it before the campaign window closes.`);
      }
    }

    if (winPickup && !winPickup.taken &&
        Math.abs(winPickup.z - playerZ) < 16 && winPickup.lane === laneIndex) {
      winPickup.taken = true;
      campaign.winPickupCollected = true;
      startEscape();
      return;
    }

    // Window expired without the win: the run simply continues (addendum §11).
    if (campaign.windowRemaining <= 0) {
      campaign.active = false;
      campaign.distractionActive = false;
      campaign.resolved = true;
      winPickup = null;
      hud.banner(LABEL_CAMPAIGN_OVER, 1600);
      hud.announce('Campaign over. You are still driving the Berkeley budget.');
    }
  }

  /**
   * Begin the escape cinematic (addendum §12-§15). This is a terminal state
   * distinct from a bridge crossing, a crash, or a budget win — and it must not
   * repair any fiscal condition on the way out (addendum §17).
   */
  function startEscape() {
    if (escape || ended) return;
    campaign.active = false;
    campaign.resolved = true;
    audio.escape();
    escape = {
      t: 0,
      below: {
        rainLevel: state.rainLevel,
        budgetGap: state.budget.currentGap,
        laneWear: { ...state.laneWear }
      }
    };
    hud.announce(
      'You rise away from the Berkeley road. Below, the Berkeley Budget car keeps driving with no one in it.'
    );
  }

  function stepEscape(dt, now) {
    escape.t += dt;
    // The road HUD has no meaning once the player has left the road, and its
    // presence would read as a fiscal scoreboard on the escape (addendum §16).
    if (!escape.hudHidden) { escape.hudHidden = true; hud.setHidden(true); }
    renderer.clear();
    escapeRenderer.draw(escape.t, { rise: HO.riseSeconds }, escape.below, now);

    const total = HO.riseSeconds + HO.driverlessSeconds;
    if (escape.t >= total && !ended) {
      ended = true;
      running = false;
      audio.stopAll();
      onEnd({ type: 'higherOffice', summary: withPolitics(summarize(state)) });
    }
  }

  /* ---------------------------------------------------------------- */
  /* Special Meeting Pit Stop (Pit Stop addendum)                      */
  /* ---------------------------------------------------------------- */

  // The ramp leaves from the leftmost lane the player is actually allowed to
  // drive. Routing it through a Council-closed lane would make taking the exit
  // indistinguishable from a barrier crash.
  const MEETING_EXIT_WINDOW = 20;   // metres either side of the cutoff

  /**
   * Places 0-2 pit-stop exits per Council Mode run, biased toward moments of
   * pressure — shortly before a bridge, when the exit is most tempting
   * (addendum §3). Common Sense Mode does not offer them in release 1.
   */
  /**
   * The Special Meeting is now an on-demand player action rather than a random
   * roadside offramp (On-Demand addendum §1, §7, §8). Availability is a plain
   * eligibility check plus a once-per-fiscal-year cooldown — no probability,
   * no waiting for a spawn.
   */
  function canCallMeeting() {
    return mode === 'council'
      && running
      && !ended
      && !meeting.active
      && !meetingSummaryOpen
      && !returnTransition
      && !currentBridge
      && !escape
      && !fall
      && !roosevelt.active
      && !politics.specialMeetingUsedThisFiscalYear;
  }

  /** Presentation-only temptation cue; never affects availability (§22). */
  function meetingPressure() {
    const b = state.budget;
    const ratio = b.openingGap > 0 ? b.currentGap / b.openingGap : 0;
    return ratio > 0.65 ? 'high' : 'normal';
  }

  function callMeeting() {
    if (!canCallMeeting()) return;
    politics.specialMeetingUsedThisFiscalYear = true;
    politics.totalSpecialMeetingsCalled += 1;
    enterMeeting();
  }

  function enterMeeting() {
    beginMeeting(meeting, state, politics, { playerZ, laneIndex }, rng);
    audio.meetingEnter();
    hud.announce(
      'Special meeting begins. The car has stopped. Voter and activist sentiment are now shown. Fiscal state is frozen.'
    );
    hud.setDim(1);
    meetingUi?.open({
      onExtend: () => {
        if (!canExtend(meeting)) return;
        const step = extendMeeting(meeting, politics);
        audio.gavel();
        hud.announce(
          `Meeting extended. Activist sentiment ${step.activist > 0 ? 'up' : 'down'} ` +
          `${Math.abs(step.activist)}, voter sentiment down ${Math.abs(step.voter)}. ` +
          'No fiscal value changed.'
        );
      },
      onPander: () => {
        const step = pander(meeting, politics);
        if (!step) return;
        audio.applause(step.uses);
        meetingUi?.panderFeedback(step);
        hud.announce(
          step.activist > 0
            ? `Pandered. Activist sentiment up ${step.activist}, voter sentiment down ${Math.abs(step.voter)}. No fiscal value changed.`
            : `Pandered with no activist effect. Voter sentiment down ${Math.abs(step.voter)}.`
        );
        if (step.exhausted) hud.announce('Credibility exhausted. Pandering no longer works.');
      },
      onMega: () => {
        if (!canMegaPander(meeting, politics)) return;
        const proposal = pickProposal(rng);
        meetingUi?.askMegaPander(proposal, approved => {
          if (!approved) return;

          const r = approveMegaPander(meeting, politics, proposal);
          audio.cheer();
          hud.announce(
            `${proposal.label} approved at $${proposal.annualCost.toFixed(1)} million per year ` +
            `with no recurring funding identified. Activist sentiment up ${r.activist}, ` +
            `political profile up ${r.profile}.`
          );

          // Consent buys process, never a lower cost (addendum §27).
          meetingUi?.askConsent(onConsent => {
            const step = resolveConsent(meeting, politics, onConsent);
            addRecurringCommitment(state, {
              source: 'mega_pander',
              label: proposal.label,
              annualCost: proposal.annualCost,
              adoptedOnConsent: onConsent
            });
            if (onConsent) {
              audio.stamp();
              meetingUi?.showConsentStamp();
              hud.announce(
                'Approved without discussion. The annual cost is unchanged at ' +
                `$${proposal.annualCost.toFixed(1)} million per year.`
              );
            } else {
              hud.announce(
                'Approved after discussion. The annual cost is unchanged at ' +
                `$${proposal.annualCost.toFixed(1)} million per year.`
              );
            }
          });
        });
      },
      onEnd: () => { if (canEndMeeting(meeting)) concludeMeeting(); }
    });
  }

  function concludeMeeting() {
    if (meetingSummaryOpen) return;
    // The road must stay frozen while the summary card is up, otherwise the
    // car keeps driving behind it and the fiscal state moves after all.
    meetingSummaryOpen = true;
    const summary = endMeeting(meeting, politics);

    // Assert the isolation rule rather than trusting it (addendum §25).
    const moved = fiscalChanged(meeting.fiscalSnapshot, state);
    if (moved && typeof console !== 'undefined') {
      console.error('Pit stop violated fiscal isolation: fiscal state changed during the meeting.');
    }

    audio.gavel();

    // The gap the player walked in with — and, by construction, walks out with.
    summary.gapBefore = meeting.fiscalSnapshot?.currentGap ?? state.budget.currentGap;
    summary.addedPerYear = meeting.megaProposal ? meeting.megaProposal.annualCost : 0;

    meetingUi?.showSummary(summary, () => {
      meetingUi?.close();
      // The night disappears in a flame-to-black dissolve and the road returns
      // in the morning — same position, same rain, same budget
      // (Rainy-Day addendum §8-§13).
      // Keep the crowd on screen through Phase A; the panel fades with it.
      meetingUi?.reopenForDissolve?.();
      returnTransition = { ms: 0, endedMeeting: true };
      audio.whoosh();
      lastT = performance.now();
      requestAnimationFrame(step);
    });
  }

  /**
   * The return transition (Rainy-Day addendum §8-§11, §15). The road is still
   * frozen through the dissolve; only in the final fade-in does the car begin
   * moving again, so no fiscal-road distance is consumed by the meeting.
   */
  function stepReturnTransition(dt, now) {
    returnTransition.ms += dt * 1000;
    const phase = transitionPhaseAt(returnTransition.ms);

    // Once the screen is fully black, the night is over: swap to morning and
    // release the frozen meeting so the road draws beneath the fade-in.
    if (!returnTransition.morningSet &&
        (phase.name === 'black' || phase.name === 'fadeIn' || phase.name === 'done')) {
      returnTransition.morningSet = true;
      meetingSummaryOpen = false;
      meetingUi?.close();
      state.timeOfDay = 'morning';
      // Nothing else is restored because nothing was ever changed: position,
      // hazards, rain, wear, and the next bridge are exactly as they were.
      audio.morning();
      audio.setRain(state.rainLevel);
    }

    // During the fade-in the car is already moving again (§15).
    const driving = returnTransition.morningSet && phase.name === 'fadeIn';
    if (driving) {
      const ramp = 0.7 + 0.3 * phase.p;
      playerZ += BASE_SPEED * speedMultiplier * ramp * dt;
      state.distance = playerZ;
      hazards = pruneHazards(hazards, playerZ);
    }

    // The meeting HUD fades out through the dissolve and the road HUD fades
    // back in with the morning (Rainy-Day addendum §9 Phase A).
    const phaseFade = phase.name === 'compress' ? 1 - phase.p
      : phase.name === 'fadeIn' ? phase.p
      : phase.name === 'done' ? 1 : 0;
    hud.setDim(phaseFade);
    if (!returnTransition.morningSet) meetingUi?.setDim(phaseFade);

    if (returnTransition.morningSet) {
      drawRoadScene(now);
    } else {
      renderer.clear();
      meetingRenderer.draw(meeting, state, now, reducedMotion());
    }

    transitionRenderer.draw(returnTransition.ms, reducedMotion());

    if (returnTransition.ms >= TRANSITION_TOTAL) {
      returnTransition = null;
      returnProtectionMs = RETURN_PROTECTION_MS;
      hud.setDim(1);
      hud.banner('GOOD MORNING!', 1500);
      hud.announce(
        `Good morning. Budget gap $${state.budget.currentGap.toFixed(1)} million, unchanged. ` +
        (state.rainLevel > 0 ? 'It is still raining.' : 'Back on the same road.')
      );
      lastT = performance.now();
    }
  }

  function stepMeeting(dt, now) {
    const outcome = updateMeeting(meeting, dt);

    // A rare, uncontrollable meeting event (Bottle Episode addendum §11).
    const rage = maybeRageQuit(meeting, politics, trafficRng);
    if (rage) {
      audio.rageQuit();
      meetingUi?.showRageQuit();
      hud.announce(
        `${RAGE_QUIT_TEXT} ${RAGE_QUIT_SUBTEXT}. Voter sentiment down ${Math.abs(rage.voterDelta)}. Structural balance unchanged.`
      );
    }

    meetingUi?.update(meeting, state, {
      canEnd: canEndMeeting(meeting),
      canExtend: canExtend(meeting),
      canPander: canPander(meeting),
      canMega: canMegaPander(meeting, politics),
      politicalProfile: politics.politicalProfile
    });
    if (outcome !== 'running') { concludeMeeting(); return; }

    renderer.clear();
    meetingRenderer.draw(meeting, state, now, reducedMotion());
    hud.update(state, laneIndex);
  }

  /* ---------------------------------------------------------------- */
  /* Crash / end states                                                */
  /* ---------------------------------------------------------------- */

  /**
   * Pit-stop metrics for the run summary (Pit Stop addendum §20). Structural
   * progress from meetings is always zero by construction, and is reported as
   * a fiscal statement rather than a claim that nothing political happened.
   */
  function withPolitics(summary) {
    return {
      ...summary,
      politics: {
        specialMeetings: politics.specialMeetings,
        meetingMinutes: Math.round(politics.meetingMinutes),
        extensions: politics.extensions,
        panderUses: politics.panderUses,
        credibilityExhausted: politics.credibilityExhausted,
        rageQuits: politics.rageQuits,
        politicalProfile: Math.round(politics.politicalProfile),
        megaPandersApproved: politics.megaPandersApproved,
        voterSentiment: Math.round(politics.voterSentiment),
        activistSentiment: Math.round(politics.activistSentiment),
        structuralChangeFromMeetings: 0
      }
    };
  }

  function crash(info) {
    if (ended || fall) return;
    ended = true;
    running = false;
    shake = 18;
    audio.pothole();
    audio.stopAll();
    const s = withPolitics(summarize(state));
    // Closed lanes now bounce the car rather than ending the run, so a crash
    // is always a pothole.
    hud.announce(`Pothole crash in the ${LANES[info.laneIndex].name} lane. Run over.`);
    setTimeout(() => onEnd({ type: 'crash', ...info, summary: s }), 700);
  }

  function finishCampaign() {
    if (ended) return;
    ended = true;
    running = false;
    audio.stopAll();
    onEnd({ type: 'complete', summary: withPolitics(summarize(state)) });
  }

  function finishFall() {
    if (ended) return;
    ended = true;
    running = false;
    audio.stopAll();
    onEnd({ type: 'cliff', summary: withPolitics(summarize(state)) });
  }

  /* ---------------------------------------------------------------- */
  /* Main loop                                                         */
  /* ---------------------------------------------------------------- */

  function step(now) {
    if (!running && !fall) return;
    const dt = Math.min((now - lastT) / 1000, 1 / 20);
    lastT = now;

    if (!paused) {
      // While the meeting runs, the road is frozen: playerZ does not advance
      // and no road system updates (addendum §5).
      if (escape) {
        stepEscape(dt, now);
        if (!ended) requestAnimationFrame(step);
        return;
      }

      if (returnTransition) {
        stepReturnTransition(dt, now);
        requestAnimationFrame(step);
        return;
      }

      if (meeting.active || meetingSummaryOpen) {
        if (meeting.active) stepMeeting(dt, now);
        requestAnimationFrame(step);
        return;
      }

      if (returnProtectionMs > 0) returnProtectionMs -= dt * 1000;

      // The opening briefing pauses the cycle rather than scrolling past it.
      if (cycleHold) { draw(now); requestAnimationFrame(step); return; }

      if (fall) {
        fall.t += dt;
        playerZ += speed * dt * 0.5;
        if (fall.t > 1.6) { finishFall(); return; }
      } else {
        speed = BASE_SPEED * speedMultiplier;
        playerZ += speed * dt;
        state.distance = playerZ;
        state.speed = speed;

        updateLaneAnimation(now);
        updateGates();
        updateCycleEvents();
        updateBridges();
        updateCampaign(dt);
        updateRoosevelt();
        updatePickups();
        updateNeighbors(dt);

        hazardCursor = updateHazards(
          hazards, state, hazardRng, playerZ, Math.max(hazardCursor, playerZ),
          { suppressFatal: returnProtectionMs > 0 });
        ensureFailedLaneCraters(hazards, state, playerZ);
        hazards = pruneHazards(hazards, playerZ);

        const hit = checkHazardCollision(hazards, playerZ, laneIndex, laneOffset);
        if (hit && hit.fatal) {
          crash({ reason: 'pothole', laneIndex, laneKey: LANE_KEYS[laneIndex] });
        } else if (hit) {
          shake = 8;
          audio.pothole();
        }

        // Campaign completion (spec §25).
        const finish = plan.find(p => p.kind === 'finish');
        if (finish && playerZ > finish.z && state.bridgeNumber >= CAMPAIGN_BRIDGES) {
          finishCampaign();
          return;
        }
      }

      if (lightning) {
        lightning.t += dt * 1000;
        if (lightning.t > RAINY_DAY_STAGING.flashMs) lightning = null;
      }

      if (bounce) {
        bounce.t += dt * 1000;
        if (bounce.t > BOUNCE_MS) bounce = null;
      }

      shake *= 0.88;
      state.score = computeScore(state);
    }

    draw(now);
    requestAnimationFrame(step);
  }

  /** Renders the road scene only; the HUD is updated separately. */
  function drawRoadScene(now) {
    const r = renderer;
    const camX = cameraX();
    const jolt = reducedMotion() ? 0 : shake;
    const pitch = fall ? Math.min(fall.t / 1.6, 1) : 0;

    r.clear();
    r.ctx.save();
    if (jolt) r.ctx.translate((Math.random() - 0.5) * jolt, (Math.random() - 0.5) * jolt);
    // Falling pitches the camera down: road and sky rise in frame (§18.4).
    if (pitch) r.ctx.translate(0, pitch * r.view.height * 0.75);

    r.drawSky(state.rainLevel, now, state.timeOfDay);

    // deck   — the span the road runs across (rendered as bridge pavement)
    // canyon  — the void beneath, extending past the deck at both ends
    // gap     — the missing section, present only on a failed bridge
    let deck = null, canyon = null, gap = null;
    if (currentBridge) {
      const { z0, z1, intact } = currentBridge;
      deck = [z0, z1];
      canyon = intact
        ? [z0 - CANYON_OVERHANG, z1 + CANYON_OVERHANG]
        : [z0 - CANYON_OVERHANG, z1 + CANYON_OVERHANG * 4];
      // The gap runs from the torn edge all the way to the draw horizon, so no
      // road is painted beyond it. Rendering the far abutment made the span
      // look continuous, which is why a broken bridge did not read as broken.
      if (!intact) gap = [currentBridge.gapStart, Infinity];
    }

    r.drawRoad(state, playerZ, camX, gap, deck, canyon);
    if (currentBridge) r.drawBridge(playerZ, camX, currentBridge);
    r.drawBarriers(state, playerZ, camX);

    // Farthest first; only signs within the draw distance, so distant bridge
    // signage does not pile up at the horizon.
    const visibleSigns = signs
      .filter(sg => sg.z > playerZ && sg.z - playerZ < DRAW_DISTANCE * SEGMENT_LENGTH)
      .sort((a, b) => b.z - a.z);
    for (const sg of visibleSigns) r.drawRoadsideSign(sg, playerZ, camX);
    r.drawHazards(hazards, playerZ, camX,
      campaign.distractionActive ? HO.hazardVisibilityFactor : 1);
    for (const p of activePickups) if (!p.taken) r.drawPickup(p, playerZ, camX, now);

    // Farthest first so nearer cars overdraw.
    for (const c of [...neighbors].sort((a, b) => b.z - a.z)) {
      r.drawNeighborCar(c, playerZ, camX, now);
    }

    // Only the next uncommitted gate is drawn: several gantries at the horizon
    // overlap into unreadable text, and only the nearest one is actionable.
    const nextGate = plan.find(
      it => it.kind === 'gate' && gateState.get(it) !== 'committed' && it.z > playerZ
    );
    if (nextGate) r.drawGantry(playerZ, camX, nextGate, state);

    for (const pk of [runPickup, winPickup]) {
      if (pk && !pk.taken) r.drawOfficePickup(playerZ, camX, pk, now);
    }

    r.drawRain(state.rainLevel, now, reducedMotion());
    r.ctx.restore();

    if (!fall) {
      const bounceTilt = bounce
        ? bounce.dir * Math.sin((bounce.t / BOUNCE_MS) * Math.PI) * 0.5
        : 0;
      r.drawHood(jolt * 0.4, laneOffset + bounceTilt);
    }

    // Lightning flash accompanying the thunderclap. Kept for reduced-motion
    // users too — only the thunder shake is dropped (Rainy-Day addendum §23).
    if (lightning) {
      const f = 1 - lightning.t / RAINY_DAY_STAGING.flashMs;
      const strobe = f * (0.55 + 0.45 * Math.sin(lightning.t * 0.06));
      r.ctx.fillStyle = `rgba(226, 238, 255, ${Math.max(0, strobe) * 0.8})`;
      r.ctx.fillRect(0, 0, r.view.width, r.view.height);
    }

  }

  function draw(now) {
    drawRoadScene(now);
    hud.setCallMeeting({
      show: mode === 'council',
      enabled: canCallMeeting(),
      pressure: meetingPressure()
    });

    const nextBridge = plan.find(it => it.kind === 'bridge' && it.z > playerZ);
    hud.update(
      state, laneIndex,
      campaign.active ? LABEL_CANDIDATE : null,
      nextBridge ? nextBridge.z - playerZ : null
    );
  }

  /* ---------------------------------------------------------------- */

  return {
    state,
    renderer,
    /**
     * Renders one static frame of the starting road. The scoreboard sits over
     * this, so when its labels fly out they land on a visible road rather than
     * an empty canvas.
     */
    preview() {
      renderer.resize();
      drawRoadScene(performance.now());
      hud.update(state, laneIndex, null, null);
    },

    start() {
      renderer.resize();
      running = true;
      lastT = performance.now();

      // The opening forecast frames the whole cycle: here is the hole, the
      // bridge is the deadline (Budget Cycle addendum §4).
      const opening = buildOpeningForecast(state);
      // Nothing may fire while the briefing is up: the player is meant to read
      // the starting gap before anything complicates it (addendum §6).
      cycleHold = true;
      hud.showYearReveal(opening, BUDGET_TUNING.revealMs, () => { cycleHold = false; });
      hud.announce(
        mode === 'council'
          ? 'Council Mode. Fees, Taxes and Borrow are open. Four lanes are closed.'
          : 'Common Sense Mode. All seven lanes are open.'
      );
      requestAnimationFrame(step);
    },
    left: () => tryMove(-1),
    right: () => tryMove(1),
    togglePause() {
      if (ended) return paused;
      paused = !paused;
      if (!paused) { lastT = performance.now(); requestAnimationFrame(step); }
      hud.announce(paused ? 'Paused.' : 'Resumed.');
      return paused;
    },
    get paused() { return paused; },
    resize: () => renderer.resize(),
    get politics() { return politics; },
    // Exposed for tests and tuning; the pit stop is otherwise driven entirely
    // by the road position.
    laneRepeatMs: LANE_REPEAT_MS,
    callMeeting,
    get canCallMeeting() { return canCallMeeting(); },
    get meetingPressure() { return meetingPressure(); },
    // Exposed for tests only; reading these does not affect play.
    get events() { return EVENTS; },
    get laneKeys() { return LANE_KEYS; },

    /**
     * Screen positions of each lane at a readable middle distance, used by the
     * start scoreboard to fly its labels onto the road they name.
     */
    laneScreenPositions() {
      const camX = cameraX();
      // ~40 m ahead: far enough to still read as road, near enough that each
      // lane is wide enough for its label to sit inside without overlapping.
      const p = renderer.projectRoad(40, camX);
      return LANE_KEYS.map((_, i) => ({
        x: renderer.laneScreenX(p, laneCenterOffset(i)),
        y: p.y - p.scale * 1.0
      }));
    },

    get campaign() { return campaign; },
    get roosevelt() { return roosevelt; },
    // Exposed for tests: the two Higher Office pickups currently on the road.
    get officePickups() { return { run: runPickup, win: winPickup }; },
    get playerZ() { return playerZ; },
    get escaping() { return !!escape; },
    get meetingActive() { return meeting.active; },
    destroy() { running = false; ended = true; audio.stopAll(); }
  };
}

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}
