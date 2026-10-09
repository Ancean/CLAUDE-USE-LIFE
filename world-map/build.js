// Builds the fictional 1915 map: modern borders regrouped into the novel's states, with hand-drawn splits.
const fs = require('fs');
const topo = require('world-atlas/countries-50m.json');
const { feature } = require('topojson-client');
const d3 = require('d3-geo');
const pc = require('polygon-clipping');
const { naturalize } = require('./natural');

const FRAME = [[-28, 20], [75, 20], [75, 74], [-28, 74], [-28, 20]];
const rect = (x0, y0, x1, y1) => [[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]];
const poly = pts => [[...pts, pts[0]]];

// Base assignment of modern countries to states.
const BASE = {
  walde: ['Germany', 'Austria', 'Luxembourg'],
  strait: ['Greece', 'Albania', 'Turkey', 'Cyprus', 'N. Cyprus'],
  wiran: ['France', 'Monaco', 'Andorra'],
  solmere: ['United Kingdom', 'Ireland', 'Isle of Man', 'Jersey', 'Guernsey', 'Iceland', 'Faeroe Is.', 'Malta'],
  steppe: ['Russia', 'Belarus', 'Ukraine', 'Lithuania', 'Finland', 'Åland', 'Moldova', 'Georgia', 'Armenia', 'Azerbaijan', 'Poland'],
  castalia: ['Italy', 'San Marino', 'Vatican'],
  tisa: ['Hungary', 'Czechia', 'Slovakia'],
  skeld: ['Netherlands', 'Belgium'],
  jutland: ['Denmark'],
  crown: ['Norway', 'Sweden'],
  terra: ['Estonia', 'Latvia'],
  alps: ['Switzerland', 'Liechtenstein'],
  hesperia: ['Spain'],
  austra: ['Portugal'],
  illyria: ['Croatia', 'Bosnia and Herz.', 'Slovenia'],
  raska: ['Serbia', 'Kosovo', 'Montenegro', 'Macedonia'],
  dacia: ['Romania'],
  moesia: ['Bulgaria'],
  wiranCol: ['Algeria', 'Tunisia', 'Morocco', 'Syria', 'Lebanon'],
  solmereCol: ['Egypt', 'Israel', 'Palestine', 'Jordan', 'Iraq', 'Kuwait'],
  castaliaCol: ['Libya'],
  other: ['Saudi Arabia', 'Iran', 'Kazakhstan', 'Turkmenistan', 'Uzbekistan', 'Sudan', 'W. Sahara', 'Mauritania', 'Mali', 'Niger', 'Chad'],
};

