// A sculpted mandrake: the gnarled, wrinkled root creature of the old
// herbology books. A knobbly tuber body, a sunken face with beady eyes deep
// in their sockets and a wide mouth, and long, thin, twisted root limbs. It's
// modelled as a smooth signed-distance shape (ellipsoids and capsules
// blended together, carved and furrowed with noise), then turned into a mesh
// once with "surface nets", with normals taken from the shape itself.
// Units are metres; it stands about 32 cm tall, feet at y = -0.16.

// ---------- distance-field pieces (plain numbers, for speed) ----------

const sphere = (x, y, z, cx, cy, cz, r) => Math.hypot(x - cx, y - cy, z - cz) - r;
function ellipsoid(x, y, z, cx, cy, cz, rx, ry, rz) {
  const px = (x - cx) / rx;
  const py = (y - cy) / ry;
  const pz = (z - cz) / rz;
  const k0 = Math.hypot(px, py, pz);
  const k1 = Math.hypot(px / rx, py / ry, pz / rz);
  return k1 === 0 ? -Math.min(rx, ry, rz) : (k0 * (k0 - 1)) / k1;
}
// a capsule from a to b whose radius tapers from ra to rb
function capsule(x, y, z, ax, ay, az, bx, by, bz, ra, rb = ra) {
  const pax = x - ax;
  const pay = y - ay;
  const paz = z - az;
  const bax = bx - ax;
  const bay = by - ay;
  const baz = bz - az;
  const h = Math.min(Math.max((pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz), 0), 1);
  return Math.hypot(pax - bax * h, pay - bay * h, paz - baz * h) - (ra + (rb - ra) * h);
}
// smooth union and smooth subtraction
function smin(a, b, k) {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}
const ssub = (a, b, k) => -smin(-a, b, k);

// a little value noise, for knobbly root skin
function hash3(x, y, z) {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function noise3(x, y, z) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fy = y - iy;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const uz = fz * fz * (3 - 2 * fz);
  const lerp = (a, b, t) => a + (b - a) * t;
  const c = (dx, dy, dz) => hash3(ix + dx, iy + dy, iz + dz);
  return lerp(
    lerp(lerp(c(0, 0, 0), c(1, 0, 0), ux), lerp(c(0, 1, 0), c(1, 1, 0), ux), uy),
    lerp(lerp(c(0, 0, 1), c(1, 0, 1), ux), lerp(c(0, 1, 1), c(1, 1, 1), ux), uy),
    uz,
  );
}
const fbm = (x, y, z) => noise3(x, y, z) * 0.6 + noise3(x * 2.1, y * 2.1, z * 2.1) * 0.3 + noise3(x * 4.3, y * 4.3, z * 4.3) * 0.1;

// ---------- the shapes ----------

const HEAD = [0, 0.104, 0.004];
export const EYES = [
  [0.0165, 0.111, 0.037],
  [-0.0165, 0.111, 0.037],
];
export const MOUTH = [0, 0.083, 0.043];

// deep twisting furrows and knobbly bark, like an old root
function rootSkin(x, y, z, deep = 1) {
  const a = Math.atan2(z, x);
  return deep * (0.0016 * Math.sin(y * 240 + Math.sin(a * 3 + y * 20) * 3) + 0.0009 * Math.sin(a * 9 + y * 34)) + 0.0032 * (fbm(x * 70, y * 70, z * 70) - 0.5);
}

