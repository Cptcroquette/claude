// ============================================================================
// LE CASSE-NOISETTE — animation d'ouverture (escape game)
// Boutique de Noël de Madame Mirabelle.
//
// Tout est dessiné en code sur un <canvas> 1920x1080. La fonction
// renderFrame(t) est déterministe (même t => même image), ce qui permet
// l'export image par image (voir render.js).
//
// Découpage (secondes) :
//   0.0 – 4.8   la porte de la boutique s'ouvre, on plonge dans la lumière
//   4.8 – 9.6   motion design : anneaux, flocons, boules, "Il était une fois…"
//   9.6 – 15.6  le casse-noisette apparaît, croque une noisette, titre
//  15.6 – 21.8  la boutique de Noël de Madame Mirabelle (sapin, cadeaux)
//  20.8 – 27.0  final : emblème, bannière, "Grande Ouverture"
// ============================================================================
"use strict";

const W = 1920, H = 1080, FPS = 30, DUR = 27;
const cv = document.getElementById("c");
const ctx = cv.getContext("2d");

// Palette tirée de l'image de référence
const C = {
  bg: "#1a0924", aub: "#331442", plum: "#592566", mag: "#88317a", rose: "#b83c8f",
  vio: "#5c4699", vio2: "#6b4fa8", ind: "#452e6f", lav: "#9d56ae", lav2: "#80489e",
  pink: "#d07ac3", pinkL: "#f29df3", cream: "#ffe8f8", skin: "#f1b6de", skinD: "#d48ac4",
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
  elastic: k => k <= 0 ? 0 : k >= 1 ? 1 : Math.pow(2, -10 * k) * Math.sin((k * 10 - .75) * (TAU / 3)) + 1,
  expo: k => k >= 1 ? 1 : 1 - Math.pow(2, -10 * k),
};
function rng(seed) {
  return () => {
    seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${n >> 8 & 255},${n & 255},${a})`;
}
function rr(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
function circle(g, x, y, r) { g.beginPath(); g.arc(x, y, r, 0, TAU); }
function canvas(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; }

// Sprites de lueur (plus rapides que shadowBlur)
function makeGlow(col) {
  const c = canvas(128, 128), g = c.getContext("2d");
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, rgba(col, 1)); gr.addColorStop(.25, rgba(col, .45)); gr.addColorStop(1, rgba(col, 0));
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return c;
}
const GLOW = { cream: makeGlow(C.cream), pinkL: makeGlow(C.pinkL), lav: makeGlow(C.lav), pink: makeGlow(C.pink), rose: makeGlow(C.rose) };
function glow(g, x, y, r, sprite, a) {
  if (a <= 0) return;
  g.globalAlpha = a; g.drawImage(sprite, x - r, y - r, 2 * r, 2 * r); g.globalAlpha = 1;
}

// Étoile à n branches
function starPath(g, x, y, R, r, n, rot) {
  g.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const a = rot + i * Math.PI / n - Math.PI / 2, d = i % 2 ? r : R;
    g.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
  }
  g.closePath();
}
function twinkle(g, x, y, R, rot, a, col = C.cream) {
  if (a <= 0 || R <= 0) return;
  glow(g, x, y, R * 2.2, GLOW.pinkL, a * .6);
  g.globalAlpha = a; g.fillStyle = col;
  starPath(g, x, y, R, R * .16, 4, rot); g.fill();
  g.globalAlpha = 1;
}
// Champ d'étoiles scintillantes déterministe
const TW = (() => { const r = rng(42); return Array.from({ length: 60 }, () => ({ x: r(), y: r(), s: 6 + r() * 14, sp: 1.2 + r() * 2.2, ph: r() * TAU })); })();
function twinkleField(g, t, a, x0 = 0, y0 = 0, w = W, h = H, n = 60) {
  for (let i = 0; i < n; i++) {
    const s = TW[i], k = Math.pow(Math.max(0, Math.sin(t * s.sp + s.ph)), 6);
    twinkle(g, x0 + s.x * w, y0 + s.y * h, s.s * (.4 + .6 * k), t * .5 + i, a * k);
  }
}

// Flocon géométrique
function flake(g, x, y, R, rot, col, lw, a = 1) {
  if (R <= 0 || a <= 0) return;
  g.save(); g.globalAlpha = a; g.translate(x, y); g.rotate(rot);
  g.strokeStyle = col; g.lineWidth = lw; g.lineCap = "round";
  g.beginPath();
  for (let i = 0; i < 6; i++) {
    const c = Math.cos(i * TAU / 6), s = Math.sin(i * TAU / 6);
    const L = (px, py) => [px * c - py * s, px * s + py * c];
    const seg = (a1, b1) => { const p = L(...a1), q = L(...b1); g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]); };
    seg([0, 0], [0, -R]);
    seg([0, -R * .42], [-R * .24, -R * .64]); seg([0, -R * .42], [R * .24, -R * .64]);
    seg([0, -R * .7], [-R * .15, -R * .85]); seg([0, -R * .7], [R * .15, -R * .85]);
  }
  g.stroke();
  circle(g, 0, 0, R * .12); g.fillStyle = col; g.fill();
  g.restore();
}

// Neige (trois profondeurs mélangées)
const FLAKES = (() => {
  const r = rng(1);
  return Array.from({ length: 240 }, () => {
    const s = .8 + r() * r() * 4.2;
    return { x: r() * W, y: r() * (H + 40), s, sp: 25 + s * 30, fr: .3 + r() * .8, ph: r() * TAU, dr: 10 + r() * 30, a: .35 + r() * .6 };
  });
})();
function snow(g, t, alpha = 1, n = FLAKES.length) {
  if (alpha <= 0) return;
  g.fillStyle = C.cream;
  for (let i = 0; i < n; i++) {
    const f = FLAKES[i];
    const y = (f.y + t * f.sp) % (H + 40) - 20;
    const x = ((f.x + Math.sin(t * f.fr + f.ph) * f.dr) % W + W) % W;
    g.globalAlpha = alpha * f.a;
    circle(g, x, y, f.s); g.fill();
  }
  g.globalAlpha = 1;
}

// Bokeh (grosses taches de lumière floues)
const BOKEH = (() => {
  const r = rng(9), cols = ["pinkL", "lav", "pink", "cream"];
  return Array.from({ length: 16 }, (_, i) => ({ x: r() * W, y: r() * H, r: 50 + r() * 120, sp: 8 + r() * 18, ph: r() * TAU, c: cols[i % 4] }));
})();
function bokeh(g, t, a) {
  if (a <= 0) return;
  g.save(); g.globalCompositeOperation = "lighter";
  for (const b of BOKEH) {
    const y = ((b.y - t * b.sp) % (H + 300) + H + 300) % (H + 300) - 150;
    glow(g, b.x + Math.sin(t * .4 + b.ph) * 40, y, b.r, GLOW[b.c], a * (.10 + .05 * Math.sin(t + b.ph)));
  }
  g.restore();
}

// Fonds
function bgNight(g, c0 = C.vio2, c1 = C.ind, c2 = C.bg) {
  const gr = g.createRadialGradient(W / 2, H * .42, 40, W / 2, H * .5, W * .78);
  gr.addColorStop(0, c0); gr.addColorStop(.45, c1); gr.addColorStop(1, c2);
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
}
function mountains(g, t, baseY, amp, col, seed, drift) {
  g.fillStyle = col; g.beginPath(); g.moveTo(0, H);
  for (let x = 0; x <= W + 20; x += 20) {
    const X = x + drift * t;
    const y = baseY - amp * (
      .55 * (1 - Math.abs(Math.sin(X * .0016 + seed))) +
      .30 * (1 - Math.abs(Math.sin(X * .0041 + seed * 2.1))) +
      .15 * Math.sin(X * .011 + seed * 3.7));
    g.lineTo(x, y);
  }
  g.lineTo(W, H); g.closePath(); g.fill();
}
function landscape(g, t) {
  mountains(g, t, 760, 300, rgba(C.lav, .22), 1.3, 6);
  mountains(g, t, 860, 240, rgba(C.vio, .45), 4.1, 14);
  const fog = g.createLinearGradient(0, 700, 0, H);
  fog.addColorStop(0, rgba(C.pinkL, 0)); fog.addColorStop(.5, rgba(C.pinkL, .10)); fog.addColorStop(1, rgba(C.aub, .7));
  g.fillStyle = fog; g.fillRect(0, 700, W, H - 700);
}

// Grain + vignette (texture "peinte" de l'image de référence)
const GRAIN = (() => {
  const c = canvas(256, 256), g = c.getContext("2d"), d = g.createImageData(256, 256), r = rng(3);
  for (let i = 0; i < d.data.length; i += 4) { const v = r() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
  g.putImageData(d, 0, 0); return c;
})();
const grainPattern = ctx.createPattern(GRAIN, "repeat");
function finish(g, t, frame) {
  const v = g.createRadialGradient(W / 2, H / 2, H * .35, W / 2, H / 2, W * .7);
  v.addColorStop(0, "rgba(15,3,22,0)"); v.addColorStop(1, "rgba(15,3,22,.72)");
  g.fillStyle = v; g.fillRect(0, 0, W, H);
  const r = rng(frame + 1);
  g.save(); g.globalCompositeOperation = "overlay"; g.globalAlpha = .07;
  g.translate(-r() * 256, -r() * 256); g.fillStyle = grainPattern; g.fillRect(0, 0, W + 256, H + 256);
  g.restore();
}

// Textes
function setFont(g, f) { g.font = f; g.letterSpacing = "0px"; }
function vGrad(g, y0, y1, a, b) { const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, a); gr.addColorStop(1, b); return gr; }
// Révélation "écriture à la main" : masque qui balaye de gauche à droite
function writeReveal(g, k, x0, y0, w, h, draw, sparkle = true, t = 0) {
  if (k <= 0) return;
  g.save(); g.beginPath(); g.rect(x0, y0, w * k, h); g.clip(); draw(); g.restore();
  if (sparkle && k < 1) twinkle(g, x0 + w * k, y0 + h * .55 + Math.sin(k * 30) * h * .15, 26, t * 4, 1);
}

// ----------------------------------------------------------------------------
// ÉLÉMENTS DE NOËL
// ----------------------------------------------------------------------------
const PALS = [[C.pinkL, C.rose, C.plum], [C.lav, C.vio2, C.ind], [C.cream, C.pink, C.mag], [C.pinkL, C.lav2, C.aub]];
function bauble(g, x, y, r, pal) {
  g.save(); g.translate(x, y);
  g.fillStyle = C.lav; rr(g, -r * .25, -r - 12, r * .5, 16, 3); g.fill();
  g.strokeStyle = C.pinkL; g.lineWidth = 2.5; circle(g, 0, -r - 15, 6); g.stroke();
  const gr = g.createRadialGradient(-r * .35, -r * .4, r * .05, 0, 0, r);
  gr.addColorStop(0, pal[0]); gr.addColorStop(.55, pal[1]); gr.addColorStop(1, pal[2]);
  circle(g, 0, 0, r); g.fillStyle = gr; g.fill();
  g.save(); g.clip();
  g.strokeStyle = rgba(C.cream, .75); g.lineWidth = r * .07; g.lineJoin = "round";
  g.beginPath(); for (let i = 0; i <= 10; i++) g.lineTo(-r + i * r * .2, i % 2 ? -r * .12 : r * .12); g.stroke();
  g.lineWidth = r * .04; g.beginPath();
  g.moveTo(-r, -r * .32); g.lineTo(r, -r * .32); g.moveTo(-r, r * .32); g.lineTo(r, r * .32); g.stroke();
  g.restore();
  g.fillStyle = "rgba(255,240,250,.5)"; g.beginPath(); g.ellipse(-r * .38, -r * .45, r * .22, r * .11, -.7, 0, TAU); g.fill();
  g.restore();
}
function hangBauble(g, ax, ay, len, r, pal, ang) {
  g.save(); g.translate(ax, ay); g.rotate(ang);
  g.strokeStyle = rgba(C.pinkL, .6); g.lineWidth = 2;
  g.beginPath(); g.moveTo(0, 0); g.lineTo(0, len); g.stroke();
  bauble(g, 0, len + r + 15, r, pal);
  g.restore();
}
function bow(g, x, y, s, col, hi) {
  g.save(); g.translate(x, y); g.fillStyle = col;
  g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(-s * 1.3, -s * 1.0, -s * 1.5, s * .6, 0, 0); g.fill();
  g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(s * 1.3, -s * 1.0, s * 1.5, s * .6, 0, 0); g.fill();
  g.beginPath(); g.moveTo(-4, 2); g.lineTo(-s * .6, s * 1.3); g.lineTo(-s * .25, s * 1.1); g.lineTo(0, 4); g.fill();
  g.beginPath(); g.moveTo(4, 2); g.lineTo(s * .6, s * 1.3); g.lineTo(s * .25, s * 1.1); g.lineTo(0, 4); g.fill();
  g.fillStyle = hi; circle(g, 0, 0, s * .24); g.fill();
  g.restore();
}
function gift(g, x, baseY, w, h, col, rib, k) {
  if (k <= 0) return;
  g.save(); g.translate(x + w / 2, baseY); g.scale(k, k);
  g.fillStyle = col; g.fillRect(-w / 2, -h, w, h);
  g.fillStyle = "rgba(20,5,30,.25)"; g.fillRect(w * .12, -h, w * .38, h);
  g.fillStyle = col; g.fillRect(-w / 2 - 8, -h - 6, w + 16, 28);
  g.fillStyle = "rgba(255,230,250,.22)"; g.fillRect(-w / 2 - 8, -h - 6, w + 16, 6);
  g.fillStyle = "rgba(20,5,30,.25)"; g.fillRect(-w / 2 - 8, -h + 16, w + 16, 6);
  g.fillStyle = rib; g.fillRect(-w * .08, -h - 6, w * .16, h + 6);
  bow(g, 0, -h - 8, w * .22, rib, C.cream);
  g.restore();
}
function wreath(g, x, y, R) {
  const r = rng(11), cols = [C.ind, C.vio, "#3b2466", C.vio2];
  for (let i = 0; i < 80; i++) {
    const a = i / 80 * TAU + r() * .2, d = R + (r() - .5) * 24;
    g.save(); g.translate(x + Math.cos(a) * d, y + Math.sin(a) * d); g.rotate(a + r() * 1.2);
    g.fillStyle = cols[i % 4]; g.beginPath(); g.ellipse(0, 0, 22, 9, 0, 0, TAU); g.fill();
    g.restore();
  }
  for (let i = 0; i < 16; i++) {
    const a = r() * TAU, d = R + (r() - .5) * 20;
    g.fillStyle = i % 2 ? C.pinkL : C.cream; circle(g, x + Math.cos(a) * d, y + Math.sin(a) * d, 6); g.fill();
  }
  bow(g, x, y + R + 4, 30, C.rose, C.pinkL);
}

// ----------------------------------------------------------------------------
// LE CASSE-NOISETTE (inspiré de l'image : chapeau-couronne, grosses
// moustaches, joues roses, yeux ronds, épaulettes duveteuses)
// ----------------------------------------------------------------------------
function drawNutcracker(g, x, y, s, st = {}) {
  const blink = st.blink || 0, jaw = st.jaw || 0, look = st.look || 0;
  g.save(); g.translate(x, y); g.rotate(st.tilt || 0); g.scale(s, s);

  // Buste
  let gr = g.createLinearGradient(-260, 0, 260, 0);
  gr.addColorStop(0, C.plum); gr.addColorStop(.5, C.rose); gr.addColorStop(1, C.plum);
  rr(g, -250, 215, 500, 200, [90, 90, 30, 30]); g.fillStyle = gr; g.fill();
  g.strokeStyle = C.pinkL; g.lineWidth = 7;
  for (const yy of [280, 330, 380]) {
    g.beginPath(); g.moveTo(-58, yy); g.lineTo(58, yy); g.stroke();
    for (const sx of [-1, 1]) { g.fillStyle = C.cream; circle(g, sx * 66, yy, 10); g.fill(); }
  }
  // Épaulettes
  for (const sx of [-1, 1]) {
    g.fillStyle = C.pink; circle(g, sx * 205, 250, 64); g.fill();
    g.fillStyle = C.pinkL; circle(g, sx * 200, 238, 50); g.fill();
    g.fillStyle = C.cream;
    for (let i = 0; i < 9; i++) { circle(g, sx * 205 + (i - 4) * 14, 314 + (i % 2) * 5, 11); g.fill(); }
    g.fillStyle = "rgba(255,245,252,.7)"; circle(g, sx * 188, 222, 16); g.fill();
  }
  // Cou
  g.fillStyle = C.skinD; rr(g, -62, 140, 124, 90, 10); g.fill();
  g.strokeStyle = rgba(C.plum, .45); g.lineWidth = 4;
  for (const yy of [172, 198]) { g.beginPath(); g.moveTo(-62, yy); g.lineTo(62, yy); g.stroke(); }
  // Col duveteux
  const r = rng(21);
  for (let i = 0; i < 16; i++) {
    g.fillStyle = i % 2 ? C.cream : "#f7d3ee";
    circle(g, -118 + i * 15.7, 222 + r() * 10, 17 + r() * 6); g.fill();
  }
  // Cheveux (derrière le visage)
  g.fillStyle = C.aub; rr(g, -182, -120, 364, 262, [40, 40, 70, 70]); g.fill();
  g.fillStyle = "#24102f";
  for (const sx of [-1, 1]) for (let i = 0; i < 5; i++) { circle(g, sx * (158 + (i % 2) * 8), 30 + i * 22, 16); g.fill(); }

  // Visage (bois)
  gr = g.createLinearGradient(-140, 0, 140, 0);
  gr.addColorStop(0, C.skinD); gr.addColorStop(.45, C.skin); gr.addColorStop(1, C.skinD);
  rr(g, -140, -150, 280, 252, [30, 30, 10, 10]); g.fillStyle = gr; g.fill();
  g.strokeStyle = rgba(C.plum, .12); g.lineWidth = 2;
  for (let i = 0; i < 9; i++) { const xx = -120 + i * 30; g.beginPath(); g.moveTo(xx, -140); g.bezierCurveTo(xx + 6, -60, xx - 6, 20, xx + 3, 95); g.stroke(); }
  // Bouche + mâchoire articulée
  const o = jaw * 58;
  g.fillStyle = "#1a0620"; rr(g, -80, 90, 160, 14 + o, 6); g.fill();
  if (jaw > .05) { g.fillStyle = C.cream; g.fillRect(-64, 90, 128, 9); }
  rr(g, -114, 100 + o, 228, 64, [6, 6, 44, 44]); g.fillStyle = gr; g.fill();
  g.strokeStyle = rgba(C.plum, .5); g.lineWidth = 3;
  g.beginPath(); g.moveTo(-40, 146 + o); g.quadraticCurveTo(0, 156 + o, 40, 146 + o); g.stroke();
  // Joues
  for (const sx of [-1, 1]) {
    glow(g, sx * 94, 30, 46, GLOW.rose, .5);
    g.fillStyle = rgba(C.rose, .8); circle(g, sx * 94, 30, 30); g.fill();
  }
  // Sourcils
  g.fillStyle = C.aub;
  for (const sx of [-1, 1]) { g.save(); g.translate(sx * 62, -82 - (st.brow || 0) * 14); g.rotate(sx * -.14); rr(g, -46, -11, 92, 22, 11); g.fill(); g.restore(); }
  // Yeux
  for (const sx of [-1, 1]) {
    const ex = sx * 62, ey = -28;
    g.fillStyle = "#f6eeff"; g.beginPath(); g.ellipse(ex, ey, 41, 37, 0, 0, TAU); g.fill();
    g.strokeStyle = C.aub; g.lineWidth = 5; g.stroke();
    const ix = ex + look * 12;
    g.fillStyle = C.vio2; circle(g, ix, ey + 2, 21); g.fill();
    g.strokeStyle = C.vio; g.lineWidth = 3; g.stroke();
    g.fillStyle = C.bg; circle(g, ix, ey + 2, 10); g.fill();
    g.fillStyle = "#fff"; circle(g, ix + 7, ey - 6, 6); g.fill();
    if (blink > 0) {
      g.save(); g.beginPath(); g.ellipse(ex, ey, 43, 39, 0, 0, TAU); g.clip();
      g.fillStyle = C.skin; g.fillRect(ex - 46, ey - 40, 92, 80 * blink);
      g.strokeStyle = C.aub; g.lineWidth = 5; g.beginPath(); g.moveTo(ex - 46, ey - 40 + 80 * blink); g.lineTo(ex + 46, ey - 40 + 80 * blink); g.stroke();
      g.restore();
    }
  }
  // Nez
  g.fillStyle = C.rose; rr(g, -24, -48, 48, 92, 18); g.fill();
  g.fillStyle = "rgba(255,220,245,.4)"; rr(g, -13, -40, 10, 52, 5); g.fill();
  // Moustache
  g.fillStyle = C.aub;
  for (const sx of [-1, 1]) {
    g.save(); g.scale(sx, 1);
    g.beginPath(); g.moveTo(0, 46);
    g.bezierCurveTo(30, 26, 82, 24, 116, 42);
    g.bezierCurveTo(142, 54, 152, 28, 138, 12);
    g.bezierCurveTo(164, 22, 166, 72, 122, 80);
    g.bezierCurveTo(82, 88, 30, 88, 0, 74);
    g.closePath(); g.fill();
    g.strokeStyle = rgba(C.lav, .35); g.lineWidth = 3;
    g.beginPath(); g.moveTo(20, 54); g.bezierCurveTo(60, 42, 100, 46, 124, 58); g.stroke();
    g.restore();
  }
  // Chapeau
  gr = g.createLinearGradient(-155, 0, 155, 0);
  gr.addColorStop(0, C.plum); gr.addColorStop(.4, C.rose); gr.addColorStop(.55, C.pink); gr.addColorStop(1, C.plum);
  g.fillStyle = gr; rr(g, -155, -345, 310, 212, [6, 6, 0, 0]); g.fill();
  // couronne
  g.beginPath(); g.moveTo(-155, -330); g.lineTo(-155, -345);
  for (let i = 0; i < 5; i++) { g.lineTo(-155 + (i + .5) * 62, -410); g.lineTo(-155 + (i + 1) * 62, -345); }
  g.lineTo(155, -330); g.closePath();
  g.fillStyle = vGrad(g, -410, -330, C.cream, C.pinkL); g.fill();
  g.fillStyle = C.cream; for (let i = 0; i < 5; i++) { circle(g, -155 + (i + .5) * 62, -414, 9); g.fill(); }
  // bandeau
  g.fillStyle = C.pink; rr(g, -162, -192, 324, 58, 6); g.fill();
  g.strokeStyle = C.cream; g.lineWidth = 4; g.beginPath();
  for (let i = 0; i <= 16; i++) g.lineTo(-150 + i * 18.75, i % 2 ? -174 : -154); g.stroke();
  g.fillStyle = C.vio2; circle(g, 0, -163, 20); g.fill();
  g.strokeStyle = C.cream; g.lineWidth = 4; g.stroke();
  g.fillStyle = "#fff"; circle(g, -6, -170, 5); g.fill();
  g.fillStyle = "rgba(40,8,50,.3)"; g.fillRect(-140, -134, 280, 14);

  g.restore();
}
// Position de la bouche, dans le repère du casse-noisette
const MOUTH_Y = 98;

function hazelnut(g, x, y, s, rot) {
  if (s <= 0) return;
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(s, s);
  const gr = g.createRadialGradient(-10, -6, 4, 0, 6, 46);
  gr.addColorStop(0, "#e2a6cf"); gr.addColorStop(.6, "#a4568b"); gr.addColorStop(1, "#5e2651");
  g.fillStyle = gr; g.beginPath(); g.ellipse(0, 8, 38, 40, 0, 0, TAU); g.fill();
  g.fillStyle = "#3d1740"; g.beginPath(); g.ellipse(0, -24, 34, 16, 0, Math.PI, 0); g.lineTo(34, -20); g.lineTo(-34, -20); g.fill();
  g.fillStyle = "rgba(255,235,250,.45)"; g.beginPath(); g.ellipse(-14, 2, 8, 14, -.4, 0, TAU); g.fill();
  g.restore();
}

// ----------------------------------------------------------------------------
// SCÈNE 1 — la porte
// ----------------------------------------------------------------------------
function doorPath(g) {
  g.beginPath(); g.moveTo(700, 960); g.lineTo(700, 510); g.arc(960, 510, 260, Math.PI, 0); g.lineTo(1220, 960); g.closePath();
}
function panel(g, x, y, w, h) {
  g.fillStyle = "rgba(40,8,50,.35)"; g.fillRect(x, y, w, h);
  g.fillStyle = "rgba(255,190,235,.10)"; g.fillRect(x + 12, y + 12, w - 24, h - 24);
  g.lineWidth = 3;
  g.strokeStyle = "rgba(255,200,240,.28)"; g.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
  g.strokeStyle = "rgba(25,5,35,.55)"; g.strokeRect(x + 12, y + 12, w - 24, h - 24);
}
// Battant gauche (260x710) pré-rendu ; le droit en est le miroir
const LEAF = (() => {
  const c = canvas(260, 710), g = c.getContext("2d");
  g.translate(-700, -250); doorPath(g); g.clip();
  const gr = g.createLinearGradient(700, 0, 960, 0);
  gr.addColorStop(0, "#6a285f"); gr.addColorStop(1, "#8d3c80");
  g.fillStyle = gr; g.fillRect(700, 250, 260, 710);
  for (let i = 0; i < 5; i++) {
    const x = 700 + i * 52;
    g.fillStyle = i % 2 ? "rgba(255,200,240,.05)" : "rgba(30,5,40,.08)"; g.fillRect(x, 250, 52, 710);
    g.strokeStyle = "rgba(30,8,40,.5)"; g.lineWidth = 2; g.beginPath(); g.moveTo(x, 250); g.lineTo(x, 960); g.stroke();
  }
  const r = rng(7); g.strokeStyle = "rgba(40,10,50,.2)"; g.lineWidth = 1.2;
  for (let i = 0; i < 70; i++) {
    const x = 700 + r() * 260, y = 250 + r() * 710;
    g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + r() * 6 - 3, y + 60, x + r() * 6 - 3, y + 120, x + r() * 4 - 2, y + 180); g.stroke();
  }
  panel(g, 728, 560, 204, 165); panel(g, 728, 758, 204, 172);
  for (const y of [372, 870]) {
    g.fillStyle = "#200a2a"; rr(g, 700, y, 118, 18, 9); g.fill();
    g.fillStyle = C.lav; for (let k = 0; k < 3; k++) { circle(g, 720 + k * 34, y + 9, 3.5); g.fill(); }
  }
  // poignée
  const hg = g.createLinearGradient(928, 0, 946, 0); hg.addColorStop(0, C.lav); hg.addColorStop(.5, C.cream); hg.addColorStop(1, C.lav2);
  g.fillStyle = "#200a2a"; rr(g, 922, 600, 30, 130, 8); g.fill();
  g.fillStyle = hg; rr(g, 929, 612, 16, 106, 8); g.fill();
  wreath(g, 830, 430, 74);
  // bord du battant (ombre côté libre)
  g.fillStyle = "rgba(20,5,30,.35)"; g.fillRect(954, 250, 6, 710);
  return c;
})();
const LEAF_R = (() => { const c = canvas(260, 710), g = c.getContext("2d"); g.translate(260, 0); g.scale(-1, 1); g.drawImage(LEAF, 0, 0); return c; })();
function darkCopy(src) {
  const c = canvas(src.width, src.height), g = c.getContext("2d");
  g.drawImage(src, 0, 0); g.globalCompositeOperation = "source-atop"; g.fillStyle = "#12041a"; g.fillRect(0, 0, c.width, c.height);
  return c;
}
const LEAF_D = darkCopy(LEAF), LEAF_RD = darkCopy(LEAF_R);

// Dessine un battant pivotant vers l'intérieur, en perspective (tranches verticales)
function drawLeaf(g, img, dark, hingeX, dir, theta, flipped) {
  const f = 1100, cx = 960, cy = 600, N = 260, step = 2;
  const co = Math.cos(theta), si = Math.sin(theta);
  const proj = d => { const k = f / (f + d * si); return { x: cx + (hingeX + dir * d * co - cx) * k, k }; };
  for (let d = 0; d < N; d += step) {
    const a = proj(d), b = proj(d + step);
    const x0 = Math.min(a.x, b.x), w = Math.abs(b.x - a.x) + .7;
    const y0 = cy + (250 - cy) * a.k, h = 710 * a.k;
    const sx = flipped ? N - d - step : d;
    g.drawImage(img, sx, 0, step, 710, x0, y0, w, h);
    if (si > .01) { g.globalAlpha = .6 * si; g.drawImage(dark, sx, 0, step, 710, x0, y0, w, h); g.globalAlpha = 1; }
  }
}

const WALL = (() => {
  const c = canvas(W, H), g = c.getContext("2d");
  g.fillStyle = vGrad(g, 0, 960, "#1c0a27", "#3a1749"); g.fillRect(0, 0, W, 960);
  g.strokeStyle = rgba(C.lav, .13); g.lineWidth = 2;
  for (let y = 22; y < 960; y += 44) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  g.fillStyle = "#24102f"; for (const x of [470, 1420]) g.fillRect(x, 0, 30, 960);
  // fenêtres rondes
  for (const x of [270, 1650]) {
    const wg = g.createRadialGradient(x, 540, 10, x, 540, 110);
    wg.addColorStop(0, C.cream); wg.addColorStop(.6, C.pinkL); wg.addColorStop(1, C.pink);
    circle(g, x, 540, 100); g.fillStyle = wg; g.fill();
    g.lineWidth = 22; g.strokeStyle = C.mag; g.stroke();
    g.lineWidth = 9; g.strokeStyle = C.plum; g.beginPath(); g.moveTo(x - 100, 540); g.lineTo(x + 100, 540); g.moveTo(x, 440); g.lineTo(x, 640); g.stroke();
    g.fillStyle = C.cream; g.beginPath(); g.ellipse(x, 646, 120, 16, 0, Math.PI, 0); g.fill();
    // silhouettes de boules derrière la vitre
    for (let k = -1; k <= 1; k++) { g.fillStyle = rgba(C.mag, .45); circle(g, x + k * 50, 500 + Math.abs(k) * 25, 18); g.fill(); }
  }
  // cadre de porte + clefs de voûte
  g.lineCap = "butt";
  const fp = () => { g.beginPath(); g.moveTo(700, 964); g.lineTo(700, 510); g.arc(960, 510, 260, Math.PI, 0); g.lineTo(1220, 964); };
  fp(); g.lineWidth = 62; g.strokeStyle = "#200a2a"; g.stroke();
  fp(); g.lineWidth = 46; g.strokeStyle = C.mag; g.stroke();
  fp(); g.lineWidth = 3; g.strokeStyle = rgba(C.pinkL, .35); g.stroke();
  for (let i = 0; i <= 8; i++) {
    const a = Math.PI + i / 8 * Math.PI;
    g.save(); g.translate(960 + Math.cos(a) * 262, 510 + Math.sin(a) * 262); g.rotate(a + Math.PI / 2);
    g.fillStyle = i === 4 ? C.pink : C.plum; rr(g, -20, -30, 40, 52, 4); g.fill();
    g.strokeStyle = "#200a2a"; g.lineWidth = 3; g.stroke();
    g.restore();
  }
  // sol enneigé
  g.fillStyle = vGrad(g, 950, H, "#d9b8ee", "#8e6cc0");
  g.beginPath(); g.moveTo(0, 975);
  for (let x = 0; x <= W; x += 60) g.lineTo(x, 962 + Math.sin(x * .013) * 10 + Math.sin(x * .031) * 5);
  g.lineTo(W, H); g.lineTo(0, H); g.closePath(); g.fill();
  return c;
})();

function lantern(g, x, y, t, seed) {
  const fl = .6 + .12 * Math.sin(t * 13 + seed) + .06 * Math.sin(t * 29 + seed * 2);
  g.save(); g.globalCompositeOperation = "lighter"; glow(g, x, y, 190, GLOW.pinkL, fl * .55); g.restore();
  g.strokeStyle = "#200a2a"; g.lineWidth = 8;
  g.beginPath(); g.moveTo(x + (x < 960 ? -60 : 60), y - 80); g.lineTo(x, y - 80); g.lineTo(x, y - 58); g.stroke();
  g.fillStyle = "#200a2a"; g.beginPath(); g.moveTo(x - 40, y - 40); g.lineTo(x, y - 62); g.lineTo(x + 40, y - 40); g.fill();
  const lg = g.createRadialGradient(x, y, 4, x, y, 50); lg.addColorStop(0, C.cream); lg.addColorStop(1, C.pinkL);
  g.fillStyle = lg; g.globalAlpha = .75 + .25 * fl; g.fillRect(x - 30, y - 40, 60, 76); g.globalAlpha = 1;
  g.strokeStyle = "#200a2a"; g.lineWidth = 5; g.strokeRect(x - 30, y - 40, 60, 76);
  g.beginPath(); g.moveTo(x, y - 40); g.lineTo(x, y + 36); g.stroke();
  g.fillStyle = "#200a2a"; g.fillRect(x - 36, y + 36, 72, 12);
}

// Guirlande lumineuse autour de l'arche
function archLights(g, t, a) {
  g.strokeStyle = rgba(C.aub, .9); g.lineWidth = 3;
  g.beginPath();
  for (let i = 0; i <= 60; i++) { const an = Math.PI + i / 60 * Math.PI; g.lineTo(960 + Math.cos(an) * 322, 510 + Math.sin(an) * 322 + Math.sin(i / 60 * Math.PI * 14) * 5); }
  g.stroke();
  const cols = [GLOW.pinkL, GLOW.cream, GLOW.lav];
  g.save(); g.globalCompositeOperation = "lighter";
  for (let i = 0; i < 15; i++) {
    const an = Math.PI + (i + .5) / 15 * Math.PI, x = 960 + Math.cos(an) * 322, y = 510 + Math.sin(an) * 322 + 6;
    const k = .55 + .45 * Math.sin(t * 3 + i * 1.7);
    glow(g, x, y, 34, cols[i % 3], a * k);
    glow(g, x, y, 10, GLOW.cream, a);
  }
  g.restore();
}

function sign(g, t) {
  g.save(); g.translate(960, 0); g.rotate(Math.sin(t * 1.3) * .012);
  g.strokeStyle = "#200a2a"; g.lineWidth = 5;
  for (const sx of [-1, 1]) { g.beginPath(); g.moveTo(sx * 200, 0); g.lineTo(sx * 200, 78); g.stroke(); }
  g.fillStyle = C.mag; rr(g, -260, 72, 520, 86, 10); g.fill();
  g.strokeStyle = "#200a2a"; g.lineWidth = 6; g.stroke();
  g.strokeStyle = rgba(C.pinkL, .5); g.lineWidth = 2; rr(g, -250, 82, 500, 66, 6); g.stroke();
  setFont(g, "900 34px 'Cinzel Decorative'"); g.textAlign = "center"; g.textBaseline = "middle";
  g.fillStyle = C.cream; g.fillText("Le Casse-Noisette", 0, 117);
  g.fillStyle = C.cream; g.beginPath(); g.ellipse(0, 72, 250, 9, 0, Math.PI, 0); g.fill();
  g.restore();
}

// Particules lumineuses qui s'échappent de la porte
const SPARKS = (() => { const r = rng(5); return Array.from({ length: 90 }, () => ({ t0: 2.1 + r() * 2.6, a: r() * TAU, sp: .5 + r() * .8, s: 3 + r() * 9, c: r() < .5 ? "cream" : "pinkL" })); })();

function sceneDoor(g, t) {
  const open = E.inOut(P(t, 1.7, 3.7));
  let theta = 1.3 * open;
  if (t > 1.35 && t < 1.7) theta += .025 * Math.abs(Math.sin((t - 1.35) * 30)); // le loquet cède
  const o = Math.sin(theta) / Math.sin(1.3);
  const cam = (1 + .025 * t) * (1 + 10 * E.in(P(t, 2.9, 4.8)));

  g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
  g.save();
  g.translate(960, 600); g.scale(cam, cam); g.translate(-960, -600);
  g.drawImage(WALL, 0, 0);

  // intérieur lumineux
  g.save(); doorPath(g); g.clip();
  const ig = g.createRadialGradient(960, 640, 10, 960, 640, 520);
  ig.addColorStop(0, C.cream); ig.addColorStop(.35, C.pinkL); ig.addColorStop(.75, C.pink); ig.addColorStop(1, C.mag);
  g.fillStyle = ig; g.fillRect(700, 250, 520, 710);
  for (let i = 0; i < 5; i++) { // boules suspendues à l'intérieur
    const bx = 760 + i * 100, sw = Math.sin(t * 1.4 + i) * .08;
    hangBauble(g, bx, 250, 90 + (i % 3) * 60, 22, PALS[i % 4], sw);
  }
  // battants
  drawLeaf(g, LEAF, LEAF_D, 700, 1, theta, false);
  drawLeaf(g, LEAF_R, LEAF_RD, 1220, -1, theta, true);
  g.restore();

  // lumière qui filtre avant l'ouverture
  const crack = (1 - o) * (.55 + .25 * Math.sin(t * 5));
  g.save(); g.globalCompositeOperation = "lighter";
  if (crack > 0.01) {
    g.fillStyle = rgba(C.pinkL, crack); g.fillRect(957, 290, 6, 670);
    g.fillStyle = rgba(C.cream, crack * .8); g.fillRect(700, 954, 520, 8);
    glow(g, 960, 960, 180, GLOW.pinkL, crack * .6);
  }
  // flaque de lumière sur la neige
  if (o > 0) {
    const sp = g.createLinearGradient(0, 960, 0, H);
    sp.addColorStop(0, rgba(C.cream, .55 * o)); sp.addColorStop(1, rgba(C.pinkL, 0));
    g.fillStyle = sp; g.beginPath(); g.moveTo(700, 962); g.lineTo(1220, 962); g.lineTo(1220 + 420 * o, H + 40); g.lineTo(700 - 420 * o, H + 40); g.closePath(); g.fill();
    // rayons
    g.save(); g.translate(960, 640);
    for (let i = 0; i < 16; i++) {
      const a = i / 16 * TAU + t * .08 + Math.sin(t * .6 + i) * .03;
      g.save(); g.rotate(a);
      const rg = g.createLinearGradient(0, 0, 0, -1300);
      rg.addColorStop(0, rgba(C.cream, .13 * o)); rg.addColorStop(1, rgba(C.pinkL, 0));
      g.fillStyle = rg; g.beginPath(); g.moveTo(-8, 0); g.lineTo(-40 - (i % 3) * 20, -1300); g.lineTo(40 + (i % 3) * 20, -1300); g.lineTo(8, 0); g.fill();
      g.restore();
    }
    g.restore();
  }
  g.restore();

  archLights(g, t, 1);
  lantern(g, 610, 560, t, 1); lantern(g, 1310, 560, t, 4);
  sign(g, t);
  g.restore();

  // particules (espace écran)
  g.save(); g.globalCompositeOperation = "lighter";
  for (const s of SPARKS) {
    const age = t - s.t0; if (age < 0 || age > 1.4) continue;
    const d = age * age * 900 * s.sp;
    const x = 960 + Math.cos(s.a) * d * 1.3, y = 620 + Math.sin(s.a) * d * .8;
    glow(g, x, y, s.s * (1 + age * 3), GLOW[s.c], (1 - age / 1.4) * o);
  }
  g.restore();
  snow(g, t, 1 - P(t, 3.2, 4.2));
  // fondu d'entrée
  if (t < .8) { g.fillStyle = rgba(C.bg, 1 - E.out(t / .8)); g.fillRect(0, 0, W, H); }
}

// ----------------------------------------------------------------------------
// SCÈNE 2 — motion design : anneaux, flocons, boules
// ----------------------------------------------------------------------------
const RING_COLS = [C.pinkL, C.lav, C.pink, C.cream, C.rose];
const FLAKE_POS = Array.from({ length: 8 }, (_, i) => { const a = i / 8 * TAU + .2; return { x: Math.cos(a) * 560, y: Math.sin(a) * 350, R: 50 + (i % 3) * 18 }; });
const HANGS = [
  { x: 230, L: 170, r: 48 }, { x: 430, L: 320, r: 62 }, { x: 640, L: 210, r: 50 },
  { x: 1280, L: 250, r: 56 }, { x: 1490, L: 150, r: 46 }, { x: 1690, L: 330, r: 64 },
];

function sunburst(g, cx, cy, rot, a, n = 24) {
  g.save(); g.translate(cx, cy); g.rotate(rot); g.fillStyle = rgba(C.pinkL, a);
  for (let i = 0; i < n; i++) {
    g.beginPath(); g.moveTo(0, 0);
    g.arc(0, 0, 1600, i * TAU / n, (i + .5) * TAU / n); g.closePath(); g.fill();
  }
  g.restore();
}

function sceneBurst(g, u, t) {
  bgNight(g, C.vio2, C.plum, C.bg);
  sunburst(g, 960, 540, u * .12, .045 * P(u, 0, .6));
  bokeh(g, t, 1);
  const exit = E.in(P(u, 3.9, 4.7));

  // anneaux
  g.save(); g.translate(960, 540);
  for (let i = 0; i < 5; i++) {
    const k = E.out(P(u, .1 + i * .12, 1.3 + i * .12));
    if (k <= 0) continue;
    const R = (130 + i * 115) * k * (1 - exit);
    g.strokeStyle = RING_COLS[i]; g.globalAlpha = .9;
    g.lineWidth = lerp(34, i % 2 ? 3 : 5, k);
    if (i % 2) { g.setLineDash([4, 18]); g.lineDashOffset = -u * 40 * (i % 4 ? 1 : -1); g.lineWidth = 6; g.lineCap = "round"; }
    circle(g, 0, 0, Math.max(0, R)); g.stroke(); g.setLineDash([]);
  }
  g.globalAlpha = 1; g.restore();

  // flocons qui arrivent en tournoyant
  for (let i = 0; i < 8; i++) {
    const k = P(u, .6 + i * .08, 1.6 + i * .08); if (k <= 0) continue;
    const e = E.back(k), f = FLAKE_POS[i];
    const x = 960 + f.x * lerp(2.4, 1, e), y = 540 + f.y * lerp(2.4, 1, e) + Math.sin(u * 1.5 + i) * 10;
    const s = 1 - E.in(P(u, 3.8, 4.4));
    flake(g, x, y, f.R * s, (1 - e) * 4 + u * .3 * (i % 2 ? 1 : -1) + exit * 6, i % 2 ? C.cream : C.pinkL, 5, clamp(k * 3));
  }

  // boules suspendues
  const up = E.in(P(u, 3.7, 4.4)) * 800;
  HANGS.forEach((h, i) => {
    const s0 = 1.1 + i * .1, k = P(u, s0, s0 + 1.3); if (k <= 0) return;
    const drop = E.elastic(k);
    const age = u - s0;
    const ang = .22 * Math.sin(age * 3.2 + i) * Math.exp(-age * .7) + .04 * Math.sin(u * 1.3 + i);
    hangBauble(g, h.x, -40 - up, (h.L + 40) * drop, h.r, PALS[i % 4], ang);
  });

  // texte
  const ta = 1 - P(u, 3.8, 4.2);
  g.save(); g.globalAlpha = ta;
  setFont(g, "400 160px 'Great Vibes'"); g.textAlign = "center"; g.textBaseline = "alphabetic";
  const tw = g.measureText("Il était une fois…").width;
  writeReveal(g, E.inOut(P(u, 1.4, 2.8)), 960 - tw / 2 - 20, 380, tw + 60, 260, () => {
    g.shadowColor = C.pink; g.shadowBlur = 30;
    g.fillStyle = vGrad(g, 450, 580, C.cream, C.pinkL);
    g.fillText("Il était une fois…", 960, 575);
    g.shadowBlur = 0;
  }, true, u);
  const sa = E.out(P(u, 2.6, 3.3));
  g.globalAlpha = ta * sa;
  setFont(g, "italic 500 50px 'Cormorant Garamond'"); g.fillStyle = C.cream;
  g.fillText("…une boutique pas comme les autres", 960, 670 + (1 - sa) * 20);
  g.restore();

  twinkleField(g, u, .9);
  snow(g, u + 30, .6 * P(u, .3, 1.2), 120);

  // point lumineux central avant la scène suivante
  const cg = P(u, 4.2, 4.8);
  g.save(); g.globalCompositeOperation = "lighter"; glow(g, 960, 540, 60 + 500 * E.in(cg), GLOW.cream, cg); g.restore();
}

// ----------------------------------------------------------------------------
// SCÈNE 3 — le casse-noisette croque une noisette
// ----------------------------------------------------------------------------
const SHELLS = (() => { const r = rng(17); return Array.from({ length: 18 }, () => ({ a: -Math.PI * r(), sp: 300 + r() * 500, rot: (r() - .5) * 14, s: 8 + r() * 14, c: r() < .5 ? "#e2a6cf" : "#c98bb3" })); })();

function sceneNut(g, v, t) {
  bgNight(g, C.vio2, C.ind, C.bg);
  sunburst(g, 960, 440, -v * .08, .035);
  landscape(g, t);
  bokeh(g, t, .8);

  // tremblement au "crac"
  const sh = v > 3.55 && v < 3.9 ? Math.sin(v * 90) * 12 * (1 - P(v, 3.55, 3.9)) : 0;
  g.save(); g.translate(sh, sh * .5);

  // onde d'arrivée
  const w0 = P(v, 0, .8);
  if (w0 > 0 && w0 < 1) { g.strokeStyle = rgba(C.cream, 1 - w0); g.lineWidth = 20 * (1 - w0); circle(g, 960, 460, 900 * E.out(w0)); g.stroke(); }

  // halo derrière le personnage
  g.save(); g.globalCompositeOperation = "lighter";
  glow(g, 960, 420, 520, GLOW.pink, .45 * E.out(P(v, .1, 1)));
  g.restore();
  g.strokeStyle = rgba(C.pinkL, .35 * P(v, .4, 1)); g.lineWidth = 3; g.setLineDash([2, 14]); g.lineCap = "round";
  g.lineDashOffset = v * 30; circle(g, 960, 430, 380); g.stroke(); g.setLineDash([]);

  // le casse-noisette
  const pop = E.back(P(v, .1, 1.0));
  const blink = Math.max(1 - Math.abs(v - 2.3) / .09, 1 - Math.abs(v - 5.0) / .09, 0);
  let jaw = E.out(P(v, 2.8, 3.1));
  if (v > 3.45) jaw = 1 - E.in(P(v, 3.45, 3.55));
  if (v > 4.1) jaw = .25 * Math.max(0, Math.sin((v - 4.1) * 16)) * (1 - P(v, 4.1, 4.8)); // petit rire
  const look = v > 2.5 && v < 3.5 ? E.inOut(P(v, 2.5, 2.8)) * (1 - P(v, 3.3, 3.5)) : 0;
  const s = .68 * pop;
  if (s > 0) {
    drawNutcracker(g, 960, 440 + Math.sin(v * 1.6) * 6, s, {
      blink, jaw, look, tilt: Math.sin(v * 1.2) * .015 + (v > 3.55 && v < 4.2 ? .03 * Math.sin((v - 3.55) * 20) : 0),
      brow: v > 3.55 && v < 4.4 ? 1 - P(v, 4.0, 4.4) : 0,
    });
  }
  const mx = 960, my = 440 + MOUTH_Y * .68;

  // la noisette arrive de la droite
  const nk = P(v, 2.95, 3.45);
  if (nk > 0 && nk < 1) {
    const e = E.inOut(nk);
    const x = lerp(1560, mx, e), y = lerp(260, my, e) - Math.sin(e * Math.PI) * 180;
    hazelnut(g, x, y, lerp(1.1, .45, e), e * 8);
  }
  // éclats
  const ck = v - 3.55;
  if (ck > 0 && ck < 1.4) {
    for (const p of SHELLS) {
      const x = mx + Math.cos(p.a) * p.sp * ck, y = my + Math.sin(p.a) * p.sp * ck + 700 * ck * ck;
      g.save(); g.globalAlpha = 1 - ck / 1.4; g.translate(x, y); g.rotate(p.rot * ck);
      g.fillStyle = p.c; g.beginPath(); g.moveTo(-p.s, 0); g.lineTo(0, -p.s * .7); g.lineTo(p.s * .8, p.s * .5); g.closePath(); g.fill();
      g.restore();
    }
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * TAU, d = 60 + 380 * E.out(clamp(ck / .7));
      twinkle(g, mx + Math.cos(a) * d, my + Math.sin(a) * d * .7, 18, ck * 5 + i, 1 - clamp(ck / .9));
    }
    // "CRAC !"
    const ca = E.back(P(ck, 0, .3)), cf = 1 - P(ck, .8, 1.1);
    if (ca > 0 && cf > 0) {
      g.save(); g.globalAlpha = cf; g.translate(1300, 330); g.rotate(-.16); g.scale(ca, ca);
      setFont(g, "900 96px 'Cinzel Decorative'"); g.textAlign = "center"; g.textBaseline = "middle";
      g.lineJoin = "round"; g.lineWidth = 16; g.strokeStyle = C.aub; g.strokeText("CRAC !", 0, 0);
      g.fillStyle = vGrad(g, -40, 40, C.cream, C.pinkL); g.fillText("CRAC !", 0, 0);
      g.restore();
    }
  }
  g.restore();

  // titre lettre par lettre
  const title = "Le Casse-Noisette";
  setFont(g, "900 116px 'Cinzel Decorative'"); g.textAlign = "left"; g.textBaseline = "alphabetic";
  const total = g.measureText(title).width, x0 = 960 - total / 2, by = 880;
  const grad = vGrad(g, by - 90, by + 10, C.cream, C.pinkL);
  for (let i = 0; i < title.length; i++) {
    const ch = title[i]; if (ch === " ") continue;
    const st = 1.1 + i * .05, k = P(v, st, st + .7); if (k <= 0) continue;
    const e = E.back(k), px = x0 + g.measureText(title.slice(0, i)).width, cw = g.measureText(ch).width;
    g.save(); g.globalAlpha = clamp(k * 4);
    g.translate(px + cw / 2, by + lerp(-130, 0, e)); g.rotate((1 - E.out(k)) * .7 * (i % 2 ? 1 : -1));
    g.lineJoin = "round"; g.lineWidth = 14; g.strokeStyle = C.aub; g.strokeText(ch, -cw / 2, 0);
    g.shadowColor = C.pink; g.shadowBlur = 24; g.fillStyle = grad; g.translate(-cw / 2, 0); g.fillText(ch, 0, 0);
    g.restore();
  }
  // "ESCAPE GAME" + filets
  const ea = E.out(P(v, 2.1, 2.8));
  if (ea > 0) {
    g.save(); g.globalAlpha = ea;
    setFont(g, "600 42px 'Cormorant Garamond'"); g.letterSpacing = `${lerp(40, 18, ea)}px`;
    g.textAlign = "center"; g.fillStyle = C.pinkL; g.fillText("ESCAPE GAME", 969, 965);
    g.strokeStyle = C.pinkL; g.lineWidth = 2;
    const L = 260 * ea;
    g.beginPath(); g.moveTo(690, 950); g.lineTo(690 - L, 950); g.moveTo(1230, 950); g.lineTo(1230 + L, 950); g.stroke();
    starPath(g, 690 - L - 14, 950, 10, 3, 4, 0); g.fillStyle = C.cream; g.fill();
    starPath(g, 1230 + L + 14, 950, 10, 3, 4, 0); g.fill();
    g.restore();
  }
  twinkleField(g, t, .8);
  snow(g, t, .9);
}

// ----------------------------------------------------------------------------
// SCÈNE 4 — la boutique de Noël de Madame Mirabelle
// ----------------------------------------------------------------------------
const WALLPAPER = (() => {
  const c = canvas(W + 120, H + 120), g = c.getContext("2d");
  g.fillStyle = rgba(C.pinkL, .06);
  for (let y = 0; y < H + 120; y += 60) for (let x = (y / 60 % 2) * 30; x < W + 120; x += 60) {
    g.beginPath(); g.moveTo(x, y - 7); g.lineTo(x + 7, y); g.lineTo(x, y + 7); g.lineTo(x - 7, y); g.fill();
  }
  return c;
})();
const TREE = { cx: 1430, tiers: [[910, 580, 260], [770, 470, 240], [630, 360, 220], [490, 250, 210]] };
const GIFTS = [
  { x: 1120, w: 130, h: 110, c: C.rose, r: C.cream }, { x: 1262, w: 92, h: 78, c: C.vio2, r: C.pinkL },
  { x: 1560, w: 150, h: 130, c: C.pinkL, r: C.mag }, { x: 1722, w: 104, h: 88, c: C.lav, r: C.cream },
];

function tier(g, cx, baseY, w, h, k) {
  if (k <= 0) return;
  g.save(); g.translate(cx, baseY); g.scale(k, k);
  const edge = () => {
    g.beginPath(); g.moveTo(0, -h); g.quadraticCurveTo(-w * .16, -h * .45, -w / 2, 0);
    const n = 6; for (let i = 0; i < n; i++) { const a = -w / 2 + i * w / n, b = a + w / n; g.quadraticCurveTo((a + b) / 2, 30, b, 0); }
    g.quadraticCurveTo(w * .16, -h * .45, 0, -h); g.closePath();
  };
  edge(); g.fillStyle = vGrad(g, -h, 20, C.vio2, C.ind); g.fill();
  g.save(); g.clip(); g.fillStyle = "rgba(20,5,35,.3)"; g.fillRect(0, -h, w, h + 40); g.restore();
  g.strokeStyle = rgba(C.pinkL, .45); g.lineWidth = 4;
  g.beginPath(); g.moveTo(0, -h); g.quadraticCurveTo(-w * .16, -h * .45, -w / 2, 0); g.stroke();
  g.restore();
}
function garlandPoint(i, k) { // point k (0..1) de la guirlande du palier i
  const [by, w, h] = TREE.tiers[i], cx = TREE.cx;
  const x0 = cx - w * .36, y0 = by - h * .45, x1 = cx + w * .42, y1 = by - h * .1, qx = cx, qy = by - h * .02;
  const m = 1 - k;
  return [m * m * x0 + 2 * m * k * qx + k * k * x1, m * m * y0 + 2 * m * k * qy + k * k * y1];
}

function sceneShop(g, w, t) {
  bgNight(g, C.plum, C.aub, C.bg);
  g.drawImage(WALLPAPER, -((w * 12) % 60), -((w * 8) % 60));
  bokeh(g, t, 1);
  // sol
  g.fillStyle = vGrad(g, 940, H, rgba(C.aub, .0), rgba(C.bg, .9)); g.fillRect(0, 940, W, H - 940);
  g.strokeStyle = rgba(C.pinkL, .25); g.lineWidth = 2; g.beginPath(); g.moveTo(0, 960); g.lineTo(W, 960); g.stroke();

  // sapin
  const cx = TREE.cx;
  g.save(); g.globalCompositeOperation = "lighter"; glow(g, cx, 620, 560, GLOW.pink, .35 * P(w, .3, 1.5)); g.restore();
  g.fillStyle = "#24102f"; g.fillRect(cx - 30, 890, 60, 70);
  g.fillStyle = "rgba(10,2,16,.5)"; g.beginPath(); g.ellipse(cx, 962, 320, 20, 0, 0, TAU); g.fill();
  TREE.tiers.forEach((tr, i) => tier(g, cx, tr[0], tr[1], tr[2], E.back(P(w, .3 + i * .18, .9 + i * .18))));
  // guirlandes
  const cols = [GLOW.pinkL, GLOW.cream, GLOW.lav];
  TREE.tiers.forEach((tr, i) => {
    const gk = E.inOut(P(w, 1.3 + i * .15, 1.9 + i * .15)); if (gk <= 0) return;
    g.strokeStyle = rgba(C.pinkL, .55); g.lineWidth = 2.5; g.beginPath();
    for (let j = 0; j <= 30 * gk; j++) g.lineTo(...garlandPoint(i, j / 30)); g.stroke();
    g.save(); g.globalCompositeOperation = "lighter";
    const n = 7;
    for (let j = 0; j < n; j++) {
      const kk = (j + .5) / n; if (kk > gk) break;
      const [x, y] = garlandPoint(i, kk), f = .55 + .45 * Math.sin(t * 4 + j * 1.9 + i);
      glow(g, x, y, 30, cols[(i + j) % 3], f); glow(g, x, y, 8, GLOW.cream, 1);
    }
    g.restore();
  });
  // boules du sapin
  [[1330, 820, 26, 0], [1560, 850, 24, 2], [1400, 700, 22, 1], [1500, 560, 20, 3], [1370, 450, 18, 2], [1470, 380, 16, 0]].forEach(([x, y, r, p], i) => {
    const k = E.back(P(w, 1.7 + i * .1, 2.1 + i * .1)); if (k > 0) bauble(g, x, y, r * k, PALS[p]);
  });
  // étoile
  const sk = E.back(P(w, 2.3, 2.9));
  if (sk > 0) {
    g.save(); g.globalCompositeOperation = "lighter";
    glow(g, cx, 262, 200 * sk, GLOW.pinkL, .8); glow(g, cx, 262, 90 * sk, GLOW.cream, .9);
    g.restore();
    g.save(); g.translate(cx, 262); g.rotate(t * .25);
    g.fillStyle = rgba(C.cream, .15 * sk);
    for (let i = 0; i < 12; i++) { g.rotate(TAU / 12); g.beginPath(); g.moveTo(-6, 0); g.lineTo(0, -220 * sk); g.lineTo(6, 0); g.fill(); }
    g.restore();
    g.save(); g.translate(cx, 262); g.rotate((1 - sk) * 4);
    starPath(g, 0, 0, 56 * sk, 24 * sk, 5, 0); g.fillStyle = vGrad(g, -56, 56, C.cream, C.pinkL); g.fill();
    g.strokeStyle = C.rose; g.lineWidth = 4; g.stroke();
    g.restore();
  }
  // cadeaux
  GIFTS.forEach((b, i) => gift(g, b.x, 960, b.w, b.h, b.c, b.r, E.back(P(w, 2.6 + i * .12, 3.1 + i * .12))));

  // textes
  const X = 150;
  g.textAlign = "left"; g.textBaseline = "alphabetic";
  let a = E.out(P(w, .5, 1.1));
  g.save(); g.globalAlpha = a; setFont(g, "italic 500 62px 'Cormorant Garamond'"); g.fillStyle = C.pinkL;
  g.fillText("Bienvenue à la", X, 330 + (1 - a) * 30); g.restore();
  // lignes révélées par un masque qui monte
  [["Boutique", 470, .8], ["de Noël", 600, 1.0]].forEach(([s, y, st]) => {
    const k = E.out(P(w, st, st + .7)); if (k <= 0) return;
    g.save(); g.beginPath(); g.rect(0, y - 125, 1150, 150); g.clip();
    setFont(g, "900 124px 'Cinzel Decorative'");
    g.translate(0, (1 - k) * 140);
    g.lineJoin = "round"; g.lineWidth = 12; g.strokeStyle = C.aub; g.strokeText(s, X, y);
    g.shadowColor = C.pink; g.shadowBlur = 20; g.fillStyle = vGrad(g, y - 100, y, C.cream, C.pinkL); g.fillText(s, X, y);
    g.restore();
  });
  // filet orné
  const fk = E.inOut(P(w, 1.5, 2.2));
  if (fk > 0) {
    g.strokeStyle = C.pinkL; g.lineWidth = 2.5; g.beginPath(); g.moveTo(X, 650); g.lineTo(X + 520 * fk, 650); g.stroke();
    twinkle(g, X + 520 * fk + 16, 650, 14, t, 1);
  }
  a = E.out(P(w, 1.8, 2.4));
  g.save(); g.globalAlpha = a; setFont(g, "italic 500 52px 'Cormorant Garamond'"); g.fillStyle = C.cream;
  g.fillText("tenue par", X, 740 + (1 - a) * 20); g.restore();
  setFont(g, "400 142px 'Great Vibes'");
  const mw = g.measureText("Madame Mirabelle").width;
  writeReveal(g, E.inOut(P(w, 2.1, 3.5)), X - 20, 760, mw + 70, 200, () => {
    g.shadowColor = C.rose; g.shadowBlur = 30;
    g.fillStyle = vGrad(g, 800, 900, C.pinkL, C.pink); g.fillText("Madame Mirabelle", X, 890);
  }, true, t);

  twinkleField(g, t + 3, .8, 0, 0, W, 700);
  snow(g, t, .5, 110);
}

// ----------------------------------------------------------------------------
// SCÈNE 5 — final : emblème et "Grande Ouverture"
// ----------------------------------------------------------------------------
function banner(g, cx, cy, w, h, k, text, ta) {
  if (k <= 0) return;
  const hw = w / 2 * E.out(k), tk = E.out(P(k, .6, 1));
  if (tk > 0) for (const sx of [-1, 1]) {
    const ex = cx + sx * hw;
    g.fillStyle = C.plum;
    g.beginPath(); g.moveTo(ex - sx * 20, cy - h / 2 + 24); g.lineTo(ex + sx * 110 * tk, cy - h / 2 + 24);
    g.lineTo(ex + sx * 70 * tk, cy + 24); g.lineTo(ex + sx * 110 * tk, cy + h / 2 + 24); g.lineTo(ex - sx * 20, cy + h / 2 + 24); g.fill();
    g.fillStyle = "#200a2a"; g.beginPath(); g.moveTo(ex, cy + h / 2); g.lineTo(ex - sx * 20, cy + h / 2 + 24); g.lineTo(ex, cy + h / 2 - 2); g.fill();
  }
  g.fillStyle = vGrad(g, cy - h / 2, cy + h / 2, C.rose, C.mag); g.fillRect(cx - hw, cy - h / 2, hw * 2, h);
  g.strokeStyle = rgba(C.cream, .6); g.lineWidth = 2;
  g.strokeRect(cx - hw + 10, cy - h / 2 + 9, Math.max(0, hw * 2 - 20), h - 18);
  if (ta > 0) {
    g.save(); g.beginPath(); g.rect(cx - hw, cy - h / 2, hw * 2, h); g.clip(); g.globalAlpha = ta;
    setFont(g, "900 70px 'Cinzel Decorative'"); g.textAlign = "center"; g.textBaseline = "middle";
    g.fillStyle = "rgba(20,5,30,.4)"; g.fillText(text, cx + 3, cy + 7);
    g.fillStyle = vGrad(g, cy - 35, cy + 35, C.cream, C.pinkL); g.fillText(text, cx, cy + 4);
    g.restore();
  }
}

function sceneFinal(g, z, t) {
  bgNight(g, C.vio2, C.ind, C.bg);
  sunburst(g, 960, 430, z * .06, .04, 32);
  landscape(g, t);
  bokeh(g, t, 1);
  const cx = 960, cy = 430;

  // boules suspendues dans les coins
  [[150, 140, 50], [300, 260, 40], [440, 120, 34], [1480, 120, 34], [1620, 260, 40], [1770, 140, 50]].forEach(([x, L, r], i) => {
    const s0 = .3 + (i % 3) * .12, k = P(z, s0, s0 + 1.3); if (k <= 0) return;
    const age = z - s0;
    hangBauble(g, x, -40, (L + 40) * E.elastic(k), r, PALS[(i + 1) % 4], .2 * Math.sin(age * 3 + i) * Math.exp(-age * .8) + .03 * Math.sin(t * 1.2 + i));
  });

  // disque
  const dk = E.out(P(z, .3, 1.1));
  g.save(); g.globalCompositeOperation = "lighter"; glow(g, cx, cy, 520, GLOW.pink, .5 * dk); g.restore();
  if (dk > 0) {
    const dg = g.createRadialGradient(cx, cy - 60, 20, cx, cy, 260);
    dg.addColorStop(0, C.lav2); dg.addColorStop(1, C.aub);
    circle(g, cx, cy, 258 * dk); g.fillStyle = dg; g.fill();
  }
  // casse-noisette dans le médaillon
  const nk = E.back(P(z, .8, 1.6));
  if (nk > 0) {
    g.save(); circle(g, cx, cy, 256 * dk); g.clip();
    const blink = Math.max(0, 1 - Math.abs(z - 4.2) / .09);
    drawNutcracker(g, cx, cy + 40 + (1 - nk) * 300, .47, { blink, jaw: .2 * Math.max(0, Math.sin((z - 3.6) * 14)) * (z > 3.6 && z < 4.0 ? 1 : 0) });
    g.restore();
  }
  // anneaux
  const rk = E.inOut(P(z, .4, 1.4));
  g.strokeStyle = C.pinkL; g.lineWidth = 6; g.lineCap = "round";
  g.beginPath(); g.arc(cx, cy, 266, -Math.PI / 2, -Math.PI / 2 + TAU * rk); g.stroke();
  g.strokeStyle = C.lav; g.lineWidth = 2;
  g.beginPath(); g.arc(cx, cy, 282, Math.PI / 2, Math.PI / 2 - TAU * rk, true); g.stroke();
  const da = P(z, .8, 1.4);
  if (da > 0) {
    for (let i = 0; i < 80; i++) {
      const a = i / 80 * TAU + z * .15;
      g.fillStyle = i % 2 ? rgba(C.pinkL, da) : rgba(C.lav, da);
      circle(g, cx + Math.cos(a) * 304, cy + Math.sin(a) * 304, 3.5); g.fill();
    }
  }
  for (let i = 0; i < 12; i++) {
    const k = E.back(P(z, 1.0 + i * .06, 1.4 + i * .06)); if (k <= 0) continue;
    const a = i / 12 * TAU - Math.PI / 2 + Math.sin(z * .5) * .05;
    const x = cx + Math.cos(a) * 340, y = cy + Math.sin(a) * 340;
    starPath(g, x, y, 14 * k, 5 * k, 4, z * .6 + i); g.fillStyle = i % 3 ? C.pinkL : C.cream; g.fill();
  }

  // bannière
  banner(g, cx, 668, 820, 116, P(z, 1.6, 2.4), "Le Casse-Noisette", E.out(P(z, 2.0, 2.6)));
  // ESCAPE GAME
  const ea = E.out(P(z, 2.5, 3.1));
  if (ea > 0) {
    g.save(); g.globalAlpha = ea;
    setFont(g, "600 46px 'Cormorant Garamond'"); g.letterSpacing = `${lerp(44, 20, ea)}px`;
    g.textAlign = "center"; g.textBaseline = "alphabetic"; g.fillStyle = C.cream;
    g.fillText("ESCAPE GAME", cx + 10, 810);
    g.restore();
  }
  // Grande Ouverture
  setFont(g, "400 136px 'Great Vibes'"); g.textAlign = "center"; g.textBaseline = "alphabetic";
  const gw = g.measureText("Grande Ouverture").width;
  writeReveal(g, E.inOut(P(z, 3.0, 4.3)), cx - gw / 2 - 30, 830, gw + 80, 190, () => {
    g.shadowColor = C.rose; g.shadowBlur = 36;
    g.fillStyle = vGrad(g, 870, 970, C.cream, C.pinkL); g.fillText("Grande Ouverture", cx, 960);
  }, true, t);

  // gerbes d'étincelles
  [[4.4, 520, 300], [4.7, 1400, 280], [5.0, 380, 620], [5.2, 1540, 640]].forEach(([s0, x, y], j) => {
    const k = z - s0; if (k < 0 || k > 1.2) return;
    g.save(); g.globalCompositeOperation = "lighter";
    for (let i = 0; i < 16; i++) {
      const a = i / 16 * TAU + j, d = 170 * E.out(clamp(k / .9));
      glow(g, x + Math.cos(a) * d, y + Math.sin(a) * d + 60 * k * k, 12, i % 2 ? GLOW.pinkL : GLOW.cream, 1 - k / 1.2);
    }
    g.restore();
  });
  twinkleField(g, t, 1);
  snow(g, t, 1);
}

// ----------------------------------------------------------------------------
// COMPOSITION
// ----------------------------------------------------------------------------
function flashOverlay(g, a, col = C.cream) { if (a > 0) { g.fillStyle = rgba(col, clamp(a)); g.fillRect(0, 0, W, H); } }

function stripeWipe(g, k) {
  if (k <= 0 || k >= 1) return;
  const kin = P(k, 0, .5), kout = P(k, .5, 1), bw = 150, n = 20, cols = [C.rose, C.cream, C.lav, C.cream];
  g.save(); g.translate(W / 2, H / 2); g.rotate(-.5);
  for (let i = 0; i < n; i++) {
    const d = i / n * .5;
    const a = E.inOut(P(kin, d, d + .5)), b = E.inOut(P(kout, d, d + .5));
    const y0 = -1300 + b * 2600, y1 = -1300 + a * 2600;
    if (y1 <= y0) continue;
    g.fillStyle = cols[i % 4]; g.fillRect(-1500 + i * bw, y0, bw + 1, y1 - y0);
  }
  g.restore();
}

function renderFrame(t, frame = Math.round(t * FPS)) {
  const g = ctx;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1; g.globalCompositeOperation = "source-over"; g.shadowBlur = 0;

  if (t < 4.8) sceneDoor(g, t);
  else if (t < 9.6) sceneBurst(g, t - 4.8, t);
  else if (t < 15.6) sceneNut(g, t - 9.6, t);
  else if (t < 21.8) sceneShop(g, t - 15.6, t);

  // ouverture en cercle vers le final
  if (t >= 20.8) {
    const k = E.inOut(P(t, 20.8, 21.8)), R = k * 1150;
    g.save(); circle(g, 960, 540, R); g.clip(); sceneFinal(g, t - 20.8, t); g.restore();
    if (k > 0 && k < 1) { g.strokeStyle = C.pinkL; g.lineWidth = 10; circle(g, 960, 540, R); g.stroke(); }
  }

  // transitions
  flashOverlay(g, t < 4.8 ? E.in(P(t, 3.9, 4.8)) : 1 - E.out(P(t, 4.8, 5.8)));
  const f2 = 1 - Math.abs(t - 9.6) / .35;
  if (f2 > 0) { g.save(); g.globalCompositeOperation = "lighter"; glow(g, 960, 540, 1400, GLOW.cream, f2); g.restore(); flashOverlay(g, f2 * .6); }
  stripeWipe(g, P(t, 15.1, 16.1));

  finish(g, t, frame);
  // fondu de fin
  const fo = E.inOut(P(t, 25.9, 27));
  if (fo > 0) { g.fillStyle = rgba("#0d0512", fo); g.fillRect(0, 0, W, H); }
}

// ----------------------------------------------------------------------------
// LECTURE / EXPORT
// ----------------------------------------------------------------------------
window.FPS = FPS; window.DUR = DUR; window.renderFrame = renderFrame;
window.frameJPEG = i => { renderFrame(i / FPS, i); return cv.toDataURL("image/jpeg", .95).split(",")[1]; };
window.ready = Promise.all([
  "900 40px 'Cinzel Decorative'", "400 40px 'Great Vibes'",
  "500 40px 'Cormorant Garamond'", "italic 500 40px 'Cormorant Garamond'", "600 40px 'Cormorant Garamond'",
].map(f => document.fonts.load(f))).then(() => document.fonts.ready);

if (!location.search.includes("capture")) {
  window.ready.then(() => {
    let start = performance.now();
    cv.addEventListener("click", () => { start = performance.now(); });
    const loop = now => {
      const t = ((now - start) / 1000) % DUR;
      renderFrame(t);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
}
