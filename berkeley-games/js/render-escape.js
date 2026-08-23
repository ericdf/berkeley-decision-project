// Higher Office Escape cinematic (Higher Office addendum §12, §13, §14, §24).
//
// The sequence is: rise out of the Berkeley roadway, look back down at a
// stylised ruined Berkeley, and watch the driverless Berkeley Budget car keep
// going without you. It depicts damaged infrastructure only — never casualties,
// bodies, or human suffering (addendum §13).

import { ROAD_SIGN_TEXT } from './content/roosevelt.js';

// Crash choreography for the driverless car, in seconds from escape start
// (Roosevelt addendum §10). The sign shows first, then impact, flip, slide.
const CRASH = { sign: 2.2, impact: 3.4, flip: 3.6, slide: 4.2, flames: 4.4 };

function hash01(n) {
  const s = Math.sin(n * 57.3 + 19.7) * 39113.77;
  return s - Math.floor(s);
}

export function createEscapeRenderer(ctx, view) {
  return {
    /**
     * @param {number} t       seconds since the escape began
     * @param {object} phase   { rise, driverless } durations in seconds
     * @param {object} below   run conditions preserved from the road (§17, §21)
     */
    draw(t, phase, below, now) {
      const W = view.width, H = view.height;
      // 0 → still on the road, 1 → fully risen into the higher-office realm.
      const rise = Math.min(1, t / phase.rise);
      const eased = rise * rise * (3 - 2 * rise);

      drawHigherOfficeSky(ctx, W, H, eased, now);
      // Berkeley recedes downward and shrinks as the camera climbs.
      drawBerkeleyBelow(ctx, W, H, eased, t, below, now);
      drawClouds(ctx, W, H, eased, now);

      // A bright bloom washes through the middle of the transition.
      const flash = Math.max(0, 1 - Math.abs(rise - 0.35) * 5);
      if (flash > 0) {
        ctx.fillStyle = `rgba(255, 252, 240, ${flash * 0.55})`;
        ctx.fillRect(0, 0, W, H);
      }
    }
  };
}

