import NoiseDrift from "../NoiseDrift.jsx";
import BroomRiders from "./BroomRiders.jsx";
import { seeded } from "../sceneUtils.js";
import { WATERLINE, CASTLE_BASE, TOWERS, HALLS, WALL, WINDOWS, CLIFF_PATH, CLIFF_CRAGS } from "./castleShapes.js";
import "../scenes.css";
import "./CastleNight.css";

// Every layer shares this viewBox and alignment so they line up exactly.
const VIEW = "0 0 1600 1000";
const FIT = "xMidYMax slice";
const MOON = { x: 1320, y: 165, r: 54 };
// Flips anything drawn above the waterline into its reflection below it.
const MIRROR = `matrix(1 0 0 -1 0 ${WATERLINE * 2})`;

const STARS = Array.from({ length: 240 }, (_, i) => ({
  x: seeded(i) * 1600,
  y: seeded(i + 500) * 560,
  r: 0.4 + seeded(i + 1000) ** 3 * 2.2,
  delay: seeded(i + 1500) * 5,
}));

function CastleShape() {
  const merlons = [];
  for (let x = WALL.x1; x < WALL.x2; x += 20) merlons.push(x);
  return (
    <>
      <rect x={WALL.x1} y={WALL.top} width={WALL.x2 - WALL.x1} height={CASTLE_BASE - WALL.top + 6} />
      {merlons.map((x) => (
        <rect key={x} x={x} y={WALL.top - 9} width="11" height="10" />
      ))}
      {HALLS.map((h) => (
        <g key={h.x1}>
          <rect x={h.x1} y={h.top} width={h.x2 - h.x1} height={CASTLE_BASE - h.top} />
          <polygon points={`${h.x1 - 4},${h.top} ${(h.x1 + h.x2) / 2},${h.peak} ${h.x2 + 4},${h.top}`} />
        </g>
      ))}
      {TOWERS.map((t) => (
        <g key={t.x}>
          <rect x={t.x - t.w / 2} y={t.top} width={t.w} height={CASTLE_BASE - t.top} />
          <polygon points={`${t.x - t.w / 2 - 6},${t.top + 2} ${t.x},${t.top - t.roof} ${t.x + t.w / 2 + 6},${t.top + 2}`} />
          <rect x={t.x - 1} y={t.top - t.roof - 14} width="2" height="16" />
        </g>
      ))}
    </>
  );
}

function Windows({ flicker = false }) {
  return WINDOWS.map((w, i) => {
    const flickers = flicker && i % 5 === 0;
    return (
      <rect
        key={i}
        x={w.x}
        y={w.y}
        width={w.w}
        height={w.h}
        rx={w.w / 2}
        fill={w.color}
        opacity={w.opacity}
        className={flickers ? "cn-window" : undefined}
        style={flickers ? { animationDelay: `${(i * 0.37) % 3}s` } : undefined}
      />
    );
  });
}

// The far shore, the cliff and the castle: drawn once above the water
// and once more, flipped and rippled, as the lake's reflection.
function Landscape({ reflection = false }) {
  return (
    <g>
      <path
        d="M0 705 L0 618 L120 588 L260 640 L380 598 L520 650 L700 560 L860 612 L1000 540 L1150 600 L1300 556 L1450 620 L1600 578 L1600 705 Z"
        fill="url(#cn-far-hills)"
        filter={reflection ? undefined : "url(#cn-rock)"}
      />
      <path
        d="M900 705 L1000 642 L1120 664 L1240 612 L1380 652 L1500 622 L1600 642 L1600 705 Z"
        fill="url(#cn-near-hills)"
        filter={reflection ? undefined : "url(#cn-rock)"}
      />
      <path d={CLIFF_PATH} fill="url(#cn-cliff)" filter={reflection ? undefined : "url(#cn-rock)"} />
      {!reflection && CLIFF_CRAGS.map((d) => <path key={d} d={d} className="cn-crag" />)}
      {!reflection && (
        <g fill="#41579a" opacity="0.55" transform="translate(1.4 -1.4)">
          <CastleShape />
        </g>
      )}
      <g fill="#0a0e1a" filter={reflection ? undefined : "url(#cn-stone)"}>
        <CastleShape />
      </g>
      {reflection && (
        <g filter="url(#cn-window-glow)">
          <Windows />
        </g>
      )}
    </g>
  );
}