// the body: a tuber that swells into a head, a sunken face, root legs
function bodyField(x, y, z) {
  // a slightly bent, tapering tuber
  const bend = Math.sin(y * 9) * 0.006;
  let d = capsule(x - bend, y, z, 0, -0.06, 0, 0, 0.055, 0.004, 0.03, 0.041); // trunk
  d = smin(d, ellipsoid(x, y, z, 0, 0.012, 0.012, 0.036, 0.04, 0.033), 0.02); // pot belly
  d = smin(d, ellipsoid(x, y, z, HEAD[0], HEAD[1], HEAD[2], 0.042, 0.05, 0.041), 0.028); // head
  // a heavy, knotted brow and a squashed, knobbly nose
  d = smin(d, capsule(x, y, z, -0.029, 0.121, 0.03, 0, 0.117, 0.039, 0.0075, 0.0085), 0.008);
  d = smin(d, capsule(x, y, z, 0, 0.117, 0.039, 0.029, 0.121, 0.03, 0.0085, 0.0075), 0.008);
  d = smin(d, capsule(x, y, z, 0, 0.109, 0.043, 0.001, 0.097, 0.05, 0.005, 0.0075), 0.006);
  // sunken eye sockets and hollow cheeks
  for (const [ex, ey, ez] of EYES) d = ssub(d, sphere(x, y, z, ex, ey, ez + 0.003, 0.0092), 0.005);
  for (const s of [-1, 1]) d = ssub(d, sphere(x, y, z, s * 0.03, 0.09, 0.038, 0.009), 0.012);
  // a wide mouth hollow
  d = ssub(d, ellipsoid(x, y, z, MOUTH[0], MOUTH[1], MOUTH[2] + 0.004, 0.018, 0.011, 0.012), 0.006);
  for (const s of [-1, 1]) {
    // little pointed root ears
    d = smin(d, capsule(x, y, z, s * 0.036, 0.108, -0.002, s * 0.054, 0.122, -0.008, 0.007, 0.002), 0.006);
    // long, thin, twisted root legs with knobbly knees
    d = smin(d, capsule(x, y, z, s * 0.014, -0.055, 0.002, s * 0.03, -0.1, 0.012, 0.0125, 0.009), 0.012);
    d = smin(d, sphere(x, y, z, s * 0.03, -0.1, 0.012, 0.0105), 0.006);
    d = smin(d, capsule(x, y, z, s * 0.03, -0.1, 0.012, s * 0.026, -0.148, 0.004, 0.009, 0.006), 0.006);
    // root toes splaying out
    for (const t of [-1, 0, 1]) d = smin(d, capsule(x, y, z, s * 0.026, -0.148, 0.004, s * (0.026 + t * 0.008), -0.16, 0.016 + Math.abs(t) * -0.004, 0.0045, 0.0022), 0.004);
    // knotty nubs on the body
    d = smin(d, capsule(x, y, z, s * 0.032, 0.0, -0.012, s * 0.048, -0.012, -0.022, 0.006, 0.002), 0.006);
  }
  // the bark only matters near the surface (it's never more than a few mm)
  return Math.abs(d) > 0.006 ? d : d + rootSkin(x, y, z);
}

// an arm, from the shoulder at the origin: long, thin and gnarled, with a
// knobbly elbow and long bony root fingers
function armField(x, y, z) {
  let d = capsule(x, y, z, 0, 0, 0, 0.034, -0.03, 0.01, 0.0095, 0.0075); // upper arm
  d = smin(d, sphere(x, y, z, 0.034, -0.03, 0.01, 0.0085), 0.005); // knobbly elbow
  d = smin(d, capsule(x, y, z, 0.034, -0.03, 0.01, 0.056, -0.066, 0.022, 0.0072, 0.0052), 0.005); // forearm
  d = smin(d, ellipsoid(x, y, z, 0.059, -0.072, 0.024, 0.0075, 0.008, 0.006), 0.004); // knuckly hand
  // four long fingers and a thumb, each with a little crook
  for (const [fx, fz, len] of [[0.006, 0.002, 1], [0.002, 0.006, 1.15], [-0.003, 0.007, 1.05], [-0.007, 0.004, 0.85]]) {
    const mx = 0.06 + fx * 1.4;
    const my = -0.072 - 0.012 * len;
    const mz = 0.026 + fz;
    d = smin(d, capsule(x, y, z, 0.059 + fx * 0.5, -0.075, 0.025, mx, my, mz, 0.0028, 0.0022), 0.0025);
    d = smin(d, capsule(x, y, z, mx, my, mz, mx + fx * 0.8, my - 0.01 * len, mz + 0.006, 0.0022, 0.0013), 0.002);
  }
  d = smin(d, capsule(x, y, z, 0.054, -0.07, 0.024, 0.05, -0.08, 0.034, 0.0026, 0.0015), 0.002); // thumb
  return Math.abs(d) > 0.005 ? d : d + rootSkin(x * 1.3, y * 1.3, z * 1.3, 0.55);
}

// ---------- surface nets: a smooth mesh from a distance field ----------

