// City Budget Garage scene (Reboot spec §9, §10).
//
// A municipal service bay with the Berkeley Budget car stopped in it and the
// garage door ahead. Procedural, matching the rest of the game's art. The
// fiscal controls themselves are DOM, drawn over this — canvas widgets would
// not be keyboard-operable (§96).

function hash01(n) {
  const s = Math.sin(n * 91.7 + 41.3) * 28711.5453;
  return s - Math.floor(s);
}

export function createGarageRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { width: 0, height: 0, dpr: 1 };

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    view.width = Math.max(1, Math.round(rect.width));
    view.height = Math.max(1, Math.round(rect.height));
    view.dpr = dpr;
    canvas.width = view.width * dpr;
    canvas.height = view.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /**
   * @param {number} doorOpen 0 closed, 1 fully open — drives the adoption beat.
   */
  function draw(state, t, doorOpen = 0, reducedMotion = false) {
    const W = view.width, H = view.height;
    ctx.clearRect(0, 0, W, H);

    drawBay(W, H, t, reducedMotion);
    drawDoorway(W, H, state, t, doorOpen);
    drawCar(W, H, t, reducedMotion);
    drawForeground(W, H);
  }

  function drawBay(W, H, t, reducedMotion) {
    // Concrete interior.
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#232830');
    g.addColorStop(0.55, '#2b313b');
    g.addColorStop(1, '#1a1e25');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // Back wall with the doorway aperture left dark.
    ctx.fillStyle = '#1e232b';
    ctx.fillRect(0, H * 0.10, W, H * 0.52);

    // Corrugated wall ribs.
    ctx.strokeStyle = 'rgba(255,255,255,0.035)';
    ctx.lineWidth = 2;
    for (let x = 0; x < W; x += Math.max(18, W * 0.022)) {
      ctx.beginPath();
      ctx.moveTo(x, H * 0.10);
      ctx.lineTo(x, H * 0.62);
      ctx.stroke();
    }

    // Work lights.
    for (let i = 0; i < 4; i++) {
      const lx = W * (0.14 + i * 0.24);
      const flick = reducedMotion ? 1 : 0.94 + Math.sin(t * 0.004 + i * 2.1) * 0.06;
      const gl = ctx.createRadialGradient(lx, H * 0.06, 0, lx, H * 0.06, H * 0.30);
      gl.addColorStop(0, `rgba(255, 244, 214, ${0.20 * flick})`);
      gl.addColorStop(1, 'rgba(255, 244, 214, 0)');
      ctx.fillStyle = gl;
      ctx.beginPath();
      ctx.arc(lx, H * 0.06, H * 0.30, 0, Math.PI * 2);
      ctx.fill();
      // Fixture.
      ctx.fillStyle = '#3c424c';
      ctx.fillRect(lx - W * 0.035, 0, W * 0.07, H * 0.022);
      ctx.fillStyle = `rgba(255, 248, 224, ${0.75 * flick})`;
      ctx.fillRect(lx - W * 0.030, H * 0.020, W * 0.06, H * 0.006);
    }

    // Painted bay floor with a service pit outline.
    ctx.fillStyle = '#2f343d';
    ctx.fillRect(0, H * 0.62, W, H * 0.38);
    ctx.strokeStyle = 'rgba(240, 200, 60, 0.30)';
    ctx.lineWidth = Math.max(2, W * 0.004);
    ctx.setLineDash([W * 0.02, W * 0.014]);
    ctx.beginPath();
    ctx.moveTo(W * 0.16, H * 0.70);
    ctx.lineTo(W * 0.84, H * 0.70);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  /** The doorway ahead, with weather visible through it once it lifts (§10). */
  function drawDoorway(W, H, state, t, doorOpen) {
    const dx = W * 0.30, dw = W * 0.40;
    const dyTop = H * 0.14, dh = H * 0.48;

    // Exterior seen through the opening.
    const rain = state.weather?.rainLevel ?? 0;
    const sky = ctx.createLinearGradient(0, dyTop, 0, dyTop + dh);
    if (rain > 0) {
      sky.addColorStop(0, '#3d4653');
      sky.addColorStop(1, '#6d7683');
    } else {
      sky.addColorStop(0, '#2c4a72');
      sky.addColorStop(1, '#8fb0cc');
    }
    ctx.fillStyle = sky;
    ctx.fillRect(dx, dyTop, dw, dh);

    // Street beyond.
    ctx.fillStyle = rain > 0 ? '#3a3f46' : '#454b53';
    ctx.fillRect(dx, dyTop + dh * 0.62, dw, dh * 0.38);

    if (rain > 0) {
      ctx.strokeStyle = `rgba(200, 216, 232, ${0.18 + rain * 0.07})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let i = 0; i < 40 * rain; i++) {
        const x = dx + hash01(i * 3.1) * dw;
        const y = dyTop + ((hash01(i * 7.7) * dh) + t * 0.5) % dh;
        ctx.moveTo(x, y);
        ctx.lineTo(x - 3, y + 11);
      }
      ctx.stroke();
    }

    // Rolling door, lifting from the top.
    const closedH = dh * (1 - doorOpen);
    if (closedH > 1) {
      ctx.fillStyle = '#4a505a';
      ctx.fillRect(dx, dyTop, dw, closedH);
      ctx.strokeStyle = 'rgba(0,0,0,0.28)';
      ctx.lineWidth = 2;
      for (let y = dyTop; y < dyTop + closedH; y += Math.max(10, H * 0.022)) {
        ctx.beginPath();
        ctx.moveTo(dx, y);
        ctx.lineTo(dx + dw, y);
        ctx.stroke();
      }
      // Hazard stripe along the door's bottom edge.
      const lip = dyTop + closedH;
      ctx.save();
      ctx.beginPath();
      ctx.rect(dx, lip - H * 0.014, dw, H * 0.014);
      ctx.clip();
      for (let k = -2; k < 26; k++) {
        ctx.fillStyle = k % 2 ? '#f0c419' : '#22262c';
        ctx.beginPath();
        ctx.moveTo(dx + k * dw * 0.05, lip);
        ctx.lineTo(dx + k * dw * 0.05 + dw * 0.03, lip - H * 0.014);
        ctx.lineTo(dx + k * dw * 0.05 + dw * 0.06, lip - H * 0.014);
        ctx.lineTo(dx + k * dw * 0.05 + dw * 0.03, lip);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    // Door frame.
    ctx.strokeStyle = '#5b626d';
    ctx.lineWidth = Math.max(3, W * 0.006);
    ctx.strokeRect(dx, dyTop, dw, dh);
  }

  /** The Berkeley Budget car, stopped, seen from behind (§9). */
  function drawCar(W, H, t, reducedMotion) {
    const cx = W * 0.5;
    const cy = H * 0.80;
    const cw = W * 0.30;
    const ch = cw * 0.42;

    // Contact shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + ch * 0.52, cw * 0.58, ch * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body.
    ctx.fillStyle = '#1e5aa8';
    roundRect(ctx, cx - cw / 2, cy - ch * 0.5, cw, ch, cw * 0.05);
    ctx.fill();
    // Roof / cabin.
    ctx.fillStyle = '#17457f';
    roundRect(ctx, cx - cw * 0.34, cy - ch * 1.15, cw * 0.68, ch * 0.72, cw * 0.04);
    ctx.fill();
    // Rear window.
    ctx.fillStyle = 'rgba(28, 44, 66, 0.9)';
    roundRect(ctx, cx - cw * 0.27, cy - ch * 1.05, cw * 0.54, ch * 0.46, cw * 0.02);
    ctx.fill();
    // Tail lights.
    ctx.fillStyle = '#e04a3a';
    ctx.fillRect(cx - cw * 0.44, cy - ch * 0.24, cw * 0.11, ch * 0.20);
    ctx.fillRect(cx + cw * 0.33, cy - ch * 0.24, cw * 0.11, ch * 0.20);
    // Wheels.
    ctx.fillStyle = '#15181d';
    ctx.fillRect(cx - cw * 0.52, cy + ch * 0.30, cw * 0.11, ch * 0.26);
    ctx.fillRect(cx + cw * 0.41, cy + ch * 0.30, cw * 0.11, ch * 0.26);

    // Plate.
    const fs = Math.max(9, W * 0.011);
    ctx.font = `800 ${fs}px ui-sans-serif, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#dfe8f4';
    ctx.fillRect(cx - cw * 0.13, cy - ch * 0.06, cw * 0.26, fs * 1.5);
    ctx.fillStyle = '#1a2330';
    ctx.fillText('BERKELEY', cx, cy + fs * 0.55);
    ctx.textAlign = 'left';
  }

  /** Cones and a bench so the bay reads as a working municipal yard. */
  function drawForeground(W, H) {
    for (const [fx, scale] of [[0.09, 1.0], [0.90, 0.9]]) {
      const x = W * fx, y = H * 0.93, s = H * 0.05 * scale;
      ctx.fillStyle = '#e8620f';
      ctx.beginPath();
      ctx.moveTo(x, y - s * 2);
      ctx.lineTo(x + s * 0.72, y);
      ctx.lineTo(x - s * 0.72, y);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#f7f2e8';
      ctx.fillRect(x - s * 0.42, y - s * 1.3, s * 0.84, s * 0.32);
    }
  }

  function roundRect(c, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + rr, y);
    c.arcTo(x + w, y, x + w, y + h, rr);
    c.arcTo(x + w, y + h, x, y + h, rr);
    c.arcTo(x, y + h, x, y, rr);
    c.arcTo(x, y, x + w, y, rr);
    c.closePath();
  }

  return { view, resize, draw };
}
