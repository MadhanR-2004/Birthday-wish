import { W, H, FAR, point, scale, polygon, line, archedWindow, ceilingRib } from "./hallGeometry.js";
import { seeded } from "../sceneUtils.js";
import "../scenes.css";
import "./GrandHall.css";

// Every layer shares this viewBox and alignment so they line up exactly.
const VIEW = `0 0 ${W} ${H}`;
const FIT = "xMidYMid slice";

const STARS = Array.from({ length: 170 }, (_, i) => ({
  x: seeded(i) * W,
  y: seeded(i + 400) * 420,
  r: 0.4 + seeded(i + 800) ** 3 * 2,
  delay: seeded(i + 1200) * 4,
}));

const WINDOW_DEPTHS = [0.1, 0.4, 0.7];
const WINDOW_LENGTH = 0.13;
const TORCH_DEPTHS = [0.04, 0.32, 0.62, 0.9];
const RIB_DEPTHS = Array.from({ length: 11 }, (_, i) => i / 10);
const CHANDELIER_DEPTHS = [0.28, 0.6];
const SIDES = [-1, 1];

const DUST = Array.from({ length: 30 }, (_, i) => ({
  left: seeded(i + 2000) * 100,
  top: 30 + seeded(i + 2100) * 70,
  size: 1.5 + seeded(i + 2200) * 2.5,
  duration: 9 + seeded(i + 2300) * 10,
  delay: seeded(i + 2400) * -18,
}));

const FLOOR = [point(0, -1, 1), point(1, -1, 1), point(1, 1, 1), point(0, 1, 1)];

// ---------- static architecture ----------

function SideWall({ u }) {
  const wall = [point(0, u, 0), point(1, u, 0), point(1, u, 1), point(0, u, 1)];
  const courses = [0.12, 0.24, 0.36, 0.48, 0.6, 0.72, 0.84, 0.94];
  return (
    <g>
      <path d={polygon(wall)} fill={`url(#gh-wall-${u < 0 ? "left" : "right"})`} filter="url(#gh-stone)" />
      {courses.map((v) => (
        <path key={v} d={line(point(0, u, v), point(1, u, v))} className="gh-mortar" />
      ))}
      {WINDOW_DEPTHS.map((t1) => {
        const t2 = t1 + WINDOW_LENGTH;
        const mid = (t1 + t2) / 2;
        return (
          <g key={t1}>
            {/* deep stone reveal around the glass */}
            <path d={archedWindow(t1 - 0.015, t2 + 0.015, u, 0.7, 0.3, 0.0)} fill="#16111a" filter="url(#gh-stone)" />
            <path d={archedWindow(t1, t2, u)} fill="url(#gh-glass)" />
            <path d={archedWindow(t1, t2, u)} fill="url(#gh-glass-sheen)" />
            <path d={line(point(mid, u, 0.17), point(mid, u, 0.66))} className="gh-lead" />
            <path d={line(point(t1, u, 0.47), point(t2, u, 0.47))} className="gh-lead" />
            <path d={line(point(t1, u, 0.56), point(t2, u, 0.56))} className="gh-lead thin" />
            <path d={line(point(t1, u, 0.38), point(t2, u, 0.38))} className="gh-lead thin" />
            {/* stone sill */}
            <path d={polygon([point(t1 - 0.02, u, 0.66), point(t2 + 0.02, u, 0.66), point(t2 + 0.02, u, 0.685), point(t1 - 0.02, u, 0.685)])} fill="#3a3038" />
          </g>
        );
      })}
    </g>
  );
}

function EndWall() {
  const { left, right, top, bottom } = FAR;
  return (
    <g>
      <rect x={left} y={top} width={right - left} height={bottom - top} fill="url(#gh-end-wall)" filter="url(#gh-stone)" />
      <path d="M700 654 L700 426 Q800 284 900 426 L900 654 Z" fill="#16111a" />
      <clipPath id="gh-end-window">
        <path d="M712 650 L712 432 Q800 304 888 432 L888 650 Z" />
      </clipPath>
      <g clipPath="url(#gh-end-window)">
        <rect x="700" y="300" width="200" height="360" fill="url(#gh-glass)" />
        <circle cx="842" cy="420" r="34" fill="url(#gh-moon-halo)" />
        <circle cx="842" cy="420" r="14" fill="#f3f5ff" />
        <path d="M712 600 L760 560 L800 585 L850 545 L888 575 L888 650 L712 650 Z" fill="#0d1733" />
      </g>
      <path d="M771 650 L771 380 M829 650 L829 380 M712 520 L888 520" className="gh-lead" />
      <circle cx="800" cy="400" r="20" fill="none" className="gh-lead" />
    </g>
  );
}