function surfaceNets(field, min, max, step) {
  const nx = Math.ceil((max[0] - min[0]) / step) + 1;
  const ny = Math.ceil((max[1] - min[1]) / step) + 1;
  const nz = Math.ceil((max[2] - min[2]) / step) + 1;
  const at = (i, j, k) => i + nx * (j + ny * k);
  // sample coarsely first; then only points near the surface need the exact
  // (slow) value, and everywhere else the coarse one keeps the right sign
  const C = 4;
  const cx = Math.ceil((nx - 1) / C) + 1;
  const cy = Math.ceil((ny - 1) / C) + 1;
  const cz = Math.ceil((nz - 1) / C) + 1;
  const coarse = new Float32Array(cx * cy * cz);
  for (let k = 0; k < cz; k++)
    for (let j = 0; j < cy; j++)
      for (let i = 0; i < cx; i++) coarse[i + cx * (j + cy * k)] = field(min[0] + i * C * step, min[1] + j * C * step, min[2] + k * C * step);
  const margin = step * C * 1.2 + 0.004;
  const values = new Float32Array(nx * ny * nz);
  for (let k = 0; k < nz; k++)
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        const near = coarse[Math.min(Math.round(i / C), cx - 1) + cx * (Math.min(Math.round(j / C), cy - 1) + cy * Math.min(Math.round(k / C), cz - 1))];
        values[at(i, j, k)] = Math.abs(near) > margin ? near : field(min[0] + i * step, min[1] + j * step, min[2] + k * step);
      }

  // one vertex per cell the surface passes through: the average of where it
  // crosses the cell's edges
  const cell = new Int32Array(nx * ny * nz).fill(-1);
  const pos = [];
  const corner = new Float32Array(8);
  const EDGES = [
    [0, 1], [2, 3], [4, 5], [6, 7],
    [0, 2], [1, 3], [4, 6], [5, 7],
    [0, 4], [1, 5], [2, 6], [3, 7],
  ];
  for (let k = 0; k < nz - 1; k++)
    for (let j = 0; j < ny - 1; j++)
      for (let i = 0; i < nx - 1; i++) {
        let inside = 0;
        for (let c = 0; c < 8; c++) {
          corner[c] = values[at(i + (c & 1), j + ((c >> 1) & 1), k + ((c >> 2) & 1))];
          if (corner[c] < 0) inside++;
        }
        if (inside === 0 || inside === 8) continue;
        let sx = 0;
        let sy = 0;
        let sz = 0;
        let n = 0;
        for (const [a, b] of EDGES) {
          const va = corner[a];
          const vb = corner[b];
          if (va < 0 === vb < 0) continue;
          const t = va / (va - vb);
          sx += (a & 1) + ((b & 1) - (a & 1)) * t;
          sy += ((a >> 1) & 1) + (((b >> 1) & 1) - ((a >> 1) & 1)) * t;
          sz += ((a >> 2) & 1) + (((b >> 2) & 1) - ((a >> 2) & 1)) * t;
          n++;
        }
        cell[at(i, j, k)] = pos.length / 3;
        pos.push(min[0] + (i + sx / n) * step, min[1] + (j + sy / n) * step, min[2] + (k + sz / n) * step);
      }

  // a quad across every grid edge the surface crosses
  const index = [];
  const quad = (a, b, c, d, flip) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (flip) index.push(a, c, b, a, d, c);
    else index.push(a, b, c, a, c, d);
  };
  for (let k = 1; k < nz - 1; k++)
    for (let j = 1; j < ny - 1; j++)
      for (let i = 1; i < nx - 1; i++) {
        const v = values[at(i, j, k)] < 0;
        if (v !== values[at(i + 1, j, k)] < 0) quad(cell[at(i, j - 1, k - 1)], cell[at(i, j, k - 1)], cell[at(i, j, k)], cell[at(i, j - 1, k)], !v);
        if (v !== values[at(i, j + 1, k)] < 0) quad(cell[at(i - 1, j, k - 1)], cell[at(i - 1, j, k)], cell[at(i, j, k)], cell[at(i, j, k - 1)], !v);
        if (v !== values[at(i, j, k + 1)] < 0) quad(cell[at(i - 1, j - 1, k)], cell[at(i, j - 1, k)], cell[at(i, j, k)], cell[at(i - 1, j, k)], !v);
      }

  // smooth normals straight from the field
  const normals = new Float32Array(pos.length);
  const e = step * 0.5;
  for (let p = 0; p < pos.length; p += 3) {
    const [x, y, z] = [pos[p], pos[p + 1], pos[p + 2]];
    const gx = field(x + e, y, z) - field(x - e, y, z);
    const gy = field(x, y + e, z) - field(x, y - e, z);
    const gz = field(x, y, z + e) - field(x, y, z - e);
    const l = Math.hypot(gx, gy, gz) || 1;
    normals[p] = gx / l;
    normals[p + 1] = gy / l;
    normals[p + 2] = gz / l;
  }
  // make every triangle face outwards (the way the field's normal points)
  for (let t = 0; t < index.length; t += 3) {
    const [a, b, c] = [index[t] * 3, index[t + 1] * 3, index[t + 2] * 3];
    const ux = pos[b] - pos[a];
    const uy = pos[b + 1] - pos[a + 1];
    const uz = pos[b + 2] - pos[a + 2];
    const vx = pos[c] - pos[a];
    const vy = pos[c + 1] - pos[a + 1];
    const vz = pos[c + 2] - pos[a + 2];
    const fx = uy * vz - uz * vy;
    const fy = uz * vx - ux * vz;
    const fz = ux * vy - uy * vx;
    if (fx * normals[a] + fy * normals[a + 1] + fz * normals[a + 2] < 0) {
      const tmp = index[t + 1];
      index[t + 1] = index[t + 2];
      index[t + 2] = tmp;
    }
  }
  return { position: new Float32Array(pos), normal: normals, index: new Uint32Array(index) };
}

