// Special Meeting return transition (Rainy-Day and Return addendum §8-§11).
//
// flames → full-screen orange → black → morning. The dissolve uses the drum
// fire as its visual source; the car never catches fire.

export const TRANSITION_PHASES = {
  compress: 800,     // A: crowd/signs press in, flames strengthen
  flare: 700,        // B: one drum flame flares across the screen
  orange: 240,       // C: hold full-screen warm orange
  fadeBlack: 460,    // D: orange fades to black
  black: 600,        // E: hold black — the night disappears here
  fadeIn: 700        // morning fades up
};

export const TRANSITION_TOTAL =
  Object.values(TRANSITION_PHASES).reduce((a, b) => a + b, 0);

/** Which phase a given elapsed time falls in, plus progress within it. */
export function transitionPhaseAt(ms) {
  let acc = 0;
  for (const [name, dur] of Object.entries(TRANSITION_PHASES)) {
    if (ms < acc + dur) return { name, p: (ms - acc) / dur, elapsed: ms };
    acc += dur;
  }
  return { name: 'done', p: 1, elapsed: ms };
}

export function createTransitionRenderer(ctx, view) {
  return {
    /**
     * Draws the dissolve overlay on top of whatever scene was already rendered.
     * @returns {boolean} true while the underlying scene should still be the
     *          meeting; false once the road should be drawn beneath instead.
     */
    draw(ms, reducedMotion) {
      const W = view.width, H = view.height;
      const { name, p } = transitionPhaseAt(ms);

      switch (name) {
        case 'compress': {
          // Warm light builds as the drums flare up.
          ctx.fillStyle = `rgba(255, 140, 40, ${p * 0.28})`;
          ctx.fillRect(0, 0, W, H);
          return true;
        }
        case 'flare': {
          // One flame expands from a drum to fill the frame. Reduced motion
          // gets a flat warm wash instead of the expanding shape (§23).
          if (reducedMotion) {
            ctx.fillStyle = `rgba(255, 150, 50, ${0.28 + p * 0.72})`;
            ctx.fillRect(0, 0, W, H);
          } else {
            ctx.fillStyle = 'rgba(255, 140, 40, 0.28)';
            ctx.fillRect(0, 0, W, H);
            const cx = W * 0.22, cy = H * 0.62;
            const r = p * Math.hypot(W, H) * 1.15;
            const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(1, r));
            g.addColorStop(0, 'rgba(255, 246, 200, 0.98)');
            g.addColorStop(0.45, 'rgba(255, 176, 56, 0.95)');
            g.addColorStop(1, 'rgba(255, 120, 20, 0)');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(cx, cy, Math.max(1, r), 0, Math.PI * 2);
            ctx.fill();
          }
          return true;
        }
        case 'orange': {
          ctx.fillStyle = '#ff9a2e';
          ctx.fillRect(0, 0, W, H);
          return true;
        }
        case 'fadeBlack': {
          ctx.fillStyle = '#ff9a2e';
          ctx.fillRect(0, 0, W, H);
          ctx.fillStyle = `rgba(0, 0, 0, ${p})`;
          ctx.fillRect(0, 0, W, H);
          return true;
        }
        case 'black': {
          ctx.fillStyle = '#000';
          ctx.fillRect(0, 0, W, H);
          return true;
        }
        case 'fadeIn': {
          // The road is drawn underneath; black lifts off it.
          ctx.fillStyle = `rgba(0, 0, 0, ${1 - p})`;
          ctx.fillRect(0, 0, W, H);
          return false;
        }
        default:
          return false;
      }
    }
  };
}
