// City tour renderer (Reboot spec §38-§45, §76-§82).
//
// The drive is consequence, not decision. Same route every year so the player
// builds a memory of the place and notices what their budget did to it.

import { LANDMARKS, serviceLabel, businessLabel } from './content/city.js';

const ROAD_HALF = 15;       // metres centreline to shoulder
const CAM_HEIGHT = 6;
const CAM_DEPTH = 0.9;
const SEG = 8;
const DRAW = 80;

function hash01(n) {
  const s = Math.sin(n * 91.7 + 41.3) * 28711.5453;
  return s - Math.floor(s);
}

export function createTourRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { width: 0, height: 0, horizonY: 0, dpr: 1 };

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    view.width = Math.max(1, Math.round(rect.width));
    view.height = Math.max(1, Math.round(rect.height));
    view.horizonY = view.height * 0.42;
    view.dpr = dpr;
    canvas.width = view.width * dpr;
    canvas.height = view.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function project(dz, camX) {
    const d = Math.max(dz, 0.5);
    const f = CAM_DEPTH * view.width;
    const halfW = (f * ROAD_HALF) / d;
    return {
      y: view.horizonY + (f * CAM_HEIGHT) / d,
      halfW,
      cx: view.width / 2 - camX * halfW,
      scale: f / d
    };
  }

  const laneX = (p, o) => p.cx + o * p.halfW;

  /* ---------------- scene ---------------- */

  function draw(state, tour, t) {
    const W = view.width, H = view.height;
    const rain = state.weather.rainLevel;
    ctx.clearRect(0, 0, W, H);

    drawSky(W, H, rain, tour.timeOfDay);
    drawGround(W, H, rain);
    drawRoad(state, tour, t);
    drawLandmarks(state, tour, t);
    drawHazards(tour, t);
    if (rain > 0) drawRain(W, H, rain, t, tour.reducedMotion);
    drawHood(W, H, tour.shake);
  }

  function drawSky(W, H, rain, timeOfDay) {
    const g = ctx.createLinearGradient(0, 0, 0, view.horizonY + 10);
    if (rain > 0) {
      g.addColorStop(0, '#3a4653');
      g.addColorStop(0.55, '#6b7684');
      g.addColorStop(1, '#98a2ad');
    } else {
      g.addColorStop(0, '#1d3a63');
      g.addColorStop(0.55, '#4a7ab0');
      g.addColorStop(1, '#9dc0dc');
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, view.horizonY + 10);

    // Skyline.
    const base = view.horizonY + 2;
    ctx.fillStyle = `rgba(30, 40, 58, ${0.85 - rain * 0.12})`;
    let x = -20, i = 0;
    while (x < W + 20) {
      const h = (hash01(i) * 0.055 + 0.02) * H;
      const w = (hash01(i + 97) * 0.05 + 0.025) * W;
      ctx.fillRect(x, base - h, w, h);
      x += w + hash01(i + 31) * 12 + 4;
      i++;
    }
  }

  function drawGround(W, H, rain) {
    const g = ctx.createLinearGradient(0, view.horizonY, 0, H);
    const dim = rain * 0.12;
    g.addColorStop(0, shade('#3d5a3a', -dim));
    g.addColorStop(1, shade('#2a3f28', -dim));
    ctx.fillStyle = g;
    ctx.fillRect(0, view.horizonY, W, H - view.horizonY);
  }

  /** Street condition is both the consequence and the gameplay (§41, §80). */
  function drawRoad(state, tour, t) {
    const z = tour.distance;
    const camX = tour.camX;
    const streets = state.city.streets;
    const baseZ = Math.floor(z / SEG) * SEG;

    for (let i = DRAW; i >= 1; i--) {
      const zFar = baseZ + i * SEG, zNear = baseZ + (i - 1) * SEG;
      if (zNear - z <= 1) continue;
      const pf = project(zFar - z, camX), pn = project(zNear - z, camX);
      if (pn.y <= pf.y) continue;

      const band = Math.floor(zNear / SEG);
      const stripe = band % 2 === 0;
      const fog = Math.min(1, (zFar - z) / (DRAW * SEG));

      // Shoulders.
      const sf = pf.halfW * 1.08, sn = pn.halfW * 1.08;
      const shoulder = stripe ? '#b8332e' : '#e8e4dc';
      quad(pf.cx - sf, pf.y, pf.cx - pf.halfW, pf.y,
           pn.cx - pn.halfW, pn.y, pn.cx - sn, pn.y, fogged(shoulder, fog, rainOf(state)));
      quad(pf.cx + pf.halfW, pf.y, pf.cx + sf, pf.y,
           pn.cx + sn, pn.y, pn.cx + pn.halfW, pn.y, fogged(shoulder, fog, rainOf(state)));

      // Pavement tinted by street health: fresh and dark when maintained,
      // patchy and pale when deferred.
      let base = streets >= 3 ? [58, 60, 66]
        : streets === 2 ? [66, 66, 70]
        : streets === 1 ? [78, 74, 72]
        : [88, 82, 78];
      if (stripe) base = base.map(c => c + 5);
      quad(pf.cx - pf.halfW, pf.y, pf.cx + pf.halfW, pf.y,
           pn.cx + pn.halfW, pn.y, pn.cx - pn.halfW, pn.y,
           fogged(`rgb(${base[0]},${base[1]},${base[2]})`, fog, rainOf(state)));

      // Patches and cracks on a neglected street.
      if (streets <= 2 && band % 3 === 0) {
        ctx.fillStyle = `rgba(30, 28, 28, ${0.20 + (3 - streets) * 0.08})`;
        const px = laneX(pn, (hash01(band) - 0.5) * 1.4);
        ctx.fillRect(px, pf.y, Math.max(2, pn.halfW * 0.10), pn.y - pf.y);
      }

      // Centre dashes.
      if (band % 3 === 0) {
        const wf = Math.max(0.4, pf.scale * 0.14), wn = Math.max(0.6, pn.scale * 0.14);
        quad(pf.cx - wf, pf.y, pf.cx + wf, pf.y, pn.cx + wn, pn.y, pn.cx - wn, pn.y,
             `rgba(240,240,230,${Math.max(0, 0.8 - fog * 0.55)})`);
      }
    }
  }

  const rainOf = s => s.weather.rainLevel;

  /** Landmarks in fixed positions along the route (§39, §78). */
  function drawLandmarks(state, tour, t) {
    const routeLen = tour.routeLength;
    const items = [];
    for (const lm of LANDMARKS) {
      // Repeat the route so the tour reads as a loop through the same city.
      const lz = lm.at * routeLen;
      const dz = lz - tour.distance;
      if (dz < -30 || dz > DRAW * SEG) continue;
      items.push({ lm, dz });
    }
    items.sort((a, b) => b.dz - a.dz);
    for (const { lm, dz } of items) drawLandmark(state, tour, lm, dz, t);
  }

  function drawLandmark(state, tour, lm, dz, t) {
    const p = project(Math.max(dz, 1), tour.camX);
    const side = lm.side ?? 1;
    const level = state.city[lm.service] ?? 3;

    if (lm.kind === 'street') { drawPavingCrew(state, p, side); return; }
    if (lm.kind === 'corridor') { drawCorridor(state, p, t); return; }
    if (lm.kind === 'program') { drawProgramSite(state, tour, p, side); return; }
    if (lm.kind === 'park') { drawPark(state, p, side, level); return; }

    drawBuilding(p, side, lm, level);
  }

  function drawBuilding(p, side, lm, level) {
    const w = p.scale * 16, h = p.scale * 11;
    if (w < 8) return;
    const x = laneX(p, side * 2.3);
    const y = p.y;

    const dark = level <= 0;
    ctx.fillStyle = dark ? '#2a2b2f' : '#59504a';
    ctx.fillRect(x - w / 2, y - h, w, h);
    ctx.fillStyle = dark ? '#222327' : '#463f3a';
    ctx.fillRect(x - w / 2, y - h - h * 0.14, w, h * 0.14);

    // Windows: lit when the service is running, dark when it is not.
    const cols = 3, rows = 2;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const lit = !dark && (level >= 2 || (r + c) % 2 === 0);
        ctx.fillStyle = lit ? 'rgba(255, 226, 160, 0.85)' : 'rgba(22, 24, 30, 0.9)';
        ctx.fillRect(
          x - w * 0.36 + c * w * 0.26, y - h * 0.82 + r * h * 0.38,
          w * 0.17, h * 0.22
        );
      }
    }

    if (w > 26) {
      const label = level <= 0 ? lm.closedSign
        : level === 1 ? lm.reducedSign
        : lm.name;
      const warn = level <= 1;
      drawSign(x, y - h - p.scale * 1.4, w * 1.15, label, warn);
    }

    if (level <= 0) {
      // Chained gate.
      ctx.strokeStyle = '#8a8f98';
      ctx.lineWidth = Math.max(1, p.scale * 0.1);
      ctx.beginPath();
      ctx.moveTo(x - w * 0.3, y - h * 0.1);
      ctx.lineTo(x + w * 0.3, y - h * 0.32);
      ctx.stroke();
    }
  }

  function drawPark(state, p, side, level) {
    const x = laneX(p, side * 2.0);
    const s = p.scale * 5.5;
    if (s < 4) return;
    // Trees, thinning as maintenance falls away.
    const n = Math.max(1, level + 1);
    for (let i = 0; i < n; i++) {
      const tx = x + (i - (n - 1) / 2) * s * 1.1;
      ctx.fillStyle = '#5a4632';
      ctx.fillRect(tx - s * 0.08, p.y - s * 0.9, s * 0.16, s * 0.9);
      ctx.fillStyle = level >= 2 ? '#3f7a44' : level === 1 ? '#5d6b43' : '#6b6350';
      ctx.beginPath();
      ctx.arc(tx, p.y - s * 1.15, s * 0.55, 0, Math.PI * 2);
      ctx.fill();
    }
    if (level <= 1 && s > 10) {
      drawSign(x, p.y - s * 2.2, s * 4,
        level <= 0 ? 'PARK SERVICES — SUSPENDED' : 'PARK — REDUCED MAINTENANCE', true);
    }
  }

  /** Commercial corridor: vacancy is the tax-base story (§45, §82). */
  function drawCorridor(state, p, t) {
    const level = state.city.businessDistrict;
    const w = p.scale * 7.5, h = p.scale * 7.5;
    if (w < 5) return;
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const x = laneX(p, side * (1.9 + i * 0.85));
        const open = i < level + 1;
        ctx.fillStyle = open ? '#6a5b4a' : '#3f3d3c';
        ctx.fillRect(x - w / 2, p.y - h, w, h);
        // Shopfront.
        ctx.fillStyle = open ? 'rgba(255, 214, 140, 0.8)' : 'rgba(26, 26, 28, 0.9)';
        ctx.fillRect(x - w * 0.36, p.y - h * 0.5, w * 0.72, h * 0.42);
        if (!open && w > 22) {
          ctx.fillStyle = '#c8c2b4';
          ctx.font = `800 ${Math.max(5, w * 0.14)}px system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText('FOR LEASE', x, p.y - h * 0.22);
          ctx.textAlign = 'left';
        }
      }
    }
    if (w > 22) {
      drawSign(laneX(p, 0), p.y - h - p.scale * 2.6, w * 3.4,
        `COMMERCIAL CORRIDOR — ${businessLabel(level)}`, level <= 0);
    }
  }

  /** The prioritization contrast: a low-value program wound down (§25, §44). */
  function drawProgramSite(state, tour, p, side) {
    const w = p.scale * 12, h = p.scale * 8;
    if (w < 8) return;
    const x = laneX(p, side * 2.3);
    const ended = tour.flags.prioritized;

    ctx.fillStyle = ended ? '#3a3a3e' : '#565049';
    ctx.fillRect(x - w / 2, p.y - h, w, h);
    ctx.fillStyle = ended ? 'rgba(22,24,30,0.9)' : 'rgba(255, 226, 160, 0.7)';
    ctx.fillRect(x - w * 0.3, p.y - h * 0.6, w * 0.6, h * 0.36);

    if (w > 24) {
      drawSign(x, p.y - h - p.scale * 1.4, w * 1.3,
        ended ? tour.prioritizeSign : tour.programLabel, false);
    }
  }

  function drawPavingCrew(state, p, side) {
    const level = state.city.streets;
    const s = p.scale * 2.4;
    if (s < 2) return;
    const x = laneX(p, side * 1.9);
    if (level >= 3) {
      // Fresh work: a crew and a resurfaced sign.
      ctx.fillStyle = '#f0a01e';
      ctx.fillRect(x - s * 1.6, p.y - s * 1.5, s * 3.2, s * 1.5);
      ctx.fillStyle = '#2b2b2f';
      ctx.fillRect(x - s * 1.3, p.y - s * 0.4, s * 0.7, s * 0.4);
      ctx.fillRect(x + s * 0.6, p.y - s * 0.4, s * 0.7, s * 0.4);
      if (s > 6) drawSign(x, p.y - s * 3.2, s * 8, 'STREET RESURFACED', false);
    } else if (s > 6) {
      drawSign(x, p.y - s * 2.6, s * 8, 'PAVING DEFERRED', true);
    }
  }

  function drawSign(x, y, w, text, warn) {
    const h = w * 0.26;
    ctx.fillStyle = warn ? '#ffcf33' : '#1d5c2e';
    ctx.fillRect(x - w / 2, y - h, w, h);
    ctx.strokeStyle = warn ? '#3a2c00' : '#eaf4ea';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x - w / 2 + 1.5, y - h + 1.5, w - 3, h - 3);
    ctx.fillStyle = warn ? '#2a2000' : '#f4faf4';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let fs = Math.max(5, h * 0.44);
    ctx.font = `800 ${fs}px system-ui, -apple-system, sans-serif`;
    while (ctx.measureText(text).width > w - 8 && fs > 4) {
      fs -= 0.5;
      ctx.font = `800 ${fs}px system-ui, -apple-system, sans-serif`;
    }
    ctx.fillText(text, x, y - h / 2);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  /** Potholes: how bad streets actually feel to drive (§41). */
  function drawHazards(tour, t) {
    for (const h of tour.hazards) {
      const dz = h.z - tour.distance;
      if (dz < 1 || dz > DRAW * SEG) continue;
      const p = project(dz, tour.camX);
      const x = laneX(p, h.x);
      const rw = p.scale * 0.9 * h.size, rh = rw * 0.36;
      if (rw < 0.8) continue;
      ctx.fillStyle = 'rgba(18,16,18,0.92)';
      ellipse(x, p.y, rw, rh);
      ctx.fillStyle = 'rgba(140,130,120,0.5)';
      ellipse(x, p.y - rh * 0.22, rw * 0.9, rh * 0.5);
    }
  }

  function drawRain(W, H, rain, t, reduced) {
    const drops = reduced ? 0 : [0, 70, 150, 250][rain];
    ctx.strokeStyle = `rgba(200, 220, 240, ${0.16 + rain * 0.05})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let i = 0; i < drops; i++) {
      const x = (hash01(i * 3.7) * W + Math.sin(t * 0.0004 + i) * 12) % W;
      const y = (hash01(i * 7.13) * H + t * 0.9) % H;
      ctx.moveTo(x, y);
      ctx.lineTo(x - 3, y + 11 + rain * 4);
    }
    ctx.stroke();
    ctx.fillStyle = `rgba(150, 170, 190, ${0.04 * rain})`;
    ctx.fillRect(0, 0, W, H);
  }

  function drawHood(W, H, shake) {
    const y = H * 0.90 + (shake || 0);
    ctx.fillStyle = '#1e5aa8';
    ctx.beginPath();
    ctx.moveTo(-W * 0.1, H + 2);
    ctx.lineTo(W * 0.24, y);
    ctx.quadraticCurveTo(W * 0.5, y - H * 0.028, W * 0.76, y);
    ctx.lineTo(W * 1.1, H + 2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(W * 0.24, y);
    ctx.quadraticCurveTo(W * 0.5, y - H * 0.028, W * 0.76, y);
    ctx.stroke();
  }

  /* ---------------- helpers ---------------- */

  function quad(x1, y1, x2, y2, x3, y3, x4, y4, fill) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.lineTo(x4, y4);
    ctx.closePath(); ctx.fill();
  }

  function ellipse(x, y, rx, ry) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(rx, 0.4), Math.max(ry, 0.3), 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function fogged(color, fog, rain) {
    const m = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    let r, g, b;
    if (m) { r = +m[1]; g = +m[2]; b = +m[3]; }
    else {
      const n = parseInt(color.slice(1), 16);
      r = (n >> 16) & 255; g = (n >> 8) & 255; b = n & 255;
    }
    const f = Math.min(1, fog * (0.5 + rain * 0.1));
    const fc = rain > 0 ? [150, 160, 172] : [157, 192, 220];
    return `rgb(${Math.round(r * (1 - f) + fc[0] * f)},${Math.round(g * (1 - f) + fc[1] * f)},${Math.round(b * (1 - f) + fc[2] * f)})`;
  }

  function shade(hex, amount) {
    const n = parseInt(hex.slice(1), 16);
    const c = i => Math.max(0, Math.min(255, ((n >> i) & 255) + amount * 255));
    return `rgb(${Math.round(c(16))},${Math.round(c(8))},${Math.round(c(0))})`;
  }

  return { view, resize, draw, project };
}
