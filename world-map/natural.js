// Terrain-based coastlines: a designed outline only says roughly where land is. A height field is built from the
// signed distance to that outline plus domain-warped fractal noise, and the coast is the contour where height = 0.
// Bays, headlands, islets and lakes therefore come out of the same terrain instead of being added one by one.
const { contours } = require('d3-contour');
const pc = require('polygon-clipping');

function hash(i, j, seed) {
  let h = (i * 374761393 + j * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x, y, seed) {
  const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash(i, j, seed), b = hash(i + 1, j, seed), c = hash(i, j + 1, seed), d = hash(i + 1, j + 1, seed);
  return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1;
}
function fbm(x, y, seed, oct = 6, gain = 0.5) {
  let s = 0, amp = 0.5, f = 1;
  for (let o = 0; o < oct; o++) { s += amp * vnoise(x * f, y * f, seed + o * 17); f *= 2.03; amp *= gain; }
  return s;
}

// Even-odd scanline fill of a multipolygon onto the grid.
function rasterize(mp, x0, y0, res, nx, ny) {
  const inside = new Uint8Array(nx * ny);
  const edges = [];
  for (const p of mp) for (const r of p) for (let k = 0; k < r.length - 1; k++) edges.push([r[k], r[k + 1]]);
  for (let j = 0; j < ny; j++) {
    const y = y0 + (j + 0.5) * res, xs = [];
    for (const [a, b] of edges) {
      if ((a[1] > y) !== (b[1] > y)) xs.push(a[0] + ((y - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
    }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const i0 = Math.max(0, Math.ceil((xs[k] - x0) / res - 0.5)), i1 = Math.min(nx - 1, Math.floor((xs[k + 1] - x0) / res - 0.5));
      for (let i = i0; i <= i1; i++) inside[j * nx + i] = 1;
    }
  }
  return inside;
}

// Two-pass chamfer distance (in cells) to the nearest cell of the other kind.
function distance(mask, nx, ny, target) {
  const INF = 1e9, d = new Float32Array(nx * ny);
  for (let k = 0; k < d.length; k++) d[k] = mask[k] === target ? 0 : INF;
  const A = 1, B = Math.SQRT2;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i; let v = d[k];
    if (i > 0) v = Math.min(v, d[k - 1] + A);
    if (j > 0) { v = Math.min(v, d[k - nx] + A); if (i > 0) v = Math.min(v, d[k - nx - 1] + B); if (i < nx - 1) v = Math.min(v, d[k - nx + 1] + B); }
    d[k] = v;
  }
  for (let j = ny - 1; j >= 0; j--) for (let i = nx - 1; i >= 0; i--) {
    const k = j * nx + i; let v = d[k];
    if (i < nx - 1) v = Math.min(v, d[k + 1] + A);
    if (j < ny - 1) { v = Math.min(v, d[k + nx] + A); if (i < nx - 1) v = Math.min(v, d[k + nx + 1] + B); if (i > 0) v = Math.min(v, d[k + nx - 1] + B); }
    d[k] = v;
  }
  return d;
}

const ringArea = r => { let s = 0; for (let k = 0; k < r.length - 1; k++) s += r[k][0] * r[k + 1][1] - r[k + 1][0] * r[k][1]; return Math.abs(s) / 2; };

/**
 * outline: multipolygon of the designed land.  bbox: [x0, y0, x1, y1] in degrees.
 * amp: how far (degrees) the terrain may push the coast; rough(x, y) scales it locally (default 1).
 * scale: size of the largest landforms in degrees.
 */
function naturalize(outline, bbox, { amp = 0.35, scale = 1.6, seed = 1, res = 0.02, rough = () => 1, minIsle = 0.0015, minLake = 0.04 } = {}) {
  const [x0, y0, x1, y1] = bbox;
  const nx = Math.ceil((x1 - x0) / res), ny = Math.ceil((y1 - y0) / res);
  const inside = rasterize(outline, x0, y0, res, nx, ny);
  const dIn = distance(inside, nx, ny, 0), dOut = distance(inside, nx, ny, 1);
  const h = new Float64Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i, x = x0 + (i + 0.5) * res, y = y0 + (j + 0.5) * res;
    const sd = (inside[k] ? dIn[k] : -dOut[k]) * res;
    // Domain warp makes the noise flow into drowned valleys and spits instead of round blobs.
    const wx = x / scale + 0.9 * fbm(x / scale + 5.2, y / scale + 1.3, seed + 101, 4);
    const wy = y / scale + 0.9 * fbm(x / scale + 9.7, y / scale + 2.8, seed + 202, 4);
    const n = fbm(wx, wy, seed, 9, 0.62); // a higher gain keeps more fine detail, as real coasts do
    h[k] = Math.max(-2, Math.min(2, sd)) + amp * rough(x, y) * n * 2.2;
  }
  const [mp] = contours().size([nx, ny]).thresholds([0])(h).map(c => c.coordinates);
  const geo = [];
  for (const poly of mp) {
    const rings = poly.map(r => r.map(([i, j]) => [x0 + i * res, y0 + j * res]));
    if (ringArea(rings[0]) < minIsle) continue;
    geo.push([rings[0], ...rings.slice(1).filter(r => ringArea(r) >= minLake)]);
  }
  return pc.union(geo);
}

module.exports = { naturalize, fbm };