function Floor() {
  const lanes = [-0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75];
  const rows = [0.06, 0.14, 0.24, 0.36, 0.5, 0.66, 0.84];
  return (
    <g>
      <path d={polygon(FLOOR)} fill="url(#gh-floor)" filter="url(#gh-floor-stone)" />
      {lanes.map((u) => (
        <path key={`l${u}`} d={line(point(0, u, 1), point(1, u, 1))} className="gh-floor-joint" />
      ))}
      {rows.map((t) => (
        <path key={`r${t}`} d={line(point(t, -1, 1), point(t, 1, 1))} className="gh-floor-joint" />
      ))}
    </g>
  );
}

function LongTable() {
  const near = 0.0;
  const far = 0.78;
  const half = 0.11;
  const top = [point(near, -half, 0.86), point(far, -half, 0.86), point(far, half, 0.86), point(near, half, 0.86)];
  const side = (u) => [point(near, u, 0.86), point(far, u, 0.86), point(far, u, 0.885), point(near, u, 0.885)];
  const bench = (u1, u2) => [point(near, u1, 0.925), point(far, u1, 0.925), point(far, u2, 0.925), point(near, u2, 0.925)];
  return (
    <g>
      <path d={polygon(bench(-0.21, -0.16))} fill="#24170e" filter="url(#gh-wood)" />
      <path d={polygon(bench(0.16, 0.21))} fill="#24170e" filter="url(#gh-wood)" />
      <path d={polygon(side(-half))} fill="#170e08" />
      <path d={polygon(side(half))} fill="#170e08" />
      <path d={polygon(top)} fill="url(#gh-table)" filter="url(#gh-wood)" />
      <path d={polygon(top)} fill="url(#gh-table-sheen)" />
    </g>
  );
}

// ---------- light: beams, reflections and flames ----------

function WindowLight() {
  return (
    <g>
      {SIDES.map((u) =>
        WINDOW_DEPTHS.map((t1) => {
          const t2 = t1 + WINDOW_LENGTH;
          return (
            <g key={`${u}${t1}`}>
              {/* beam of moonlight slanting into the hall */}
              <path
                d={polygon([point(t1, u, 0.2), point(t2, u, 0.2), point(t2 + 0.12, u * 0.15, 1), point(t1 + 0.12, u * 0.15, 1)])}
                fill={`url(#gh-beam-${u < 0 ? "left" : "right"})`}
              />
              {/* the window's reflection in the polished floor */}
              <path d={archedWindow(t1, t2, u, 1.34, 1.68, 1.95)} fill="url(#gh-glass)" opacity="0.16" clipPath="url(#gh-floor-clip)" />
            </g>
          );
        })
      )}
    </g>
  );
}

function Torch({ t, u }) {
  const s = scale(t);
  const [x, y] = point(t, u * 0.985, 0.5);
  const [rx, ry] = point(t, u * 0.9, 1);
  return (
    <g>
      <circle cx={x} cy={y - 30 * s} r={230 * s} fill="url(#gh-torch-glow)" className="gh-glow" />
      {/* flicker of the flame reflected on the floor */}
      <ellipse cx={rx} cy={ry + 40 * s} rx={22 * s} ry={110 * s} fill="url(#gh-reflection)" className="gh-glow" clipPath="url(#gh-floor-clip)" />
      <rect x={x - 5 * s} y={y - 8 * s} width={10 * s} height={42 * s} rx={3 * s} fill="#1a120c" />
      <path d={`M${x - 14 * s} ${y - 6 * s} L${x + 14 * s} ${y - 6 * s} L${x + 9 * s} ${y + 6 * s} L${x - 9 * s} ${y + 6 * s} Z`} fill="#2a1d12" />
      <g className="gh-flame" style={{ transformOrigin: `${x}px ${y - 8 * s}px` }}>
        <path
          d={`M${x} ${y - 56 * s} Q${x + 17 * s} ${y - 26 * s} ${x + 9 * s} ${y - 8 * s} L${x - 9 * s} ${y - 8 * s} Q${x - 17 * s} ${y - 26 * s} ${x} ${y - 56 * s} Z`}
          fill="url(#gh-flame)"
          filter="url(#gh-soft)"
        />
      </g>
    </g>
  );
}

function Chandelier({ t }) {
  const s = scale(t);
  const [cx, cy] = point(t, 0, 0.12);
  const ribTop = ceilingRib(t).apex[1];
  const lights = Array.from({ length: 10 }, (_, i) => {
    const a = (i / 10) * Math.PI * 2;
    return [cx + Math.cos(a) * 95 * s, cy + Math.sin(a) * 18 * s];
  });
  return (
    <g>
      <path d={`M${cx} ${ribTop} L${cx} ${cy}`} stroke="#120d0a" strokeWidth={3 * s} />
      <circle cx={cx} cy={cy} r={300 * s} fill="url(#gh-torch-glow)" className="gh-glow" />
      <ellipse cx={cx} cy={cy} rx={95 * s} ry={18 * s} fill="none" stroke="#21170f" strokeWidth={7 * s} />
      {lights.map(([lx, ly], i) => (
        <g key={i}>
          <circle cx={lx} cy={ly - 12 * s} r={16 * s} fill="url(#gh-spark)" className="gh-glow" style={{ animationDelay: `${i * 0.31}s` }} />
          <rect x={lx - 3 * s} y={ly - 10 * s} width={6 * s} height={10 * s} fill="#e8dcc4" />
        </g>
      ))}
    </g>
  );
}

