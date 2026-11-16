// One-point perspective for the hall. The screen is the near end of the hall
// (1600 x 1000) and FAR is the end wall. A point is given by:
//   t: depth, 0 = near you, 1 = the end wall
//   u: across, -1 = left wall, 1 = right wall
//   v: height, 0 = top of the walls, 1 = floor
export const W = 1600;
export const H = 1000;
export const FAR = { left: 560, right: 1040, top: 260, bottom: 700 };

const FAR_SCALE = (FAR.right - FAR.left) / W;
const lerp = (a, b, k) => a + (b - a) * k;

// Evenly spaced depths in the 3D world shrink correctly on screen.
function screenDepth(t) {
  const zFar = 1 / FAR_SCALE;
  const z = 1 + t * (zFar - 1);
  return (1 - 1 / z) / (1 - 1 / zFar);
}

export function point(t, u, v) {
  const d = screenDepth(t);
  const left = lerp(0, FAR.left, d);
  const right = lerp(W, FAR.right, d);
  const top = lerp(0, FAR.top, d);
  const bottom = lerp(H, FAR.bottom, d);
  return [lerp(left, right, (u + 1) / 2), lerp(top, bottom, v)];
}

// How big things look at depth t (1 near, ~0.3 at the end wall).
export function scale(t) {
  return lerp(1, FAR_SCALE, screenDepth(t));
}

const fmt = ([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`;

export function polygon(points) {
  return `M${points.map(fmt).join(" L")} Z`;
}

export function line(a, b) {
  return `M${fmt(a)} L${fmt(b)}`;
}

// An arched window on a side wall, from depth t1 to t2.
export function archedWindow(t1, t2, u, vBottom = 0.66, vSpring = 0.32, vApex = 0.05) {
  const mid = (t1 + t2) / 2;
  return `M${fmt(point(t1, u, vBottom))} L${fmt(point(t1, u, vSpring))} Q${fmt(point(mid, u, vApex))} ${fmt(
    point(t2, u, vSpring)
  )} L${fmt(point(t2, u, vBottom))} Z`;
}

// A stone rib arching across the ceiling at depth t. Returns the path and its apex.
export function ceilingRib(t) {
  const [lx, ly] = point(t, -1, 0);
  const [rx, ry] = point(t, 1, 0);
  const lift = 300 * scale(t);
  const apex = [(lx + rx) / 2, ly - lift * 0.75];
  return {
    path: `M${lx.toFixed(1)} ${ly.toFixed(1)} C${lx.toFixed(1)} ${(ly - lift).toFixed(1)} ${rx.toFixed(1)} ${(
      ry - lift
    ).toFixed(1)} ${rx.toFixed(1)} ${ry.toFixed(1)}`,
    apex,
  };
}

