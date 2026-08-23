// Hopkins — shared procedural sprites.
//
// The crossing and the emergency-response scene share a camera and a visual
// language, so they share these drawing routines: a vehicle drawn here looks
// the same wherever it appears. Procedural canvas only, no image assets.
//
// Every sprite takes a facing direction (+1 travelling right, -1 left) so the
// same shape works in either lane.

/* ------------------------------------------------------------------ */
/* Storefronts                                                         */
/* ------------------------------------------------------------------ */

// The row of shops the corridor is supposed to serve. Order is left to right;
// MARKET sits apart on the right, CAFE below it.
export const SHOPS = [
  { key: 'liquor', name: 'LIQUOR', tone: '#7d4a63', awning: '#a3617f' },
  { key: 'pizza', name: 'PIZZA', tone: '#8c4a35', awning: '#c1663f' },
  { key: 'bakery', name: 'BAKERY', tone: '#8a6b3f', awning: '#c49a55' },
  { key: 'fish', name: 'FISH', tone: '#3f6a80', awning: '#5b93ad' },
  { key: 'sushi', name: 'SUSHI', tone: '#7a3f45', awning: '#a85a60' },
  { key: 'cheese', name: 'CHEESE', tone: '#8a7c3a', awning: '#c2b04e' },
  { key: 'butcher', name: 'BUTCHER', tone: '#77383a', awning: '#a44f52' }
];

/**
 * Draw the shopfront row.
 *
 * @param opts.damage 0 = intact, 1 = burnt out. Scorching is applied left to
 *                    right, so a fire on the left ruins the shops nearest it.
 */
export function drawShopRow(ctx, x, y, w, h, opts = {}) {
  const damage = opts.damage || 0;
  const label = opts.labels !== false;

  // Shops occupy the left two thirds; MARKET stands alone after a gap.
  const rowW = w * 0.64;
  const gap = w * 0.06;
  const marketW = w * 0.22;
  const unit = rowW / SHOPS.length;

  SHOPS.forEach((s, i) => {
    // Damage falls off with distance from the left edge of the block.
    const near = 1 - i / SHOPS.length;
    const burn = Math.max(0, Math.min(1, damage * (0.45 + near * 1.1)));
    // The two nearest the blast come down; the rest are wrecked but standing.
    const collapse = i < 2 ? Math.max(0, Math.min(1, (damage - 0.45) / 0.55)) : 0;
    drawShop(ctx, x + i * unit, y, unit - 2, h, s, burn, label, collapse, i);
  });

  drawShop(ctx, x + rowW + gap, y, marketW, h,
    { key: 'market', name: 'MARKET', tone: '#4a4038', awning: '#6d5c4a' },
    Math.max(0, Math.min(1, damage * 0.25)), label);
}

