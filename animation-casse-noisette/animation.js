// ============================================================================
// LE CASSE-NOISETTE — teaser d'ouverture (escape game), 15 s, format 9:16
// Boutique de Noël de Madame Mirabelle. Ambiance : Noël étrange, mystère.
//
// Les décors sont les illustrations fournies (assets/), animées en code :
// caméra, lumières qui vacillent, neige, brouillard, porte qui s'ouvre,
// mâchoire du casse-noisette, textes "stop-motion".
// renderFrame(t) est déterministe => export image par image (render.js).
//
//   0.0 –  4.6  la maison : une silhouette passe à la fenêtre, la porte
//               s'ouvre, on plonge à travers elle…
//   4.6 –  8.6  …dans la boutique. "Madame Mirabelle vous attend…"
//               Les lampes grésillent et s'éteignent une à une.
//   8.6 – 11.3  noir. Une ampoule clignote : le casse-noisette.
//               "…et lui aussi." Sa mâchoire s'ouvre… CRAC !
//  11.3 – 15.0  le grand sapin, titre, "Escape Game — Grande Ouverture"
// Les mêmes repères de temps sont utilisés par la bande-son (bande-son.py).
// ============================================================================
"use strict";

const W = 1080, H = 1920, FPS = 30, DUR = 15;
const cv = document.getElementById("c");
const ctx = cv.getContext("2d");
ctx.imageSmoothingQuality = "high";

const C = {
  ink: "#0b0310", aub: "#331442", plum: "#592566", mag: "#88317a", rose: "#b83c8f",
  vio2: "#6b4fa8", lav: "#9d56ae", pink: "#d07ac3", pinkL: "#f29df3", cream: "#ffe8f8",
  red: "#ff5f8a", blue: "#6f7dff",
};

