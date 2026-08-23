// City tour: the drive through the city the budget created (Reboot spec
// §38-§48, §71-§73, §76-§82).
//
// No fiscal decisions happen here. Events queue cost against the NEXT budget;
// the adopted one never reopens (§47, §103).

import { LANDMARKS, PRIORITIZE_SIGNS, PROGRAM_LABELS } from './content/city.js';
import { TOUR, TOUR_EVENTS } from './content/cycle.js';
import { queueNextYearPressure } from './state.js';
import { ROOSEVELT } from './content/endgame.js';

const LANE_LIMIT = 0.72;      // how far off-centre the car may steer
const STEER_SPEED = 1.5;      // road-widths per second

export function createTour({ state, rng, renderer, audio, hud, ui, onFinish }) {
  const routeLength = TOUR.secondsPerYear * TOUR.metresPerSecond;

  const tour = {
    distance: 0,
    routeLength,
    camX: 0,
    steer: 0,
    shake: 0,
    hazards: [],
    flags: state.tourFlags,
    prioritizeSign: PRIORITIZE_SIGNS[Math.floor(rng.next() * PRIORITIZE_SIGNS.length)],
    programLabel: PROGRAM_LABELS[Math.floor(rng.next() * PROGRAM_LABELS.length)],
    timeOfDay: 'day',
    reducedMotion: false
  };

  let running = false;
  let lastT = 0;
  let rafId = 0;
  const fired = new Set();

  /* ---------------- route contents ---------------- */

  // Potholes scale with how badly streets were funded (§41, §80).
  function seedHazards() {
    const streets = state.city.streets;
    const density = streets >= 3 ? 0.05 : streets === 2 ? 0.2 : streets === 1 ? 0.45 : 0.7;
    for (let z = 140; z < routeLength; z += 26) {
      if (!rng.chance(density)) continue;
      tour.hazards.push({
        z: z + rng.range(-8, 8),
        x: rng.range(-0.75, 0.75),
        size: 0.6 + rng.next() * (streets <= 1 ? 0.8 : 0.4),
        hit: false
      });
    }
  }

  // 1-3 future-pressure cards per tour (§48, §77).
  const events = [];
  function seedEvents() {
    const [lo, hi] = TOUR.eventsPerTour;
    const n = rng.int(lo, hi);
    const pool = [...TOUR_EVENTS];
    for (let i = 0; i < n && pool.length; i++) {
      const pick = pool.splice(Math.floor(rng.next() * pool.length), 1)[0];
      events.push({ at: routeLength * (0.25 + 0.55 * (i / Math.max(1, n - 1 || 1))), event: pick });
    }
  }

  // The Higher Office escape moved out of Budget Quest into its own episode,
  // GET TO SACRAMENTO OR DIE TRYIN' (Sacramento spec §2).

  // Rare municipal prompt (§73).
  let rooseveltAt = null;
  function seedRoosevelt() {
    if (state.easterEggs.rooseveltPromptSeen) return;
    if (!rng.chance(ROOSEVELT.chancePerTour)) return;
    rooseveltAt = routeLength * 0.44;
  }

  /* ---------------- loop ---------------- */

  function step(now) {
    if (!running) return;
    const dt = Math.min((now - lastT) / 1000, 1 / 20);
    lastT = now;

    tour.distance += TOUR.metresPerSecond * dt;
    tour.camX += tour.steer * STEER_SPEED * dt;
    tour.camX = Math.max(-LANE_LIMIT, Math.min(LANE_LIMIT, tour.camX));
    tour.shake *= 0.86;

    checkHazards();
    checkEvents();

    renderer.draw(state, tour, now);
    ui.updateProgress(tour.distance / routeLength);

    if (tour.distance >= routeLength) { finish(); return; }
    rafId = requestAnimationFrame(step);
  }

  function checkHazards() {
    for (const h of tour.hazards) {
      if (h.hit) continue;
      if (Math.abs(h.z - tour.distance) < 6 && Math.abs(h.x - tour.camX) < 0.16) {
        h.hit = true;
        // A pothole is a jolt, never a run-ender: the fiscal game is the game.
        tour.shake = 14 * h.size;
        audio.pothole?.();
      }
    }
  }

  function checkEvents() {
    for (const e of events) {
      if (fired.has(e) || tour.distance < e.at) continue;
      fired.add(e);
      const ev = e.event;
      queueNextYearPressure(state, {
        label: ev.label === 'LABOR CONTRACT RENEGOTIATED' ? 'Prior labor contract' : ev.label,
        amount: ev.nextYear,
        recurring: ev.recurring,
        labor: ev.labor === true
      });
      audio.gate?.();
      ui.showEventCard(ev);
      hud.announce(
        `${ev.label}. ${ev.detail}. Next budget plus ` +
        `$${ev.nextYear.toFixed(1)} million${ev.recurring ? ' per year' : ''}. ` +
        'This budget is already adopted and does not reopen.'
      );
    }

    if (rooseveltAt !== null && tour.distance >= rooseveltAt) {
      rooseveltAt = null;
      state.easterEggs.rooseveltPromptSeen = true;
      pause();
      ui.showRoosevelt(() => { resume(); });
    }
  }

  function finish() {
    running = false;
    cancelAnimationFrame(rafId);
    onFinish();
  }

  function pause() { running = false; cancelAnimationFrame(rafId); }
  function resume() {
    if (running) return;
    running = true;
    lastT = performance.now();
    rafId = requestAnimationFrame(step);
  }

  /* ---------------- api ---------------- */

  seedHazards();
  seedEvents();
  seedRoosevelt();

  return {
    tour,
    setSteer(v) { tour.steer = v; },
    setReducedMotion(v) { tour.reducedMotion = v; },
    start() {
      renderer.resize();
      running = true;
      lastT = performance.now();
      rafId = requestAnimationFrame(step);
    },
    pause,
    resume,
    stop() { running = false; cancelAnimationFrame(rafId); }
  };
}

export { LANDMARKS };
