// Budget Quest — wave controller (v3.2).
//
// Missiles travel slow ballistic arcs (§15-§18). Speed is deliberately gentle:
// difficulty comes from fiscal choices, not twitch. The wave can be paused at
// any time with no penalty, and every major action freezes it (§21).
//
// The year opens with a short arming window in which two shields go directly
// onto the bases. There is no separate Protect screen.

import { landMissile, deficitRemaining } from './board-state.js';

export const WAVE_SECONDS = 60;
export const ARMING_SECONDS = 7;

const timeScale = () => (window.__BBD_TEST__?.waveScale) || 1;

export function createWave({ state, rng, onLand, onTick, onArmed, onComplete }) {
  let raf = 0;
  let last = 0;
  let elapsed = 0;
  let armingLeft = ARMING_SECONDS;
  let arming = true;
  let paused = false;
  let frozen = false;      // §21: action resolution holds everything still
  let reduced = false;
  let running = false;

  const rand = () => (rng ? rng() : Math.random());

  /**
   * §16/§17: vary launch x, arc height, curvature and entry angle so paths
   * cross without becoming unreadable. Missiles are released in a staggered
   * stream rather than all at once.
   */
  function layout() {
    const live = state.missiles;
    live.forEach((m, i) => {
      m.t = 0;
      if (m.originX === undefined || m.originX === 0) {
        m.originX = 0.04 + rand() * 0.92;
      }
      // Bow the path away from a straight line, in either direction.
      m.arc = (rand() - 0.5) * 1.6;
      m.arcHeight = rand();
      // §43: the sky should read as "there are thirty missiles", so the
      // whole salvo is airborne early rather than trickling out across the
      // year. Entry is spread over the first fifth of the wave only.
      if (!m.releaseAt) {
        m.releaseAt = (i / Math.max(1, live.length)) * WAVE_SECONDS * 0.18;
      }
      // Slight per-missile speed variation keeps the stream from marching in
      // lockstep, while §18 keeps the whole flight deliberately slow.
      m.travel = WAVE_SECONDS * (0.42 + rand() * 0.16);
    });
  }

  function step(now) {
    if (!running) return;
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
    last = now;
    const scaled = dt * timeScale();
    const held = paused || frozen;

    if (!held) {
      if (arming) {
        armingLeft -= scaled;
        if (armingLeft <= 0) { arming = false; armingLeft = 0; onArmed?.(); }
      } else {
        elapsed += scaled;
      }
    }

    if (!arming && !held) {
      for (const m of state.missiles) {
        if (m.resolved || m.landed) continue;
        const since = elapsed - m.releaseAt;
        if (since <= 0) { m.t = 0; continue; }
        const f = Math.min(1, since / m.travel);
        m.t = reduced ? Math.floor(f * 12) / 12 : f;
        if (f >= 1) {
          const rec = landMissile(state, m);
          if (rec) onLand?.(m, rec);
        }
      }
    }

    onTick?.({
      arming,
      armingLeft: Math.max(0, armingLeft),
      fraction: Math.min(1, elapsed / WAVE_SECONDS),
      remaining: deficitRemaining(state)
    });

    if (!arming && !held && state.missiles.every(m => m.resolved || m.landed)) {
      running = false;
      onComplete?.();
      return;
    }
    raf = requestAnimationFrame(step);
  }

  return {
    /** @param skipArming true when the sky is already clear */
    start(skipArming = false) {
      layout();
      elapsed = 0;
      last = 0;
      armingLeft = skipArming ? 0 : ARMING_SECONDS;
      arming = !skipArming;
      paused = false;
      frozen = false;
      running = true;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(step);
    },

    /** Give newly launched missiles a path without disturbing those in flight. */
    relayout() { layout(); },

    stop() { running = false; cancelAnimationFrame(raf); },
    armNow() { if (arming) { arming = false; armingLeft = 0; onArmed?.(); } },

    /** §21: action resolution freezes motion immediately. */
    setFrozen(v) { frozen = v; if (!v) last = 0; },
    get frozen() { return frozen; },

    setPaused(v) { paused = v; if (!v) last = 0; },
    get paused() { return paused; },
    togglePause() { paused = !paused; if (!paused) last = 0; return paused; },
    setReducedMotion(v) { reduced = v; },

    finishNow() {
      arming = false;
      frozen = false;
      for (const m of state.missiles) {
        if (m.resolved || m.landed) continue;
        const rec = landMissile(state, m);
        if (rec) onLand?.(m, rec);
      }
      running = false;
      onComplete?.();
    },

    get arming() { return arming; },
    get running() { return running; }
  };
}