// Splits, applied in order: [modern country, region, state that receives the part inside it].
const SPLITS = [
  ['France', poly([[6.8, 47.42], [7.75, 47.42], [8.35, 48.95], [7.9, 49.12], [7.05, 49.2], [6.8, 48.55]]), 'walde'], // Alsace
  ['France', rect(8.4, 41.2, 9.8, 43.2), 'castalia'],                                   // Corsica
  ['France', poly([[5.75, 46.45], [7.1, 46.45], [7.1, 45.05], [6.3, 45.05], [5.75, 45.6]]), 'alps'], // Savoy
  ['Italy', poly([[10.35, 46.6], [11.0, 46.1], [11.9, 46.05], [12.6, 46.5], [12.6, 47.2], [10.35, 47.2]]), 'walde'], // South Tyrol
  ['Italy', rect(6.6, 45.45, 7.95, 46.1), 'alps'],                                      // Aosta
  ['Spain', poly([[-2.1, 43.6], [3.6, 43.6], [3.6, 40.5], [0.85, 40.5], [0.55, 40.8], [0.2, 40.9], [0.05, 41.15], [-0.3, 41.3], [-0.55, 41.62], [-0.95, 41.6], [-1.25, 41.9], [-1.5, 41.95], [-1.75, 42.3], [-2.1, 42.4]]), 'wiran'], // Catalonia, Aragon, Navarre
  ['Spain', poly([[-10, 44], [-5.6, 44], [-5.8, 43.2], [-5.5, 42.6], [-5.9, 42.1], [-6.2, 41.6], [-6.0, 41.0], [-6.4, 40.6], [-6.2, 40.3], [-10, 40.3]]), 'austra'], // Galicia and western León
  ['Belgium', rect(2.4, 50.78, 3.35, 51.6), 'solmere'],                                // Flemish coast
  ['Belgium', poly([[2.8, 50.8], [6.5, 50.65], [6.5, 49.4], [2.8, 49.4]]), 'wiran'],    // Wallonia
  ['Germany', rect(7.5, 54.45, 11.3, 55.2), 'jutland'],                                 // Schleswig
  ['Czechia', poly([[11, 51.3], [16.6, 51.3], [16.4, 50.4], [15.9, 49.9], [15.4, 49.3], [15.1, 48.5], [11, 48.4]]), 'walde'], // Bohemia
  ['Poland', poly([[13, 55.6], [22.9, 55.6], [22.9, 54.35], [22.6, 53.6], [21.0, 53.25], [19.7, 53.15], [19.3, 52.9], [18.8, 52.6], [18.6, 52.2], [18.1, 51.8], [18.0, 51.2], [18.6, 50.9], [19.0, 50.6], [19.4, 50.1], [18.8, 49.3], [13, 49.3]]), 'walde'], // Prussian provinces
  ['Russia', rect(19, 54, 23, 55.5), 'walde'],                                          // Königsberg
  ['Lithuania', poly([[20.5, 55.25], [21.7, 55.25], [21.4, 55.7], [21.3, 56.1], [20.5, 56.1]]), 'walde'], // Memel
  ['Slovenia', rect(13, 45.4, 16.7, 47), 'walde'],                                       // Carniola
  ['Croatia', poly([[13.4, 45.6], [14.6, 45.6], [14.6, 44.85], [13.4, 44.85]]), 'walde'], // Istria
  ['Serbia', poly([[18.8, 46.3], [21.6, 46.3], [21.4, 45.2], [20.6, 44.85], [19.4, 44.85], [18.8, 45.0]]), 'tisa'], // Vojvodina
  ['Romania', poly([[20.2, 46.25], [21.4, 45.3], [22.8, 45.25], [23.6, 45.5], [24.0, 46.2], [24.2, 47.0], [24.0, 48.0], [22.8, 47.95], [21.0, 47.6]]), 'tisa'], // western Transylvania
  ['Turkey', poly([[36.2, 38.3], [45, 38.3], [45, 35], [36.2, 35]]), 'wiranCol'],        // Cilicia and the upper Euphrates
  ['Turkey', poly([[41.3, 42], [45, 42], [45, 39.6], [41.3, 39.6]]), 'steppe'],          // Kars and Ardahan
];

const feats = feature(topo, topo.objects.countries).features;
const byName = Object.fromEntries(feats.map(f => [f.properties.name, f]));
const coords = g => (g.type === 'Polygon' ? [g.coordinates] : g.coordinates);
const frame = [FRAME];

function clipped(name) {
  const f = byName[name];
  if (!f) { console.error('missing', name); return []; }
  let polys = coords(f.geometry);
  // Russia touches the antimeridian; shift its far-eastern points so the planar clip stays valid.
  if (name === 'Russia') polys = polys.map(p => p.map(r => r.map(([x, y]) => [x < -160 ? x + 360 : x, y])));
  try { return pc.intersection(polys, frame); } catch (e) { console.error('clip fail', name, e.message); return []; }
}

const stateOf = {};
for (const [st, names] of Object.entries(BASE)) for (const n of names) stateOf[n] = st;
const geom = {};
for (const n of Object.keys(stateOf)) geom[n] = clipped(n);

const parts = {};
const add = (st, mp) => { if (mp && mp.length) (parts[st] ||= []).push(mp); };
for (const [country, region, st] of SPLITS) {
  const g = geom[country];
  if (!g || !g.length) { console.error('no geom for split', country); continue; }
  add(st, pc.intersection(g, region));
  geom[country] = pc.difference(g, region);
}
for (const [n, g] of Object.entries(geom)) add(stateOf[n], g);

