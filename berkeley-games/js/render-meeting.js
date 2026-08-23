// Special Meeting bottle episode (Bottle Episode Revision addendum).
//
// The driving scene is gone entirely: no car, no hood, no road (§3). The view
// sits in a crowded late-night council chamber. Activist pressure acts on the
// room — crowd closing in, signs intruding, barriers rattling — never on a
// vehicle. Nothing here depicts assault, injury, or riot violence (§7).

import { PROTEST_SIGNS } from './content/meeting.js';
import { pressureTier } from './meeting.js';

const CROWD_COUNT = 30;
const DRUM_COUNT = 3;
const DAIS_SEATS = 7;

/** Stable hash → [0,1), so the room does not shimmer between frames. */
function hash01(n) {
  const s = Math.sin(n * 91.7 + 41.3) * 28711.5453;
  return s - Math.floor(s);
}

export function createMeetingRenderer(ctx, view) {
  // Fixed layout, generated once.
  // Sign-holders are spaced across the width rather than placed at random,
  // so the placards are readable instead of stacking on top of each other.
  // Everyone else fills in wherever.
  const holders = Array.from({ length: CROWD_COUNT }, (_, i) => i)
    .filter(i => hash01(i * 13.7) > 0.52);
  const slotOf = new Map(holders.map((i, n) => [i, n]));

  const crowd = Array.from({ length: CROWD_COUNT }, (_, i) => ({
    x: slotOf.has(i)
      // Evenly spaced with a little jitter, so it is not a picket line.
      ? (slotOf.get(i) + 0.5) / holders.length + (hash01(i * 3.1) - 0.5) * 0.02
      : hash01(i * 3.1),
    // Alternate holders near and far, so adjacent signs differ in size and
    // height rather than forming a solid band across the frame.
    depth: slotOf.has(i)
      ? (slotOf.get(i) % 2 ? 0.62 : 0.16) + hash01(i * 7.7) * 0.2
      : hash01(i * 7.7),             // 0 = nearest the viewpoint
    height: 0.82 + hash01(i * 5.3) * 0.4,
    sign: PROTEST_SIGNS[Math.floor(hash01(i * 11.9) * PROTEST_SIGNS.length)],
    hasSign: hash01(i * 13.7) > 0.52,
    // How high this one is held, so a row of signs is not a flat line.
    lift: 0.9 + hash01(i * 17.3) * 0.85,
    phase: hash01(i * 2.9) * Math.PI * 2,
    coat: ['#3b4a5e', '#5a4038', '#37503f', '#4a3a58', '#2f4652', '#553f47'][i % 6]
  }));

  const drums = Array.from({ length: DRUM_COUNT }, (_, i) => ({
    x: i === 0 ? 0.07 : i === 1 ? 0.5 : 0.93,
    phase: hash01(i * 23.7) * Math.PI * 2
  }));

  // The councilmember who may rage quit sits at a fixed seat so the empty
  // chair afterwards is unmistakable (addendum §16).
  const RAGE_SEAT = 4;

  function draw(meeting, gameState, t, reducedMotion) {
    const W = view.width, H = view.height;
    const pressure = meeting.crowdPressure ?? 0;
    const tier = pressureTier(meeting.activistSentiment);

    // Environmental shake: the room, not a car. Reduced motion drops it and
    // relies on denser signs plus the UI pulse instead (§26).
    const amp = reducedMotion ? 0 : pressure;
    const shakeX = Math.sin(t * 0.011) * amp * W * 0.008;
    const shakeY = Math.sin(t * 0.015 + 1) * amp * H * 0.005;

    ctx.save();
    ctx.translate(shakeX, shakeY);

    drawChamber(W, H, t, pressure);
    drawDais(W, H, meeting, t);
    for (const d of drums) drawDrum(d, t, W, H);
    drawBarriers(W, H, pressure, t, reducedMotion);
    drawCrowd(meeting, t, W, H, pressure, reducedMotion);

    ctx.restore();

    // Signs pressing into the frame edges as the room closes in.
    if (pressure > 0.25) drawIntrudingSigns(W, H, pressure, t, reducedMotion);

    // Vignette tightens with pressure, making the scene claustrophobic (§19).
    drawVignette(W, H, pressure);

    if (reducedMotion && pressure > 0.05) drawPressureBorder(W, H, pressure, t);
  }

  function drawChamber(W, H, t, pressure) {
    // Council chamber interior, late at night.
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#151a26');
    g.addColorStop(0.55, '#1e2433');
    g.addColorStop(1, '#12161f');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // Back wall panelling.
    ctx.fillStyle = 'rgba(46, 38, 30, 0.55)';
    ctx.fillRect(W * 0.08, H * 0.10, W * 0.84, H * 0.42);
    ctx.strokeStyle = 'rgba(90, 74, 56, 0.5)';
    ctx.lineWidth = 2;
    for (let i = 0; i <= 6; i++) {
      const x = W * (0.08 + i * 0.14);
      ctx.beginPath();
      ctx.moveTo(x, H * 0.10);
      ctx.lineTo(x, H * 0.52);
      ctx.stroke();
    }

    // Ceiling lights.
    for (let i = 0; i < 4; i++) {
      const lx = W * (0.18 + i * 0.22);
      const gl = ctx.createRadialGradient(lx, H * 0.06, 0, lx, H * 0.06, H * 0.16);
      gl.addColorStop(0, 'rgba(255, 240, 200, 0.30)');
      gl.addColorStop(1, 'rgba(255, 240, 200, 0)');
      ctx.fillStyle = gl;
      ctx.beginPath();
      ctx.arc(lx, H * 0.06, H * 0.16, 0, Math.PI * 2);
      ctx.fill();
    }

    // Occasional press camera flash.
    const flash = Math.sin(t * 0.0013) > 0.995 ? 1 : 0;
    if (flash) {
      ctx.fillStyle = 'rgba(255,255,255,0.10)';
      ctx.fillRect(0, 0, W, H);
    }
  }

  /** The dais: silhouetted councilmembers, one chair possibly empty (§13, §16). */
  function drawDais(W, H, meeting, t) {
    const deskY = H * 0.50;
    const deskH = H * 0.10;

    // Seated silhouettes behind the desk.
    for (let i = 0; i < DAIS_SEATS; i++) {
      const cx = W * (0.20 + i * 0.10);
      const departed = meeting.rageQuitOccurred && i === RAGE_SEAT;

      if (departed) {
        // Empty chair, pushed back — it never refills (§16).
        ctx.fillStyle = '#2a2f3a';
        ctx.fillRect(cx - W * 0.018, deskY - H * 0.075, W * 0.036, H * 0.055);
        ctx.fillStyle = '#1b1f28';
        ctx.fillRect(cx - W * 0.020, deskY - H * 0.022, W * 0.040, H * 0.012);
        continue;
      }

      const bob = Math.sin(t * 0.0016 + i) * H * 0.003;
      ctx.fillStyle = '#0e131c';
      ctx.beginPath();
      ctx.arc(cx, deskY - H * 0.078 + bob, W * 0.016, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(cx - W * 0.026, deskY - H * 0.062 + bob, W * 0.052, H * 0.062);
    }

    // Desk front.
    const dg = ctx.createLinearGradient(0, deskY, 0, deskY + deskH);
    dg.addColorStop(0, '#4a3a28');
    dg.addColorStop(1, '#2e2418');
    ctx.fillStyle = dg;
    ctx.fillRect(W * 0.12, deskY, W * 0.76, deskH);
    ctx.fillStyle = 'rgba(0,0,0,0.30)';
    ctx.fillRect(W * 0.12, deskY, W * 0.76, H * 0.008);

    // Microphones.
    ctx.strokeStyle = '#5c6470';
    ctx.lineWidth = Math.max(1, W * 0.002);
    for (let i = 0; i < DAIS_SEATS; i++) {
      const cx = W * (0.20 + i * 0.10);
      ctx.beginPath();
      ctx.moveTo(cx, deskY);
      ctx.lineTo(cx + W * 0.008, deskY - H * 0.030);
      ctx.stroke();
    }
  }

  function drawDrum(d, t, W, H) {
    // Spillover gathering areas around the chamber (§19). Ambiance only.
    const x = d.x * W;
    const y = H * 0.72;
    const dw = W * 0.030, dh = dw * 1.5;

    const flick = 0.75 + Math.sin(t * 0.011 + d.phase) * 0.15
                       + Math.sin(t * 0.027 + d.phase * 2) * 0.10;
    const glow = ctx.createRadialGradient(x, y - dh, 0, x, y - dh, dw * 5);
    glow.addColorStop(0, `rgba(255, 150, 40, ${0.20 * flick})`);
    glow.addColorStop(1, 'rgba(255, 90, 20, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y - dh, dw * 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#3a3a40';
    ctx.fillRect(x - dw / 2, y - dh, dw, dh);
    ctx.strokeStyle = '#23232a';
    ctx.lineWidth = Math.max(1, dw * 0.05);
    for (const f of [0.3, 0.62]) {
      ctx.beginPath();
      ctx.moveTo(x - dw / 2, y - dh + dh * f);
      ctx.lineTo(x + dw / 2, y - dh + dh * f);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(120, 62, 30, 0.5)';
    ctx.fillRect(x - dw * 0.32, y - dh * 0.76, dw * 0.2, dh * 0.13);

    for (let k = 0; k < 3; k++) {
      const fh = dh * (0.5 + 0.34 * Math.sin(t * 0.014 + d.phase + k * 1.7)) * flick;
      const fx = x + (k - 1) * dw * 0.24;
      ctx.fillStyle = k === 1 ? 'rgba(255, 210, 90, 0.92)' : 'rgba(240, 130, 35, 0.85)';
      ctx.beginPath();
      ctx.moveTo(fx - dw * 0.16, y - dh);
      ctx.quadraticCurveTo(fx - dw * 0.10, y - dh - fh * 0.6, fx, y - dh - fh);
      ctx.quadraticCurveTo(fx + dw * 0.10, y - dh - fh * 0.6, fx + dw * 0.16, y - dh);
      ctx.closePath();
      ctx.fill();
    }
  }

  /** Crowd barriers that rattle as pressure rises (§7). */
  function drawBarriers(W, H, pressure, t, reducedMotion) {
    const y = H * 0.63;
    const rattle = reducedMotion ? 0 : Math.sin(t * 0.03) * pressure * 3;
    ctx.strokeStyle = `rgba(150, 160, 175, ${0.35 + pressure * 0.3})`;
    ctx.lineWidth = Math.max(2, W * 0.004);
    ctx.beginPath();
    ctx.moveTo(0, y + rattle);
    ctx.lineTo(W, y - rattle);
    ctx.stroke();
    for (let i = 0; i <= 10; i++) {
      const x = (i / 10) * W;
      ctx.beginPath();
      ctx.moveTo(x, y + rattle);
      ctx.lineTo(x, y + H * 0.05);
      ctx.stroke();
    }
  }

  function drawCrowd(meeting, t, W, H, pressure, reducedMotion) {
    // Nearer figures last. Higher pressure pulls the crowd toward the viewpoint.
    const sorted = [...crowd].sort((a, b) => b.depth - a.depth);
    const signs = [];
    for (const p of sorted) {
      const push = pressure * 0.22;
      const depth = Math.max(0, p.depth - push);
      const scale = 0.55 + (1 - depth) * 1.15;
      const x = p.x * W;
      const groundY = H * (0.66 + depth * 0.26);
      const ph = H * 0.19 * scale * p.height;
      const pw = ph * 0.34;

      const bob = reducedMotion ? 0
        : Math.sin(t * (0.004 + pressure * 0.008) + p.phase) * ph * 0.05;

      ctx.fillStyle = p.coat;
      ctx.fillRect(x - pw / 2, groundY - ph * 0.66 + bob, pw, ph * 0.66);
      ctx.fillStyle = '#c9a68a';
      ctx.beginPath();
      ctx.arc(x, groundY - ph * 0.78 + bob, pw * 0.34, 0, Math.PI * 2);
      ctx.fill();

      if (p.hasSign) {
        // Held back and drawn after every figure: a placard behind a nearer
        // body was unreadable, which defeats the point of the sign.
        signs.push({ p, x, groundY, ph, bob });
      }
    }

    for (const { p, x, groundY, ph, bob } of signs) {
      const sx = Math.min(Math.max(x, W * 0.08), W * 0.92);
      // Sign size tracks the figure but is capped, so a near holder does not
      // swamp the frame, and each is held at its own height.
      const sh = Math.min(ph, H * 0.2) * 0.95;
      drawProtestSign(p.sign, sx, groundY - ph * (0.98 + p.lift * 0.34) + bob, sh);
    }
  }

  function drawProtestSign(text, x, y, ph) {
    const sw = ph * 0.82, sh = ph * 0.36;
    ctx.fillStyle = '#6b5636';
    ctx.fillRect(x - sw * 0.02, y, sw * 0.04, ph * 0.3);
    ctx.fillStyle = '#e8e4d8';
    ctx.fillRect(x - sw / 2, y - sh, sw, sh);
    ctx.strokeStyle = '#b8b3a4';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - sw / 2, y - sh, sw, sh);

    // Wrap to the board rather than at the midpoint: some of these are much
    // longer than others, and a fixed two-line split overflowed the placard.
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const maxW = sw - 6;
    let fs = Math.max(5, sh * 0.30);
    let lines = [];
    for (let attempt = 0; attempt < 14; attempt++) {
      ctx.font = `800 ${fs}px system-ui, -apple-system, sans-serif`;
      lines = [];
      let line = '';
      for (const word of text.split(' ')) {
        const test = line ? `${line} ${word}` : word;
        if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = word; }
        else line = test;
      }
      if (line) lines.push(line);
      // Fits when every line is inside the board and the stack is not too tall.
      const tall = lines.length * fs * 1.12 > sh - 4;
      const wide = lines.some(l => ctx.measureText(l).width > maxW);
      if (!tall && !wide) break;
      fs -= 0.6;
      if (fs < 4) break;
    }

    ctx.fillStyle = '#1a1a1e';
    const lineH = fs * 1.12;
    const top = y - sh / 2 - ((lines.length - 1) * lineH) / 2;
    lines.forEach((line, i) => ctx.fillText(line, x, top + i * lineH));

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  /** Signs shoved in from the frame edges, obscuring the view (§7). */
  function drawIntrudingSigns(W, H, pressure, t, reducedMotion) {
    const n = pressure > 0.8 ? 4 : pressure > 0.55 ? 3 : 2;
    for (let i = 0; i < n; i++) {
      const fromLeft = i % 2 === 0;
      const sway = reducedMotion ? 0 : Math.sin(t * 0.004 + i * 2) * W * 0.02;
      const inset = (0.02 + pressure * 0.14) * W;
      const x = fromLeft ? inset + sway : W - inset + sway;
      const y = H * (0.34 + hash01(i * 4.4) * 0.30);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((fromLeft ? -1 : 1) * (0.18 + pressure * 0.16));
      drawProtestSign(PROTEST_SIGNS[(i * 3 + 1) % PROTEST_SIGNS.length], 0, 0, H * 0.26);
      ctx.restore();
    }
  }

  function drawVignette(W, H, pressure) {
    const g = ctx.createRadialGradient(
      W / 2, H / 2, Math.min(W, H) * (0.52 - pressure * 0.22),
      W / 2, H / 2, Math.max(W, H) * 0.78
    );
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, `rgba(0,0,0,${0.35 + pressure * 0.35})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  function drawPressureBorder(W, H, intensity, t) {
    const pulse = 0.5 + 0.5 * Math.sin(t * 0.006);
    ctx.strokeStyle = `rgba(255, 140, 60, ${0.25 + intensity * 0.45 * pulse})`;
    ctx.lineWidth = Math.max(3, W * 0.008 * intensity);
    ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2,
                   W - ctx.lineWidth, H - ctx.lineWidth);
  }

  return { draw };
}