// ---------- colour: bark brown, darker in the furrows, mossy up top ----------

const rgb = (hex) => [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255].map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); // to linear, as three.js colours are
const BARK = rgb(0x9a7650);
const BARK_DARK = rgb(0x4e3520);
const MOSS = rgb(0x6f7444);
const PALE = rgb(0xc7aa80);
const EARTH = rgb(0x3a2616);
const mix = (c, to, t) => {
  for (let i = 0; i < 3; i++) c[i] += (to[i] - c[i]) * t;
};

function paint(mesh, field) {
  const { position: p, normal: n } = mesh;
  const count = p.length / 3;
  const colors = new Float32Array(p.length);
  const c = [0, 0, 0];
  for (let i = 0; i < count; i++) {
    const x = p[i * 3];
    const y = p[i * 3 + 1];
    const z = p[i * 3 + 2];
    // how open this spot is: step out along the normal and see how far the
    // surface is (furrows and sockets stay close, so they come out dark)
    let ao = 0;
    for (const s of [0.003, 0.007, 0.013]) ao += Math.min(1, Math.max(0, field(x + n[i * 3] * s, y + n[i * 3 + 1] * s, z + n[i * 3 + 2] * s) / s));
    ao /= 3;
    c[0] = BARK[0];
    c[1] = BARK[1];
    c[2] = BARK[2];
    mix(c, BARK_DARK, 0.2 + 0.45 * fbm(x * 35, y * 35, z * 35));
    // a green tinge towards the top, where the leaves grow, and pale worn ridges
    mix(c, MOSS, Math.min(1, Math.max(0, (y - 0.04) / 0.1)) * 0.35 * fbm(x * 20 + 3, y * 20, z * 20));
    mix(c, PALE, Math.max(0, ao - 0.75) * 1.2);
    // earth clinging in the furrows and round the feet
    mix(c, EARTH, (1 - ao) * 0.5 + Math.min(1, Math.max(0, (-0.11 - y) / 0.05)) * 0.5);
    const k = 0.3 + 0.7 * ao;
    colors[i * 3] = c[0] * k;
    colors[i * 3 + 1] = c[1] * k;
    colors[i * 3 + 2] = c[2] * k;
  }
  mesh.color = colors;
  return mesh;
}

// The finished meshes, as plain arrays: { body, arm }, each
// { position, normal, index, color }.
export function sculptMandrake() {
  return {
    body: paint(surfaceNets(bodyField, [-0.075, -0.168, -0.06], [0.075, 0.165, 0.07], 0.0019), bodyField),
    arm: paint(surfaceNets(armField, [-0.014, -0.104, -0.014], [0.078, 0.014, 0.05], 0.0012), armField),
  };
}