// A smooth displacement field so coasts stop reading as Europe; every state uses the same field, so shared borders still meet.
const waves = []; // no global distortion; coast edits are local (see EDITS)
function warp([x, y]) {
  let dx = 0, dy = 0;
  for (const [a, l, p, q] of waves) {
    const k = 2 * Math.PI / l;
    dx += a * Math.sin(k * (0.8 * x + 0.6 * y) + p);
    dy += a * Math.sin(k * (-0.6 * x + 0.8 * y) + q);
  }
  // Extra twist over the British Isles.
  const b = Math.exp(-(((x + 4.5) / 4.5) ** 2 + ((y - 54.5) / 4) ** 2));
  dx += 0 * b;
  dy += 0 * b;
  return [x + dx, y + dy];
}
function densify(r) {
  const o = [];
  for (let i = 0; i < r.length - 1; i++) {
    const [a, b] = [r[i], r[i + 1]];
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.25));
    for (let j = 0; j < n; j++) o.push([a[0] + (b[0] - a[0]) * j / n, a[1] + (b[1] - a[1]) * j / n]);
  }
  o.push(r[r.length - 1]);
  return o;
}
const warpMP = mp => mp.map(p => p.map(r => densify(r).map(warp)));

// Frame ring traced point by point so its edges follow parallels, not great circles.
const ring = [];
for (let y = 29; y <= 63.5; y += 0.5) ring.push([-11, y]);
for (let x = -11; x <= 51; x += 0.5) ring.push([x, 63.5]);
for (let y = 63.5; y >= 29; y -= 0.5) ring.push([51, y]);
for (let x = 51; x >= -11; x -= 0.5) ring.push([x, 29]);
ring.push([-11, 29]);
const BOX = { type: 'Polygon', coordinates: [ring] };
const proj = d3.geoConicConformal().parallels([38, 58]).rotate([-18, 0]).fitExtent([[4, 4], [996, 856]], BOX);
const path = d3.geoPath(proj).digits(1);