function drawShop(ctx, x, y, w, h, shop, burn, label, collapse = 0, seed = 0) {
  const mix = (a, b, t) => {
    const pa = [1, 3, 5].map(i => parseInt(a.substr(i, 2), 16));
    const pb = [1, 3, 5].map(i => parseInt(b.substr(i, 2), 16));
    return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * t)).join(',')})`;
  };

  // Facade
  ctx.fillStyle = mix(shop.tone, '#1a1512', burn);
  ctx.fillRect(x, y, w, h);

  // Window: lit when the shop is alive, black and broken once it burns.
  const winY = y + h * 0.42;
  const winH = h * 0.4;
  ctx.fillStyle = burn > 0.5 ? '#0b0908' : mix('#2a2f38', '#0b0908', burn);
  ctx.fillRect(x + w * 0.12, winY, w * 0.76, winH);
  if (burn < 0.5) {
    ctx.fillStyle = `rgba(255,220,150,${0.16 * (1 - burn * 2)})`;
    ctx.fillRect(x + w * 0.12, winY, w * 0.76, winH);
  }

  // Awning, striped and scalloped along its lower edge
  const aTop = y + h * 0.2, aBot = y + h * 0.38;
  ctx.fillStyle = mix(shop.awning, '#241a15', burn);
  ctx.beginPath();
  ctx.moveTo(x + w * 0.06, aBot);
  ctx.lineTo(x + w * 0.94, aBot);
  ctx.lineTo(x + w * 0.86, aTop);
  ctx.lineTo(x + w * 0.14, aTop);
  ctx.closePath();
  ctx.fill();
  if (burn < 0.6) {
    ctx.save();
    ctx.clip();
    ctx.fillStyle = `rgba(255,255,255,${0.22 * (1 - burn)})`;
    const stripes = 5;
    for (let i = 0; i < stripes; i += 2) {
      ctx.fillRect(x + w * (0.06 + (0.88 * i) / stripes), aTop, (w * 0.88) / stripes, h * 0.2);
    }
    ctx.restore();
    // Scalloped hem
    ctx.fillStyle = mix(shop.awning, '#241a15', burn);
    for (let i = 0; i < 6; i++) {
      const sx = x + w * (0.06 + (0.88 * i) / 6) + (w * 0.88) / 12;
      ctx.beginPath();
      ctx.arc(sx, aBot, (w * 0.88) / 13, 0, Math.PI);
      ctx.fill();
    }
  }

  if (label && w > 26) {
    ctx.save();
    ctx.fillStyle = burn > 0.55 ? '#4a4038' : '#f4faf4';
    ctx.font = `800 ${Math.max(6, Math.min(11, w * 0.17))}px ui-sans-serif, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(fitText(ctx, shop.name, w - 4), x + w / 2, y + h * 0.15);
    ctx.restore();
  }

  // Charring: soot up the facade and smoke stains above the window.
  if (burn > 0.15) {
    ctx.fillStyle = `rgba(0,0,0,${0.3 * burn})`;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = `rgba(10,8,7,${0.5 * burn})`;
    ctx.beginPath();
    ctx.moveTo(x + w * 0.12, winY);
    ctx.lineTo(x + w * 0.88, winY);
    ctx.lineTo(x + w * 0.7, y + h * 0.16);
    ctx.lineTo(x + w * 0.3, y + h * 0.16);
    ctx.closePath();
    ctx.fill();
  }

  // Wreckage. A burnt shop should not read as a shop with the lights off:
  // the glass is gone, the awning is in shreds, the facade is cracked, and
  // there is debris on the pavement in front of it.
  if (burn > 0.4) {
    const r = (n) => {
      const v = Math.sin((seed * 12.9898 + n * 78.233)) * 43758.5453;
      return v - Math.floor(v);
    };

    // Blown-out window: jagged glass teeth left in the frame.
    ctx.fillStyle = '#070605';
    ctx.fillRect(x + w * 0.12, winY, w * 0.76, winH);
    ctx.fillStyle = '#2b2622';
    for (let i = 0; i < 5; i++) {
      const gx = x + w * (0.14 + i * 0.15);
      const gh = winH * (0.18 + r(i) * 0.3);
      ctx.beginPath();
      ctx.moveTo(gx, winY);
      ctx.lineTo(gx + w * 0.075, winY);
      ctx.lineTo(gx + w * 0.037, winY + gh);
      ctx.closePath();
      ctx.fill();
    }

    // Awning torn away, leaving a stub and a hanging flap.
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(x + w * 0.06, y + h * 0.2, w * 0.88, h * 0.19);
    ctx.fillStyle = '#3a2b24';
    ctx.beginPath();
    ctx.moveTo(x + w * 0.14, y + h * 0.2);
    ctx.lineTo(x + w * 0.44, y + h * 0.2);
    ctx.lineTo(x + w * 0.3, y + h * 0.42);
    ctx.closePath();
    ctx.fill();

    // Cracks up the facade.
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = Math.max(1, w * 0.012);
    for (let i = 0; i < 2; i++) {
      const cx0 = x + w * (0.25 + i * 0.4);
      ctx.beginPath();
      ctx.moveTo(cx0, y + h);
      ctx.lineTo(cx0 + w * (r(i + 7) - 0.5) * 0.2, y + h * 0.66);
      ctx.lineTo(cx0 + w * (r(i + 9) - 0.5) * 0.3, y + h * 0.44);
      ctx.stroke();
    }
  }

  // Full collapse: the front comes down into a heap of rubble, with only a
  // broken stub of wall and a couple of charred joists left standing.
  if (collapse > 0) {
    const c = Math.min(1, collapse);
    const rubbleH = h * 0.34 * c;

    // Erase the standing frontage as it comes down.
    ctx.fillStyle = '#0d0b0a';
    ctx.fillRect(x, y, w, h * (0.35 + 0.6 * c));

    // Remaining stub of party wall on the left.
    ctx.fillStyle = '#231c18';
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    ctx.lineTo(x, y + h * (0.7 - 0.35 * c));
    ctx.lineTo(x + w * 0.16, y + h * (0.78 - 0.3 * c));
    ctx.lineTo(x + w * 0.16, y + h);
    ctx.closePath();
    ctx.fill();

    // Charred joists leaning out of the gap.
    ctx.strokeStyle = '#1a1512';
    ctx.lineWidth = Math.max(1.5, w * 0.035);
    for (const [ax, ay, bx, by] of [
      [0.24, 0.98, 0.44, 0.52], [0.5, 0.99, 0.36, 0.58], [0.72, 0.97, 0.82, 0.6]
    ]) {
      ctx.beginPath();
      ctx.moveTo(x + w * ax, y + h * ay);
      ctx.lineTo(x + w * bx, y + h * (by + 0.3 * (1 - c)));
      ctx.stroke();
    }

    // Rubble heaped across the frontage.
    ctx.fillStyle = '#2a231e';
    ctx.beginPath();
    ctx.moveTo(x - w * 0.04, y + h);
    for (let i = 0; i <= 6; i++) {
      const f = i / 6;
      const rr = Math.sin(seed * 3.7 + i * 2.1) * 0.5 + 0.5;
      ctx.lineTo(x - w * 0.04 + w * 1.08 * f,
        y + h - rubbleH * (0.45 + rr * 0.55));
    }
    ctx.lineTo(x + w * 1.04, y + h);
    ctx.closePath();
    ctx.fill();

    // A few blocks sitting proud of the heap.
    ctx.fillStyle = '#382e27';
    for (let i = 0; i < 5; i++) {
      const bxx = x + w * (0.08 + i * 0.19);
      const byy = y + h - rubbleH * (0.5 + Math.sin(seed + i * 3) * 0.3);
      const bs = w * 0.07;
      ctx.save();
      ctx.translate(bxx, byy);
      ctx.rotate((Math.sin(seed * 2 + i) * 0.6));
      ctx.fillRect(-bs / 2, -bs * 0.35, bs, bs * 0.7);
      ctx.restore();
    }
  }
}

