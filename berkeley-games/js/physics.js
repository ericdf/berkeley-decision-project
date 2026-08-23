// Road model, projection, and hazard generation (spec §36, §37).
// The road is a flat pseudo-3D ribbon of fixed-length segments. Objects live at
// a world Z (metres from the start) and a lane index.

import { LANE_COUNT, LANE_KEYS } from './content/lanes.js';
import { potholeChance } from './state.js';

export const SEGMENT_LENGTH = 8;        // metres per segment
export const DRAW_DISTANCE = 90;        // segments rendered ahead
// All road geometry is in metres so the projection is a plain pinhole camera.
export const ROAD_HALF_WIDTH = 17.5;    // metres from centreline to shoulder (7 x 5 m lanes)
// A literal 1.5 m eye height crushes the whole road into a few pixels under
// the horizon. This is a raised "arcade" camera: high enough that a bridge
// span reads as real screen area rather than a sliver at the vanishing point.
export const CAMERA_HEIGHT = 6;
export const CAMERA_DEPTH = 0.9;        // focal length as a fraction of view width


/** World x-offset of a lane centre, in road-half-width units [-1, 1]. */
export function laneCenterOffset(laneIndex) {
  return (laneIndex - (LANE_COUNT - 1) / 2) * (2 / LANE_COUNT);
}

/* ------------------------------------------------------------------ */
/* Road course generation                                              */
/* ------------------------------------------------------------------ */

/**
 * Builds the course plan for a run: the ordered sequence of decision gates,
 * bridges, and one-time pickups. Deterministic given the rng, and identical
 * across modes launched from the same seed (spec §8.3, §27).
 */
export function buildCourse(rng, events, pickups, opts = {}) {
  const {
    bridges = 6, shocks = [], laborContracts = [], cycle = null, speed = 36
  } = opts;

  const plan = [];
  let z = 220;                          // lead-in before the first decision
  let eventIdx = 0;
  const eventOrder = shuffleDeterministic(events, rng);
  let pickupIdx = 0;
  const shockOrder = shuffleDeterministic(shocks, rng);
  let shockIdx = 0;
  let contractIdx = 0;

  // The opening stretch of each cycle stays quiet so the player can read the
  // gap and find the bridge before anything complicates it (§6).
  const quietMetres = (cycle?.quietSecondsAfterOpening ?? 12) * speed;

  for (let b = 0; b < bridges; b++) {
    const cycleStart = z;
    const choices = rng.int(3, 5);      // spec §19

    for (let c = 0; c < choices; c++) {
      const event = eventOrder[eventIdx % eventOrder.length];
      eventIdx++;
      plan.push({ kind: 'gate', z, event, bridgeIndex: b });
      z += rng.range(340, 460);

      // One-time pickups appear between gates (spec §17). The rainy-day beat is
      // a required moment (§43 Beat 4), so the first one lands inside the
      // opening budget period rather than several bridges in, where most runs
      // would never reach it.
      if (pickupIdx < pickups.length && c === 1) {
        plan.push({ kind: 'pickup', z: z - rng.range(150, 220), pickup: pickups[pickupIdx] });
        pickupIdx++;
      }
    }

    const cycleEnd = z;
    // 2-3 genuine shocks per cycle, never in the opening quiet period and
    // never crowding the bridge (§7, §27).
    const shockWindowStart = cycleStart + quietMetres;
    const shockWindowEnd = cycleEnd - 120;
    if (shocks.length && shockWindowEnd > shockWindowStart) {
      const n = rng.int(cycle?.minShocksPerYear ?? 2, cycle?.maxShocksPerYear ?? 3);
      for (let k = 0; k < n; k++) {
        const f = (k + 0.5) / n;
        const jitter = rng.range(-0.12, 0.12);
        const sz = shockWindowStart +
          (shockWindowEnd - shockWindowStart) * Math.min(0.95, Math.max(0.05, f + jitter));
        plan.push({
          kind: 'shock', z: sz, bridgeIndex: b,
          shock: shockOrder[shockIdx++ % shockOrder.length]
        });
      }
    }

    // At most one labor renegotiation per cycle, and not every cycle (§13).
    if (laborContracts.length && rng.next() < (cycle?.laborContractChance ?? 0.55)) {
      const lz = cycleStart + quietMetres +
        (cycleEnd - cycleStart - quietMetres) * rng.range(0.45, 0.85);
      plan.push({
        kind: 'labor', z: lz, bridgeIndex: b,
        contract: laborContracts[contractIdx++ % laborContracts.length]
      });
    }

    plan.push({ kind: 'bridge', z, index: b });
    z += 400;                           // bridge span + landing
  }

  plan.push({ kind: 'finish', z });
  plan.sort((a, b) => a.z - b.z);
  return { plan, totalZ: z };
}

