// Canvas 2D pseudo-3D renderer (spec §6, §36). Everything is drawn
// procedurally — no sprites, no image assets.

import { LANES, LANE_COUNT, LANE_KEYS, CLOSED_SIGN_TEXT } from './content/lanes.js';
import { wearTier } from './state.js';
import {
  SEGMENT_LENGTH, DRAW_DISTANCE, CAMERA_HEIGHT, CAMERA_DEPTH, ROAD_HALF_WIDTH,
  laneCenterOffset
} from './physics.js';

const HORIZON_FRACTION = 0.42;

// Beyond this the lane boards are too small to read, and several queued gates
// would overlap into noise at the vanishing point. At the cruising speed this
// is ~10 s of approach, which is what reading seven boards actually takes.
const GANTRY_VISIBLE_DISTANCE = 380;

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { width: 0, height: 0, horizonY: 0, dpr: 1 };

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    view.width = Math.max(1, Math.round(rect.width));
    view.height = Math.max(1, Math.round(rect.height));
    view.horizonY = view.height * HORIZON_FRACTION;
    view.dpr = dpr;
    canvas.width = view.width * dpr;
    canvas.height = view.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* --------------------------------------------------------------- */
  /* Projection                                                       */
  /* --------------------------------------------------------------- */

  // Pinhole projection. ROAD_HALF_WIDTH and CAMERA_HEIGHT are in metres, so
  // near-field geometry stays proportionate instead of fanning off-screen.
  function projectRoad(dz, camX) {
    const d = Math.max(dz, 0.5);
    const f = CAMERA_DEPTH * view.width;          // focal length in pixels
    const halfW = (f * ROAD_HALF_WIDTH) / d;
    return {
      y: view.horizonY + (f * CAMERA_HEIGHT) / d,
      halfW,
      cx: view.width / 2 - camX * halfW,
      scale: f / d
    };
  }

  function laneScreenX(p, laneOffset) {
    return p.cx + laneOffset * p.halfW;
  }

  /* --------------------------------------------------------------- */
  /* Sky, skyline, weather                                            */
  /* --------------------------------------------------------------- */

  /**
   * @param {string} timeOfDay 'day' | 'morning' — morning is used after a
   *        Special Meeting, and never implies the rain has stopped
   *        (Rainy-Day addendum §12).
   */
  function drawSky(rainLevel, t, timeOfDay = 'day') {
    const dim = rainLevel * 0.16;
    const morning = timeOfDay === 'morning';
    const g = ctx.createLinearGradient(0, 0, 0, view.horizonY + 10);
    if (rainLevel === 0) {
      if (morning) {
        g.addColorStop(0, '#2b4f7d');
        g.addColorStop(0.5, '#7fa8cf');
        g.addColorStop(1, '#f2c98d');       // low dawn light at the horizon
      } else {
        g.addColorStop(0, '#1a2f52');
        g.addColorStop(0.55, '#3f6ea8');
        g.addColorStop(1, '#8fb6d8');
      }
    } else if (morning) {
      // Morning light and rain together — that continuity is the joke.
      g.addColorStop(0, shade('#3a5876', -dim * 0.6));
      g.addColorStop(0.55, shade('#7b8ea1', -dim * 0.6));
      g.addColorStop(1, shade('#c8bda8', -dim * 0.6));
    } else {
      g.addColorStop(0, shade('#1a2f52', -dim));
      g.addColorStop(0.55, shade('#4a5f78', -dim));
      g.addColorStop(1, shade('#8c9aa8', -dim));
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, view.width, view.horizonY + 10);

    if (rainLevel === 0) {
      // Low sun, purely decorative; sits nearer the horizon in the morning.
      ctx.fillStyle = morning ? 'rgba(255, 226, 170, 0.7)' : 'rgba(255, 214, 150, 0.55)';
      ctx.beginPath();
      ctx.arc(view.width * (morning ? 0.24 : 0.72),
              view.horizonY - view.height * (morning ? 0.045 : 0.10),
              view.height * (morning ? 0.065 : 0.055), 0, Math.PI * 2);
      ctx.fill();
    }
    drawSkyline(rainLevel, t);
  }

  // Deterministic pseudo-random skyline, stable frame to frame.
  function drawSkyline(rainLevel, t) {
    const base = view.horizonY + 2;
    const alpha = 0.85 - rainLevel * 0.14;
    ctx.fillStyle = `rgba(28, 38, 56, ${alpha})`;
    let x = -20;
    let i = 0;
    while (x < view.width + 20) {
      const h = (hash01(i) * 0.055 + 0.02) * view.height;
      const w = (hash01(i + 97) * 0.05 + 0.025) * view.width;
      ctx.fillRect(x, base - h, w, h);
      // A couple of lit windows per building.
      ctx.fillStyle = `rgba(255, 226, 160, ${0.25 * (1 - rainLevel * 0.2)})`;
      for (let k = 0; k < 3; k++) {
        if (hash01(i * 13 + k) < 0.45) continue;
        ctx.fillRect(x + w * (0.2 + k * 0.25), base - h + h * 0.25, w * 0.13, h * 0.12);
      }
      ctx.fillStyle = `rgba(28, 38, 56, ${alpha})`;
      x += w + hash01(i + 31) * 12 + 4;
      i++;
    }
    // Hills behind the road, drawn after so they occlude nothing important.
    ctx.fillStyle = `rgba(46, 66, 52, ${0.7 - rainLevel * 0.12})`;
    ctx.beginPath();
    ctx.moveTo(0, base);
    for (let px = 0; px <= view.width; px += 18) {
      const hh = Math.sin(px * 0.004) * 10 + Math.sin(px * 0.011 + 2) * 6;
      ctx.lineTo(px, base - 12 - hh);
    }
    ctx.lineTo(view.width, base);
    ctx.closePath();
    ctx.fill();
  }

  function drawRain(rainLevel, t, reducedMotion) {
    if (rainLevel <= 0) return;
    const drops = reducedMotion ? 0 : [0, 60, 140, 260][rainLevel];
    ctx.strokeStyle = `rgba(200, 220, 240, ${0.16 + rainLevel * 0.06})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let i = 0; i < drops; i++) {
      const seed = hash01(i * 7.13);
      const speed = 900 + seed * 700;
      const x = (hash01(i * 3.7) * view.width + Math.sin(t * 0.0004 + i) * 14) % view.width;
      const y = (seed * view.height + t * speed * 0.001) % view.height;
      const len = 10 + rainLevel * 5;
      ctx.moveTo(x, y);
      ctx.lineTo(x - 3, y + len);
    }
    ctx.stroke();

    // Windshield haze + reduced contrast (spec §17.3).
    ctx.fillStyle = `rgba(150, 170, 190, ${0.05 * rainLevel})`;
    ctx.fillRect(0, 0, view.width, view.height);

    // Static beading on the glass.
    ctx.fillStyle = `rgba(220, 235, 250, ${0.05 + rainLevel * 0.02})`;
    for (let i = 0; i < 30 * rainLevel; i++) {
      const x = hash01(i * 11.1) * view.width;
      const y = hash01(i * 5.3) * view.height;
      ctx.beginPath();
      ctx.arc(x, y, 1 + hash01(i * 2.2) * 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* --------------------------------------------------------------- */
  /* Road                                                             */
  /* --------------------------------------------------------------- */

  function drawRoad(state, playerZ, camX, gapRange, deck, canyon) {
    const baseZ = Math.floor(playerZ / SEGMENT_LENGTH) * SEGMENT_LENGTH;

    // Ground either side of the road.
    const groundTop = view.horizonY;
    const gg = ctx.createLinearGradient(0, groundTop, 0, view.height);
    const dim = state.rainLevel * 0.15;
    const lift = state.timeOfDay === 'morning' ? 0.09 : 0;
    gg.addColorStop(0, shade('#3d5a3a', -dim + lift));
    gg.addColorStop(1, shade('#2a3f28', -dim + lift));
    ctx.fillStyle = gg;
    ctx.fillRect(0, groundTop, view.width, view.height - groundTop);

    // The chasm the bridge spans, cut into the ground plane before the road is
    // laid over it, so an intact deck visibly bridges the void.
    if (canyon) drawCanyon(playerZ, camX, canyon, deck);

    // Far-to-near so nearer segments overdraw.
    for (let i = DRAW_DISTANCE; i >= 1; i--) {
      const zFar = baseZ + i * SEGMENT_LENGTH;
      const zNear = baseZ + (i - 1) * SEGMENT_LENGTH;
      const dzFar = zFar - playerZ;
      const dzNear = zNear - playerZ;
      if (dzNear <= 1) continue;

      const pf = projectRoad(dzFar, camX);
      const pn = projectRoad(dzNear, camX);
      if (pn.y <= pf.y) continue;

      // A missing bridge span leaves a hole in the road (spec §18.4). Any
      // segment overlapping the gap is skipped, not only ones fully inside it.
      if (gapRange && zFar > gapRange[0] && zNear < gapRange[1]) continue;

      const onBridge = deck && zFar > deck[0] && zNear < deck[1];
      const fog = Math.min(1, dzFar / (DRAW_DISTANCE * SEGMENT_LENGTH));
      // Keyed on world position, not the loop index: indexing by `i` makes
      // every stripe flip colour together each time baseZ steps, which reads
      // as the whole road strobing rather than flowing past.
      const band = Math.floor(zNear / SEGMENT_LENGTH);
      drawRoadSegment(state, pf, pn, band, fog, onBridge);
    }
  }

  function drawRoadSegment(state, pf, pn, i, fog, onBridge) {
    const stripe = (i % 2 === 0);
    const dash = (i % 3 === 0);

    // Shoulder / rumble strip.
    const shoulder = stripe ? '#b8332e' : '#e8e4dc';
    const sf = pf.halfW * 1.09, sn = pn.halfW * 1.09;
    quad(ctx, pf.cx - sf, pf.y, pf.cx - pf.halfW, pf.y,
              pn.cx - pn.halfW, pn.y, pn.cx - sn, pn.y, shoulder);
    quad(ctx, pf.cx + pf.halfW, pf.y, pf.cx + sf, pf.y,
              pn.cx + sn, pn.y, pn.cx + pn.halfW, pn.y, shoulder);

    // Per-lane pavement, tinted by wear so damage is spatially legible.
    for (let l = 0; l < LANE_COUNT; l++) {
      const key = LANE_KEYS[l];
      const wear = state.laneWear[key];
      const closed = state.closedLanes.includes(key);
      const oL = laneCenterOffset(l) - 1 / LANE_COUNT;
      const oR = laneCenterOffset(l) + 1 / LANE_COUNT;

      let color = pavementColor(wear, stripe, closed, onBridge, l);
      color = applyFog(color, fog, state.rainLevel);

      quad(ctx,
        laneScreenX(pf, oL), pf.y, laneScreenX(pf, oR), pf.y,
        laneScreenX(pn, oR), pn.y, laneScreenX(pn, oL), pn.y, color);

      // Cracking texture on worn lanes.
      const tier = wearTier(wear);
      if ((tier === 'worn' || tier === 'badly-worn' || tier === 'near-failure') && pn.y - pf.y > 2) {
        drawCracks(pf, pn, l, wear, i);
      }
    }

    // Lane divider dashes. Drawn as tapered quads rather than strokes so the
    // marking narrows with distance instead of staying a constant-width line.
    if (dash) {
      const wf = Math.max(0.35, pf.scale * 0.14);   // ~14 cm of paint
      const wn = Math.max(0.5, pn.scale * 0.14);
      const alpha = 0.8 - fog * 0.55;
      const paint = `rgba(240, 240, 230, ${Math.max(0, alpha)})`;
      for (let l = 1; l < LANE_COUNT; l++) {
        const o = laneCenterOffset(l) - 1 / LANE_COUNT;
        const xf = laneScreenX(pf, o), xn = laneScreenX(pn, o);
        quad(ctx, xf - wf, pf.y, xf + wf, pf.y, xn + wn, pn.y, xn - wn, pn.y, paint);
      }
    }
  }

  function pavementColor(wear, stripe, closed, onBridge, laneIndex) {
    const tier = wearTier(wear);
    // Alternating per-lane tone keeps seven lanes readable as separate strips
    // even where the dashed markings are too small to resolve.
    const band = laneIndex % 2 ? 6 : 0;
    let base;
    if (onBridge) base = stripe ? [116, 116, 122] : [104, 104, 110];
    else base = stripe ? [70, 72, 78] : [62, 64, 70];
    base = base.map(c => c + band);

    if (closed) {
      // Closed lanes stay pristine — that contrast is the point (spec §14.4).
      base = (stripe ? [80, 82, 88] : [72, 74, 80]).map(c => c + band);
    } else if (tier === 'worn') {
      base = base.map(c => c - 6);
    } else if (tier === 'badly-worn') {
      base = base.map((c, k) => c - 12 + (k === 0 ? 8 : 0));
    } else if (tier === 'near-failure' || tier === 'failed') {
      base = [Math.min(255, base[0] + 14), base[1] - 8, base[2] - 12];
    }
    return `rgb(${base[0]},${base[1]},${base[2]})`;
  }

  function drawCracks(pf, pn, lane, wear, i) {
    const density = wear >= 95 ? 4 : wear >= 70 ? 3 : 1;
    ctx.strokeStyle = `rgba(24, 22, 24, ${0.18 + wear * 0.003})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let k = 0; k < density; k++) {
      const h = hash01(i * 31 + lane * 7 + k * 3);
      if (h < 0.4) continue;
      const o = laneCenterOffset(lane) + (h - 0.5) * (1.6 / LANE_COUNT);
      ctx.moveTo(laneScreenX(pf, o), pf.y);
      ctx.lineTo(laneScreenX(pn, o + (hash01(k + i) - 0.5) * 0.03), pn.y);
    }
    ctx.stroke();
  }

  /**
   * The canyon under the bridge — the literal fiscal cliff.
   *
   * Built as two solid polygons (the ground left and right of the deck) whose
   * inner edges follow the road in perspective, plus a full-width polygon
   * wherever the deck is missing. Solid paths rather than per-slice quads, so
   * no seams show between depth steps.
   */
  function drawCanyon(playerZ, camX, canyon, deck) {
    const [cz0, cz1] = canyon;
    if (cz1 - playerZ <= 1) return;

    const STEP = 3;
    const near = [], far = [];
    for (let z = Math.max(cz0, playerZ + 0.8); z <= cz1; z += STEP) {
      const p = projectRoad(z - playerZ, camX);
      near.push(p);
    }
    if (near.length < 2) return;

    // Shared gradient: light rock at the far rim, black in the depths.
    const g = ctx.createLinearGradient(0, near[near.length - 1].y, 0, near[0].y);
    g.addColorStop(0, '#4a4034');
    g.addColorStop(0.3, '#2b2520');
    g.addColorStop(1, '#080706');

    const RIM = 1.09;   // matches the shoulder edge

    // Left bank.
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, near[0].y);
    for (const p of near) ctx.lineTo(p.cx - p.halfW * RIM, p.y);
    ctx.lineTo(0, near[near.length - 1].y);
    ctx.closePath();
    ctx.fill();

    // Right bank.
    ctx.beginPath();
    ctx.moveTo(view.width, near[0].y);
    for (const p of near) ctx.lineTo(p.cx + p.halfW * RIM, p.y);
    ctx.lineTo(view.width, near[near.length - 1].y);
    ctx.closePath();
    ctx.fill();

    // Where the deck is absent the void spans the road corridor as well.
    if (deck) {
      const voidRuns = [[cz0, deck[0]], [deck[1], cz1]];
      for (const [a, bz] of voidRuns) {
        if (bz - a < 0.5) continue;
        const pts = near.filter(p => true);
        ctx.beginPath();
        let started = false;
        for (let z = Math.max(a, playerZ + 0.8); z <= bz; z += STEP) {
          const p = projectRoad(z - playerZ, camX);
          const x = p.cx - p.halfW * RIM;
          if (!started) { ctx.moveTo(x, p.y); started = true; } else ctx.lineTo(x, p.y);
        }
        if (!started) continue;
        for (let z = bz; z >= Math.max(a, playerZ + 0.8); z -= STEP) {
          const p = projectRoad(z - playerZ, camX);
          ctx.lineTo(p.cx + p.halfW * RIM, p.y);
        }
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  /* --------------------------------------------------------------- */
  /* Bridge structure                                                 */
  /* --------------------------------------------------------------- */

  function drawBridge(playerZ, camX, bridge) {
    const { z0, z1, intact, gapStart } = bridge;
    const maxDz = DRAW_DISTANCE * SEGMENT_LENGTH;
    const railEnd = intact ? z1 : (gapStart ?? z1);

    // Parapets along whatever deck still exists.
    for (let z = z0; z < railEnd; z += 12) {
      const dz = z - playerZ;
      if (dz < 2 || dz > maxDz) continue;
      const p = projectRoad(dz, camX);
      const h = p.scale * 1.1;              // ~1.1 m parapet
      const t = Math.max(1, p.scale * 0.25);
      for (const side of [-1.04, 1.04]) {
        const x = laneScreenX(p, side);
        ctx.fillStyle = 'rgba(210, 208, 200, 0.9)';
        ctx.fillRect(x - t / 2, p.y - h, t, h);
      }
    }

    if (intact) return;

    // A failed bridge has to be unmistakable well before the player reaches it
    // (spec §18.4): severed parapets alone read as a continuous road, because
    // the far abutment is still drawn beyond the gap.
    drawBrokenSpan(playerZ, camX, bridge, railEnd, maxDz);
  }

  /**
   * The missing span: a torn deck edge, dangling structure, and a barricade of
   * warning chevrons across the lanes at the brink.
   */
  function drawBrokenSpan(playerZ, camX, bridge, railEnd, maxDz) {
    const dz = railEnd - playerZ;
    if (dz <= 2 || dz > maxDz) return;
    const p = projectRoad(dz, camX);

    // Ragged concrete edge where the deck shears off.
    ctx.fillStyle = '#8a8580';
    ctx.beginPath();
    ctx.moveTo(p.cx - p.halfW * 1.06, p.y);
    for (let k = 0; k <= 16; k++) {
      const f = k / 16;
      ctx.lineTo(p.cx - p.halfW * 1.06 + f * p.halfW * 2.12,
                 p.y + hash01(k * 5) * p.scale * 0.5);
    }
    ctx.lineTo(p.cx + p.halfW * 1.06, p.y);
    ctx.closePath();
    ctx.fill();

    // Broken reinforcement hanging into the void.
    ctx.strokeStyle = '#5d5851';
    ctx.lineWidth = Math.max(1, p.scale * 0.06);
    ctx.beginPath();
    for (let k = 0; k < 14; k++) {
      const x = p.cx - p.halfW + (k / 13) * p.halfW * 2;
      const drop = p.scale * (0.4 + hash01(k * 7.7) * 1.1);
      ctx.moveTo(x, p.y);
      ctx.lineTo(x + (hash01(k * 3.1) - 0.5) * p.scale * 0.6, p.y + drop);
    }
    ctx.stroke();

    // Barricade across the brink: chevron panels, one per lane.
    const laneW = (p.halfW * 2) / LANE_COUNT;
    const bh = p.scale * 1.25;
    if (bh < 3) return;
    for (let l = 0; l < LANE_COUNT; l++) {
      const cx = laneScreenX(p, laneCenterOffset(l));
      const w = laneW * 0.92;
      const y = p.y - bh;
      ctx.fillStyle = '#e8620f';
      ctx.fillRect(cx - w / 2, y, w, bh);
      // Diagonal hazard stripes.
      ctx.save();
      ctx.beginPath();
      ctx.rect(cx - w / 2, y, w, bh);
      ctx.clip();
      ctx.strokeStyle = '#f7f2e8';
      ctx.lineWidth = Math.max(1.5, w * 0.10);
      for (let k = -2; k < 8; k++) {
        const ox = cx - w / 2 + k * w * 0.28;
        ctx.beginPath();
        ctx.moveTo(ox, y + bh);
        ctx.lineTo(ox + bh, y);
        ctx.stroke();
      }
      ctx.restore();
      ctx.strokeStyle = '#2a1a08';
      ctx.lineWidth = 1;
      ctx.strokeRect(cx - w / 2, y, w, bh);
    }

    // BRIDGE OUT sign above the barricade, readable from a distance.
    if (p.halfW > 70) {
      const fs = Math.max(9, p.scale * 1.0);
      ctx.font = `900 ${fs}px system-ui, -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const label = 'BRIDGE OUT';
      const tw = ctx.measureText(label).width + fs;
      const sy = p.y - bh - fs * 2.1;
      ctx.fillStyle = '#ffcf33';
      ctx.fillRect(p.cx - tw / 2, sy, tw, fs * 1.6);
      ctx.strokeStyle = '#3a2c00';
      ctx.lineWidth = 2;
      ctx.strokeRect(p.cx - tw / 2, sy, tw, fs * 1.6);
      ctx.fillStyle = '#2a2000';
      ctx.fillText(label, p.cx, sy + fs * 0.85);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    }
  }

  /* --------------------------------------------------------------- */
  /* Overhead gantry with lane boards                                 */
  /* --------------------------------------------------------------- */

  function drawGantry(playerZ, camX, gate, state) {
    const dz = gate.z - playerZ;
    // Only drawn in the band where the boards are actually legible: far enough
    // that it is not overhead and swallowing the frame, near enough that the
    // per-lane text can be read before the commit point.
    if (dz < 22 || dz > GANTRY_VISIBLE_DISTANCE) return;

    const p = projectRoad(dz, camX);
    const laneW = (p.halfW * 2) / LANE_COUNT;
    const boardH = p.scale * 1.6;              // ~1.6 m tall boards
    const gantryY = p.y - p.scale * 6.2;       // ~6.2 m clearance above the road
    if (boardH < 4) return;

    // Support legs and beam.
    const legW = Math.max(1, p.scale * 0.22);
    ctx.fillStyle = '#4a4f56';
    for (const side of [-1.10, 1.10]) {
      ctx.fillRect(laneScreenX(p, side) - legW / 2, gantryY, legW, p.y - gantryY);
    }
    ctx.fillRect(laneScreenX(p, -1.12), gantryY - boardH * 0.16,
                 p.halfW * 2.24, boardH * 0.16);

    // Event headline above the boards.
    const fs = Math.max(9, boardH * 0.62);
    ctx.font = `700 ${fs}px system-ui, -apple-system, "Segoe UI", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const hw = ctx.measureText(gate.event.label).width / 2 + fs * 0.5;
    ctx.fillStyle = 'rgba(12,14,18,0.88)';
    ctx.fillRect(p.cx - hw, gantryY - boardH * 1.45, hw * 2, fs * 1.5);
    ctx.fillStyle = '#ffd85e';
    ctx.fillText(gate.event.label, p.cx, gantryY - boardH * 1.45 + fs * 0.78);

    // Per-lane response boards.
    for (let l = 0; l < LANE_COUNT; l++) {
      const key = LANE_KEYS[l];
      const closed = state.closedLanes.includes(key);
      const failed = state.laneWear[key] >= 100;
      const x0 = laneScreenX(p, laneCenterOffset(l) - 1 / LANE_COUNT) + 1;
      const x1 = laneScreenX(p, laneCenterOffset(l) + 1 / LANE_COUNT) - 1;
      const w = x1 - x0;
      if (w < 5) continue;

      ctx.fillStyle = closed ? '#5a3a10' : failed ? '#3a1418' : '#12242e';
      ctx.fillRect(x0, gantryY, w, boardH);
      ctx.strokeStyle = 'rgba(255,255,255,0.28)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x0, gantryY, w, boardH);

      const lfs = Math.max(6, boardH * 0.29);
      const cx = (x0 + x1) / 2;
      ctx.font = `700 ${lfs}px system-ui, -apple-system, sans-serif`;
      ctx.fillStyle = closed ? '#ffb648' : failed ? '#ff8a8a' : '#8ee6ff';
      fitText(ctx, LANES[l].short, cx, gantryY + boardH * 0.30, w - 4, lfs);

      const resp = gate.event.responses[key];
      const detail = closed ? 'CLOSED' : failed ? 'LANE FAILED' : (resp?.display ?? '—');
      ctx.font = `600 ${lfs * 0.9}px system-ui, -apple-system, sans-serif`;
      ctx.fillStyle = closed || failed ? '#ffd9a8' : '#ffffff';
      fitText(ctx, detail, cx, gantryY + boardH * 0.72, w - 4, lfs * 0.9);
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  /* --------------------------------------------------------------- */
  /* Closed-lane barriers                                             */
  /* --------------------------------------------------------------- */

  function drawBarriers(state, playerZ, camX) {
    if (state.closedLanes.length === 0) return;

    const CONE_SPACING = 14;      // metres between cones along a lane edge
    const SIGN_SPACING = 120;     // metres between lane-closure sign boards
    const maxZ = playerZ + DRAW_DISTANCE * SEGMENT_LENGTH;

    // Far to near so nearer cones overdraw.
    const first = Math.ceil((playerZ + 2) / CONE_SPACING) * CONE_SPACING;
    const stops = [];
    for (let z = first; z < maxZ; z += CONE_SPACING) stops.push(z);
    stops.reverse();

    for (const z of stops) {
      const dz = z - playerZ;
      const p = projectRoad(dz, camX);
      // Cone height in metres, projected — keeps near cones from filling the screen.
      const h = (p.scale * 0.7);
      if (h < 0.8) continue;

      for (const key of state.closedLanes) {
        const l = LANE_KEYS.indexOf(key);
        // Cones straddle the lane edges, leaving the lane itself visible.
        for (const edge of [-1, 1]) {
          const o = laneCenterOffset(l) + edge / LANE_COUNT;
          drawCone(laneScreenX(p, o), p.y, h);
        }
      }
    }

    // Periodic sign boards, drawn far-to-near, above the closed lanes.
    const firstSign = Math.ceil((playerZ + 20) / SIGN_SPACING) * SIGN_SPACING;
    const signZs = [];
    for (let z = firstSign; z < maxZ; z += SIGN_SPACING) signZs.push(z);
    signZs.reverse();
    for (const z of signZs) {
      const dz = z - playerZ;
      // Near signs would fill the screen and hide the road, so only draw them
      // in the mid-distance band where they are readable and out of the way.
      if (dz < 45) continue;
      const p = projectRoad(dz, camX);
      for (const key of state.closedLanes) {
        drawClosedSign(p, LANE_KEYS.indexOf(key));
      }
    }
  }

  /** Traffic cone, `h` = projected height in pixels. */
  function drawCone(x, y, h) {
    const w = h * 0.55;
    ctx.fillStyle = '#e8620f';
    ctx.beginPath();
    ctx.moveTo(x, y - h);
    ctx.lineTo(x + w / 2, y);
    ctx.lineTo(x - w / 2, y);
    ctx.closePath();
    ctx.fill();
    if (h > 5) {
      ctx.fillStyle = '#f7f2e8';
      ctx.fillRect(x - w * 0.26, y - h * 0.62, w * 0.52, h * 0.17);
    }
  }

  function drawClosedSign(p, laneIndex) {
    // Sign panel sized to the lane it closes, floating just above the road.
    const laneW = (p.halfW * 2) / LANE_COUNT;
    const w = laneW * 0.94;
    const h = w * 0.40;
    if (w < 26) return;
    const x = laneScreenX(p, laneCenterOffset(laneIndex));
    const y = p.y - p.scale * 2.1;      // ~2.1 m above the surface

    ctx.fillStyle = '#e8620f';
    ctx.fillRect(x - w / 2, y - h, w, h);
    ctx.strokeStyle = '#2a1a08';
    ctx.lineWidth = Math.max(1, w * 0.02);
    ctx.strokeRect(x - w / 2, y - h, w, h);

    ctx.fillStyle = '#1a1208';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const fs = Math.max(6, h * 0.34);
    // Wording comes from the lane content module so the spec string is defined once.
    const [line1, line2] = CLOSED_SIGN_TEXT.split('—').map(t => t.trim());
    ctx.font = `800 ${fs}px system-ui, -apple-system, sans-serif`;
    fitText(ctx, line1, x, y - h * 0.66, w - 6, fs);
    ctx.font = `700 ${fs * 0.8}px system-ui, -apple-system, sans-serif`;
    fitText(ctx, line2, x, y - h * 0.28, w - 6, fs * 0.8);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  /* --------------------------------------------------------------- */
  /* Hazards, pickups, signs, traffic                                 */
  /* --------------------------------------------------------------- */

  function drawHazards(hazards, playerZ, camX, visibility = 1) {
    const maxDz = DRAW_DISTANCE * SEGMENT_LENGTH * visibility;
    const sorted = [...hazards].sort((a, b) => b.z - a.z);
    for (const h of sorted) {
      const dz = h.z - playerZ;
      if (dz < 1 || dz > maxDz) continue;
      const p = projectRoad(dz, camX);
      const x = laneScreenX(p, laneCenterOffset(h.lane));
      const laneW = (p.halfW * 2) / LANE_COUNT;
      const rw = laneW * 0.5 * h.size;
      const rh = rw * 0.34;
      if (rw < 0.6) continue;

      // Dark hole with a lighter broken rim so it reads at distance.
      ctx.fillStyle = 'rgba(20,18,20,0.92)';
      ellipse(ctx, x, p.y, rw, rh);
      ctx.fillStyle = 'rgba(140,130,120,0.55)';
      ellipse(ctx, x, p.y - rh * 0.22, rw * 0.92, rh * 0.55);
      ctx.fillStyle = 'rgba(10,8,10,0.95)';
      ellipse(ctx, x, p.y, rw * 0.78, rh * 0.72);
    }
  }

  function drawPickup(pickup, playerZ, camX, t) {
    const dz = pickup.z - playerZ;
    if (dz < 1 || dz > DRAW_DISTANCE * SEGMENT_LENGTH) return;
    const p = projectRoad(dz, camX);
    const x = laneScreenX(p, laneCenterOffset(pickup.lane));
    const s = p.scale * 0.5;          // ~0.5 m cash bundle
    if (s < 1.5) return;
    const bob = Math.sin(t * 0.005) * s * 0.25;
    const y = p.y - s * 1.6 + bob;

    // Cash bundle.
    ctx.fillStyle = '#2f7d4f';
    ctx.fillRect(x - s, y - s * 0.6, s * 2, s * 1.2);
    ctx.fillStyle = '#d8f0d8';
    ctx.fillRect(x - s * 0.9, y - s * 0.5, s * 1.8, s * 0.22);
    ctx.strokeStyle = '#eaf7ea';
    ctx.lineWidth = Math.max(1, s * 0.12);
    ctx.strokeRect(x - s, y - s * 0.6, s * 2, s * 1.2);
    ctx.fillStyle = '#eaf7ea';
    ctx.textAlign = 'center';
    ctx.font = `800 ${Math.max(6, s * 0.9)}px system-ui, sans-serif`;
    ctx.fillText('$', x, y + s * 0.32);

    if (s > 6) {
      const fs = Math.max(7, s * 0.62);
      ctx.font = `700 ${fs}px system-ui, sans-serif`;
      ctx.fillStyle = 'rgba(12,20,14,0.8)';
      const w = ctx.measureText(pickup.pickup.label).width + fs;
      ctx.fillRect(x - w / 2, y - s * 2.6, w, fs * 1.5);
      ctx.fillStyle = '#b6f0c4';
      ctx.fillText(pickup.pickup.label, x, y - s * 2.6 + fs * 1.05);
    }
    ctx.textAlign = 'left';
  }

  function drawRoadsideSign(sign, playerZ, camX) {
    const dz = sign.z - playerZ;
    if (dz < 2 || dz > DRAW_DISTANCE * SEGMENT_LENGTH) return;
    const p = projectRoad(dz, camX);
    const side = sign.side ?? 1;
    const x = laneScreenX(p, side * 1.28);
    const w = p.scale * 3.4;          // ~3.4 m wide panel
    const h = w * 0.46;
    if (w < 10) return;
    const postH = p.scale * 1.6;
    const y = p.y - postH;

    ctx.fillStyle = '#3a3f45';
    ctx.fillRect(x - w * 0.03, y, w * 0.06, postH);
    ctx.fillStyle = sign.warn ? '#ffcf33' : '#1f5b3a';
    ctx.fillRect(x - w / 2, y - h, w, h);
    ctx.strokeStyle = sign.warn ? '#3a2c00' : '#e8f2e8';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x - w / 2, y - h, w, h);
    ctx.fillStyle = sign.warn ? '#2a2000' : '#f0f7f0';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const lines = sign.text.split('\n');
    const fs = Math.max(5, (h / lines.length) * 0.56);
    ctx.font = `800 ${fs}px system-ui, -apple-system, sans-serif`;
    lines.forEach((line, i) => {
      fitText(ctx, line, x, y - h + (h / lines.length) * (i + 0.5), w - 6, fs);
    });
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  function drawNeighborCar(car, playerZ, camX, t) {
    const dz = car.z - playerZ;
    if (dz < -20 || dz > DRAW_DISTANCE * SEGMENT_LENGTH) return;
    const p = projectRoad(Math.max(dz, 1), camX);
    const x = laneScreenX(p, laneCenterOffset(car.lane));
    const w = p.scale * 1.8;          // ~1.8 m track width
    const h = w * 0.62;
    if (w < 2) return;

    // Rear of a car, seen from behind as it pulls away.
    ctx.fillStyle = car.bodyColor;
    roundRect(ctx, x - w / 2, p.y - h, w, h, w * 0.12);
    ctx.fill();
    ctx.fillStyle = car.roofColor;
    roundRect(ctx, x - w * 0.36, p.y - h * 1.42, w * 0.72, h * 0.5, w * 0.1);
    ctx.fill();
    // Rear window.
    ctx.fillStyle = 'rgba(40,60,80,0.85)';
    roundRect(ctx, x - w * 0.28, p.y - h * 1.34, w * 0.56, h * 0.34, w * 0.06);
    ctx.fill();
    // Tail lights.
    ctx.fillStyle = '#e04a3a';
    ctx.fillRect(x - w * 0.44, p.y - h * 0.72, w * 0.16, h * 0.2);
    ctx.fillRect(x + w * 0.28, p.y - h * 0.72, w * 0.16, h * 0.2);
    // Wheels.
    ctx.fillStyle = '#1a1a1c';
    ctx.fillRect(x - w * 0.54, p.y - h * 0.28, w * 0.12, h * 0.3);
    ctx.fillRect(x + w * 0.42, p.y - h * 0.28, w * 0.12, h * 0.3);

    // Waving arm out the window (spec §20.1, beat 2).
    if (w > 8) {
      const wave = Math.sin(t * 0.012) * 0.9;
      const ax = x + w * 0.34;
      const ay = p.y - h * 1.16;
      ctx.strokeStyle = '#e8c49a';
      ctx.lineWidth = Math.max(1.2, w * 0.07);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(ax + Math.cos(-0.5 + wave * 0.5) * w * 0.3,
                 ay - Math.abs(Math.sin(1.1 + wave * 0.4)) * h * 0.55);
      ctx.stroke();
      ctx.lineCap = 'butt';
    }

    // City label plate.
    if (w > 14) {
      const fs = Math.max(6, w * 0.22);
      ctx.font = `800 ${fs}px system-ui, -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(14,16,20,0.85)';
      const tw = ctx.measureText(car.name).width + fs * 0.8;
      ctx.fillRect(x - tw / 2, p.y - h * 2.0, tw, fs * 1.4);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(car.name, x, p.y - h * 2.0 + fs);
      ctx.textAlign = 'left';
    }
  }

  /**
   * Higher Office pickups (Higher Office addendum §6). Deliberately unlike the
   * ordinary green cash pickups: a glowing gold campaign banner.
   */
  function drawOfficePickup(playerZ, camX, pickup, t) {
    const dz = pickup.z - playerZ;
    if (dz < 1 || dz > DRAW_DISTANCE * SEGMENT_LENGTH) return;
    const p = projectRoad(dz, camX);
    const x = laneScreenX(p, laneCenterOffset(pickup.lane));
    const s = p.scale * 1.1;
    if (s < 2) return;
    const y = p.y - s * 1.5 + Math.sin(t * 0.006) * s * 0.12;
    const isWin = pickup.kind === 'win';

    // Shimmer halo.
    const pulse = 0.7 + Math.sin(t * 0.008) * 0.3;
    const halo = ctx.createRadialGradient(x, y, 0, x, y, s * 3.2);
    halo.addColorStop(0, `rgba(255, 236, 150, ${0.5 * pulse})`);
    halo.addColorStop(1, 'rgba(255, 210, 80, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(x, y, s * 3.2, 0, Math.PI * 2);
    ctx.fill();

    // Campaign-style banner on two posts.
    const bw = s * 3.4, bh = s * 1.15;
    ctx.fillStyle = '#6d5a1c';
    ctx.fillRect(x - bw / 2, y - bh / 2, s * 0.14, bh + s * 1.1);
    ctx.fillRect(x + bw / 2 - s * 0.14, y - bh / 2, s * 0.14, bh + s * 1.1);

    const g = ctx.createLinearGradient(x - bw / 2, 0, x + bw / 2, 0);
    g.addColorStop(0, isWin ? '#fff4c2' : '#ffd85e');
    g.addColorStop(0.5, isWin ? '#ffffff' : '#ffe89a');
    g.addColorStop(1, isWin ? '#fff4c2' : '#ffd85e');
    ctx.fillStyle = g;
    ctx.fillRect(x - bw / 2, y - bh / 2, bw, bh);
    ctx.strokeStyle = '#8a6d12';
    ctx.lineWidth = Math.max(1, s * 0.08);
    ctx.strokeRect(x - bw / 2, y - bh / 2, bw, bh);

    const fs = Math.max(6, bh * 0.30);
    ctx.font = `900 ${fs}px system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = '#3a2c00';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    fitText(ctx, isWin ? 'WIN' : 'RUN FOR', x, y - bh * 0.18, bw - s * 0.5, fs);
    fitText(ctx, 'HIGHER OFFICE!', x, y + bh * 0.20, bw - s * 0.5, fs);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    // Sparkle particles.
    ctx.fillStyle = `rgba(255, 250, 210, ${0.65 * pulse})`;
    for (let i = 0; i < 6; i++) {
      const a = t * 0.003 + i * 1.05;
      ctx.fillRect(x + Math.cos(a) * s * 2.4, y + Math.sin(a * 1.3) * s * 1.5,
                   Math.max(1, s * 0.09), Math.max(1, s * 0.09));
    }
  }

  /* --------------------------------------------------------------- */
  /* Player hood / dashboard                                          */
  /* --------------------------------------------------------------- */

  function drawHood(shake, laneOffset) {
    const y = view.height * 0.80 + shake;
    const tilt = laneOffset * view.width * 0.02;

    // Hood.
    ctx.fillStyle = '#1e5aa8';
    ctx.beginPath();
    ctx.moveTo(-view.width * 0.1 + tilt, view.height + 2);
    ctx.lineTo(view.width * 0.16 + tilt, y);
    ctx.quadraticCurveTo(view.width * 0.5 + tilt, y - view.height * 0.035,
                         view.width * 0.84 + tilt, y);
    ctx.lineTo(view.width * 1.1 + tilt, view.height + 2);
    ctx.closePath();
    ctx.fill();

    // Hood highlight and centre crease.
    ctx.strokeStyle = 'rgba(255,255,255,0.20)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(view.width * 0.16 + tilt, y);
    ctx.quadraticCurveTo(view.width * 0.5 + tilt, y - view.height * 0.035,
                         view.width * 0.84 + tilt, y);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.moveTo(view.width * 0.5 + tilt, y - view.height * 0.028);
    ctx.lineTo(view.width * 0.5 + tilt, view.height);
    ctx.stroke();

    // "BERKELEY BUDGET" plate on the hood.
    const fs = Math.max(9, view.height * 0.022);
    ctx.font = `800 ${fs}px system-ui, -apple-system, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.30)';
    ctx.fillText('BERKELEY BUDGET', view.width * 0.5 + tilt, y + view.height * 0.055);
    ctx.textAlign = 'left';
  }

  /* --------------------------------------------------------------- */

  return {
    view,
    resize,
    ctx,
    drawSky,
    drawRoad,
    drawBridge,
    drawGantry,
    drawBarriers,
    drawHazards,
    drawPickup,
    drawRoadsideSign,
    drawNeighborCar,
    drawOfficePickup,
    drawHood,
    drawRain,
    projectRoad,
    laneScreenX,
    clear() { ctx.clearRect(0, 0, view.width, view.height); }
  };
}

/* ------------------------------------------------------------------ */
/* Small drawing helpers                                               */
/* ------------------------------------------------------------------ */

function quad(ctx, x1, y1, x2, y2, x3, y3, x4, y4, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.lineTo(x3, y3);
  ctx.lineTo(x4, y4);
  ctx.closePath();
  ctx.fill();
}

function ellipse(ctx, x, y, rx, ry) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(rx, 0.4), Math.max(ry, 0.3), 0, 0, Math.PI * 2);
  ctx.fill();
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** Draw text shrunk to fit a maximum width, so signs never overflow. */
function fitText(ctx, text, x, y, maxWidth, baseSize) {
  let size = baseSize;
  const font = ctx.font;
  while (ctx.measureText(text).width > maxWidth && size > 4) {
    size -= 0.5;
    ctx.font = font.replace(/[\d.]+px/, `${size}px`);
  }
  ctx.fillText(text, x, y);
  ctx.font = font;
}

function applyFog(color, fog, rainLevel) {
  const m = color.match(/rgb\((\d+),(\d+),(\d+)\)/);
  if (!m) return color;
  const f = Math.min(1, fog * (0.55 + rainLevel * 0.12));
  const fogColor = rainLevel > 0 ? [140, 150, 160] : [143, 182, 216];
  const r = Math.round(+m[1] * (1 - f) + fogColor[0] * f);
  const g = Math.round(+m[2] * (1 - f) + fogColor[1] * f);
  const b = Math.round(+m[3] * (1 - f) + fogColor[2] * f);
  return `rgb(${r},${g},${b})`;
}

function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amount * 255));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amount * 255));
  const b = Math.max(0, Math.min(255, (n & 255) + amount * 255));
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}

/** Stable hash → [0,1), so decorative detail does not shimmer between frames. */
function hash01(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

