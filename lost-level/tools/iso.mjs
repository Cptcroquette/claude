// Générateur des dessins isométriques (traits techniques) intégrés dans index.html.
// Usage : node tools/iso.mjs <scene>   → imprime le fragment SVG sur la sortie standard.
// Projection isométrique : X = (x - y)·cos30·s, Y = (x + y)·sin30·s − z·s.

const C = Math.cos(Math.PI / 6), S = 0.5;

const bounds = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
function makeProj(s, ox = 0, oy = 0) {
  return ([x, y, z]) => {
    const X = +(ox + (x - y) * C * s).toFixed(1), Y = +(oy + (x + y) * S * s - z * s).toFixed(1);
    bounds.x0 = Math.min(bounds.x0, X); bounds.x1 = Math.max(bounds.x1, X);
    bounds.y0 = Math.min(bounds.y0, Y); bounds.y1 = Math.max(bounds.y1, Y);
    return [X, Y];
  };
}
const pts = (P, list) => list.map(p => P(p).join(',')).join(' ');

// Boîte : faces visibles depuis +x / +y / +z, dessinées en traits sur fond ivoire.
function box(P, [x0, y0, z0], [w, d, h], o = {}) {
  const x1 = x0 + w, y1 = y0 + d, z1 = z0 + h;
  const top = [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
  const right = [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]];
  const front = [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]];
  const cls = o.cls ? ` class="${o.cls}"` : '';
  return `<g${cls}>` +
    `<polygon class="f-top" points="${pts(P, top)}"/>` +
    `<polygon class="f-${o.right || 'side'}" points="${pts(P, right)}"/>` +
    `<polygon class="f-${o.front || 'front'}" points="${pts(P, front)}"/>` +
    `</g>`;
}

// Porte dessinée sur la face y = const (face avant).
function doorFront(P, y, x0, z0, w, h, cls = 'door') {
  return `<polygon class="${cls}" points="${pts(P, [[x0, y, z0], [x0 + w, y, z0], [x0 + w, y, z0 + h], [x0, y, z0 + h]])}"/>`;
}
// Porte dessinée sur la face x = const (face droite).
function doorRight(P, x, y0, z0, w, h, cls = 'door') {
  return `<polygon class="${cls}" points="${pts(P, [[x, y0, z0], [x, y0 + w, z0], [x, y0 + w, z0 + h], [x, y0, z0 + h]])}"/>`;
}
const line = (P, a, b, cls = 'c') => { const [x1, y1] = P(a), [x2, y2] = P(b); return `<line class="${cls}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`; };