/** CAFE sits on its own, lower right. */
export function drawCafe(ctx, x, y, w, h, damage = 0) {
  drawShop(ctx, x, y, w, h,
    { key: 'cafe', name: 'CAFE', tone: '#3f5a4a', awning: '#5d8069' },
    Math.max(0, Math.min(1, damage * 0.2)), true);
}

function fitText(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t).width > maxW) t = t.slice(0, -1);
  return t;
}

/* ------------------------------------------------------------------ */
/* Vehicles — side-on, facing `dir`                                    */
/* ------------------------------------------------------------------ */

/**
 * A bicycle: two spoked wheels, a diamond frame, handlebars, and a rider
 * leaning over them. Unmistakably a bicycle at small sizes, which the
 * previous rectangle-and-dot was not.
 */
export function drawBicycle(ctx, cx, cy, size, dir = 1, phase = 0) {
  const r = size * 0.26;            // wheel radius
  const base = cy + size * 0.34;    // ground line
  const back = cx - dir * size * 0.42;
  const front = cx + dir * size * 0.42;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Wheels
  ctx.strokeStyle = '#e9edf2';
  ctx.lineWidth = Math.max(1.4, size * 0.055);
  for (const wx of [back, front]) {
    ctx.beginPath();
    ctx.arc(wx, base - r, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Spokes, turning as the bike travels
  ctx.strokeStyle = 'rgba(233,237,242,0.5)';
  ctx.lineWidth = Math.max(0.5, size * 0.018);
  for (const wx of [back, front]) {
    for (let i = 0; i < 4; i++) {
      const a = phase + (i * Math.PI) / 4;
      ctx.beginPath();
      ctx.moveTo(wx - Math.cos(a) * r * 0.85, base - r - Math.sin(a) * r * 0.85);
      ctx.lineTo(wx + Math.cos(a) * r * 0.85, base - r + Math.sin(a) * r * 0.85);
      ctx.stroke();
    }
  }

  // Frame: seat tube, down tube, top tube, fork
  const bb = { x: cx - dir * size * 0.02, y: base - r * 0.35 };   // bottom bracket
  const seat = { x: cx - dir * size * 0.2, y: base - r * 1.5 };
  const bar = { x: cx + dir * size * 0.26, y: base - r * 1.45 };
  ctx.strokeStyle = '#ffd043';
  ctx.lineWidth = Math.max(1.2, size * 0.05);
  ctx.beginPath();
  ctx.moveTo(back, base - r); ctx.lineTo(bb.x, bb.y);            // chainstay
  ctx.lineTo(seat.x, seat.y); ctx.lineTo(back, base - r);         // seat tube
  ctx.moveTo(seat.x, seat.y); ctx.lineTo(bar.x, bar.y);           // top tube
  ctx.moveTo(bb.x, bb.y); ctx.lineTo(bar.x, bar.y);               // down tube
  ctx.moveTo(bar.x, bar.y); ctx.lineTo(front, base - r);          // fork
  ctx.stroke();

  // Handlebars
  ctx.beginPath();
  ctx.moveTo(bar.x - dir * size * 0.06, bar.y - size * 0.04);
  ctx.lineTo(bar.x + dir * size * 0.05, bar.y - size * 0.02);
  ctx.stroke();

  // Rider: head, torso leaning forward, legs pedalling
  const hip = { x: seat.x + dir * size * 0.02, y: seat.y - size * 0.03 };
  const shoulder = { x: cx + dir * size * 0.08, y: base - r * 2.3 };
  ctx.strokeStyle = '#7fd4ff';
  ctx.lineWidth = Math.max(1.4, size * 0.06);
  ctx.beginPath();
  ctx.moveTo(hip.x, hip.y); ctx.lineTo(shoulder.x, shoulder.y);   // torso
  ctx.lineTo(bar.x, bar.y - size * 0.03);                          // arm
  ctx.stroke();

  // Legs, cranking out of phase
  const crank = size * 0.1;
  for (const off of [0, Math.PI]) {
    const a = phase * 1.4 + off;
    ctx.beginPath();
    ctx.moveTo(hip.x, hip.y);
    ctx.lineTo(bb.x + Math.cos(a) * crank, bb.y + Math.sin(a) * crank);
    ctx.stroke();
  }

  ctx.fillStyle = '#7fd4ff';
  ctx.beginPath();
  ctx.arc(shoulder.x + dir * size * 0.03, shoulder.y - size * 0.09, size * 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** A car: body, cabin greenhouse, wheels, and lights on the leading end. */
export function drawCar(ctx, cx, cy, w, h, dir = 1, tone = '#c8552f') {
  const bodyH = h * 0.34;
  const cabH = h * 0.3;
  const y = cy - bodyH * 0.1;      // body top
  const wheelY = y + bodyH;

  ctx.save();

  // Cabin first, so the body sits in front of its lower edge.
  ctx.fillStyle = tone;
  ctx.beginPath();
  const cabBack = cx - dir * w * 0.3;
  const cabFront = cx + dir * w * 0.12;
  ctx.moveTo(cabBack, y);
  ctx.lineTo(cabBack + dir * w * 0.07, y - cabH);
  ctx.lineTo(cabFront - dir * w * 0.07, y - cabH);
  ctx.lineTo(cabFront, y);
  ctx.closePath();
  ctx.fill();

  // Glass
  ctx.fillStyle = 'rgba(150,190,215,0.55)';
  ctx.beginPath();
  ctx.moveTo(cabBack + dir * w * 0.03, y - h * 0.03);
  ctx.lineTo(cabBack + dir * w * 0.085, y - cabH * 0.82);
  ctx.lineTo(cabFront - dir * w * 0.085, y - cabH * 0.82);
  ctx.lineTo(cabFront - dir * w * 0.03, y - h * 0.03);
  ctx.closePath();
  ctx.fill();

  // Body: a bonnet that slopes down toward the leading end.
  ctx.fillStyle = tone;
  ctx.beginPath();
  ctx.moveTo(cx - dir * w * 0.5, y - h * 0.02);
  ctx.lineTo(cx + dir * w * 0.36, y - h * 0.02);
  ctx.lineTo(cx + dir * w * 0.5, y + bodyH * 0.35);
  ctx.lineTo(cx + dir * w * 0.5, y + bodyH);
  ctx.lineTo(cx - dir * w * 0.5, y + bodyH);
  ctx.closePath();
  ctx.fill();

  // Wheels with hubs, clear of the body
  for (const wx of [cx - dir * w * 0.3, cx + dir * w * 0.28]) {
    ctx.fillStyle = '#14171c';
    ctx.beginPath(); ctx.arc(wx, wheelY, h * 0.13, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#585f68';
    ctx.beginPath(); ctx.arc(wx, wheelY, h * 0.055, 0, Math.PI * 2); ctx.fill();
  }

  // Lights
  ctx.fillStyle = '#ffe9a8';
  ctx.fillRect(cx + dir * w * 0.44, y + bodyH * 0.3, w * 0.06 * dir, bodyH * 0.28);
  ctx.fillStyle = '#ff6b5e';
  ctx.fillRect(cx - dir * w * 0.5, y + bodyH * 0.3, w * 0.05 * dir, bodyH * 0.26);
  ctx.restore();
}

/** A bus: long slab body, window band, door, destination blind. */
export function drawBus(ctx, cx, cy, w, h, dir = 1) {
  const bodyH = h * 0.62;
  const y = cy - bodyH * 0.45;

  ctx.save();
  ctx.fillStyle = '#14171c';
  for (const wx of [cx - w * 0.3, cx + w * 0.26]) {
    ctx.beginPath();
    ctx.ellipse(wx, y + bodyH, h * 0.1, h * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = '#d8d3c4';
  roundRect(ctx, cx - w / 2, y, w, bodyH, h * 0.05);
  ctx.fill();

  // Window band along the flank
  ctx.fillStyle = '#2a3038';
  ctx.fillRect(cx - w * 0.44, y + bodyH * 0.16, w * 0.76, bodyH * 0.36);
  // Window mullions, so it reads as a bus rather than a van
  ctx.strokeStyle = '#d8d3c4';
  ctx.lineWidth = Math.max(1, w * 0.008);
  for (let i = 1; i < 5; i++) {
    const mx = cx - w * 0.44 + (w * 0.76 * i) / 5;
    ctx.beginPath();
    ctx.moveTo(mx, y + bodyH * 0.16);
    ctx.lineTo(mx, y + bodyH * 0.52);
    ctx.stroke();
  }

  // Destination blind on the leading end
  ctx.fillStyle = '#1b1f26';
  ctx.fillRect(cx + dir * w * 0.3, y + bodyH * 0.05, w * 0.16, bodyH * 0.1);

  // Door on the kerb side
  ctx.fillStyle = '#8f9aa6';
  ctx.fillRect(cx - dir * w * 0.16, y + bodyH * 0.16, w * 0.06, bodyH * 0.7);
  ctx.restore();
}

/** A fire engine: red pump body, white stripe, roof ladder, cab, light bar. */
export function drawFireTruck(ctx, cx, cy, w, h, dir = 1, flash = 0) {
  const bodyH = h * 0.42;
  const y = cy - bodyH * 0.5;
  const wheelY = y + bodyH;

  ctx.save();

  // Wheels
  ctx.fillStyle = '#14171c';
  for (const wx of [cx - dir * w * 0.34, cx - dir * w * 0.06, cx + dir * w * 0.32]) {
    ctx.beginPath(); ctx.arc(wx, wheelY, h * 0.12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#585f68';
    ctx.beginPath(); ctx.arc(wx, wheelY, h * 0.05, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#14171c';
  }

  // Pump body, running from the tail to the cab
  ctx.fillStyle = '#c0392b';
  ctx.fillRect(cx - dir * w * 0.5, y, w * 0.72, bodyH);

  // Cab at the leading end, a little taller than the body
  const cabW = w * 0.28;
  const cabX = dir > 0 ? cx + w * 0.22 : cx - w * 0.5;
  ctx.fillStyle = '#a82f22';
  ctx.fillRect(cabX, y - bodyH * 0.34, cabW, bodyH * 1.34);
  // Windscreen, on the leading face
  ctx.fillStyle = 'rgba(150,190,215,0.6)';
  ctx.fillRect(cabX + (dir > 0 ? cabW * 0.42 : cabW * 0.12),
    y - bodyH * 0.24, cabW * 0.46, bodyH * 0.44);

  // White stripe along the flank — the strongest read at small sizes
  ctx.fillStyle = '#f4f7f8';
  ctx.fillRect(cx - dir * w * 0.5, y + bodyH * 0.52, w * 0.72, bodyH * 0.2);

  // Roof ladder
  const lx0 = cx - dir * w * 0.46, lx1 = cx + dir * w * 0.16;
  const ly = y - h * 0.055;
  ctx.strokeStyle = '#d9dee4';
  ctx.lineWidth = Math.max(1, h * 0.022);
  ctx.beginPath();
  ctx.moveTo(lx0, ly); ctx.lineTo(lx1, ly);
  ctx.moveTo(lx0, ly + h * 0.045); ctx.lineTo(lx1, ly + h * 0.045);
  ctx.stroke();
  ctx.lineWidth = Math.max(0.6, h * 0.012);
  for (let i = 0; i <= 5; i++) {
    const rx = lx0 + ((lx1 - lx0) * i) / 5;
    ctx.beginPath(); ctx.moveTo(rx, ly); ctx.lineTo(rx, ly + h * 0.045); ctx.stroke();
  }

  // Light bar on the cab roof, alternating
  const barW = cabW * 0.86;
  const barX = cabX + (cabW - barW) / 2;
  ctx.fillStyle = flash ? '#ff5a44' : '#7fd4ff';
  ctx.fillRect(barX, y - bodyH * 0.52, barW / 2, bodyH * 0.18);
  ctx.fillStyle = flash ? '#7fd4ff' : '#ff5a44';
  ctx.fillRect(barX + barW / 2, y - bodyH * 0.52, barW / 2, bodyH * 0.18);
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* ------------------------------------------------------------------ */
/* Houses — the residential end of the corridor                        */
/* ------------------------------------------------------------------ */

const HOUSE_TONES = [
  { wall: '#5a5f52', roof: '#3b3f38' },
  { wall: '#6a5a4a', roof: '#443a30' },
  { wall: '#4e5a63', roof: '#343d44' },
  { wall: '#63544f', roof: '#413734' },
  { wall: '#575f4a', roof: '#3a4033' }
];

/** A row of modest houses: gabled roof, door, two windows, a porch light. */
export function drawHouseRow(ctx, x, y, w, h, count = 6, seed = 0) {
  const unit = w / count;
  for (let i = 0; i < count; i++) {
    const t = HOUSE_TONES[(i + seed) % HOUSE_TONES.length];
    drawHouse(ctx, x + i * unit + unit * 0.06, y, unit * 0.88, h, t, i + seed);
  }
}

function drawHouse(ctx, x, y, w, h, tone, n) {
  const roofH = h * 0.34;

  // Gabled roof
  ctx.fillStyle = tone.roof;
  ctx.beginPath();
  ctx.moveTo(x - w * 0.06, y + roofH);
  ctx.lineTo(x + w / 2, y);
  ctx.lineTo(x + w * 1.06, y + roofH);
  ctx.closePath();
  ctx.fill();

  // Wall
  ctx.fillStyle = tone.wall;
  ctx.fillRect(x, y + roofH, w, h - roofH);

  // Door
  ctx.fillStyle = '#2b2621';
  ctx.fillRect(x + w * 0.42, y + h * 0.62, w * 0.18, h - roofH - h * 0.28);

  // Windows, lit on alternating houses so the row has life in it
  const lit = n % 3 !== 0;
  ctx.fillStyle = lit ? 'rgba(255,214,140,0.75)' : '#242a30';
  ctx.fillRect(x + w * 0.1, y + h * 0.46, w * 0.22, h * 0.16);
  ctx.fillRect(x + w * 0.68, y + h * 0.46, w * 0.22, h * 0.16);

  // Porch light
  ctx.fillStyle = 'rgba(255,220,150,0.6)';
  ctx.fillRect(x + w * 0.63, y + h * 0.6, w * 0.03, h * 0.04);
}

/* ------------------------------------------------------------------ */
/* Wheelie bins                                                        */
/* ------------------------------------------------------------------ */

export const BIN_TONES = {
  black: { body: '#31363d', lid: '#22262b' },
  green: { body: '#3f6b3f', lid: '#2d4e2d' },
  blue: { body: '#35577e', lid: '#274161' }
};

/**
 * A municipal wheelie bin, side-on: tapered body, overhanging hinged lid,
 * a handle at the back and a wheel at its foot. Drawn large enough that the
 * colour is a second cue rather than the only one.
 */
export function drawBin(ctx, cx, cy, w, h, kind = 'black', tipped = false) {
  const tone = BIN_TONES[kind] || BIN_TONES.black;

  ctx.save();
  ctx.translate(cx, cy);
  if (tipped) ctx.rotate(-0.9);   // knocked over, lying on its side

  // Body, wider at the top than the base
  ctx.fillStyle = tone.body;
  ctx.beginPath();
  ctx.moveTo(-w * 0.42, h * 0.5);
  ctx.lineTo(w * 0.42, h * 0.5);
  ctx.lineTo(w * 0.5, -h * 0.3);
  ctx.lineTo(-w * 0.5, -h * 0.3);
  ctx.closePath();
  ctx.fill();

  // Vertical ribs
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = Math.max(0.6, w * 0.04);
  for (const f of [-0.2, 0.2]) {
    ctx.beginPath();
    ctx.moveTo(w * f, -h * 0.26);
    ctx.lineTo(w * f, h * 0.46);
    ctx.stroke();
  }

  // Lid, overhanging both sides with a lip at the front
  ctx.fillStyle = tone.lid;
  ctx.fillRect(-w * 0.56, -h * 0.42, w * 1.12, h * 0.14);
  ctx.fillRect(w * 0.4, -h * 0.34, w * 0.16, h * 0.1);

  // Handle at the back
  ctx.strokeStyle = tone.lid;
  ctx.lineWidth = Math.max(1, w * 0.07);
  ctx.beginPath();
  ctx.moveTo(-w * 0.5, -h * 0.24);
  ctx.lineTo(-w * 0.68, -h * 0.1);
  ctx.stroke();

  // Wheel
  ctx.fillStyle = '#14171c';
  ctx.beginPath();
  ctx.arc(-w * 0.3, h * 0.54, h * 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