// Local coast edits: soft-edged blobs added to one state's land or cut out of everyone's.
function blob(cx, cy, rx, ry, seed, rot = 0) {
  const r = [];
  for (let i = 0; i < 96; i++) {
    const t = (i / 96) * 2 * Math.PI;
    const k = 1 + 0.07 * Math.sin(3 * t + seed) + 0.04 * Math.sin(5 * t + 2 * seed);
    const ex = rx * k * Math.cos(t), ey = ry * k * Math.sin(t);
    r.push([cx + ex * Math.cos(rot) - ey * Math.sin(rot), cy + ex * Math.sin(rot) + ey * Math.cos(rot)]);
  }
  return [[...r, r[0]]];
}
const EDITS = [
  ['add', 'solmere', blob(-5.6, 54.95, 0.8, 0.38, 1, -0.5)],   // North Channel closed: one isle instead of two
  ['add', 'steppe', blob(36.6, 46.1, 2.0, 0.75, 2)],          // Azov filled, Crimea joined to the mainland
  ['add', 'castalia', blob(17.0, 40.0, 0.75, 0.45, 5)],       // Gulf of Taranto filled
  ['add', 'walde', blob(8.0, 54.15, 1.0, 0.42, 6)],           // German Bight pushed out
  ['cut', '*', blob(-1.4, 46.0, 0.7, 0.45, 4)],               // a gulf in Wiran's Atlantic coast
  ['cut', '*', blob(-9.25, 39.4, 0.55, 0.75, 3)],             // a gulf on Austra's west coast
  ['cut', '*', blob(10.6, 59.2, 0.5, 0.9, 7)],                // a wide fjord in the northern crown
];
const U = {};
for (const [st, list] of Object.entries(parts)) U[st] = list.length > 1 ? pc.union(...list) : list[0];
for (const [op, st, shape] of EDITS) {
  if (op === 'cut') { for (const k of Object.keys(U)) U[k] = pc.difference(U[k], shape); continue; }
  const others = Object.entries(U).filter(([k]) => k !== st).map(([, g]) => g);
  U[st] = pc.union(U[st], pc.difference(shape, ...others));
}
// Redrawn coasts: Italy, the British Isles and North Africa are cut out and replaced by designed shapes.
// A shape is a ring of control points, smoothed with a closed Catmull-Rom spline, then given a small ragged edge.
function coast(ctrl, seed, rough = 0.06) {
  const n = ctrl.length, pts = [];
  for (let i = 0; i < n; i++) {
    const [p0, p1, p2, p3] = [ctrl[(i - 1 + n) % n], ctrl[i], ctrl[(i + 1) % n], ctrl[(i + 2) % n]];
    const steps = Math.max(8, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 0.02));
    for (let j = 0; j < steps; j++) {
      const t = j / steps, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      pts.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  // Fractal ragged edge: six octaves, each finer and weaker, pushed along the local normal.
  let s = 0;
  const out = pts.map((q, i) => {
    const a = pts[(i - 1 + pts.length) % pts.length], b = pts[(i + 1) % pts.length];
    s += Math.hypot(q[0] - a[0], q[1] - a[1]);
    const tx = b[0] - a[0], ty = b[1] - a[1], L = Math.hypot(tx, ty) || 1;
    let w = 0;
    for (let o = 0; o < 6; o++) w += 0.55 ** o * Math.sin(s * 1.7 * 2.1 ** o + seed * (o + 1.3));
    w *= rough;
    return [q[0] - (ty / L) * w, q[1] + (tx / L) * w];
  });
  return pc.union([[[...out, out[0]]]]);
}
// Midpoint-displacement coast: a smooth spline base, then each edge is split and its midpoint pushed sideways,
// recursively, until edges are a few kilometres long. Control points may carry a third value, the local ruggedness.
function rng(seed) { let a = Math.floor(seed * 1e6) >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function coast2(ctrl, seed, opts = {}) {
  const { H = 0.38, isles = 0, step = 0.6 } = opts;
  const rand = rng(seed);
  const n = ctrl.length, base = [];
  for (let i = 0; i < n; i++) {
    const [p0, p1, p2, p3] = [ctrl[(i - 1 + n) % n], ctrl[i], ctrl[(i + 1) % n], ctrl[(i + 2) % n]];
    const r1 = p1[2] ?? 1, r2 = p2[2] ?? 1;
    const steps = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
    for (let j = 0; j < steps; j++) {
      const t = j / steps, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      base.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1]), r1 + (r2 - r1) * t]);
    }
  }
  const out = [];
  const split = (a, b, depth) => {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 0.03 || depth > 8) { out.push(a); return; }
    const r = (a[2] + b[2]) / 2;
    const d = (rand() * 2 - 1) * len * H * r * 0.82 ** depth; // finer levels are damped so edges read as coast, not fuzz
    const m = [(a[0] + b[0]) / 2 - ((b[1] - a[1]) / len) * d, (a[1] + b[1]) / 2 + ((b[0] - a[0]) / len) * d, r];
    split(a, m, depth + 1); split(m, b, depth + 1);
  };
  for (let i = 0; i < base.length; i++) split(base[i], base[(i + 1) % base.length], 0);
  let shape = pc.union([[[...out.map(q => [q[0], q[1]]), [out[0][0], out[0][1]]]]]);
  // Islets off the rugged stretches: small fractal blobs a little way offshore.
  for (let k = 0; k < isles; k++) {
    const i = Math.floor(rand() * base.length), q = base[i], nx = base[(i + 1) % base.length];
    if (q[2] < 1.2) continue;
    const tx = nx[0] - q[0], ty = nx[1] - q[1], L = Math.hypot(tx, ty) || 1;
    const off = 0.08 + rand() * 0.3, rad = 0.03 + rand() * 0.1;
    const cx = q[0] + (ty / L) * off, cy = q[1] - (tx / L) * off;
    const ring = [];
    for (let j = 0; j < 7; j++) { const t = j / 7 * 2 * Math.PI, k2 = 0.6 + rand() * 0.8; ring.push([cx + rad * k2 * Math.cos(t), cy + rad * k2 * 0.8 * Math.sin(t), 1.2]); }
    const isle = coast2(ring, seed + k + 0.37, { H: 0.3, step: 0.05 });
    shape = pc.union(shape, isle);
  }
  return shape;
}
// Outline from control points (smooth spline, no added noise), then let terrain decide the actual coast.
const nat = (ctrl, bbox, opts) => naturalize(coast(ctrl, 0, 0), bbox, opts);
const near = (x, y, cx, cy, r) => 1 - Math.exp(-(((x - cx) ** 2 + (y - cy) ** 2) / (r * r)));
const MASKS = [
  poly([[7.55, 43.75], [8.6, 44.3], [10.2, 43.95], [12.3, 44.25], [13.6, 43.9], [16.0, 42.9], [18.7, 41.2], [18.8, 39.6], [16.5, 36.1], [11.5, 36.15], [7.3, 38.5], [7.6, 41.0], [8.3, 42.95]]), // Italian peninsula and islands
  poly([[-11, 49.8], [1.0, 50.15], [1.65, 50.75], [2.0, 51.3], [2.0, 61.5], [-11, 61.5]]),                           // British Isles
  poly([[-25, 15], [32.35, 15], [32.35, 31.6], [30, 31.9], [26, 32.0], [24.5, 33.3], [21, 33.5], [15, 33.6], [11.6, 35.5], [11.3, 37.6], [9.8, 37.7], [5, 37.3], [-0.5, 36.3], [-2.2, 35.8], [-5.3, 35.95], [-5.7, 35.9], [-6.2, 36.0], [-9.5, 34.5], [-25, 34.5]]), // North Africa west of Sinai
];
for (const m of MASKS) for (const k of Object.keys(U)) U[k] = pc.difference(U[k], m);
const give = (st, shape) => {
  const others = Object.entries(U).filter(([k]) => k !== st).map(([, g]) => g);
  U[st] = pc.union(U[st] || [], pc.difference(shape, ...others));
};
// Castalia: the peninsula forks into two arms around a deep gulf; a crescent island to the west, a long island across the gulf mouth.
// Third value per point = ruggedness: the Tyrrhenian side and the gulf are rocky, the Adriatic side is a low, even shore.
{ const base = coast([[7.8, 44.15, 0.5], [8.8, 44.35, 0.9], [9.7, 43.8, 1.1], [10.4, 43.1, 1.2], [11.2, 42.5, 1.2], [11.9, 41.8, 1.2], [12.15, 41.45, 0.9], [13.05, 41.55, 0.6], [12.55, 41.15, 0.9], [12.9, 40.4, 1.1], [12.8, 39.7, 1.2], [12.4, 39.2, 1.3], [11.9, 38.6, 1.4], [11.6, 38.0, 1.4], [12.0, 37.6, 1.2], [12.8, 37.75, 0.9], [13.6, 38.25, 0.6], [14.1, 37.6, 0.9], [14.6, 37.2, 1.1], [15.4, 37.4, 1.1], [15.7, 37.9, 1.0], [15.4, 38.6, 0.9], [14.9, 39.2, 0.8], [14.7, 39.8, 0.7], [15.1, 40.3, 0.7], [16.0, 40.2, 0.8], [16.9, 40.0, 0.9], [17.5, 40.25, 1.0], [17.1, 40.75, 0.6], [16.4, 41.2, 0.5], [15.9, 41.8, 0.5], [15.9, 42.4, 0.7], [16.5, 42.7, 1.0], [16.0, 43.0, 0.7], [14.9, 43.3, 0.5], [13.9, 43.85, 0.5], [12.7, 44.35, 0.45], [11.0, 44.65, 0.5], [9.5, 44.65, 0.5]], 0, 0);
  give('castalia', pc.union(naturalize(base, [6.5, 36.4, 18.9, 45.3], { seed: 31, amp: 0.45, scale: 1.4, rough: (x, y) => 0.55 + 0.75 * Math.min(1, Math.max(0, (16.5 - x) / 5)) }), pc.intersection(base, rect(7.3, 43.5, 14.3, 45.4)))); }