// ----------------------------------------------------------------------------
// OUTILS
// ----------------------------------------------------------------------------
const TAU = Math.PI * 2;
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const P = (t, a, b) => clamp((t - a) / (b - a));
const lerp = (a, b, k) => a + (b - a) * k;
const E = {
  inOut: k => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2,
  out: k => 1 - Math.pow(1 - k, 3),
  in: k => k * k * k,
  back: k => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); },
};
function rng(seed) {
  return () => {
    seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function rgba(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${n >> 8 & 255},${n & 255},${a})`; }
function circle(g, x, y, r) { g.beginPath(); g.arc(x, y, Math.max(0, r), 0, TAU); }
function canvas(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; }
// bruit lisse [-1, 1]
const noise = (t, s) => .5 * Math.sin(t * 1.7 + s) + .3 * Math.sin(t * 3.13 + s * 1.3) + .2 * Math.sin(t * 7.37 + s * 2.7);
// lumière de bougie / ampoule fatiguée
function flicker(t, s) {
  const dip = Math.pow(Math.max(0, Math.sin(t * 1.3 + s * 5)), 40);
  return clamp(.82 + .18 * noise(t * 4, s) - .7 * dip, 0, 1);
}
// pas "stop-motion" : change 12 fois par seconde
const boil = (t, i) => rng(Math.floor(t * 12) * 131 + i * 17);

function makeGlow(col) {
  const c = canvas(128, 128), g = c.getContext("2d");
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, rgba(col, 1)); gr.addColorStop(.22, rgba(col, .5)); gr.addColorStop(1, rgba(col, 0));
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return c;
}
const GLOW = { cream: makeGlow(C.cream), pinkL: makeGlow(C.pinkL), pink: makeGlow(C.pink), rose: makeGlow(C.rose), red: makeGlow(C.red), blue: makeGlow(C.blue), lav: makeGlow(C.lav) };
function glow(g, x, y, r, sprite, a) {
  if (a <= 0 || r <= 0) return;
  g.globalAlpha = Math.min(1, a); g.drawImage(sprite, x - r, y - r, 2 * r, 2 * r); g.globalAlpha = 1;
}
function additive(g, fn) { g.save(); g.globalCompositeOperation = "lighter"; fn(); g.restore(); }
function vGrad(g, y0, y1, a, b) { const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, a); gr.addColorStop(1, b); return gr; }
function shade(g, a, col = C.ink) { if (a > 0) { g.fillStyle = rgba(col, clamp(a)); g.fillRect(0, 0, W, H); } }

// Caméra : le point (fx, fy) de l'image arrive au centre de l'écran, à
// l'échelle s. Avec clamp, on ne sort jamais de l'image.
function camera(g, img, fx, fy, s, rot = 0, doClamp = true) {
  if (doClamp) {
    const c = Math.abs(Math.cos(rot)), si = Math.abs(Math.sin(rot));
    const bw = W / 2 * c + H / 2 * si, bh = W / 2 * si + H / 2 * c;
    s = Math.max(s, 2 * bw / img.width, 2 * bh / img.height);
    fx = clamp(fx, bw / s, img.width - bw / s);
    fy = clamp(fy, bh / s, img.height - bh / s);
  }
  g.translate(W / 2, H / 2); g.rotate(rot); g.scale(s, s); g.translate(-fx, -fy);
  return { fx, fy, s };
}

// ----------------------------------------------------------------------------
// ASSETS
// ----------------------------------------------------------------------------
const IMG = {};
function loadImg(key, src) {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => { IMG[key] = i; res(); }; i.onerror = rej; i.src = src; });
}

// ----------------------------------------------------------------------------
// ATMOSPHÈRE : neige, brouillard, grain
// ----------------------------------------------------------------------------
const FLAKES = (() => {
  const r = rng(1);
  return Array.from({ length: 260 }, () => {
    const z = Math.pow(r(), 1.8);
    return { x: r() * W, y: r() * H, z, sp: 50 + z * 330, dr: 8 + z * 40, fr: .4 + r() * .9, ph: r() * TAU, pink: r() < .3 };
  });
})();
function snow(g, t, a = 1, wind = 0) {
  if (a <= 0) return;
  for (const f of FLAKES) {
    const y = (f.y + t * f.sp) % (H + 60) - 30;
    const x = ((f.x + Math.sin(t * f.fr + f.ph) * f.dr + wind * t * f.sp * .3) % W + W) % W;
    if (f.z > .8) glow(g, x, y, 10 + f.z * 22, f.pink ? GLOW.pinkL : GLOW.cream, a * .55);
    else { g.globalAlpha = a * (.3 + f.z * .7); g.fillStyle = f.pink ? C.pinkL : C.cream; circle(g, x, y, 1.2 + f.z * 4); g.fill(); }
  }
  g.globalAlpha = 1;
}
const FOG = (() => {
  const c = canvas(1024, 512), g = c.getContext("2d"), r = rng(8);
  for (let i = 0; i < 90; i++) {
    const x = r() * 1024, y = 180 + r() * 300, rad = 60 + r() * 160;
    for (const dx of [-1024, 0, 1024]) glow(g, x + dx, y, rad, GLOW.lav, .10);
  }
  return c;
})();
function fog(g, t, y, a, speed = 18, scale = 1.6) {
  if (a <= 0) return;
  const w = 1024 * scale, h = 512 * scale, off = ((t * speed) % w + w) % w;
  g.globalAlpha = a;
  for (let x = -off; x < W; x += w) g.drawImage(FOG, x, y, w, h);
  g.globalAlpha = 1;
}
const GRAIN = (() => {
  const c = canvas(256, 256), g = c.getContext("2d"), d = g.createImageData(256, 256), r = rng(3);
  for (let i = 0; i < d.data.length; i += 4) { const v = r() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
  g.putImageData(d, 0, 0); return c;
})();
const grainPattern = ctx.createPattern(GRAIN, "repeat");
function finish(g, t, frame) {
  const v = g.createRadialGradient(W / 2, H * .47, W * .35, W / 2, H / 2, H * .62);
  v.addColorStop(0, rgba(C.ink, 0)); v.addColorStop(1, rgba(C.ink, .78));
  g.fillStyle = v; g.fillRect(0, 0, W, H);
  // légère variation d'exposition, comme une vieille pellicule
  shade(g, .035 * (boil(t, 5)() - .3));
  const r = rng(frame + 1);
  g.save(); g.globalCompositeOperation = "overlay"; g.globalAlpha = .09;
  g.translate(-r() * 256, -r() * 256); g.fillStyle = grainPattern; g.fillRect(0, 0, W + 256, H + 256);
  g.restore();
}

// ----------------------------------------------------------------------------
// TEXTES "STOP-MOTION"
// ----------------------------------------------------------------------------
function letters(g, str, cx, y, font, t, o) {
  g.font = font; g.letterSpacing = o.spacing || "0px"; g.textAlign = "left"; g.textBaseline = "alphabetic";
  // largeurs lettre par lettre (évite que les ligatures "ss"/"tt" se chevauchent)
  const ws = [...str].map(ch => g.measureText(ch).width);
  const total = ws.reduce((a, b) => a + b, 0);
  let px = cx - total / 2;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i], cw = ws[i], x = px; px += cw;
    if (ch === " ") continue;
    const s0 = o.start + i * (o.stagger || 0), k = P(t, s0, s0 + (o.dur || .4));
    if (k <= 0) continue;
    const j = boil(t, i + (o.seed || 0)), b = o.boil ?? 3;
    let a = (o.pop ? clamp(k * 3) : E.out(k)) * (o.alpha ?? 1);
    if (o.flick) a *= boil(t, i + 50)() < o.flick ? .25 : 1;
    if (a <= 0) continue;
    const sc = o.pop ? E.back(k) : 1;
    g.save(); g.globalAlpha = a;
    g.translate(x + cw / 2 + (j() - .5) * b, y + (j() - .5) * b + (o.rise ? (1 - E.out(k)) * o.rise : 0));
    g.rotate((j() - .5) * b * .012 + (o.pop ? (1 - E.out(k)) * .6 * (i % 2 ? 1 : -1) : 0));
    g.scale(sc, sc);
    if (o.stroke) { g.lineJoin = "round"; g.lineWidth = o.strokeW || 10; g.strokeStyle = o.stroke; g.strokeText(ch, -cw / 2, 0); }
    if (o.glow) { g.shadowColor = o.glow; g.shadowBlur = o.glowBlur || 26; }
    g.fillStyle = typeof o.fill === "function" ? o.fill(g) : o.fill;
    g.fillText(ch, -cw / 2, 0);
    g.restore();
  }
  g.letterSpacing = "0px";
}
// Trait terminé par des spirales (comme la colline de Jack)
function flourish(g, cx, ly, halfW, R, k, col) {
  if (k <= 0) return;
  const T = Math.PI * 3.2;
  for (const dir of [-1, 1]) {
    const pts = [];
    for (let i = 0; i <= 20; i++) pts.push([cx + dir * halfW * i / 20, ly]);
    const sx = cx + dir * halfW, sy = ly - R;
    for (let i = 1; i <= 70; i++) {
      const th = T * (1 - i / 70), r = R * th / T;
      pts.push([sx + dir * r * Math.sin(th + Math.PI * .2), sy - r * Math.cos(th + Math.PI * .2)]);
    }
    const n = Math.floor(pts.length * k);
    g.strokeStyle = col; g.lineWidth = 4; g.lineCap = "round"; g.lineJoin = "round";
    g.beginPath(); for (let i = 0; i < n; i++) g.lineTo(pts[i][0], pts[i][1]); g.stroke();
  }
}

// ----------------------------------------------------------------------------
// SCÈNE 1 — la maison (assets/maison.webp, 747x1113)
// ----------------------------------------------------------------------------
const DOOR = { x0: 346, x1: 406, cy: 698, r: 30, bot: 826, cx: 376, mid: 752 };
function doorPath(g) {
  g.beginPath(); g.moveTo(DOOR.x0, DOOR.bot); g.lineTo(DOOR.x0, DOOR.cy);
  g.arc(DOOR.cx, DOOR.cy, DOOR.r, Math.PI, 0); g.lineTo(DOOR.x1, DOOR.bot); g.closePath();
}
let LEAF = null, LEAF_D = null;
function buildLeaf() {
  const c = canvas(60, 160), g = c.getContext("2d");
  g.translate(-DOOR.x0, -666); doorPath(g); g.clip();
  g.drawImage(IMG.maison, 0, 0);
  const d = canvas(60, 160), h = d.getContext("2d");
  h.drawImage(c, 0, 0); h.globalCompositeOperation = "source-atop"; h.fillStyle = C.ink; h.fillRect(0, 0, 60, 160);
  LEAF = c; LEAF_D = d;
}
// battant pivotant vers l'intérieur (charnière à gauche), tranche par tranche
function drawLeaf(g, theta) {
  const f = 170, cx = DOOR.cx, cy = DOOR.mid, N = 60;
  const co = Math.cos(theta), si = Math.sin(theta);
  const proj = d => { const k = f / (f + d * si); return { x: cx + (DOOR.x0 + d * co - cx) * k, k }; };
  for (let d = 0; d < N; d++) {
    const a = proj(d), b = proj(d + 1);
    const y0 = cy + (666 - cy) * a.k, h = 160 * a.k;
    g.drawImage(LEAF, d, 0, 1, 160, a.x, y0, b.x - a.x + .4, h);
    if (si > .01) { g.globalAlpha = .75 * si; g.drawImage(LEAF_D, d, 0, 1, 160, a.x, y0, b.x - a.x + .4, h); g.globalAlpha = 1; }
  }
}
// fenêtres éclairées [x, y, rayon, graine]
const WINDOWS = [[470, 355, 50, 1], [378, 518, 38, 2], [515, 542, 34, 3], [237, 382, 32, 4], [240, 702, 36, 5], [145, 708, 44, 6],
  [505, 700, 78, 7], [580, 566, 30, 8], [690, 716, 22, 9], [182, 572, 20, 10], [215, 540, 20, 11], [268, 528, 20, 12]];

// Point de vue de la boutique au début de la scène 2 (voir sceneShop)
const SHOP_START = { fx: 365, fy: 620, s: 2.1 };

function sceneHouse(g, t) {
  const img = IMG.maison;
  const open = E.inOut(P(t, 2.0, 3.3));
  let theta = 1.45 * open;
  if (t > 1.72 && t < 2.0) theta += .04 * Math.abs(Math.sin((t - 1.72) * 38)); // le loquet cède
  const o = Math.sin(theta) / Math.sin(1.45);

  const dive = E.in(P(t, 3.05, 4.6));
  const s = lerp(1.8, 2.75, E.inOut(P(t, 0, 3.2))) * Math.exp(Math.log(15) * dive);
  const fx = lerp(lerp(372, 376, P(t, 0, 3)), DOOR.cx, dive);
  const fy = lerp(lerp(560, 690, E.inOut(P(t, 0, 3.2))), DOOR.mid, E.out(P(t, 3.05, 4.6)));
  const rot = (Math.sin(t * .6) * .014 + .01) * (1 - dive);

  g.fillStyle = C.ink; g.fillRect(0, 0, W, H);
  g.save();
  const cam = camera(g, img, fx, fy, s, rot, dive === 0);
  g.drawImage(img, 0, 0);

  // à travers la porte : la boutique, vue "au loin"
  g.save(); doorPath(g); g.clip();
  g.fillStyle = "#12030f"; g.fillRect(DOOR.x0, 660, 60, 170);
  if (open > 0) {
    g.save();
    g.translate(DOOR.cx, DOOR.mid); g.scale(SHOP_START.s / cam.s, SHOP_START.s / cam.s); g.translate(-SHOP_START.fx, -SHOP_START.fy);
    g.drawImage(IMG.boutique, 0, 0);
    g.restore();
    additive(g, () => glow(g, DOOR.cx, DOOR.mid, 90, GLOW.pinkL, .55 * o * (1 - dive)));
  }
  drawLeaf(g, theta);
  g.restore();

  // fenêtres qui vacillent (celle du haut s'éteint un instant)
  additive(g, () => {
    WINDOWS.forEach(([x, y, r, sd], i) => {
      let a = .42 * flicker(t, sd);
      if (i === 1) a *= t > 1.2 && t < 1.55 ? .1 : 1;
      glow(g, x, y, r * 1.6, i % 3 ? GLOW.rose : GLOW.pinkL, a);
    });
    // flaque de lumière sur la neige
    glow(g, DOOR.cx + 10, 850, 150, GLOW.pinkL, .55 * o);
    glow(g, DOOR.cx, DOOR.mid, 60 + 40 * o, GLOW.cream, (.12 + .5 * o) * (1 - dive * .8));
  });
  // une silhouette passe derrière la fenêtre du haut
  if (t > .7 && t < 2.6) {
    const x = t < 1.4 ? lerp(425, 468, E.inOut(P(t, .7, 1.4))) : t < 1.95 ? 468 : lerp(468, 515, E.in(P(t, 1.95, 2.5)));
    g.save(); g.beginPath(); g.rect(440, 316, 58, 78); g.clip();
    g.fillStyle = "rgba(22,4,26,.88)";
    circle(g, x, 346, 11); g.fill();             // tête
    circle(g, x + 3, 332, 6); g.fill();          // chignon
    g.beginPath(); g.ellipse(x, 388, 24, 26, 0, 0, TAU); g.fill(); // épaules
    g.restore();
  }
  g.restore();

  // atmosphère (écran)
  fog(g, t, 1350, .7 * (1 - dive), 22, 1.8);
  snow(g, t, 1 - P(t, 3.6, 4.4), .15);
  shade(g, 1 - E.out(P(t, 0, 1.4)));
  // halo quand on traverse la porte
  additive(g, () => glow(g, W / 2, H / 2, 1400, GLOW.pinkL, .35 * Math.max(0, 1 - Math.abs(t - 4.55) / .3)));
}

// ----------------------------------------------------------------------------
// SCÈNE 2 — la boutique (assets/boutique.webp, 730x1096)
// ----------------------------------------------------------------------------
const LAMPS = [[207, 456, 46, 1], [462, 569, 34, 2], [262, 614, 30, 3], [440, 638, 26, 4], [432, 673, 24, 5]];
const PAPERS = (() => {
  const r = rng(12), cols = ["#b83a62", "#d9587e", "#8c2448", "#e2799a", "#6a1d3c"];
  return Array.from({ length: 70 }, () => {
    const z = r();
    return { x: r() * W, y: r() * H, z, s: 8 + z * z * 40, sp: 40 + z * 140, rs: (r() - .5) * 4, fl: 1 + r() * 4, ph: r() * TAU, c: cols[Math.floor(r() * 5)] };
  });
})();
function papers(g, t, a) {
  for (const p of PAPERS) {
    const y = (p.y + t * p.sp) % (H + 100) - 50, x = p.x + Math.sin(t * .8 + p.ph) * 60 * (.3 + p.z);
    g.save(); g.globalAlpha = a * (.45 + p.z * .5);
    g.translate(x, y); g.rotate(t * p.rs + p.ph); g.scale(1, Math.cos(t * p.fl + p.ph));
    g.fillStyle = p.c; g.fillRect(-p.s / 2, -p.s * .35, p.s, p.s * .7);
    g.restore();
  }
}
function sceneShop(g, u, t) {
  const img = IMG.boutique;
  const k = E.out(P(u, 0, 4));
  g.save();
  camera(g, img, lerp(SHOP_START.fx, 360, k), lerp(SHOP_START.fy, 700, k), SHOP_START.s * (1 + .2 * k), Math.sin(u * .7) * .01 * k);
  g.drawImage(img, 0, 0);
  // lampes : vacillent, puis grésillent et meurent une à une
  const lampOn = LAMPS.map(([, , , sd], i) => {
    const death = 2.55 + i * .2;
    if (u > death + .25) return 0;
    let a = flicker(t * 1.5, sd);
    if (u > death) a *= boil(t * 2, i)() < .5 ? 1 : .05;
    return a;
  });
  additive(g, () => {
    LAMPS.forEach(([x, y, r], i) => { glow(g, x, y, r * 3.2, GLOW.rose, .55 * lampOn[i]); glow(g, x, y, r * .9, GLOW.cream, .8 * lampOn[i]); });
    glow(g, 355, 520, 120, GLOW.blue, .35 + .1 * noise(t, 3));
    glow(g, 355, 760, 110, GLOW.blue, .3);
  });
  g.restore();

  const lights = lampOn.reduce((a, b) => a + b, 0) / LAMPS.length;
  papers(g, t, 1 - P(u, 3.2, 3.8));
  // l'obscurité gagne à mesure que les lampes meurent
  shade(g, .72 * (1 - lights) * P(u, 2.4, 2.6));
  shade(g, E.in(P(u, 3.55, 4.0)));

  // "Madame Mirabelle vous attend…"
  const fade = 1 - P(u, 3.35, 3.7);
  if (fade > 0) {
    g.fillStyle = vGrad(g, 1250, 1800, rgba(C.ink, 0), rgba(C.ink, .7)); g.fillRect(0, 1250, W, 670);
    const opt = { stagger: .045, dur: .5, rise: 16, boil: 3, glow: C.rose, alpha: fade, fill: C.cream, flick: u > 2.7 ? .35 : 0 };
    letters(g, "Madame Mirabelle", W / 2, 1520, "italic 108px 'IM Fell English'", u, { ...opt, start: .5 });
    letters(g, "vous attend…", W / 2, 1640, "italic 88px 'IM Fell English'", u, { ...opt, start: 1.25, seed: 40, fill: C.pinkL });
  }
  // flash d'entrée (continuité avec la porte)
  additive(g, () => glow(g, W / 2, H / 2, 1400, GLOW.pinkL, .35 * (1 - P(u, 0, .4))));
}

// ----------------------------------------------------------------------------
// SCÈNE 3 — le casse-noisette (assets/casse-noisette.jpg, 1440x1440)
// ----------------------------------------------------------------------------
const PUPILS = [[482, 468], [992, 508]];
function sceneNut(g, v, t) {
  const img = IMG.nut;
  g.fillStyle = C.ink; g.fillRect(0, 0, W, H);
  // ampoule qui clignote avant de tenir
  let L = (v > .04 && v < .1) || (v > .2 && v < .29) || v > .42 ? 1 : 0;
  if (v > .42) L = .78 + .22 * flicker(t * 2, 9);
  if (L <= 0) return;

  const crack = 2.0;
  const sh = v > crack && v < crack + .4 ? (1 - P(v, crack, crack + .4)) * 26 : 0;
  const shx = Math.sin(v * 95) * sh, shy = Math.cos(v * 77) * sh;
  const s = lerp(.98, 1.38, E.inOut(P(v, 0, 2.7))) * (v > crack ? 1 + .05 * E.out(P(v, crack, crack + .3)) : 1);
  const fx = lerp(760, 740, P(v, 0, 2.7)), fy = lerp(640, 540, E.inOut(P(v, 0, 2.7)));

  g.save();
  g.translate(W / 2 + shx, H / 2 + shy); g.scale(s, s); g.translate(-fx, -fy);
  g.drawImage(img, 0, 0);
  // mâchoire : s'ouvre lentement, tremble… et claque
  let d = 34 * E.inOut(P(v, 1.0, 1.85));
  if (v > 1.85 && v < crack) d += Math.sin(v * 60) * 2;
  if (v >= crack) d = 0;
  if (d > .5) {
    g.fillStyle = "#14020f"; g.fillRect(430, 842, 730, d + 4);
    g.drawImage(img, 400, 844, 780, 200, 400, 844 + d, 780, 200);
  }
  // reflets dans les yeux
  additive(g, () => {
    const e = P(v, .9, 1.95) * (v < crack ? 1 : 1 - P(v, crack, crack + .5));
    for (const [x, y] of PUPILS) { glow(g, x, y, 70, GLOW.red, .5 * e * (0.8 + .2 * Math.sin(v * 20))); glow(g, x + 18, y - 22, 16, GLOW.cream, .6 * L); }
  });
  // bords de l'image fondus dans le noir
  const top = 0, bot = 1440;
  g.fillStyle = vGrad(g, top, top + 260, rgba(C.ink, 1), rgba(C.ink, 0)); g.fillRect(-500, top - 1, 2440, 262);
  g.fillStyle = vGrad(g, bot - 320, bot, rgba(C.ink, 0), rgba(C.ink, 1)); g.fillRect(-500, bot - 321, 2440, 322);
  g.fillStyle = C.ink; g.fillRect(-2000, -2000, 5440, 2000); g.fillRect(-2000, bot, 5440, 2000);
  g.restore();

  // ampoule qui se balance : ombre mouvante
  const lx = W / 2 + Math.sin(v * 2.1) * 140, ly = 820;
  const sg = g.createRadialGradient(lx, ly, 150, lx, ly, 900);
  sg.addColorStop(0, rgba(C.ink, 0)); sg.addColorStop(1, rgba(C.ink, .85));
  g.fillStyle = sg; g.fillRect(0, 0, W, H);
  shade(g, 1 - L);

  // "…et lui aussi."
  if (v > .7 && v < crack) {
    letters(g, "…et lui aussi.", W / 2, 1680, "italic 96px 'IM Fell English'", v, {
      start: .75, stagger: .05, dur: .4, boil: 4, fill: C.pinkL, glow: C.rose, flick: .15,
    });
  }
  // CRAC : éclair
  const fl = v > crack ? 1 - P(v, crack, crack + .3) : 0;
  if (fl > 0) { g.fillStyle = rgba(C.cream, .6 * fl); g.fillRect(0, 0, W, H); }
  shade(g, E.inOut(P(v, 2.3, 2.7)));
}

// ----------------------------------------------------------------------------
// SCÈNE 4 — le grand sapin et le titre (assets/sapin.webp, 722x1100)
// ----------------------------------------------------------------------------
function sceneTree(g, w, t) {
  const img = IMG.sapin;
  const k = E.inOut(P(w, 0, 2.2));
  g.save();
  camera(g, img, 361, lerp(820, 550, k), lerp(2.7, 1.76, k), Math.sin(w * .5) * .006);
  g.drawImage(img, 0, 0);
  additive(g, () => {
    TREE_LIGHTS.forEach(([x, y, b], i) => {
      const tw = Math.pow(.5 + .5 * Math.sin(t * (2 + i % 5) + i * 2.3), 3);
      glow(g, x, y, 5 + 7 * tw, i % 4 ? GLOW.pinkL : GLOW.cream, (.25 + .75 * tw) * b);
    });
    SKY_STARS.forEach(([x, y, b], i) => {
      const tw = Math.pow(Math.max(0, Math.sin(t * (1.3 + i % 4) + i)), 6);
      glow(g, x, y, 3 + 6 * tw, GLOW.cream, tw * b);
    });
    // l'étoile du sommet s'embrase
    const sk = E.out(P(w, 1.0, 1.5)) * (1 - .3 * P(w, 1.5, 2.6));
    glow(g, 360, 205, 150 * sk, GLOW.pinkL, .9 * sk);
    glow(g, 360, 205, 40 * sk, GLOW.cream, sk);
    g.save(); g.translate(360, 205); g.rotate(t * .3); g.fillStyle = rgba(C.cream, .5 * sk);
    for (let i = 0; i < 4; i++) { g.rotate(Math.PI / 2); g.beginPath(); g.moveTo(-1.5, 0); g.lineTo(0, -120 * sk); g.lineTo(1.5, 0); g.fill(); }
    g.restore();
  });
  g.restore();

  snow(g, t, 1, -.1);
  fog(g, t, 1300, .6, 14, 1.8);
  g.fillStyle = vGrad(g, 1150, 1920, rgba(C.ink, 0), rgba(C.ink, .88)); g.fillRect(0, 1150, W, 770);

  // titre
  const fillGrad = g2 => vGrad(g2, -110, 10, C.cream, C.pinkL);
  letters(g, "Le", W / 2, 1375, "76px 'Henny Penny'", w, { start: 1.2, dur: .4, pop: true, boil: 3, stroke: C.ink, strokeW: 10, glow: C.rose, fill: fillGrad });
  letters(g, "Casse-Noisette", W / 2, 1535, "132px 'Henny Penny'", w, {
    start: 1.3, stagger: .035, dur: .45, pop: true, boil: 4, stroke: C.ink, strokeW: 14, glow: C.rose, glowBlur: 34, fill: fillGrad, seed: 10,
  });
  flourish(g, W / 2, 1600, 330, 26, E.inOut(P(w, 1.85, 2.45)), C.pinkL);
  letters(g, "ESCAPE GAME", W / 2 + 7, 1690, "58px 'IM Fell English SC'", w, { start: 2.0, stagger: .03, dur: .35, boil: 2, fill: C.cream, spacing: "14px", seed: 30 });
  letters(g, "Grande Ouverture", W / 2, 1790, "italic 70px 'IM Fell English'", w, { start: 2.3, stagger: .03, dur: .4, rise: 12, boil: 2, fill: C.pinkL, glow: C.rose, seed: 60 });

  shade(g, 1 - E.out(P(w, 0, .5)));
}

// ----------------------------------------------------------------------------
// COMPOSITION
// ----------------------------------------------------------------------------
function renderFrame(t, frame = Math.round(t * FPS)) {
  const g = ctx;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1; g.globalCompositeOperation = "source-over"; g.shadowBlur = 0;
  if (t < 4.6) sceneHouse(g, t);
  else if (t < 8.6) sceneShop(g, t - 4.6, t);
  else if (t < 11.3) sceneNut(g, t - 8.6, t);
  else sceneTree(g, t - 11.3, t);
  finish(g, t, frame);
  shade(g, E.inOut(P(t, 14.45, 15)));
}

window.FPS = FPS; window.DUR = DUR; window.W = W; window.H = H; window.renderFrame = renderFrame;
window.frameJPEG = i => { renderFrame(i / FPS, i); return cv.toDataURL("image/jpeg", .94).split(",")[1]; };
window.ready = Promise.all([
  loadImg("maison", "assets/maison.webp"), loadImg("boutique", "assets/boutique.webp"),
  loadImg("sapin", "assets/sapin.webp"), loadImg("nut", "assets/casse-noisette.jpg"),
  ...["76px 'Henny Penny'", "58px 'IM Fell English SC'", "italic 70px 'IM Fell English'"].map(f => document.fonts.load(f)),
]).then(() => { buildLeaf(); return document.fonts.ready; });

if (!location.search.includes("capture")) {
  window.ready.then(() => {
    const audio = document.getElementById("son");
    let start = performance.now();
    const restart = () => { start = performance.now(); if (audio) { audio.currentTime = 0; audio.play().catch(() => {}); } };
    cv.addEventListener("click", restart);
    const loop = now => {
      const t = (now - start) / 1000;
      if (t >= DUR) restart();
      renderFrame(Math.min(t, DUR - 1e-3));
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
}
