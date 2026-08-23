// Budget Quest — deficit board renderer (v3.2).
//
// Missile Command. Every missile is $1M of uncovered deficit (§7): identical,
// unlabeled (§8), and travelling a ballistic arc toward a City base (§15-§17).
// A $30M deficit is thirty of them crossing the sky at once.
//
// Procedural canvas only. Bases, controls and meters are real DOM so they stay
// keyboard-operable and screen-readable.

import { FUNCTION_KEYS, MISSILE_KINDS } from './content.js';

const TONE = {
  structural: { body: '#ff6b5e', trail: 'rgba(255,107,94,0.30)' },
  shock: { body: '#ffa657', trail: 'rgba(255,166,87,0.32)' }
};

export function createBoardRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let w = 0, h = 0;
  const flashes = [];
  const bursts = [];

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const r = canvas.getBoundingClientRect();
    w = Math.max(320, r.width);
    h = Math.max(160, r.height);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function flash(key, redirected) { flashes.push({ key, t: 0, redirected }); }

  /** An intercepted missile: it flares and dissolves rather than landing. */
  function burst(x, y, tone) {
    bursts.push({ x, y, t: 0, tone: tone || '#7ee787' });
  }

  /**
   * A missile's position along its arc. §16: varied origin, specific target,
   * curved path, visibly converging. The arc is a quadratic Bezier from the
   * launch point to the base, bowed by the missile's own `arc` value so
   * trajectories cross without becoming chaotic (§17).
   */
  function pointAt(m, tileRects) {
    const target = tileRects[m.aimedAt];
    const tx = target ? target.x + target.w / 2 : w / 2;
    const ty = target ? Math.min(target.y, h) : h;
    const sx = m.originX * w;
    const sy = -12;

    // Control point: horizontally biased toward the launch side, lifted or
    // dropped by the arc factor. This is what makes the path bend.
    const cx = sx + (tx - sx) * 0.5 + m.arc * w * 0.22;
    const cy = sy + (ty - sy) * (0.28 + m.arcHeight * 0.4);

    const t = Math.max(0, Math.min(1, m.t || 0));
    const u = 1 - t;
    return {
      x: u * u * sx + 2 * u * t * cx + t * t * tx,
      y: u * u * sy + 2 * u * t * cy + t * t * ty,
      // Tangent, so the warhead can point along its heading.
      dx: 2 * u * (cx - sx) + 2 * t * (tx - cx),
      dy: 2 * u * (cy - sy) + 2 * t * (ty - cy)
    };
  }

  function draw(state, tileRects, dt = 0.016, opts = {}) {
    ctx.clearRect(0, 0, w, h);
    drawSky(state);
    drawShields(state, tileRects);
    drawMissiles(state, tileRects, opts.dimmed);
    drawLegend(state);
    drawEffects(tileRects, dt);
  }

  /**
   * §8 keeps labels off the missiles themselves. When a shock volley is in
   * the air it is a different thing from the structural deficit, so the sky
   * says so once, in a corner, rather than on every warhead.
   */
  function drawLegend(state) {
    const shocks = state.missiles.filter(
      m => !m.resolved && !m.landed && m.kind === 'shock' && m.t > 0).length;
    if (!shocks) return;
    const label = `${MISSILE_KINDS.shock.label} · ${shocks}`;
    ctx.save();
    ctx.font = '800 9.5px ui-sans-serif, system-ui, sans-serif';
    const tw = ctx.measureText(label).width;
    ctx.fillStyle = 'rgba(8,12,19,0.9)';
    ctx.fillRect(8, 8, tw + 24, 20);
    ctx.fillStyle = MISSILE_KINDS.shock.tone;
    ctx.fillRect(12, 13, 8, 10);
    ctx.fillStyle = '#e6edf3';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 26, 19);
    ctx.restore();
  }

  function drawSky(state) {
    const live = state.missiles.filter(m => !m.resolved && !m.landed).length;
    const g = ctx.createLinearGradient(0, 0, 0, h);
    if (live === 0) {
      // Clear skies read as calm, not merely empty (§41).
      g.addColorStop(0, '#0b1c2e');
      g.addColorStop(1, '#0a1119');
    } else {
      g.addColorStop(0, '#1c0f13');
      g.addColorStop(1, '#0a0d13');
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  function drawShields(state, tileRects) {
    for (const key of FUNCTION_KEYS) {
      const st = state.functions[key];
      if (!st || !st.shielded || st.exited) continue;
      const r = tileRects[key];
      if (!r) continue;
      const cx = r.x + r.w / 2;
      const cy = Math.min(r.y, h);
      const rx = r.w * 0.54;
      const ry = Math.min(38, r.w * 0.34);

      const g = ctx.createLinearGradient(0, cy - ry, 0, cy);
      g.addColorStop(0, 'rgba(127,212,255,0)');
      g.addColorStop(1, 'rgba(127,212,255,0.3)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, Math.PI, 0);
      ctx.fill();

      ctx.strokeStyle = 'rgba(127,212,255,0.92)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, Math.PI, 0);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  function drawMissiles(state, tileRects, dimmed) {
    ctx.save();
    if (dimmed) ctx.globalAlpha = 0.4;

    for (const m of state.missiles) {
      if (m.resolved || m.landed) continue;
      if ((m.t || 0) <= 0) continue;
      const tone = TONE[m.kind] || TONE.structural;
      const p = pointAt(m, tileRects);

      // Trail: the travelled portion of the arc, so the path is readable.
      const back = Math.max(0, (m.t || 0) - 0.22);
      ctx.strokeStyle = tone.trail;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      const steps = 10;
      for (let i = 0; i <= steps; i++) {
        const tt = back + ((m.t - back) * i) / steps;
        const q = pointAt({ ...m, t: tt }, tileRects);
        if (i === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y);
      }
      ctx.stroke();

      // Warhead: a small oriented dart, no label and no dollar figure (§8).
      const ang = Math.atan2(p.dy, p.dx);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(ang);
      ctx.fillStyle = tone.body;
      ctx.beginPath();
      ctx.moveTo(6, 0);
      ctx.lineTo(-4, 3);
      ctx.lineTo(-4, -3);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // A soft glow makes a dense sky legible without adding text.
      ctx.fillStyle = tone.body;
      ctx.globalAlpha = (dimmed ? 0.4 : 1) * 0.22;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = dimmed ? 0.4 : 1;
    }
    ctx.restore();
  }

  function drawEffects(tileRects, dt) {
    for (let i = flashes.length - 1; i >= 0; i--) {
      const f = flashes[i];
      f.t += dt;
      const r = tileRects[f.key];
      if (!r || f.t > 0.8) { flashes.splice(i, 1); continue; }
      const a = 1 - f.t / 0.8;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = f.redirected ? '#7fd4ff' : '#ff6b5e';
      const y = Math.min(r.y, h);
      ctx.fillRect(r.x, y - 3, r.w, 3);
      ctx.restore();
    }

    for (let i = bursts.length - 1; i >= 0; i--) {
      const b = bursts[i];
      b.t += dt;
      if (b.t > 0.45) { bursts.splice(i, 1); continue; }
      const a = 1 - b.t / 0.45;
      const rad = 3 + b.t * 46;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.strokeStyle = b.tone;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(b.x, b.y, rad, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = a * 0.28;
      ctx.fillStyle = b.tone;
      ctx.beginPath();
      ctx.arc(b.x, b.y, rad * 0.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  return {
    resize, draw, flash, burst, pointAt,
    get size() { return { w, h }; }
  };
}
