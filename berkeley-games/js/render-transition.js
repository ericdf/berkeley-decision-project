// Special Meeting return transition.
//
// The signs close in until one of them fills the frame, and then the night
// goes black. The old flare-to-orange sunburst is retired: the crowd pressing
// in is the thing that ends the meeting, so the crowd should be what you see.

import { FINAL_SIGN } from './content/meeting.js';

export const TRANSITION_PHASES = {
  compress: 900,     // A: the signs press in from the edges
  close: 900,        // B: one sign rushes forward and fills the viewport
  hold: 1500,        // C: hold it, long enough to read the small print
  fadeBlack: 500,    // D: the sign fades to black
  black: 500,        // E: hold black — the night disappears here
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
          // The room darkens as the signs crowd the frame.
          ctx.fillStyle = `rgba(10, 12, 16, ${p * 0.45})`;
          ctx.fillRect(0, 0, W, H);
          drawClosingSigns(ctx, W, H, p, reducedMotion);
          return true;
        }
        case 'close': {
          // One sign rushes the camera and takes the whole frame.
          ctx.fillStyle = `rgba(10, 12, 16, ${0.45 + p * 0.3})`;
          ctx.fillRect(0, 0, W, H);
          drawClosingSigns(ctx, W, H, 1, reducedMotion);
          const ease = reducedMotion ? p : 1 - Math.pow(1 - p, 3);
          drawFinalSign(ctx, W, H, ease);
          return true;
        }
        case 'hold': {
          ctx.fillStyle = '#0a0c10';
          ctx.fillRect(0, 0, W, H);
          drawFinalSign(ctx, W, H, 1);
          return true;
        }
        case 'fadeBlack': {
          ctx.fillStyle = '#0a0c10';
          ctx.fillRect(0, 0, W, H);
          drawFinalSign(ctx, W, H, 1);
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

/** Placard silhouettes crowding in from both edges as the meeting closes. */
function drawClosingSigns(ctx, W, H, p, reducedMotion) {
  const n = 6;
  for (let i = 0; i < n; i++) {
    const fromLeft = i % 2 === 0;
    // Each one starts off-frame and slides toward the centre.
    const travel = 0.08 + p * (0.2 + (i / n) * 0.22);
    const x = fromLeft ? W * travel : W * (1 - travel);
    const y = H * (0.22 + ((i * 7) % 5) / 5 * 0.5);
    const ph = H * (0.3 + ((i * 3) % 4) / 4 * 0.14);
    const lean = (fromLeft ? -1 : 1) * (0.16 + p * 0.22);
    ctx.save();
    ctx.globalAlpha = 0.55 + p * 0.45;
    ctx.translate(x, y);
    ctx.rotate(reducedMotion ? lean * 0.4 : lean);
    const sw = ph * 0.86, sh = ph * 0.38;
    ctx.fillStyle = '#6b5636';
    ctx.fillRect(-sw * 0.02, 0, sw * 0.04, ph * 0.34);
    ctx.fillStyle = '#ded9cb';
    ctx.fillRect(-sw / 2, -sh, sw, sh);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-sw / 2, -sh, sw, sh);
    // Illegible scrawl: these are the crowd, not the punchline.
    ctx.fillStyle = 'rgba(30,30,34,0.55)';
    for (let k = 0; k < 3; k++) {
      ctx.fillRect(-sw * 0.36, -sh + sh * (0.22 + k * 0.24),
        sw * (0.4 + ((i + k) % 3) * 0.14), sh * 0.1);
    }
    ctx.restore();
  }
}

/**
 * The sign that fills the viewport. `f` is 0 at the far distance and 1 when
 * it has arrived, so the same routine serves the rush and the hold.
 */
function drawFinalSign(ctx, W, H, f) {
  const scale = 0.22 + f * 0.78;
  const sw = W * 1.02 * scale;
  const sh = H * 1.02 * scale;
  const x = W / 2 - sw / 2;
  const y = H / 2 - sh / 2;

  ctx.save();
  ctx.globalAlpha = Math.min(1, 0.3 + f * 0.7);

  // Board
  ctx.fillStyle = '#efeadb';
  ctx.fillRect(x, y, sw, sh);
  ctx.strokeStyle = '#b8b3a4';
  ctx.lineWidth = Math.max(2, sw * 0.008);
  ctx.strokeRect(x, y, sw, sh);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Hand-lettered, sized to fit the board.
  let fs = Math.min(sh * 0.16, sw * 0.13);
  ctx.fillStyle = '#1a1a1e';
  ctx.font = `900 ${fs}px system-ui, -apple-system, sans-serif`;
  const words = FINAL_SIGN.text.split(' ');
  const lines = [words.slice(0, 3).join(' '), words.slice(3).join(' ')]
    .filter(Boolean);
  while (lines.some(l => ctx.measureText(l).width > sw * 0.86) && fs > 6) {
    fs -= 1;
    ctx.font = `900 ${fs}px system-ui, -apple-system, sans-serif`;
  }
  const lineH = fs * 1.2;
  const top = H / 2 - ((lines.length - 1) * lineH) / 2 - sh * 0.04;
  lines.forEach((l, i) => ctx.fillText(l, W / 2, top + i * lineH));

  // The citation, in small print, because the line is quoted.
  const cfs = Math.max(7, fs * 0.2);
  ctx.font = `600 italic ${cfs}px system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = '#5c574c';
  ctx.fillText(FINAL_SIGN.citation, W / 2, top + lines.length * lineH + cfs * 1.6);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.restore();
}
