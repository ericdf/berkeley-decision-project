// HOPKINS — one council decision, lived through three ways.
// (Hopkins Episode Spec; authored linear sequence per §4, §40, §41.)

import { RECORD, BANNERS, TRANSITION_TITLE, CHAPTERS, SCENES, END } from './content.js';
import {
  drawShopRow, drawCafe, drawHouseRow,
  drawBicycle, drawCar, drawBus, drawFireTruck, drawBin
} from './sprites.js';

const T = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * Headless tests drive the whole three-game sequence, which runs several
 * minutes at normal pace. This scales scene lengths only; it is never set in
 * normal play.
 */
const paceScale = () => (window.__BBD_TEST__?.hopkinsScale) || 1;
const secs = (n) => n / paceScale();

export function createHopkins({ canvas, ui, audio, hud, reducedMotion, onExit }) {
  const ctx = canvas.getContext('2d');
  const view = { w: 0, h: 0 };
  let raf = 0;
  let scene = null;

  const stats = {
    crossingTime: 0, bikeBells: 0, nearMisses: 0,
    marketVisits: 0, emergencyDelay: 0,
    cansDodged: 0, cansClipped: 0
  };

  function resize() {
    const r = canvas.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;   // screen not visible yet
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    view.w = Math.max(1, Math.round(r.width));
    view.h = Math.max(1, Math.round(r.height));
    canvas.width = view.w * dpr;
    canvas.height = view.h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  const hash01 = n => { const s = Math.sin(n * 91.7 + 41.3) * 28711.5; return s - Math.floor(s); };

  /* ================= PART I — Council cold open ================= */

  async function councilColdOpen() {
    let burn = 0;          // 0..1 across the first banner
    let clock = 90;        // compressed 1:30 (§10)
    let swapped = false;
    let voteShown = false;
    let hands = 0;

    drawLoop(now => {
      drawChamber(now);
      drawBanner(swapped ? BANNERS.second : BANNERS.first, burn, swapped);
      if (!swapped) drawQuote();
      if (clock > 0) drawClock(clock);
      drawDais(hands, now);
      if (voteShown) drawVote();
    });

    hud.announce('Berkeley City Council. A motion on Hopkins Street is under consideration.');
    await T(1400);

    // Quote lands, then the earnest banner catches (§8, §9).
    ui.caption(quoteLine(), 3200);
    await T(2600);

    audio.whoosh?.();
    // The stamp comes down hard, then holds.
    for (let i = 0; i <= 12; i++) { burn = i / 12; await T(reducedMotion() ? 8 : 22); }
    audio.stamp?.();
    await T(reducedMotion() ? 200 : 700);
    hud.announce(`The banner reading ${BANNERS.first} burns away.`);
    await T(500);

    // Ninety seconds compressed into a spin, not endured (§10).
    ui.caption('1:30', 1200);
    const spinFor = reducedMotion() ? 500 : 1500;
    const t0 = performance.now();
    while (performance.now() - t0 < spinFor) {
      clock = Math.max(0, 90 * (1 - (performance.now() - t0) / spinFor));
      await T(30);
    }
    clock = 0;

    swapped = true; burn = 0;
    audio.stamp?.();
    hud.announce(
      `Ninety seconds later the banner reads ${BANNERS.second}. ` +
      RECORD.reversal.summary
    );
    await T(1200);

    // Hands go up, then the tally (§12, §13).
    for (let i = 1; i <= 9; i++) { hands = i; audio.leverClick?.(); await T(reducedMotion() ? 40 : 130); }
    await T(300);
    voteShown = true;
    audio.tallyImpact?.();
    hud.announce(`${RECORD.vote.tally}. ${RECORD.vote.result}.`);
    await T(1900);
  }

  function quoteLine() {
    // Unverified wording is never attributed to a named person.
    return RECORD.quote.verified
      ? `“${RECORD.quote.text}” — ${RECORD.quote.attributionWhenVerified}`
      : RECORD.quote.paraphrase;
  }

  function drawChamber(now) {
    const { w, h } = view;
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#171c26'); g.addColorStop(1, '#0f131a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(46,38,30,0.5)';
    ctx.fillRect(w * 0.06, h * 0.10, w * 0.88, h * 0.56);
    for (let i = 0; i < 5; i++) {
      const lx = w * (0.16 + i * 0.18);
      const gl = ctx.createRadialGradient(lx, h * 0.04, 0, lx, h * 0.04, h * 0.26);
      gl.addColorStop(0, 'rgba(255,244,214,0.14)'); gl.addColorStop(1, 'rgba(255,244,214,0)');
      ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(lx, h * 0.04, h * 0.26, 0, Math.PI * 2); ctx.fill();
    }
  }

  /**
   * The banner for a motion. `burn` is now the stamp animation: the first
   * substitute does not catch fire, it gets stamped FAILED, which is what
   * actually happened to it.
   */
  function drawBanner(text, burn, clean) {
    const { w, h } = view;
    const bw = w * 0.72, bh = h * 0.12, x = w * 0.5 - bw / 2, y = h * 0.14;

    ctx.save();
    ctx.fillStyle = clean ? '#f4f7f4' : '#e8e2cf';
    ctx.fillRect(x, y, bw, bh);
    ctx.strokeStyle = clean ? '#2b6cb0' : '#8a7f5f';
    ctx.lineWidth = 3; ctx.strokeRect(x + 2, y + 2, bw - 4, bh - 4);
    ctx.fillStyle = '#1b1f26';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    let fs = Math.max(12, bh * 0.42);
    ctx.font = `900 ${fs}px ui-sans-serif, system-ui, sans-serif`;
    while (ctx.measureText(text).width > bw - 30 && fs > 8) {
      fs -= 1; ctx.font = `900 ${fs}px ui-sans-serif, system-ui, sans-serif`;
    }
    ctx.fillText(text, w * 0.5, y + bh / 2);

    // FAILED, stamped across it. It slams down oversized and settles.
    if (burn > 0) {
      const t = Math.min(1, burn);
      const settle = t < 0.35 ? 1 + (0.35 - t) * 4 : 1;
      ctx.save();
      ctx.globalAlpha = Math.min(1, t * 3);
      ctx.translate(w * 0.5, y + bh * 0.52);
      ctx.rotate(-0.16);
      ctx.scale(settle, settle);
      const sfs = bh * 0.62;
      ctx.font = `900 ${sfs}px ui-sans-serif, system-ui, sans-serif`;
      const label = 'FAILED';
      const tw = ctx.measureText(label).width;
      const pad = sfs * 0.42;
      ctx.strokeStyle = '#c8322f';
      ctx.lineWidth = Math.max(3, sfs * 0.13);
      ctx.strokeRect(-tw / 2 - pad, -sfs * 0.72, tw + pad * 2, sfs * 1.44);
      ctx.fillStyle = 'rgba(200,50,47,0.14)';
      ctx.fillRect(-tw / 2 - pad, -sfs * 0.72, tw + pad * 2, sfs * 1.44);
      ctx.fillStyle = '#c8322f';
      ctx.fillText(label, 0, 0);
      ctx.restore();
    }
    ctx.restore();
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  }

  function drawQuote() { /* rendered as a DOM caption for legibility */ }

  function drawClock(sec) {
    const { w, h } = view;
    const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
    const text = `${m}:${String(s).padStart(2, '0')}`;
    ctx.font = `900 ${Math.max(18, h * 0.075)}px ui-monospace, Menlo, monospace`;
    ctx.textAlign = 'center';
    ctx.fillStyle = sec > 0 ? '#ffd043' : '#ff6b5e';
    ctx.fillText(text, w * 0.5, h * 0.42);
    ctx.textAlign = 'left';
  }

  /**
   * The dais. Votes read as a scoreboard rather than as raised hands: seven
   * green checks and two red crosses, which is what the roll call was.
   * @param cast how many of the nine seats have voted so far
   */
  function drawDais(cast, now) {
    const { w, h } = view;
    const y = h * 0.74;
    const ayes = RECORD.vote.ayes ?? 7;

    ctx.fillStyle = '#4a3a28';
    ctx.fillRect(w * 0.08, y, w * 0.84, h * 0.13);

    for (let i = 0; i < 9; i++) {
      const cx = w * (0.145 + i * 0.089);

      // Seat: head and shoulders behind the bench.
      ctx.fillStyle = '#0e131c';
      ctx.beginPath(); ctx.arc(cx, y - h * 0.075, w * 0.019, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(cx - w * 0.028, y - h * 0.055, w * 0.056, h * 0.055);

      if (i >= cast) continue;

      // The vote card above the seat. Ayes first, then the two against.
      const aye = i < ayes;
      const r = w * 0.019;
      const my = y - h * 0.125;
      ctx.strokeStyle = aye ? '#3fbf6a' : '#e04a3f';
      ctx.lineWidth = Math.max(2.5, w * 0.006);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      if (aye) {
        ctx.moveTo(cx - r * 0.75, my);
        ctx.lineTo(cx - r * 0.2, my + r * 0.6);
        ctx.lineTo(cx + r * 0.8, my - r * 0.7);
      } else {
        ctx.moveTo(cx - r * 0.6, my - r * 0.6);
        ctx.lineTo(cx + r * 0.6, my + r * 0.6);
        ctx.moveTo(cx + r * 0.6, my - r * 0.6);
        ctx.lineTo(cx - r * 0.6, my + r * 0.6);
      }
      ctx.stroke();
      ctx.lineCap = 'butt';
    }
  }

  function drawVote() {
    const { w, h } = view;
    ctx.fillStyle = 'rgba(6,9,14,0.86)';
    ctx.fillRect(w * 0.30, h * 0.46, w * 0.40, h * 0.18);
    ctx.strokeStyle = '#ffd043'; ctx.lineWidth = 3;
    ctx.strokeRect(w * 0.30, h * 0.46, w * 0.40, h * 0.18);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd043';
    ctx.font = `900 ${Math.max(24, h * 0.085)}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillText(RECORD.vote.tally, w * 0.5, h * 0.545);
    ctx.fillStyle = '#f2f5f8';
    ctx.font = `800 ${Math.max(11, h * 0.03)}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillText(RECORD.vote.result, w * 0.5, h * 0.60);
    ctx.textAlign = 'left';
  }

  /* ================= PART II — The Hopkins of Tomorrow ================= */

  /**
   * The title card. Shown once at the reveal, then again before each of the
   * three games with its own subtitle, so every chapter opens the same way.
   */
  async function tomorrowTransition(subtitle) {
    let reveal = 0, bloom = 1, sub = 0;
    drawLoop(now => {
      drawFutureCard(reveal, bloom, now, subtitle, sub);
    });
    audio.cheer?.();
    hud.announce(subtitle ? `${TRANSITION_TITLE}. ${subtitle}` : TRANSITION_TITLE);
    const dur = reducedMotion() ? 350 : 900;
    let t0 = performance.now();
    while (performance.now() - t0 < dur) {
      const f = (performance.now() - t0) / dur;
      bloom = 1 - f; reveal = f; await T(24);
    }
    reveal = 1; bloom = 0;

    // The subtitle lands after the title has finished writing itself.
    if (subtitle) {
      const sdur = reducedMotion() ? 200 : 420;
      t0 = performance.now();
      while (performance.now() - t0 < sdur) {
        sub = (performance.now() - t0) / sdur; await T(24);
      }
      sub = 1;
    }
    await T(reducedMotion() ? 600 : subtitle ? 1500 : 1700);
  }

  function drawFutureCard(reveal, bloom, now, subtitle, sub = 0) {
    const { w, h } = view;
    // Optimistic 1950s-TV palette, generically evoked (§16).
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#8fd0e8'); g.addColorStop(0.6, '#cdeaf3'); g.addColorStop(1, '#f2e6c8');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);

    // Simplified illustrated streetscape.
    ctx.fillStyle = 'rgba(120,150,120,0.5)';
    ctx.fillRect(0, h * 0.62, w, h * 0.38);
    for (let i = 0; i < 7; i++) {
      const bx = w * (0.06 + i * 0.135), bh2 = h * (0.10 + hash01(i) * 0.08);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillRect(bx, h * 0.62 - bh2, w * 0.09, bh2);
    }

    // Cursive title on a gentle arc, revealed left to right (§15).
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, w * reveal, h); ctx.clip();
    const fs = Math.max(22, w * 0.052);
    ctx.font = `italic 700 ${fs}px "Snell Roundhand", "Apple Chancery", "Segoe Script", cursive`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const chars = [...TRANSITION_TITLE];
    const spread = Math.min(w * 0.82, chars.length * fs * 0.52);
    chars.forEach((ch, i) => {
      const f = chars.length > 1 ? i / (chars.length - 1) : 0.5;
      const x = w * 0.5 + (f - 0.5) * spread;
      const y = h * 0.34 - Math.sin(f * Math.PI) * h * 0.05;
      ctx.save(); ctx.translate(x, y); ctx.rotate((f - 0.5) * 0.24);
      ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fillText(ch, 2, 3);
      ctx.fillStyle = '#c8322f'; ctx.fillText(ch, 0, 0);
      ctx.restore();
    });
    ctx.restore();

    // Chapter subtitle, dropped in under the title once it has been written.
    if (subtitle && sub > 0) {
      ctx.save();
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.globalAlpha = Math.min(1, sub);
      const sfs = Math.max(15, w * 0.034);
      ctx.font = `800 ${sfs}px ui-sans-serif, system-ui, sans-serif`;
      const sy = h * 0.47 + (1 - Math.min(1, sub)) * h * 0.03;
      const tw = ctx.measureText(subtitle).width;
      // A solid marquee plate, so the subtitle reads against the bright sky.
      const px = sfs * 0.7, py = sfs * 0.5;
      ctx.fillStyle = '#c8322f';
      ctx.fillRect(w * 0.5 - tw / 2 - px, sy - sfs * 0.62 - py, tw + px * 2, sfs * 1.24 + py * 2);
      ctx.strokeStyle = 'rgba(255,252,240,0.9)';
      ctx.lineWidth = Math.max(2, sfs * 0.09);
      ctx.strokeRect(w * 0.5 - tw / 2 - px, sy - sfs * 0.62 - py, tw + px * 2, sfs * 1.24 + py * 2);
      ctx.fillStyle = '#fff8e8';
      ctx.fillText(subtitle, w * 0.5, sy);
      ctx.restore();
    }

    // Sparkles and vignette.
    for (let i = 0; i < 8; i++) {
      const sx = w * hash01(i * 5.1), sy = h * (0.12 + hash01(i * 7.7) * 0.3);
      const tw = 0.5 + 0.5 * Math.sin(now * 0.006 + i);
      ctx.fillStyle = `rgba(255,255,255,${0.7 * tw})`;
      ctx.fillRect(sx - 1, sy - 5, 2, 10); ctx.fillRect(sx - 5, sy - 1, 10, 2);
    }
    const vg = ctx.createRadialGradient(w/2, h/2, Math.min(w,h)*0.35, w/2, h/2, Math.max(w,h)*0.72);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
    if (bloom > 0) { ctx.fillStyle = `rgba(255,255,255,${bloom})`; ctx.fillRect(0, 0, w, h); }
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  }

  /* ================= PART III — Crossing Hopkins ================= */

  function crossingGame() {
    return new Promise(resolve => {
      // Lanes: sidewalk, cycle track, two motor lanes, cycle track, sidewalk.
      const lanes = [
        { kind: 'walk' },
        { kind: 'bike', dir: 1, speed: 210, gap: 300 },
        { kind: 'car',  dir: 1, speed: 150, gap: 460 },
        { kind: 'car',  dir: -1, speed: 165, gap: 500 },
        { kind: 'bike', dir: -1, speed: 240, gap: 320 },
        { kind: 'walk' }
      ];
      const traffic = lanes.map((l, i) => {
        if (l.kind === 'walk') return [];
        const out = [];
        const tones = ['#c8552f', '#4a6f9c', '#8a8f96', '#6b7f52', '#9c6b3f'];
        // Jitter the spacing but never below a full vehicle length, so the
        // lane reads as separate vehicles rather than a pile-up.
        for (let x = -200; x < 2600; x += l.gap * (1.0 + hash01(i * 9 + x) * 0.5)) {
          out.push({ x, tone: tones[Math.floor(hash01(i * 31 + x) * tones.length)] });
        }
        return out;
      });

      let row = 0, px = 0.5, t0 = performance.now(), done = false;
      let hits = 0, failT = 0, failing = false;
      ui.showHint(`← → move along the kerb · ↑ step across · ${SCENES.crossing.maxHits} knocks and you are done`);
      hud.announce('Cross Hopkins Street. The market is on the far side.');
      audio.gate?.();

      const key = e => {
        if (done) return;
        if (e.key === 'ArrowUp' || e.key === 'w') { row = Math.min(lanes.length - 1, row + 1); step(); }
        if (e.key === 'ArrowDown' || e.key === 's') row = Math.max(0, row - 1);
        if (e.key === 'ArrowLeft' || e.key === 'a') px = Math.max(0.05, px - 0.06);
        if (e.key === 'ArrowRight' || e.key === 'd') px = Math.min(0.95, px + 0.06);
        e.preventDefault();
      };
      window.addEventListener('keydown', key);

      function step() {
        if (row >= lanes.length - 1) finish();
      }
      function finish(failed) {
        if (done) return;
        done = true;
        stats.crossingTime = (performance.now() - t0) / 1000;
        stats.crossingFailed = !!failed;
        window.removeEventListener('keydown', key);
        ui.showHint('');
        resolve();
      }

      drawLoop((now, dt) => {
        // Advance traffic.
        lanes.forEach((l, i) => {
          if (l.kind === 'walk') return;
          // Wrap by a fixed span rather than snapping to the edge: resetting
          // every vehicle to the same x makes an evenly spaced lane collapse
          // into clumps within a few laps.
          const span = view.w + 260;
          for (const v of traffic[i]) {
            v.x += l.dir * l.speed * dt;
            if (l.dir > 0 && v.x > view.w + 130) v.x -= span;
            if (l.dir < 0 && v.x < -130) v.x += span;
          }
        });
        drawCrossing(lanes, traffic, row, px, now, failing ? Math.min(1, failT / 1.6) : 0);

        // Collision: a bell and a step back, never injury (§21). Five of them
        // and the trip is over — the errand simply does not get done.
        const lane = lanes[row];
        if (!failing && lane.kind !== 'walk') {
          const x = px * view.w;
          for (const v of traffic[row]) {
            if (Math.abs(v.x - x) < view.w * 0.035) {
              if (lane.kind === 'bike') { stats.bikeBells++; audio.hornChirp?.(); }
              else { stats.nearMisses++; audio.pothole?.(); }
              hits++;
              stats.crossingHits = hits;
              row = Math.max(0, row - 1);
              if (hits >= SCENES.crossing.maxHits) {
                failing = true;
                failT = 0;
                hud.announce(SCENES.crossing.failed);
              }
              break;
            }
          }
        }
        if (failing) {
          failT += dt;
          const { w, h } = view;
          ctx.fillStyle = `rgba(10,12,16,${Math.min(0.82, failT * 1.1)})`;
          ctx.fillRect(0, 0, w, h);
          ctx.save();
          ctx.textAlign = 'center';
          ctx.globalAlpha = Math.min(1, failT * 1.6);
          ctx.fillStyle = '#ff8a7a';
          const fs = Math.max(15, Math.min(h * 0.05, w * 0.038));
          ctx.font = `900 ${fs}px ui-sans-serif, system-ui, sans-serif`;
          wrapText(ctx, SCENES.crossing.failed, w * 0.5, h * 0.46, w * 0.7, fs * 1.3);
          ctx.restore();
          ctx.textAlign = 'left';
          if (failT > 2.6) finish(true);
        }
      });
    });
  }

  function drawCrossing(lanes, traffic, row, px, now, ruin = 0) {
    const { w, h } = view;
    ctx.fillStyle = '#1b2029'; ctx.fillRect(0, 0, w, h);

    // The parade of shops the corridor is meant to serve, along the far kerb.
    const shopH = h * 0.15;
    const shopY = h * 0.02;
    drawShopRow(ctx, w * 0.03, shopY, w * 0.94, shopH, { damage: ruin });

    const top = h * 0.22, laneH = (h * 0.6) / lanes.length;

    lanes.forEach((l, i) => {
      const y = top + (lanes.length - 1 - i) * laneH;
      ctx.fillStyle = l.kind === 'walk' ? '#5d6470'
        : l.kind === 'bike' ? '#2f5d43' : '#3a3f47';
      ctx.fillRect(0, y, w, laneH);
      if (l.kind === 'car') {
        ctx.strokeStyle = 'rgba(240,240,230,0.5)';
        ctx.setLineDash([18, 16]); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0, y + laneH / 2); ctx.lineTo(w, y + laneH / 2); ctx.stroke();
        ctx.setLineDash([]);
      }
      for (const v of traffic[i]) {
        const cy = y + laneH * 0.52;
        if (l.kind === 'car') {
          drawCar(ctx, v.x, cy, w * 0.085, laneH * 0.95, l.dir, v.tone || '#c8552f');
        } else {
          drawBicycle(ctx, v.x, cy, laneH * 0.78, l.dir, v.x * 0.05 * l.dir);
        }
      }
    });

    // CAFE on the lower right, past the crossing.
    drawCafe(ctx, w * 0.74, top + lanes.length * laneH + h * 0.01, w * 0.22, h * 0.11, ruin);

    // Pedestrian.
    const py = top + (lanes.length - 1 - row) * laneH + laneH / 2;
    ctx.fillStyle = '#7fd4ff';
    ctx.beginPath(); ctx.arc(px * w, py - laneH * 0.16, laneH * 0.13, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(px * w - laneH * 0.10, py - laneH * 0.05, laneH * 0.2, laneH * 0.3);
  }

  /* ================= PART IV — Market reveal ================= */

  async function marketReveal() {
    drawLoop(() => {
      const { w, h } = view;
      ctx.fillStyle = '#15181f'; ctx.fillRect(0, 0, w, h);
      const bw = w * 0.5, bh = h * 0.42, x = w * 0.5 - bw / 2, y = h * 0.28;
      ctx.fillStyle = '#3b332c'; ctx.fillRect(x, y, bw, bh);
      ctx.fillStyle = '#14161b'; ctx.fillRect(x + bw * 0.1, y + bh * 0.3, bw * 0.8, bh * 0.5);
      // Roll-down shutter.
      ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 2;
      for (let sy = y + bh * 0.3; sy < y + bh * 0.8; sy += 8) {
        ctx.beginPath(); ctx.moveTo(x + bw * 0.1, sy); ctx.lineTo(x + bw * 0.9, sy); ctx.stroke();
      }
      ctx.textAlign = 'center';
      // A hand-lettered thank-you taped in the window, not a CLOSED stamp.
      ctx.fillStyle = '#e8dcc4';
      const fs = Math.max(11, Math.min(h * 0.036, bw * 0.052));
      ctx.font = `700 italic ${fs}px ui-serif, Georgia, serif`;
      wrapText(ctx, SCENES.market.closed, w * 0.5, y + bh * 0.46, bw * 0.74, fs * 1.35);
      ctx.textAlign = 'left';

      // FOR LEASE as a banner strung across the frontage — the sign the
      // landlord put up, not a footnote under the thank-you note.
      const bfs = Math.max(15, Math.min(h * 0.055, bw * 0.1));
      ctx.save();
      ctx.translate(w * 0.5, y + bh * 0.84);
      ctx.rotate(-0.045);
      ctx.font = `900 ${bfs}px ui-sans-serif, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const btw = ctx.measureText(SCENES.market.lease).width;
      const bw2 = Math.min(bw * 1.08, btw + bfs * 2.2);
      const bh2 = bfs * 1.9;
      ctx.fillStyle = '#f2ede0';
      ctx.fillRect(-bw2 / 2, -bh2 / 2, bw2, bh2);
      ctx.strokeStyle = '#c8322f';
      ctx.lineWidth = Math.max(3, bfs * 0.16);
      ctx.strokeRect(-bw2 / 2, -bh2 / 2, bw2, bh2);
      ctx.fillStyle = '#c8322f';
      ctx.letterSpacing = `${bfs * 0.08}px`;
      ctx.fillText(SCENES.market.lease, 0, 0);
      ctx.letterSpacing = '0px';
      ctx.restore();
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign = 'left';
    });
    // No narrator explains causation — the juxtaposition is the joke (§23).
    hud.announce('The market is closed.');
    await T(SCENES.market.holdMs);
  }

  /* ================= PART V — Fire in the Hills ================= */

  // Side-on, same camera as the crossing: the same storefronts along the top,
  // the same bike traffic flowing. The engine runs right to left, the buses
  // run left to right, and the street the redesign left them has room for
  // exactly one of those things at a time.
  function emergencyGame() {
    return new Promise(resolve => {
      const S = SCENES.emergency;
      let elapsed = 0, done = false;
      let truckX = 1.16;              // fraction of width, starts offscreen right
      let steer = 0;
      let blocked = 0;
      let stalled = false;
      let stallTime = 0;
      let phase = 'run';              // run | fireball | aftermath
      let fireT = 0;

      // Buses share the motor lane, travelling the other way.
      // One bus, positioned so the engine gets halfway down the street before
      // meeting it. Cars queue behind the bus in its lane and run normally in
      // the other — until the engine straddles the centre line, at which point
      // everything stops and still nothing can get past.
      const traffic = [
        { x: 0.1, speed: 0.028, dir: 1, bus: true },
        { x: -0.12, speed: 0.028, dir: 1 },
        { x: -0.32, speed: 0.028, dir: 1 },
        { x: 1.3, speed: 0.05, dir: -1 },
        { x: 1.74, speed: 0.05, dir: -1 },
        { x: 2.16, speed: 0.05, dir: -1 }
      ];
      const bus = traffic[0];
      // Bikes keep flowing throughout, including after the fire (§ user).
      // Each track runs one way: the upper one travels left, the lower one
      // right, so the two flows read as opposite sides of the street.
      const bikes = [];
      const perLane = 6;
      for (let lane = 0; lane < 2; lane++) {
        const dir = lane === 0 ? -1 : 1;
        for (let i = 0; i < perLane; i++) {
          bikes.push({
            x: -0.15 + (i / perLane) * 1.4 + hash01(lane * 31 + i) * 0.05,
            lane,                            // 0 = upper track, 1 = lower track
            dir,
            speed: 0.115 + hash01(lane * 7 + i) * 0.02
          });
        }
      }

      ui.showHint('← → drive');
      ui.caption(`${S.call} · ${S.timerLabel}`, 2200);
      hud.announce(
        'Fire in the hills. The engine is coming down Hopkins from the right. ' +
        'The buses are coming the other way and the street has no room for both.');
      audio.rageQuit?.();

      const kd = e => {
        if (e.key === 'ArrowLeft' || e.key === 'a') steer = -1;
        if (e.key === 'ArrowRight' || e.key === 'd') steer = 1;
      };
      const ku = () => { steer = 0; };
      window.addEventListener('keydown', kd);
      window.addEventListener('keyup', ku);

      const finish = () => {
        if (done) return;
        done = true;
        window.removeEventListener('keydown', kd);
        window.removeEventListener('keyup', ku);
        ui.showHint('');
        resolve();
      };

      drawLoop((now, dt) => {
        // Bikes never stop, in any phase.
        for (const b of bikes) {
          b.x += b.speed * b.dir * dt;
          if (b.x > 1.22) b.x -= 1.44;
          if (b.x < -0.22) b.x += 1.44;
        }

        if (phase === 'run') {
          elapsed += dt;

          // The engine runs down the middle of the street, straddling the
          // centre line, so both directions have to stop for it. That still
          // does not get it past the bus.
          const want = steer !== 0 ? steer * 0.16 : -0.075;
          const next = truckX + want * dt;
          const meetsBus = next - bus.x < 0.21 && next > bus.x;

          if (meetsBus) {
            blocked += dt;
            stats.emergencyDelay = blocked;
          } else {
            truckX = Math.max(-0.2, Math.min(1.1, next));
          }
          stalled = meetsBus;

          for (const v of traffic) {
            if (stalled) continue;          // the whole street is stopped
            // Oncoming traffic yields to the engine coming down the middle.
            if (v.dir < 0 && v.x - truckX < 0.28 && v.x > truckX) continue;
            // The queue behind the bus goes no faster than the bus.
            if (v.dir > 0 && v !== bus && v.x < bus.x && bus.x - v.x < 0.24) continue;
            v.x += v.speed * v.dir * dt;
            if (v.dir > 0 && v.x > 1.3) v.x -= 1.9;
            if (v.dir < 0 && v.x < -0.3) v.x += 2.4;
          }

          // Once the street has locked up there is nothing left to play for:
          // ten seconds of sitting there and the fire has won.
          if (stalled) stallTime += dt;
          if (elapsed > secs(S.seconds) || truckX < 0.16
              || stallTime > secs(S.stalledSeconds)) {
            phase = 'fireball';
            fireT = 0;
            audio.thunder?.();
            hud.announce('Too late. The fire reaches the shops at the bottom of the hill.');
          }
        } else if (phase === 'fireball') {
          fireT += dt;
          if (fireT > 1.9) { phase = 'aftermath'; fireT = 0; hud.announce(S.aftermath); }
        } else {
          // Hold the ruin on screen. The point is not the explosion, it is
          // the block afterwards with the bikes still going past it.
          fireT += dt;
          if (fireT > 7) { finish(); return; }
        }

        drawEmergency({ truckX, traffic, bus, bikes, elapsed, blocked, phase, fireT, stalled });
      });
    });
  }

  function drawEmergency(st) {
    const { w, h } = view;
    const { truckX, traffic, bikes, elapsed, blocked, phase, fireT } = st;

    // How burnt the block is, and how bright the blast is right now.
    const damage = phase === 'aftermath' ? 1
      : phase === 'fireball' ? Math.min(1, fireT / 1.1) : 0;
    const flareIn = phase === 'fireball' ? Math.min(1, fireT / 0.25) : 0;
    const flareOut = phase === 'fireball' ? Math.max(0, 1 - (fireT - 0.5) / 1.3) : 0;
    const flare = phase === 'fireball' ? Math.min(flareIn, flareOut) : 0;

    ctx.fillStyle = '#1b2029';
    ctx.fillRect(0, 0, w, h);

    // Same storefront row as the crossing, scorching as the fire takes it.
    const shopH = h * 0.16;
    drawShopRow(ctx, w * 0.03, h * 0.02, w * 0.94, shopH, { damage });

    // Lanes: kerb, bike track, the shared motor lane, bike track, kerb.
    const top = h * 0.2;
    const laneH = h * 0.098;
    const lanes = [
      { kind: 'walk' },
      { kind: 'bike' },
      { kind: 'road' },   // eastbound: buses and cars with the flow
      { kind: 'road' },   // westbound: where the engine has to go
      { kind: 'bike' },
      { kind: 'walk' }
    ];
    lanes.forEach((l, i) => {
      const y = top + i * laneH;
      ctx.fillStyle = l.kind === 'walk' ? '#5d6470'
        : l.kind === 'bike' ? '#2f5d43' : '#3a3f47';
      ctx.fillRect(0, y, w, laneH);
    });
    const roadY = top + 2 * laneH;        // eastbound lane
    const roadY2 = top + 3 * laneH;       // westbound lane
    // Centre line between the two directions.
    ctx.strokeStyle = 'rgba(240,240,230,0.5)';
    ctx.setLineDash([22, 18]); ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, roadY2); ctx.lineTo(w, roadY2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Bike tracks either side of the road, still flowing.
    for (const b of bikes) {
      const y = top + (b.lane === 0 ? 1 : 4) * laneH + laneH * 0.52;
      drawBicycle(ctx, b.x * w, y, laneH * 0.86, b.dir, b.x * 26 * b.dir);
    }

    // Traffic, both directions: buses with the flow, cars against it.
    if (phase === 'run') {
      const tones = ['#c8552f', '#4a6f9c', '#8a8f96', '#6b7f52'];
      traffic.forEach((v, i) => {
        if (v.x < -0.32 || v.x > 1.34) return;
        // Each direction keeps to its own lane.
        const y = (v.dir > 0 ? roadY : roadY2) + laneH * 0.5;
        if (v.bus) {
          drawBus(ctx, v.x * w, y, w * 0.19, laneH * 0.98, v.dir);
        } else {
          drawCar(ctx, v.x * w, y + laneH * 0.02, w * 0.1, laneH * 1.0, v.dir,
            tones[i % tones.length]);
        }
      });
    }

    // The engine, right to left, drawn last so it is never hidden by a bus.
    if (phase === 'run') {
      const flash = Math.floor(performance.now() / 240) % 2;
      drawFireTruck(ctx, truckX * w, roadY2, w * 0.155, laneH * 1.25, -1, flash);
    }

    // CAFE on the lower right.
    drawCafe(ctx, w * 0.74, top + lanes.length * laneH + h * 0.005,
      w * 0.22, h * 0.095, damage);

    // The fireball: it starts at the left edge and swallows the block.
    if (phase === 'fireball') {
      const r = (0.15 + fireT * 0.75) * w;
      const cx = w * 0.06, cy = h * 0.14;
      const g = ctx.createRadialGradient(cx, cy, r * 0.05, cx, cy, r);
      g.addColorStop(0, `rgba(255,255,240,${flare})`);
      g.addColorStop(0.25, `rgba(255,196,86,${flare * 0.95})`);
      g.addColorStop(0.6, `rgba(224,86,34,${flare * 0.7})`);
      g.addColorStop(1, 'rgba(120,26,8,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();

      // A whiteout at the moment of the blast.
      if (flareIn < 1) {
        ctx.fillStyle = `rgba(255,250,235,${(1 - flareIn) * 0.8})`;
        ctx.fillRect(0, 0, w, h);
      }

      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffd043';
      ctx.font = `900 ${Math.max(20, h * 0.075)}px ui-sans-serif, system-ui, sans-serif`;
      ctx.fillText(SCENES.emergency.tooLate, w * 0.5, h * 0.55);
      ctx.textAlign = 'left';
    }

    // Aftermath: smoke drifting off a blackened block, bikes still going.
    if (phase === 'aftermath') {
      for (let i = 0; i < 7; i++) {
        const sx = w * (0.04 + i * 0.1);
        const rise = ((fireT * 26) + i * 30) % (h * 0.3);
        ctx.fillStyle = `rgba(120,120,124,${0.16 - i * 0.014})`;
        ctx.beginPath();
        ctx.arc(sx + Math.sin(fireT + i) * w * 0.012,
          h * 0.18 - rise, w * (0.018 + i * 0.003), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.textAlign = 'center';
      ctx.fillStyle = '#c8c2b4';
      ctx.font = `800 ${Math.max(11, h * 0.03)}px ui-sans-serif, system-ui, sans-serif`;
      ctx.fillText(SCENES.emergency.aftermath, w * 0.5, h * 0.94);
      ctx.textAlign = 'left';
    }

    // Timer and the blocked notice.
    if (phase === 'run') {
      ctx.textAlign = 'center';
      ctx.fillStyle = blocked > 0 ? '#ff6b5e' : '#ffd043';
      ctx.font = `900 ${Math.max(16, h * 0.05)}px ui-monospace, Menlo, monospace`;
      ctx.fillText(fmt(Math.max(0, secs(SCENES.emergency.seconds) - elapsed)), w * 0.5, h * 0.205);
      if (st.stalled) {
        ctx.fillStyle = '#ff8a7a';
        ctx.font = `800 ${Math.max(11, h * 0.03)}px ui-sans-serif, system-ui, sans-serif`;
        ctx.fillText('NEITHER OF YOU CAN MOVE', w * 0.5, h * 0.9);
      }
      ctx.textAlign = 'left';
    }
  }

  /* ================= PART VI — Trash Day Slalom ================= */

  // Driver's seat, looking down the road. Vanishing-point perspective, so the
  // lane is wide at the bumper and the bins ahead are unmistakable. You are
  // driving the collection truck and the bins are in your lane, because the
  // redesign left them nowhere else to be.
  function collectionGame() {
    return new Promise(resolve => {
      const S = SCENES.collection;
      let elapsed = 0, done = false;
      let dist = 0;              // metres travelled
      let x = 0;                 // lateral position, -1 kerb .. +1 centre line
      let steer = 0;
      let shake = 0;

      // Bins the whole length of the run, so the road is never empty.
      // `off` is lateral position in the same -1..+1 space, alternating with
      // jitter: there is always a line through, but never a straight one.
      const bins = [];
      for (let i = 0; i < 90; i++) {
        const z = 60 + i * 32 + hash01(i * 5) * 10;
        const side = (i % 2 ? 1 : -1) * (0.34 + hash01(i * 7) * 0.42);
        bins.push({
          z,
          off: side,
          kind: ['black', 'green', 'blue'][Math.floor(hash01(i * 3) * 3)],
          hit: false
        });
      }

      // Cyclists: some in the bike lanes either side, and — because the bins
      // have taken their lane — plenty of them out in the road with you.
      const riders = [];
      for (let i = 0; i < 26; i++) {
        const inRoad = i % 3 !== 0;
        riders.push({
          z: 90 + i * 66 + hash01(i * 11) * 40,
          off: inRoad
            ? (hash01(i * 17) - 0.5) * 1.5          // out in the traffic lane
            : (i % 2 ? 1 : -1) * (1.26 + hash01(i * 13) * 0.12)
        });
      }

      ui.caption(S.title, 1800);
      ui.showHint('← → steer between the bins');
      hud.announce(
        'Trash day. You are driving the collection truck down Hopkins and the ' +
        'bins are in your lane. Steer between them.');

      const kd = e => {
        if (e.key === 'ArrowLeft' || e.key === 'a') { steer = -1; e.preventDefault(); }
        if (e.key === 'ArrowRight' || e.key === 'd') { steer = 1; e.preventDefault(); }
      };
      const ku = e => {
        if (['ArrowLeft', 'ArrowRight', 'a', 'd'].includes(e.key)) steer = 0;
      };
      window.addEventListener('keydown', kd);
      window.addEventListener('keyup', ku);

      drawLoop((now, dt) => {
        elapsed += dt;
        dist += SPEED * dt;
        x = Math.max(-1.15, Math.min(1.15, x + steer * 1.5 * dt));
        if (shake > 0) shake = Math.max(0, shake - dt * 3);

        // Clip a bin when it passes the bumper and you are still on top of it.
        for (const b of bins) {
          if (b.hit) continue;
          const rel = b.z - dist;
          if (rel > 0 || rel < -12) continue;
          b.hit = true;
          if (Math.abs(b.off - x) < 0.34) {
            b.tipped = true;
            shake = 1;
            stats.cansClipped++;
            audio.pothole?.();
          } else {
            stats.cansDodged++;
          }
        }

        // Riders. The bins pushed them into the traffic lane, so the thing
        // the corridor was built to prevent is now the thing you can do.
        for (const r of riders) {
          if (r.launched) continue;
          const rel = r.z - dist;
          if (rel > 0 || rel < -12) continue;
          if (Math.abs(r.off - x) < 0.3) {
            r.launched = true;
            r.lt = 0;
            // Thrown up and out to whichever side the truck caught them on.
            r.vx = (r.off < x ? -1 : 1) * (1.5 + hash01(r.z) * 1.2);
            r.vy = -2.6 - hash01(r.z * 3) * 0.7;
            r.spin = (r.off < x ? -1 : 1) * (6 + hash01(r.z * 5) * 5);
            shake = 1;
            stats.ridersHit = (stats.ridersHit || 0) + 1;
            audio.pothole?.();
            audio.hornChirp?.();
            hud.announce(SCENES.collection.riderHit);
          } else {
            r.passed = true;
          }
        }
        // Advance anything mid-flight.
        for (const r of riders) {
          if (!r.launched) continue;
          r.lt += dt;
          r.vy += 4.2 * dt;                 // gravity pulls it back down
        }

        drawCollection({ bins, riders, dist, x, elapsed, shake });

        if (elapsed > secs(S.seconds)) {
          if (done) return;
          done = true;
          window.removeEventListener('keydown', kd);
          window.removeEventListener('keyup', ku);
          ui.showHint('');
          resolve();
        }
      });
    });
  }

  /** Metres per second down the road. Slow enough to read the line ahead. */
  const SPEED = 42;

  /**
   * Project a point on the road into the frame.
   * @param off lateral position, -1 at the kerb to +1 at the centre line
   * @param rel distance ahead of the bumper, in metres
   */
  function project(off, rel, x, w, h) {
    const horizon = h * 0.34;
    const camY = h * 0.98;
    // 1 at the bumper, falling toward 0 at the horizon.
    const depth = 1 / (1 + rel / 26);
    const y = horizon + (camY - horizon) * depth;
    const halfRoad = w * 0.05 + (w * 0.40) * depth;
    return { x: w * 0.5 + (off - x) * halfRoad, y, scale: depth, halfRoad };
  }

  function drawCollection(st) {
    const { w, h } = view;
    const { bins, riders, dist, x, elapsed, shake } = st;
    const horizon = h * 0.34;

    ctx.save();
    if (shake > 0) {
      ctx.translate(Math.sin(elapsed * 60) * shake * 5,
                    Math.cos(elapsed * 52) * shake * 3);
    }

    // Sky and the hills above the horizon.
    const sky = ctx.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, '#101722');
    sky.addColorStop(1, '#24313f');
    ctx.fillStyle = sky;
    ctx.fillRect(-20, -20, w + 40, horizon + 20);
    ctx.fillStyle = '#1b2836';
    ctx.beginPath();
    ctx.moveTo(-20, horizon);
    for (let i = 0; i <= 14; i++) {
      const hx = (w / 14) * i;
      ctx.lineTo(hx, horizon - h * (0.03 + Math.sin(i * 1.3) * 0.022));
    }
    ctx.lineTo(w + 20, horizon); ctx.closePath(); ctx.fill();

    // Ground either side of the road.
    ctx.fillStyle = '#1a2119';
    ctx.fillRect(-20, horizon, w + 40, h - horizon + 20);

    // Road surface: a trapezoid narrowing to the vanishing point.
    const near = project(0, 0, 0, w, h);
    const far = project(0, 900, 0, w, h);
    ctx.fillStyle = '#33383f';
    ctx.beginPath();
    ctx.moveTo(w * 0.5 - near.halfRoad - (x * near.halfRoad), near.y);
    ctx.lineTo(w * 0.5 + near.halfRoad - (x * near.halfRoad), near.y);
    ctx.lineTo(w * 0.5 + far.halfRoad - (x * far.halfRoad), far.y);
    ctx.lineTo(w * 0.5 - far.halfRoad - (x * far.halfRoad), far.y);
    ctx.closePath(); ctx.fill();

    // Kerb on the left, centre line on the right, both dashed by distance so
    // the road reads as moving.
    for (const [off, colour] of [[-1.12, '#6a7360'], [1.12, '#5d6470']]) {
      ctx.fillStyle = colour;
      for (let m = 0; m < 34; m++) {
        const rel = m * 26 - (dist % 26);
        if (rel < 0 || rel > 820) continue;
        const a = project(off, rel, x, w, h);
        const b2 = project(off, rel + 13, x, w, h);
        ctx.fillRect(a.x - 2, b2.y, Math.max(1.5, 6 * a.scale), a.y - b2.y);
      }
    }
    ctx.fillStyle = 'rgba(240,240,230,0.55)';
    for (let m = 0; m < 34; m++) {
      const rel = m * 30 - (dist % 30);
      if (rel < 0 || rel > 820) continue;
      const a = project(0, rel, x, w, h);
      const b2 = project(0, rel + 14, x, w, h);
      ctx.fillRect(a.x - Math.max(1, 4 * a.scale), b2.y,
        Math.max(2, 8 * a.scale), a.y - b2.y);
    }

    // Houses receding along the left kerb.
    for (let m = 0; m < 16; m++) {
      const rel = m * 90 - (dist % 90);
      if (rel < 8 || rel > 700) continue;
      const a = project(-2.5, rel, x, w, h);
      const hw = w * 0.34 * a.scale;
      const hh = h * 0.5 * a.scale;
      if (hw < 3) continue;
      drawHouseRow(ctx, a.x - hw, a.y - hh, hw, hh, 1, m);
    }

    // Everything on the road, drawn far to near.
    const props = [
      ...bins.filter(b => !b.hit || b.tipped).map(b => ({ ...b, prop: 'bin' })),
      ...riders.filter(r => !r.launched).map(r => ({ ...r, prop: 'bike' }))
    ].map(o => ({ ...o, rel: o.z - dist }))
     .filter(o => o.rel > -6 && o.rel < 620)
     .sort((a, b) => b.rel - a.rel);

    for (const o of props) {
      const a = project(o.off, Math.max(0.5, o.rel), x, w, h);
      if (o.prop === 'bin') {
        const bw = Math.max(2, w * 0.075 * a.scale);
        const bh = Math.max(3, h * 0.19 * a.scale);
        drawBin(ctx, a.x, a.y - bh * 0.5, bw, bh, o.kind, o.tipped);
      } else {
        const size = Math.max(4, h * 0.2 * a.scale);
        drawBicycle(ctx, a.x, a.y - size * 0.35, size, -1, o.z * 0.4);
      }
    }

    // Anyone the truck has launched, tumbling up over the bonnet and out of
    // frame. The arc starts where the impact was and the bike grows as it
    // comes at the camera, so it reads as thrown toward you and away.
    for (const r of riders) {
      if (!r.launched || r.lt > 2.4) continue;
      const t = r.lt;
      const from = project(r.off, 10, x, w, h);
      const px = from.x + r.vx * t * w * 0.34;
      const py = from.y + (r.vy * t + 2.6 * t * t) * h * 0.3;
      const size = Math.max(8, h * 0.17 * (1 + t * 1.2));
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, 2.4 - t));
      ctx.translate(px, py);
      ctx.rotate(r.spin * t);
      drawBicycle(ctx, 0, 0, size, 1, t * 14);
      ctx.restore();
    }

    ctx.restore();

    // The truck's own bonnet, filling the bottom of the frame.
    drawBonnet(ctx, w, h, x, shake);

    // HUD.
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd043';
    ctx.font = `900 ${Math.max(14, h * 0.042)}px ui-monospace, Menlo, monospace`;
    ctx.fillText(fmt(Math.max(0, secs(SCENES.collection.seconds) - elapsed)), w * 0.5, h * 0.08);
    ctx.fillStyle = '#c8c2b4';
    ctx.font = `800 ${Math.max(9, h * 0.024)}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillText(`CLIPPED ${stats.cansClipped}  ·  CLEARED ${stats.cansDodged}`,
      w * 0.5, h * 0.125);
    ctx.textAlign = 'left';
  }

  /** The nose of the truck you are sitting in. */
  function drawBonnet(ctx, w, h, x, shake) {
    const lean = -x * w * 0.02 + (shake > 0 ? Math.sin(shake * 40) * 4 : 0);
    ctx.save();
    ctx.translate(lean, 0);

    // Bonnet
    ctx.fillStyle = '#4b5740';
    ctx.beginPath();
    ctx.moveTo(w * 0.1, h + 10);
    ctx.lineTo(w * 0.2, h * 0.84);
    ctx.lineTo(w * 0.8, h * 0.84);
    ctx.lineTo(w * 0.9, h + 10);
    ctx.closePath();
    ctx.fill();

    // Grille and lights on the leading edge
    ctx.fillStyle = '#3a442f';
    ctx.fillRect(w * 0.21, h * 0.84, w * 0.58, h * 0.03);
    ctx.fillStyle = '#ffe9a8';
    ctx.fillRect(w * 0.23, h * 0.855, w * 0.06, h * 0.014);
    ctx.fillRect(w * 0.71, h * 0.855, w * 0.06, h * 0.014);

    // Wing mirrors, so it reads as a cab
    ctx.fillStyle = '#3a442f';
    ctx.fillRect(w * 0.13, h * 0.72, w * 0.035, h * 0.07);
    ctx.fillRect(w * 0.835, h * 0.72, w * 0.035, h * 0.07);
    ctx.restore();
  }

  function endTally() {
    cancelAnimationFrame(raf);
    const rows = [
      ['CROSSING TIME', fmt(stats.crossingTime)],
      ['BIKE BELLS', String(stats.bikeBells)],
      ['NEAR MISSES', String(stats.nearMisses)],
      ['MARKET VISITS COMPLETED', String(stats.marketVisits)],
      ['EMERGENCY DELAY', fmt(stats.emergencyDelay)],
      ['BINS CLEARED', String(stats.cansDodged)],
      ['BINS CLIPPED', String(stats.cansClipped)],
      ['CYCLISTS HIT', String(stats.ridersHit || 0)]
    ];
    if (stats.crossingFailed) rows.splice(1, 0, ['CROSSING', 'DID NOT MAKE IT']);
    ui.showTally(END.heading, rows, END.tag, onExit);
    hud.announce(
      `${END.heading}. Crossing time ${fmt(stats.crossingTime)}. ` +
      `${stats.bikeBells} bike bells. Emergency delay ${fmt(stats.emergencyDelay)}. ` +
      `${stats.cansClipped} bins clipped. ${END.tag}.`
    );
  }

  /** Elapsed seconds as a response clock, e.g. 0:07. */
  function fmt(sec) {
    const m = Math.floor(sec / 60);
    const s2 = Math.floor(sec % 60);
    return `${m}:${String(s2).padStart(2, '0')}`;
  }

  /** Centre-wrapped text, for anything longer than a label. */
  function wrapText(ctx, text, cx, y, maxW, lineH) {
    const words = text.split(' ');
    const lines = [];
    let line = '';
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = word; }
      else line = test;
    }
    if (line) lines.push(line);
    lines.forEach((l, i) => ctx.fillText(l, cx, y + i * lineH));
    return lines.length;
  }

  function drawLoop(fn) {
    cancelAnimationFrame(raf);
    let last = performance.now();
    const step = now => {
      const dt = Math.min((now - last) / 1000, 1 / 20);
      last = now;
      // Keep the backing store in step with layout; the episode can start
      // before its screen has been measured.
      const r = canvas.getBoundingClientRect();
      if (Math.abs(r.width - view.w) > 1 || Math.abs(r.height - view.h) > 1) resize();
      fn(now, dt);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }

  return {
    async start() {
      // Let the browser lay the screen out before measuring it.
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      resize();
      window.addEventListener('resize', resize);
      // Test-only: jump straight to a scene, so the three games can be
      // exercised without playing the whole sequence each time.
      const only = window.__BBD_TEST__?.hopkinsScene;
      if (only === 'fire') {
        await tomorrowTransition(CHAPTERS.emergency);
        await emergencyGame();
        endTally();
        return;
      }
      if (only === 'trash') {
        await tomorrowTransition(CHAPTERS.collection);
        await collectionGame();
        endTally();
        return;
      }

      await councilColdOpen();
      // The reveal card doubles as the first game's title card.
      await tomorrowTransition(CHAPTERS.crossing);
      await crossingGame();
      stats.marketVisits = 0;      // the market is closed; the visit never completes
      await marketReveal();

      await tomorrowTransition(CHAPTERS.emergency);
      await emergencyGame();

      await tomorrowTransition(CHAPTERS.collection);
      await collectionGame();
      endTally();
    },
    stop() { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); }
  };
}