const scenes = {
  // Accueil : plateforme, escalier montant vers une porte, escalier fantôme qui descend sous le sol.
  hero() {
    const P = makeProj(34);
    let s = '';
    // tour arrière, avec un cadre de porte ouvert sur le vide au sommet
    s += box(P, [-2, -2, 0], [3, 3, 7]);
    s += doorRight(P, 1, -1.3, 0, 1.4, 2.4, 'door door--dark');
    s += box(P, [-1.6, -0.6, 7], [2.2, 0.3, 3], { cls: 'frame' });
    s += doorFront(P, -0.3, -1.2, 7, 1.4, 2.6, 'door door--void');
    // plateforme principale
    s += box(P, [0, 0, 0], [5, 5, 3.2]);
    s += doorFront(P, 5, 0.6, 0, 1.3, 2.3, 'door door--dark');
    // porte debout sur la plateforme : cadre + vantail orange
    s += box(P, [1.2, 1.4, 3.2], [2.2, 0.35, 3.4], { cls: 'frame' });
    s += doorFront(P, 1.75, 1.6, 3.2, 1.4, 2.8, 'door door--rust js-hero-door');
    // escalier descendant le long de +x jusqu'au niveau 0…
    const n = 6, step = 0.9, rise = 3.2 / n;
    for (let i = 0; i < n - 1; i++) s += box(P, [5 + i * step, 1, 0], [step, 2.6, 3.2 - (i + 1) * rise]);
    // …puis qui continue sous le sol (vue en coupe, pointillés)
    for (let i = 0; i < 5; i++) {
      const x = 5 + (n - 1 + i) * step, z = -i * rise;
      s += line(P, [x, 1, z], [x + step, 1, z], 'c dash');
      s += line(P, [x, 3.6, z], [x + step, 3.6, z], 'c dash');
      s += line(P, [x + step, 1, z], [x + step, 1, z - rise], 'c dash');
      s += line(P, [x + step, 3.6, z], [x + step, 3.6, z - rise], 'c dash');
      s += line(P, [x + step, 1, z - rise], [x + step, 3.6, z - rise], 'c dash');
    }
    // ligne de sol : niveau 0
    s += line(P, [-3, 6.5, 0], [13, 6.5, 0], 'c ground');
    return s;
  },
  // Salle 01 : valise isométrique portant une petite maison et une porte.
  valise() {
    const P = makeProj(26);
    let s = '';
    s += box(P, [0, 0, 0], [8, 5, 1.6]);
    // poignée
    const a = P([3, 5, 0.9]), b = P([3, 5.9, 0.9]), c = P([5, 5.9, 0.9]), d = P([5, 5, 0.9]);
    s += `<polyline class="c thick" points="${[a, b, c, d].map(p => p.join(',')).join(' ')}"/>`;
    // coins métalliques
    s += doorFront(P, 5, 0, 0, 0.5, 1.6, 'door door--rust');
    s += doorFront(P, 5, 7.5, 0, 0.5, 1.6, 'door door--rust');
    // fermoirs
    s += doorFront(P, 5, 1.5, 0.9, 0.4, 0.5, 'door door--rust');
    s += doorFront(P, 5, 6.1, 0.9, 0.4, 0.5, 'door door--rust');
    // construction sur la valise
    s += box(P, [2.2, 1.2, 1.6], [2.6, 2.4, 3.6]);
    s += doorFront(P, 3.6, 2.9, 1.6, 1.2, 2.3, 'door door--rust js-room-door');
    s += box(P, [4.8, 1.2, 1.6], [1.4, 1.4, 2.2]);
    // marches
    for (let i = 0; i < 3; i++) s += box(P, [2.9, 3.6 + i * 0.4, 1.6], [1.2, 0.4, 0.42 * (3 - i) * 0.5]);
    return s;
  },
  // Signature : porte en vue éclatée (cadre / vantail / poignée / serrure), décalée selon +y.
  door() {
    const P = makeProj(30);
    const part = (n, inner) => `<g class="xp" style="--n:${n}">${inner}</g>`;
    let s = '';
    s += part(0, box(P, [0, 0, 0], [0.5, 0.5, 7.5]) + box(P, [3.5, 0, 0], [0.5, 0.5, 7.5]) + box(P, [0, 0, 7.5], [4, 0.5, 0.5]));
    s += part(1, box(P, [0.6, 1, 0.1], [2.8, 0.3, 7.3], { front: 'rust', right: 'rust-dark', cls: 'leaf' }));
    s += part(2, box(P, [2.8, 2.2, 3.4], [0.25, 0.6, 0.25]) + box(P, [2.55, 2.8, 3.4], [0.8, 0.22, 0.22]));
    s += part(3, box(P, [2.7, 3.8, 2.4], [0.45, 0.2, 0.7]) + `<circle class="c" cx="${P([2.92, 4, 2.9])[0]}" cy="${P([2.92, 4, 2.9])[1]}" r="2.5"/>`);
    return s;
  },
};

const name = process.argv[2];
if (!scenes[name]) { console.error('scènes : ' + Object.keys(scenes).join(', ')); process.exit(1); }
const body = scenes[name](), pad = 4;
const vb = [bounds.x0 - pad, bounds.y0 - pad, bounds.x1 - bounds.x0 + 2 * pad, bounds.y1 - bounds.y0 + 2 * pad].map(v => +v.toFixed(1));
console.log(`<svg class="iso iso--${name}" viewBox="${vb.join(' ')}" aria-hidden="true" focusable="false">${body}</svg>`);