give('castalia', nat([[7.4, 42.9, 1.5], [8.4, 42.5, 1.3], [8.8, 41.6, 1.1], [8.4, 40.8, 1.2], [8.9, 40.0, 1.1], [8.5, 39.1, 1.3], [7.7, 38.8, 1.5], [7.0, 39.3, 1.7], [7.4, 40.1, 1.6], [6.8, 40.9, 1.7], [7.1, 41.9, 1.6]], [5.8, 38.0, 10.0, 43.8], { seed: 37, amp: 0.42, scale: 1.2 }));
// Solmere: a main island with two long south-western claws and deep firths, and Erin as a separate round island with a northern bay.
// The western and northern coasts are broken and island-strewn; the east and south are smoother.
give('solmere', nat([[1.45, 51.15, 0.5], [1.8, 51.9, 0.5], [1.6, 52.7, 0.5], [0.5, 52.9, 0.4], [0.4, 53.6, 0.5], [-0.2, 54.4, 0.6], [-1.0, 55.0, 0.7], [-1.6, 55.9, 0.9], [-2.3, 56.5, 1.0], [-2.9, 56.4, 1.0], [-2.2, 57.1, 1.0], [-1.9, 57.7, 1.1], [-3.0, 58.1, 1.3], [-3.3, 58.7, 1.6], [-4.6, 58.6, 1.8], [-5.2, 58.2, 2.0], [-5.0, 57.6, 2.0], [-5.7, 57.0, 2.0], [-5.4, 56.4, 2.0], [-6.1, 55.9, 1.9], [-5.5, 55.4, 1.7], [-4.8, 55.3, 1.4], [-4.9, 54.7, 1.2], [-4.0, 54.6, 1.0], [-3.2, 54.3, 0.9], [-3.6, 53.6, 1.0], [-4.6, 53.2, 1.3], [-4.9, 52.6, 1.3], [-4.3, 52.2, 1.2], [-5.4, 51.8, 1.6], [-6.2, 51.5, 1.7], [-5.2, 51.3, 1.3], [-3.9, 51.5, 0.9], [-3.4, 51.2, 0.9], [-4.8, 50.6, 1.4], [-5.9, 50.0, 1.6], [-4.9, 49.9, 1.2], [-3.6, 50.3, 0.8], [-2.2, 50.6, 0.6], [-0.8, 50.7, 0.5], [0.5, 50.75, 0.5], [1.2, 50.95, 0.5]], [-7.0, 49.2, 2.8, 59.6], { seed: 41, amp: 0.6, scale: 1.5, rough: (x, y) => (0.45 + 0.85 * Math.min(1, Math.max(0, (-x - 1.5) / 4))) * near(x, y, 1.7, 51.0, 0.6) }));
give('solmere', nat([[-7.2, 55.3, 1.4], [-6.2, 54.6, 0.8], [-6.0, 53.6, 0.6], [-6.4, 52.4, 0.6], [-7.4, 51.7, 1.0], [-8.8, 51.4, 1.5], [-10.2, 51.8, 1.9], [-10.4, 52.8, 2.0], [-9.6, 53.3, 1.9], [-10.1, 54.0, 2.0], [-9.2, 54.4, 1.8], [-8.6, 55.0, 1.6], [-8.3, 54.4, 1.4], [-7.8, 54.3, 1.3], [-7.6, 54.9, 1.4]], [-11.6, 50.6, -5.4, 56.2], { seed: 43, amp: 0.55, scale: 1.3, rough: (x) => 0.55 + 0.8 * Math.min(1, Math.max(0, (-x - 7.8) / 2)) }));
give('solmere', nat([[-2.9, 59.6, 1.5], [-1.9, 59.9, 1.5], [-1.6, 60.6, 1.5], [-2.4, 60.5, 1.5], [-3.1, 60.0, 1.5]], [-4.0, 59.0, -0.8, 61.3], { seed: 47, amp: 0.3, scale: 0.8 }));
// North Africa: a long Atlantic bulge, a broad northern cape that narrows the sea toward Castalia's southern island,
// a deep gulf in the middle, and a horn pointing at Crete.
const africaBase = coast([[-25, 18], [-12, 18], [-13.5, 24], [-12.2, 27.5], [-10.6, 30.2], [-9.4, 32.4], [-7.6, 34.0], [-5.8, 35.65], [-4.6, 35.2], [-3.8, 34.4], [-2.0, 33.9], [0.5, 33.7], [3.0, 33.8], [5.5, 33.6], [7.6, 33.9], [9.4, 34.1], [10.3, 34.3], [11.0, 33.9], [10.4, 33.3], [12.2, 32.6], [14.9, 32.2], [16.6, 31.0], [18.6, 30.3], [20.1, 31.1], [20.8, 32.4], [22.0, 33.1], [22.9, 34.3], [23.6, 34.55], [24.3, 33.9], [24.5, 32.6], [25.6, 31.8], [27.6, 31.3], [29.6, 31.0], [31.0, 31.6], [31.7, 31.55], [32.4, 31.2], [32.4, 18]], 6.6, 0);
const africa = pc.union(
  naturalize(africaBase, [-14, 27.4, 33.0, 36.4], { seed: 59, amp: 0.24, scale: 1.8, rough: (x, y) => near(x, y, -5.6, 35.9, 1.2) * (x > -4 && x < 11 ? 0.55 : 1) }),
  pc.intersection(africaBase, rect(-30, 10, 40, 27.6)),
  pc.intersection(africaBase, rect(31.4, 10, 32.45, 30.9)));