export default function CastleNight() {
  return (
    <div className="backdrop scene-castle" aria-hidden="true">
      <div className="scene-layers">
        {/* 1. sky and moon */}
        <svg className="scene-layer" viewBox={VIEW} preserveAspectRatio={FIT}>
          <defs>
            <linearGradient id="cn-sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#03071a" />
              <stop offset="0.45" stopColor="#0d1a42" />
              <stop offset="0.7" stopColor="#22396f" />
              <stop offset="1" stopColor="#0b1430" />
            </linearGradient>
            <radialGradient id="cn-halo">
              <stop offset="0" stopColor="#c9d6ff" stopOpacity="0.5" />
              <stop offset="0.3" stopColor="#8ea6e8" stopOpacity="0.18" />
              <stop offset="1" stopColor="#8ea6e8" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="cn-moon" cx="42%" cy="38%" r="65%">
              <stop offset="0" stopColor="#fdfcf6" />
              <stop offset="0.75" stopColor="#e3e3e0" />
              <stop offset="1" stopColor="#b9bcc6" />
            </radialGradient>
            <clipPath id="cn-moon-clip">
              <circle cx={MOON.x} cy={MOON.y} r={MOON.r} />
            </clipPath>
            <filter id="cn-moon-surface" x="0" y="0" width="100%" height="100%">
              <feTurbulence type="fractalNoise" baseFrequency="0.028" numOctaves="5" seed="3" />
              <feColorMatrix values="0 0 0 0 0.42  0 0 0 0 0.43  0 0 0 0 0.48  0 0 0 -2.2 1.35" />
            </filter>
          </defs>
          <rect width="1600" height="1000" fill="url(#cn-sky)" />
          <circle cx={MOON.x} cy={MOON.y} r="420" fill="url(#cn-halo)" />
          <circle cx={MOON.x} cy={MOON.y} r={MOON.r} fill="url(#cn-moon)" />
          <g clipPath="url(#cn-moon-clip)">
            <rect x={MOON.x - MOON.r} y={MOON.y - MOON.r} width={MOON.r * 2} height={MOON.r * 2} filter="url(#cn-moon-surface)" opacity="0.6" />
          </g>
        </svg>

        {/* 2. stars */}
        <svg className="scene-layer" viewBox={VIEW} preserveAspectRatio={FIT}>
          {STARS.map((s, i) => (
            <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#fff" className="twinkle" style={{ animationDelay: `${s.delay}s` }} />
          ))}
        </svg>

        {/* 3. moonlit clouds, and darker storm clouds in front of them */}
        <div className="scene-layer cn-clouds">
          <NoiseDrift name="cn-cloud" seed={11} baseFrequency="0.0016 0.0055" octaves={5}
            colorMatrix="0 0 0 0 0.6  0 0 0 0 0.66  0 0 0 0 0.8  1.7 0 0 0 -0.82" />
        </div>
        <div className="scene-layer cn-dark-clouds">
          <NoiseDrift name="cn-dark-cloud" seed={23} baseFrequency="0.0013 0.005" octaves={5}
            colorMatrix="0 0 0 0 0.04  0 0 0 0 0.06  0 0 0 0 0.13  2 0 0 0 -0.95" />
        </div>

        {/* 4. riders on a broom */}
        <div className="scene-layer">
          <BroomRiders />
        </div>

        {/* 5. hills, cliff, castle, and the lake with its reflection */}
        <svg className="scene-layer" viewBox={VIEW} preserveAspectRatio={FIT}>
          <defs>
            <linearGradient id="cn-far-hills" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#34467a" />
              <stop offset="1" stopColor="#1f2d52" />
            </linearGradient>
            <linearGradient id="cn-near-hills" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#1a2442" />
              <stop offset="1" stopColor="#0d1226" />
            </linearGradient>
            {/* lit from the moon on the right */}
            <linearGradient id="cn-cliff" x1="0" y1="0" x2="1" y2="0.4">
              <stop offset="0" stopColor="#06080f" />
              <stop offset="0.65" stopColor="#111830" />
              <stop offset="1" stopColor="#1b2646" />
            </linearGradient>
            <linearGradient id="cn-lake" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#0d1733" />
              <stop offset="1" stopColor="#02040b" />
            </linearGradient>
            <linearGradient id="cn-reflection-fade" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#02040b" stopOpacity="0.15" />
              <stop offset="1" stopColor="#02040b" stopOpacity="0.9" />
            </linearGradient>
            <radialGradient id="cn-moon-path">
              <stop offset="0" stopColor="#dfe6ff" stopOpacity="0.55" />
              <stop offset="1" stopColor="#dfe6ff" stopOpacity="0" />
            </radialGradient>
            <filter id="cn-rock" filterUnits="userSpaceOnUse" x="0" y="0" width="1600" height="1000">
              <feTurbulence type="fractalNoise" baseFrequency="0.01 0.03" numOctaves="5" seed="2" result="noise" />
              <feDiffuseLighting in="noise" surfaceScale="8" diffuseConstant="1.15" lightingColor="#b9c8f0" result="lit">
                <feDistantLight azimuth="-30" elevation="35" />
              </feDiffuseLighting>
              <feComposite in="lit" in2="SourceGraphic" operator="arithmetic" k1="1.25" k2="0" k3="0" k4="0" result="shaded" />
              <feComposite in="shaded" in2="SourceAlpha" operator="in" />
            </filter>
            <filter id="cn-stone" filterUnits="userSpaceOnUse" x="0" y="0" width="1600" height="1000">
              <feTurbulence type="fractalNoise" baseFrequency="0.06 0.14" numOctaves="4" seed="9" result="noise" />
              <feDiffuseLighting in="noise" surfaceScale="3" diffuseConstant="1.2" lightingColor="#c6d2f5" result="lit">
                <feDistantLight azimuth="-40" elevation="50" />
              </feDiffuseLighting>
              <feComposite in="lit" in2="SourceGraphic" operator="arithmetic" k1="1" k2="0" k3="0" k4="0" result="shaded" />
              <feComposite in="shaded" in2="SourceAlpha" operator="in" />
            </filter>
            <filter id="cn-window-glow" x="-10%" y="-10%" width="120%" height="120%">
              <feGaussianBlur stdDeviation="2.2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            {/* ripples: smear the reflection sideways with stretched noise */}
            <filter id="cn-water" filterUnits="userSpaceOnUse" x="0" y={WATERLINE} width="1600" height={1000 - WATERLINE}>
              <feTurbulence type="fractalNoise" baseFrequency="0.004 0.11" numOctaves="2" seed="5" result="ripples" />
              <feDisplacementMap in="SourceGraphic" in2="ripples" scale="18" xChannelSelector="R" yChannelSelector="G" result="rippled" />
              <feGaussianBlur in="rippled" stdDeviation="2.5 1" />
            </filter>
          </defs>

          {/* the lake */}
          <rect x="0" y={WATERLINE} width="1600" height={1000 - WATERLINE} fill="url(#cn-lake)" />
          <g filter="url(#cn-water)" opacity="0.6">
            <g transform={MIRROR}>
              <Landscape reflection />
            </g>
            <ellipse cx={MOON.x} cy={WATERLINE + 120} rx="34" ry="120" fill="url(#cn-moon-path)" />
          </g>
          <rect x="0" y={WATERLINE} width="1600" height={1000 - WATERLINE} fill="url(#cn-reflection-fade)" />

          <Landscape />
        </svg>

        {/* 6. glowing windows */}
        <svg className="scene-layer" viewBox={VIEW} preserveAspectRatio={FIT}>
          <g filter="url(#cn-window-glow)">
            <Windows flicker />
          </g>
        </svg>

        {/* 7. glints of moonlight on the rippling water */}
        <div className="scene-layer cn-ripples">
          <NoiseDrift name="cn-ripple" seed={31} baseFrequency="0.006 0.16" octaves={2}
            colorMatrix="0 0 0 0 0.75  0 0 0 0 0.82  0 0 0 0 1  3 0 0 0 -1.85" />
        </div>

        {/* 8. mist hanging over the water at the foot of the cliff */}
        <div className="scene-layer cn-fog">
          <NoiseDrift name="cn-fog" seed={4} baseFrequency="0.0028 0.018" octaves={4}
            colorMatrix="0 0 0 0 0.7  0 0 0 0 0.76  0 0 0 0 0.9  1.5 0 0 0 -0.6" />
        </div>
      </div>
    </div>
  );
}