function drawHigherOfficeSky(ctx, W, H, rise, now) {
  // Bright, calm, pristine — the deliberate opposite of the Berkeley palette.
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#7cc4f5');
  g.addColorStop(0.55, '#bfe4fb');
  g.addColorStop(1, '#f3f8fb');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Soft sun.
  const sx = W * 0.74, sy = H * (0.30 - rise * 0.10);
  const halo = ctx.createRadialGradient(sx, sy, 0, sx, sy, H * 0.34);
  halo.addColorStop(0, 'rgba(255, 250, 220, 0.95)');
  halo.addColorStop(0.35, 'rgba(255, 244, 200, 0.35)');
  halo.addColorStop(1, 'rgba(255, 240, 190, 0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(sx, sy, H * 0.34, 0, Math.PI * 2);
  ctx.fill();

  // Distant civic architecture, clean and unhurried (addendum §12).
  if (rise > 0.45) {
    const a = Math.min(1, (rise - 0.45) / 0.4);
    const baseY = H * 0.52;
    ctx.fillStyle = `rgba(255, 255, 255, ${0.75 * a})`;
    for (let i = 0; i < 4; i++) {
      const bx = W * (0.10 + i * 0.24);
      const bw = W * 0.09, bh = H * (0.07 + hash01(i) * 0.05);
      ctx.fillRect(bx, baseY - bh, bw, bh);
      // A simple dome / portico suggestion.
      ctx.beginPath();
      ctx.arc(bx + bw / 2, baseY - bh, bw * 0.34, Math.PI, 0);
      ctx.fill();
    }
  }
}

function drawClouds(ctx, W, H, rise, now) {
  const drift = now * 0.004;
  for (let i = 0; i < 7; i++) {
    const cy = H * (0.12 + hash01(i * 3.7) * 0.5) + rise * H * 0.12;
    const cx = ((hash01(i * 5.1) * W + drift * (12 + i * 4)) % (W * 1.4)) - W * 0.2;
    const cw = W * (0.10 + hash01(i * 7.9) * 0.10);
    const ch = cw * 0.34;
    ctx.fillStyle = `rgba(255, 255, 255, ${0.5 + hash01(i * 2.3) * 0.35})`;
    for (let k = 0; k < 4; k++) {
      ctx.beginPath();
      ctx.ellipse(cx + k * cw * 0.24, cy + Math.sin(k) * ch * 0.18,
                  cw * (0.34 - k * 0.03), ch, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/**
 * Berkeley, seen from above as the player rises away: dark, smoking, cratered,
 * with the driverless Berkeley Budget car still moving along it.
 */
function drawBerkeleyBelow(ctx, W, H, rise, t, below, now) {
  // The ground plane slides down and shrinks as the camera climbs.
  // Berkeley slides down but stays a substantial part of the frame: the
  // closing image is the driverless car still moving, not the paradise.
  const topY = H * (0.50 + rise * 0.22);
  if (topY >= H) return;

  const shrink = 1 - rise * 0.30;
  const cx = W / 2;

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, topY, W, H - topY);
  ctx.clip();

  // Dark ground.
  const gg = ctx.createLinearGradient(0, topY, 0, H);
  gg.addColorStop(0, '#241f1c');
  gg.addColorStop(1, '#15120f');
  ctx.fillStyle = gg;
  ctx.fillRect(0, topY, W, H - topY);

  // Roadway running away from the viewer, narrowing with the rise.
  const roadTopW = W * 0.16 * shrink;
  const roadBotW = W * 0.86 * shrink;
  const roadTop = topY + (H - topY) * 0.06;
  ctx.fillStyle = '#3a3a40';
  ctx.beginPath();
  ctx.moveTo(cx - roadTopW / 2, roadTop);
  ctx.lineTo(cx + roadTopW / 2, roadTop);
  ctx.lineTo(cx + roadBotW / 2, H);
  ctx.lineTo(cx - roadBotW / 2, H);
  ctx.closePath();
  ctx.fill();

  const roadAt = y => {
    const f = (y - roadTop) / Math.max(1, H - roadTop);
    return { w: roadTopW + (roadBotW - roadTopW) * f, cx };
  };

  // Cratered pavement (addendum §13).
  ctx.fillStyle = '#141212';
  for (let i = 0; i < 26; i++) {
    const f = hash01(i * 3.3);
    const y = roadTop + f * (H - roadTop);
    const r = roadAt(y);
    const px = r.cx + (hash01(i * 7.7) - 0.5) * r.w * 0.86;
    const pr = r.w * (0.03 + hash01(i * 11.3) * 0.06);
    ctx.beginPath();
    ctx.ellipse(px, y, pr, pr * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Abandoned orange lane barriers.
  for (let i = 0; i < 14; i++) {
    const f = hash01(i * 5.9);
    const y = roadTop + f * (H - roadTop);
    const r = roadAt(y);
    const px = r.cx + (hash01(i * 2.1) - 0.5) * r.w * 0.92;
    const s = Math.max(1.5, r.w * 0.022);
    ctx.fillStyle = '#c2540d';
    ctx.beginPath();
    ctx.moveTo(px, y - s * 2);
    ctx.lineTo(px + s * 0.7, y);
    ctx.lineTo(px - s * 0.7, y);
    ctx.closePath();
    ctx.fill();
  }

  // A broken bridge span further down the road.
  {
    const y = roadTop + (H - roadTop) * 0.30;
    const r = roadAt(y);
    ctx.fillStyle = '#0a0908';
    ctx.fillRect(r.cx - r.w * 0.5, y, r.w, (H - roadTop) * 0.09);
    ctx.fillStyle = '#6e6a63';
    for (const side of [-0.5, 0.42]) {
      ctx.fillRect(r.cx + r.w * side, y - r.w * 0.05, r.w * 0.08, r.w * 0.05);
    }
  }

  // Damaged FISCAL CLIFF sign, leaning (addendum §13).
  {
    const y = roadTop + (H - roadTop) * 0.52;
    const r = roadAt(y);
    const sw = r.w * 0.18, sh = sw * 0.42;
    const sx = r.cx - r.w * 0.62;
    if (sw > 12) {
      ctx.save();
      ctx.translate(sx, y);
      ctx.rotate(-0.28);
      ctx.fillStyle = '#8a7320';
      ctx.fillRect(-sw / 2, -sh, sw, sh);
      ctx.fillStyle = '#100e08';
      ctx.font = `800 ${Math.max(5, sh * 0.42)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('FISCAL CLIFF', 0, -sh * 0.5);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.restore();
    }
  }

  // The driverless Berkeley Budget car, still going (addendum §14).
  drawDriverlessCar(ctx, W, H, roadTop, roadAt, t, shrink);

  // Rain persists below if it was raining when the player left (addendum §21).
  if (below?.rainLevel > 0) {
    ctx.strokeStyle = `rgba(150, 170, 195, ${0.12 + below.rainLevel * 0.05})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < 70 * below.rainLevel; i++) {
      const x = hash01(i * 4.4) * W;
      const y = topY + ((hash01(i * 8.8) * (H - topY)) + now * 0.35) % (H - topY);
      ctx.moveTo(x, y);
      ctx.lineTo(x - 2, y + 7);
    }
    ctx.stroke();
  }

  drawSmoke(ctx, W, H, topY, now);
  drawDistantFires(ctx, W, H, topY, now);

  // Muted, smoky wash over the whole of Berkeley.
  ctx.fillStyle = `rgba(30, 22, 18, ${0.18 + rise * 0.25})`;
  ctx.fillRect(0, topY, W, H - topY);

  ctx.restore();
}

function drawDriverlessCar(ctx, W, H, roadTop, roadAt, t, shrink) {
  // Runs away from the viewer until it reaches the Roosevelt Avenue pothole,
  // then flips, slides, and burns — stylised arcade slapstick only, with no
  // occupant: the player already left (Roosevelt addendum §12).
  const preImpact = Math.min(t, CRASH.impact);
  const f = Math.min(0.95, 0.80 - preImpact * 0.035);
  const y = roadTop + Math.max(0.05, f) * (H - roadTop);
  const r = roadAt(y);
  const cw = Math.max(6, r.w * 0.20);
  const ch = cw * 0.78;

  // The pothole itself, visible ahead of the car before impact.
  if (t > CRASH.sign - 0.6) {
    const py = y - (H - roadTop) * 0.045;
    const pr = roadAt(py);
    // Severe street damage, not a canyon (Roosevelt addendum §11).
    const holeR = pr.w * 0.13;
    ctx.fillStyle = '#080707';
    ctx.beginPath();
    ctx.ellipse(pr.cx + pr.w * 0.02, py, holeR, holeR * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(150,140,130,0.5)';
    ctx.lineWidth = Math.max(1, holeR * 0.12);
    ctx.stroke();
  }

  // ROOSEVELT AVE roadside identifier, briefly before impact (§11).
  if (t > CRASH.sign && t < CRASH.slide) {
    const sy = y - (H - roadTop) * 0.10;
    const sr = roadAt(sy);
    const sw = Math.max(28, sr.w * 0.34), sh = sw * 0.26;
    const sx = sr.cx - sr.w * 0.72;
    ctx.fillStyle = '#1d5c2e';
    ctx.fillRect(sx - sw / 2, sy - sh, sw, sh);
    ctx.strokeStyle = '#eaf4ea';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(sx - sw / 2 + 2, sy - sh + 2, sw - 4, sh - 4);
    ctx.fillStyle = '#f4faf4';
    ctx.font = `800 ${Math.max(6, sh * 0.44)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ROAD_SIGN_TEXT, sx, sy - sh * 0.5);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  // Crash motion.
  let rot = 0, dx = 0, dy = 0;
  if (t >= CRASH.impact) {
    const k = t - CRASH.impact;
    rot = Math.min(Math.PI * 1.15, k * 4.2);        // front drops, then flips
    dx = -Math.min(r.w * 0.5, k * r.w * 0.30);      // slides off to the side
    dy = Math.sin(Math.min(k, 0.5) * Math.PI) * -ch * 0.7;
  }

  const x = r.cx + Math.sin(t * 1.1) * r.w * 0.10 + dx;

  ctx.save();
  ctx.translate(x, y + dy);
  ctx.rotate(rot);

  ctx.fillStyle = '#1e5aa8';
  ctx.fillRect(-cw / 2, -ch, cw, ch);
  ctx.fillStyle = '#17457f';
  ctx.fillRect(-cw * 0.36, -ch * 0.82, cw * 0.72, ch * 0.44);
  ctx.fillStyle = 'rgba(12, 20, 32, 0.9)';         // empty cabin, no driver
  ctx.fillRect(-cw * 0.28, -ch * 0.74, cw * 0.56, ch * 0.30);
  ctx.fillStyle = '#ff5a44';
  ctx.fillRect(-cw * 0.44, -ch * 0.16, cw * 0.16, ch * 0.12);
  ctx.fillRect(cw * 0.28, -ch * 0.16, cw * 0.16, ch * 0.12);
  ctx.restore();

  // Stylised arcade flames once it comes to rest.
  if (t >= CRASH.flames) {
    const k = t - CRASH.flames;
    for (let i = 0; i < 6; i++) {
      const fh = ch * (0.7 + 0.5 * Math.sin(t * 9 + i * 1.4)) * Math.min(1, k * 2);
      const fx = x + (i - 2.5) * cw * 0.22;
      ctx.fillStyle = i % 2 ? 'rgba(255, 206, 84, 0.92)' : 'rgba(240, 118, 30, 0.88)';
      ctx.beginPath();
      ctx.moveTo(fx - cw * 0.12, y + dy);
      ctx.quadraticCurveTo(fx, y + dy - fh * 0.8, fx, y + dy - fh);
      ctx.quadraticCurveTo(fx, y + dy - fh * 0.8, fx + cw * 0.12, y + dy);
      ctx.closePath();
      ctx.fill();
    }
    // Smoke column above the wreck.
    ctx.fillStyle = `rgba(70, 62, 58, ${Math.min(0.5, k * 0.3)})`;
    ctx.beginPath();
    ctx.arc(x, y + dy - ch * 2.2, cw * (0.7 + k * 0.4), 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawSmoke(ctx, W, H, topY, now) {
  for (let i = 0; i < 9; i++) {
    const sx = hash01(i * 6.1) * W;
    const baseY = topY + hash01(i * 9.3) * (H - topY) * 0.8;
    const rise = ((now * 0.02 + hash01(i) * 400) % 400) / 400;
    const sy = baseY - rise * (H - topY) * 0.5;
    const sr = (H - topY) * (0.05 + rise * 0.10);
    ctx.fillStyle = `rgba(96, 88, 82, ${0.30 * (1 - rise)})`;
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawDistantFires(ctx, W, H, topY, now) {
  for (let i = 0; i < 6; i++) {
    const fx = hash01(i * 13.1) * W;
    const fy = topY + hash01(i * 17.7) * (H - topY) * 0.7;
    const flick = 0.7 + Math.sin(now * 0.01 + i * 2) * 0.3;
    const gr = ctx.createRadialGradient(fx, fy, 0, fx, fy, (H - topY) * 0.11);
    gr.addColorStop(0, `rgba(255, 140, 40, ${0.42 * flick})`);
    gr.addColorStop(1, 'rgba(255, 100, 20, 0)');
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.arc(fx, fy, (H - topY) * 0.11, 0, Math.PI * 2);
    ctx.fill();
  }
}