const band = (x0, x1) => poly([[x0, 10], [x1, 10], [x1, 26], [x1 + 0.4, 30], [x1 - 0.3, 33], [x1, 40], [x0, 40]]);
give('wiranCol', pc.intersection(africa, band(-30, 11.8)));
give('wiranCol', nat([[-3.4, 35.2, 1.1], [-2.6, 35.9, 1.2], [-1.2, 36.1, 1.2], [0.2, 36.7, 1.3], [1.5, 36.6, 1.1], [2.4, 36.95, 1.2], [3.6, 37.0, 1.2], [4.6, 36.7, 1.0], [5.0, 36.0, 0.6], [5.5, 36.75, 1.0], [6.8, 37.0, 1.3], [7.9, 37.4, 1.5], [8.6, 37.2, 1.4], [8.2, 36.6, 1.1], [8.9, 36.1, 1.3], [9.6, 35.9, 1.3], [9.2, 35.4, 1.0], [7.8, 35.3, 0.8], [6.6, 35.0, 0.8], [5.0, 34.9, 0.7], [3.2, 35.25, 0.6], [2.0, 34.8, 0.7], [0.4, 34.75, 0.7], [-1.2, 34.9, 0.8], [-2.6, 34.85, 0.9]], [-4.5, 33.9, 10.7, 38.3], { seed: 53, amp: 0.3, scale: 1.4 })); // the old northern lobe of Africa, now a large island
give('castaliaCol', pc.intersection(africa, pc.difference(band(-30, 24.8), band(-30, 11.8))));
give('solmereCol', pc.difference(africa, band(-30, 24.8)));

