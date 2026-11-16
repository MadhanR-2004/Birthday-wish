import { seeded } from "../sceneUtils.js";

// The castle sits on a cliff above a lake. Coordinates are in the
// 1600 x 1000 scene. WATERLINE is where the cliff meets the lake.
export const WATERLINE = 705;
export const CASTLE_BASE = 532;

// x = centre, w = width, top = where the roof starts, roof = roof height
export const TOWERS = [
  { x: 170, w: 34, top: 420, roof: 48 },
  { x: 240, w: 48, top: 330, roof: 80 },
  { x: 320, w: 40, top: 372, roof: 60 },
  { x: 400, w: 62, top: 250, roof: 110 },
  { x: 480, w: 44, top: 300, roof: 72 },
  { x: 560, w: 80, top: 168, roof: 165 },
  { x: 650, w: 52, top: 282, roof: 92 },
  { x: 730, w: 60, top: 240, roof: 112 },
  { x: 806, w: 40, top: 342, roof: 62 },
  { x: 862, w: 36, top: 410, roof: 50 },
];

// Long buildings between the towers, with pitched roofs.
export const HALLS = [
  { x1: 180, x2: 330, top: 440, peak: 410 },
  { x1: 330, x2: 520, top: 380, peak: 338 },
  { x1: 590, x2: 720, top: 362, peak: 318 },
  { x1: 740, x2: 880, top: 432, peak: 402 },
];

export const WALL = { x1: 120, x2: 905, top: 470 };

// A sparse scattering of lit windows: most rooms are dark at night.
// Each window gets its own brightness and warmth so they don't look stamped.
const WINDOW_COLORS = ["#ffc96a", "#ffb34d", "#ffd98c"];

function makeWindow(n, x, y, w, h) {
  return {
    x,
    y,
    w,
    h,
    color: WINDOW_COLORS[Math.floor(seeded(n + 900) * WINDOW_COLORS.length)],
    opacity: 0.55 + seeded(n + 700) * 0.45,
  };
}

export const WINDOWS = (() => {
  const list = [];
  let n = 0;
  for (const t of TOWERS) {
    const cols = t.w >= 70 ? [-t.w / 6, t.w / 6] : [0];
    for (let y = t.top + 22; y < WALL.top - 10; y += 36) {
      for (const dx of cols) {
        n += 1;
        if (seeded(n) > 0.58) list.push(makeWindow(n, t.x + dx - 2, y, 4, 8));
      }
    }
  }
  for (const h of HALLS) {
    for (let y = h.top + 16; y < WALL.top - 10; y += 30) {
      for (let x = h.x1 + 18; x < h.x2 - 12; x += 34) {
        n += 1;
        if (seeded(n) > 0.68) list.push(makeWindow(n, x, y, 4, 8));
      }
    }
  }
  for (let x = WALL.x1 + 30; x < WALL.x2 - 20; x += 60) {
    n += 1;
    if (seeded(n) > 0.7) list.push(makeWindow(n, x, WALL.top + 26, 4, 7));
  }
  return list;
})();

// A jagged line between two points, for rocky cliff edges.
function jagged(from, to, steps, roughness, seedBase) {
  const points = [];
  for (let i = 1; i <= steps; i++) {
    const k = i / steps;
    const x = from[0] + (to[0] - from[0]) * k + (i < steps ? (seeded(seedBase + i) - 0.5) * roughness : 0);
    const y = from[1] + (to[1] - from[1]) * k + (i < steps ? (seeded(seedBase + i + 50) - 0.5) * roughness : 0);
    points.push([x, y]);
  }
  return points;
}

export const CLIFF_PATH = (() => {
  const start = [30, WATERLINE];
  const pts = [
    start,
    ...jagged(start, [70, 610], 5, 30, 300),
    ...jagged([70, 610], [96, CASTLE_BASE - 4], 5, 30, 320),
    ...jagged([96, CASTLE_BASE - 4], [915, CASTLE_BASE - 6], 30, 14, 400),
    ...jagged([915, CASTLE_BASE - 6], [960, 590], 5, 34, 500),
    ...jagged([960, 590], [1015, 640], 5, 30, 540),
    ...jagged([1015, 640], [1090, WATERLINE], 6, 22, 600),
  ];
  return `M${pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L")} Z`;
})();

// Cracks and ledges in the cliff face.
export const CLIFF_CRAGS = [
  "M150 600 L190 640 L240 650 L260 690",
  "M330 560 L360 610 L420 630 L440 690",
  "M560 548 L600 590 L590 640 L640 700",
  "M760 552 L790 600 L860 620 L880 680",
  "M930 590 L960 630 L1010 660",
];
