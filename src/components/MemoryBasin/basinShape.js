import * as THREE from "three";

// The basin is one solid of revolution: this outline (radius, height) is spun
// around the vertical axis. It runs from the centre of the base, out along
// the floor, up the stem, out over the bowl, across the rim and back down the
// inside to the centre of the bowl.

// Square-cut plinth (straight lines, so its edges stay crisp).
const PLINTH = [
  [0, 0], [0.68, 0], [0.68, 0.07], [0.64, 0.1], [0.6, 0.1], [0.6, 0.155], [0.5, 0.185], [0.42, 0.21],
];

// Stem, bowl and rim (smoothed with a spline).
const BODY = [
  [0.42, 0.21], [0.32, 0.28], [0.24, 0.4], [0.2, 0.54], [0.2, 0.66], [0.235, 0.735], [0.215, 0.785],
  [0.3, 0.84], [0.48, 0.9], [0.66, 0.99], [0.8, 1.1], [0.885, 1.2], [0.925, 1.28], [0.958, 1.322],
  [0.962, 1.357], [0.932, 1.382], [0.878, 1.377], [0.846, 1.348], [0.822, 1.292], [0.772, 1.19],
  [0.66, 1.09], [0.46, 1.0], [0.22, 0.965], [0, 0.958],
];

// Spreads points evenly along the outline, so the stone texture isn't
// stretched where the outline has fewer points.
function resample(points, count) {
  const lengths = [0];
  for (let i = 1; i < points.length; i++) lengths.push(lengths[i - 1] + points[i].distanceTo(points[i - 1]));
  const total = lengths[lengths.length - 1];
  const out = [];
  let seg = 1;
  for (let k = 0; k < count; k++) {
    const target = (total * k) / (count - 1);
    while (seg < points.length - 1 && lengths[seg] < target) seg++;
    const span = lengths[seg] - lengths[seg - 1] || 1;
    const t = Math.min(Math.max((target - lengths[seg - 1]) / span, 0), 1);
    out.push(new THREE.Vector2().lerpVectors(points[seg - 1], points[seg], t));
  }
  return { points: out, length: total };
}

export function buildBasinProfile() {
  const raw = [];
  for (let i = 0; i < PLINTH.length - 1; i++) {
    const a = new THREE.Vector2(...PLINTH[i]);
    const b = new THREE.Vector2(...PLINTH[i + 1]);
    for (let s = 0; s < 6; s++) raw.push(new THREE.Vector2().lerpVectors(a, b, s / 6));
  }
  const spline = new THREE.SplineCurve(BODY.map(([x, y]) => new THREE.Vector2(x, y)));
  raw.push(...spline.getPoints(320));

  const { points, length } = resample(raw, 260);
  points[points.length - 1].x = 0; // close the bowl exactly on the axis

  // Split at the top of the rim into the outside and the inside.
  let apex = 0;
  points.forEach((p, i) => {
    if (p.y > points[apex].y) apex = i;
  });
  return {
    points,
    length,
    outer: points.slice(0, apex + 1),
    inner: points.slice(apex),
  };
}

// Radius of an outline at a given height. Searches from the rim outwards,
// so it finds the bowl wall rather than the stem below it.
export function radiusAtHeight(points, y, fromEnd = false) {
  const n = points.length;
  for (let k = 0; k < n - 1; k++) {
    const i = fromEnd ? n - 2 - k : k;
    const a = points[i];
    const b = points[i + 1];
    if ((y - a.y) * (y - b.y) <= 0 && a.y !== b.y) {
      return a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x);
    }
  }
  return 0;
}