const out = {};
for (const [st, u] of Object.entries(U)) {
  // polygon-clipping returns CCW outer rings; d3 wants clockwise on the sphere, so reverse each ring.
  out[st] = path({ type: 'MultiPolygon', coordinates: warpMP(u).map(p => p.map(r => r.slice().reverse())) });
}
const frontPts = [[3.4, 50.78], [3.05, 50.62], [2.85, 50.42], [2.8, 50.25], [2.68, 50.02], [2.85, 49.75], [3.05, 49.55], [3.35, 49.38], [3.85, 49.3], [4.4, 49.22], [4.95, 49.2], [5.35, 49.2], [5.5, 49.05], [5.6, 48.9], [6.05, 48.88], [6.45, 48.6], [6.8, 48.3], [7.0, 47.95], [7.15, 47.6], [7.3, 47.45]];
const front = path({ type: 'LineString', coordinates: densify(frontPts).map(warp) });
const grat = path(d3.geoGraticule().extent([[-20, 25], [60, 70]]).step([10, 5])());
const outline = path(BOX);
const P = (lon, lat) => proj(warp([lon, lat])).map(v => Math.round(v));
const L = {
  walde: [12.4, 50.55], strait: [33.5, 39.2], strait2: [22.2, 39.4], wiran: [1.6, 45.9], solmere: [-1.6, 52.6], steppe: [37, 55.5],
  castalia: [13.6, 42.4], tisa: [19.6, 47.7],
  skeld: [4.3, 53.7], jutland: [9.3, 56.1], crown: [15.2, 61.2], terra: [25.6, 57.7], alps: [7.9, 46.5],
  hesperia: [-3.7, 39.3], austra: [-7.8, 41.0], illyria: [16.9, 44.6], raska: [21.0, 43.0],
  dacia: [25.0, 45.7], moesia: [25.4, 42.75],
  wiranColA: [2.5, 32.0], wiranColC: [3.6, 35.75], wiranColB: [38.4, 35.2], solmereColA: [30.5, 29.9], solmereColB: [43.6, 33.0], castaliaCol: [14.2, 30.6],
  lutece: [2.35, 48.86], hennlet: [11.58, 48.14], capital: [13.4, 52.52], strait_m: [29.0, 41.1], front_m: [2.78, 50.3],
};
const pts = Object.fromEntries(Object.entries(L).map(([k, v]) => [k, P(...v)]));
fs.writeFileSync('paths.json', JSON.stringify({ out, grat, outline, front, pts }));
console.log(Object.keys(out).sort().join(' '));