function shuffleDeterministic(arr, rng) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Hazards                                                             */
/* ------------------------------------------------------------------ */

const HAZARD_SPACING = 34;   // metres between hazard opportunities
const MIN_SPAWN_LEAD = 220;  // never spawn closer than this ahead of the player

/**
 * Wear-driven pothole spawning (spec §14.1, §37). Called each frame; spawns at
 * fixed z-intervals well ahead of the player so a hit is always avoidable.
 */
export function updateHazards(hazards, state, rng, playerZ, spawnCursor, options = {}) {
  // Fairness window after a scene transition, while the player cannot steer
  // (Rainy-Day and Return addendum §16).
  const noFatal = options.suppressFatal === true;
  let cursor = spawnCursor;
  const horizon = playerZ + MIN_SPAWN_LEAD + DRAW_DISTANCE * SEGMENT_LENGTH;

  while (cursor < horizon) {
    cursor += HAZARD_SPACING;
    for (let i = 0; i < LANE_COUNT; i++) {
      const key = LANE_KEYS[i];
      const wear = state.laneWear[key];
      const chance = potholeChance(wear);
      if (chance <= 0) continue;
      if (!rng.chance(Math.min(chance, 0.85))) continue;

      // Size and lethality scale with wear (spec §14). Only *large* potholes
      // are fatal, so a merely worn lane (35-69%) rattles the player rather
      // than ending the run — the escalation has to be felt to teach anything.
      const failed = wear >= 100;
      const size = failed ? 1 : wear >= 70 ? 0.8 : wear >= 35 ? 0.5 : 0.35;
      const fatal = wear >= 70 && !noFatal;
      hazards.push({
        z: cursor + rng.range(-8, 8),
        lane: i,
        size: noFatal ? Math.min(size, 0.5) : size,
        fatal,
        hit: false
      });
    }
  }
  return cursor;
}

/**
 * A failed lane (wear 100) gets an unmistakable continuous crater field so it
 * reads as blocked rather than merely rough (spec §14, §37).
 */
export function ensureFailedLaneCraters(hazards, state, playerZ) {
  for (let i = 0; i < LANE_COUNT; i++) {
    if (state.laneWear[LANE_KEYS[i]] < 100) continue;
    const start = Math.ceil((playerZ + MIN_SPAWN_LEAD) / 26) * 26;
    for (let z = start; z < playerZ + 900; z += 26) {
      if (!hazards.some(h => h.lane === i && Math.abs(h.z - z) < 20)) {
        hazards.push({ z, lane: i, size: 1, fatal: true, hit: false, crater: true });
      }
    }
  }
}

export function pruneHazards(hazards, playerZ) {
  return hazards.filter(h => h.z > playerZ - 40);
}

/** Collision test: player occupies its lane with a small forward footprint. */
export function checkHazardCollision(hazards, playerZ, playerLane, laneOffset) {
  // Mid-lane-change, the car straddles: only a fully-entered lane can hit.
  if (Math.abs(laneOffset) > 0.35) return null;
  for (const h of hazards) {
    if (h.hit || h.lane !== playerLane) continue;
    if (h.z > playerZ - 6 && h.z < playerZ + 6) {
      h.hit = true;
      return h;
    }
  }
  return null;
}