export default function GrandHall() {
  const ribs = RIB_DEPTHS.map((t) => ({ t, ...ceilingRib(t) }));

  return (
    <div className="backdrop scene-hall" aria-hidden="true">
      <div className="scene-layers">
        {/* 1. the open, enchanted night sky above the hall */}
        <svg className="scene-layer" viewBox={VIEW} preserveAspectRatio={FIT}>
          <defs>
            <linearGradient id="gh-sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#030616" />
              <stop offset="0.45" stopColor="#0a1640" />
              <stop offset="1" stopColor="#1b3270" />
            </linearGradient>
            <filter id="gh-nebula" x="0" y="0" width="100%" height="100%">
              <feTurbulence type="fractalNoise" baseFrequency="0.0025 0.008" numOctaves="5" seed="21" />
              <feColorMatrix values="0 0 0 0 0.45  0 0 0 0 0.5  0 0 0 0 0.85  1.4 0 0 0 -0.7" />
            </filter>
          </defs>
          <rect width={W} height={H} fill="url(#gh-sky)" />
          <rect width={W} height="460" filter="url(#gh-nebula)" opacity="0.55" />
        </svg>

        {/* 2. stars */}
        <svg className="scene-layer" viewBox={VIEW} preserveAspectRatio={FIT}>
          {STARS.map((s, i) => (
            <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#fff" className="twinkle" style={{ animationDelay: `${s.delay}s` }} />
          ))}
        </svg>

        {/* 3. the hall itself: stone, glass and wood */}
        <svg className="scene-layer" viewBox={VIEW} preserveAspectRatio={FIT}>
          <defs>
            <filter id="gh-stone" filterUnits="userSpaceOnUse" x="0" y="0" width={W} height={H}>
              <feTurbulence type="fractalNoise" baseFrequency="0.03 0.085" numOctaves="5" seed="5" result="noise" />
              <feDiffuseLighting in="noise" surfaceScale="4.5" diffuseConstant="1.15" lightingColor="#e2c39c" result="lit">
                <feDistantLight azimuth="95" elevation="48" />
              </feDiffuseLighting>
              <feComposite in="lit" in2="SourceGraphic" operator="arithmetic" k1="1.3" k2="0" k3="0" k4="0" result="shaded" />
              <feComposite in="shaded" in2="SourceAlpha" operator="in" />
            </filter>
            <filter id="gh-floor-stone" filterUnits="userSpaceOnUse" x="0" y="0" width={W} height={H}>
              <feTurbulence type="fractalNoise" baseFrequency="0.012 0.05" numOctaves="4" seed="8" result="noise" />
              <feDiffuseLighting in="noise" surfaceScale="2.5" diffuseConstant="1.2" lightingColor="#cbb8a8" result="lit">
                <feDistantLight azimuth="90" elevation="62" />
              </feDiffuseLighting>
              <feComposite in="lit" in2="SourceGraphic" operator="arithmetic" k1="1.25" k2="0" k3="0" k4="0" result="shaded" />
              <feComposite in="shaded" in2="SourceAlpha" operator="in" />
            </filter>
            <filter id="gh-wood" filterUnits="userSpaceOnUse" x="0" y="0" width={W} height={H}>
              <feTurbulence type="fractalNoise" baseFrequency="0.18 0.006" numOctaves="3" seed="14" result="noise" />
              <feDiffuseLighting in="noise" surfaceScale="2" diffuseConstant="1.25" lightingColor="#f0c896" result="lit">
                <feDistantLight azimuth="90" elevation="55" />
              </feDiffuseLighting>
              <feComposite in="lit" in2="SourceGraphic" operator="arithmetic" k1="1.35" k2="0" k3="0" k4="0" result="shaded" />
              <feComposite in="shaded" in2="SourceAlpha" operator="in" />
            </filter>
            <linearGradient id="gh-wall-left" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#3a3036" />
              <stop offset="1" stopColor="#4a404c" />
            </linearGradient>
            <linearGradient id="gh-wall-right" x1="1" y1="0" x2="0" y2="0">
              <stop offset="0" stopColor="#3a3036" />
              <stop offset="1" stopColor="#4a404c" />
            </linearGradient>
            <linearGradient id="gh-end-wall" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#3f3644" />
              <stop offset="1" stopColor="#30293a" />
            </linearGradient>
            <linearGradient id="gh-floor" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0" stopColor="#1b1619" />
              <stop offset="1" stopColor="#3b3440" />
            </linearGradient>
            <linearGradient id="gh-glass" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#9ab2ee" />
              <stop offset="0.6" stopColor="#4f6cb4" />
              <stop offset="1" stopColor="#24407f" />
            </linearGradient>
            <linearGradient id="gh-glass-sheen" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#ffffff" stopOpacity="0.18" />
              <stop offset="0.4" stopColor="#ffffff" stopOpacity="0" />
              <stop offset="0.7" stopColor="#ffffff" stopOpacity="0.06" />
              <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>
            <radialGradient id="gh-moon-halo">
              <stop offset="0" stopColor="#dfe6ff" stopOpacity="0.8" />
              <stop offset="1" stopColor="#dfe6ff" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="gh-table" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0" stopColor="#5a3820" />
              <stop offset="1" stopColor="#3a2414" />
            </linearGradient>
            <linearGradient id="gh-table-sheen" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0" stopColor="#ffd9a8" stopOpacity="0.16" />
              <stop offset="0.5" stopColor="#ffd9a8" stopOpacity="0.02" />
              <stop offset="1" stopColor="#9fb4ff" stopOpacity="0.12" />
            </linearGradient>
          </defs>

          <EndWall />
          <Floor />
          <SideWall u={-1} />
          <SideWall u={1} />

          {/* stone ribs arching over the open ceiling, far to near */}
          {[...ribs].reverse().map(({ t, path }) => (
            <g key={t}>
              <path d={path} className="gh-rib" strokeWidth={34 * scale(t)} filter="url(#gh-stone)" />
              <path d={path} className="gh-rib-light" strokeWidth={6 * scale(t)} transform={`translate(0 ${10 * scale(t)})`} />
            </g>
          ))}
          <path d={`M${ribs.map((r) => `${r.apex[0].toFixed(1)} ${r.apex[1].toFixed(1)}`).join(" L")}`} className="gh-ridge" />

          <LongTable />
        </svg>

        {/* 4. moonbeams and floor reflections (adds light) */}
        <svg className="scene-layer gh-light-layer" viewBox={VIEW} preserveAspectRatio={FIT}>
          <defs>
            <clipPath id="gh-floor-clip">
              <path d={polygon(FLOOR)} />
            </clipPath>
            <linearGradient id="gh-beam-left" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#a8bdff" stopOpacity="0.22" />
              <stop offset="1" stopColor="#a8bdff" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="gh-beam-right" x1="1" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#a8bdff" stopOpacity="0.22" />
              <stop offset="1" stopColor="#a8bdff" stopOpacity="0" />
            </linearGradient>
          </defs>
          <WindowLight />
        </svg>

        {/* 5. fire: torches and chandeliers (adds light) */}
        <svg className="scene-layer gh-light-layer" viewBox={VIEW} preserveAspectRatio={FIT}>
          <defs>
            <radialGradient id="gh-torch-glow">
              <stop offset="0" stopColor="#ffb257" stopOpacity="0.6" />
              <stop offset="0.35" stopColor="#ff8a2a" stopOpacity="0.2" />
              <stop offset="1" stopColor="#ff8a2a" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="gh-reflection">
              <stop offset="0" stopColor="#ffb257" stopOpacity="0.45" />
              <stop offset="1" stopColor="#ffb257" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="gh-flame" cx="50%" cy="75%" r="70%">
              <stop offset="0" stopColor="#fff6d6" />
              <stop offset="0.45" stopColor="#ffc24a" />
              <stop offset="1" stopColor="#e2541c" />
            </radialGradient>
            <radialGradient id="gh-spark">
              <stop offset="0" stopColor="#fff3c9" />
              <stop offset="0.35" stopColor="#ffc35a" stopOpacity="0.8" />
              <stop offset="1" stopColor="#ff9a3a" stopOpacity="0" />
            </radialGradient>
            <filter id="gh-soft" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="1.5" />
            </filter>
          </defs>
          {SIDES.map((u) => TORCH_DEPTHS.map((t) => <Torch key={`${u}${t}`} t={t} u={u} />))}
          {CHANDELIER_DEPTHS.map((t) => (
            <Chandelier key={t} t={t} />
          ))}
        </svg>

        {/* 6. warm dust floating in the light */}
        <div className="gh-dust">
          {DUST.map((d, i) => (
            <span
              key={i}
              style={{
                left: `${d.left}%`,
                top: `${d.top}%`,
                width: d.size,
                height: d.size,
                animationDuration: `${d.duration}s`,
                animationDelay: `${d.delay}s`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
