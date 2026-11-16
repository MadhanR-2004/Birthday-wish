import useSvgId from "./useSvgId.js";

// Irregular wax blob with a few drips, built once from layered sine waves.
function buildBlobPath() {
  const center = 60;
  const radius = 45;
  const drips = [
    { angle: 0.7, size: 6 },
    { angle: 2.5, size: 4 },
    { angle: 4.4, size: 5.5 },
  ];
  const points = [];
  const count = 40;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    let r = radius + 2.4 * Math.sin(3 * a + 0.5) + 1.6 * Math.sin(7 * a + 1.3) + 1 * Math.sin(11 * a + 2.1);
    for (const drip of drips) {
      const d = Math.atan2(Math.sin(a - drip.angle), Math.cos(a - drip.angle));
      r += drip.size * Math.exp(-(d * d) / 0.025);
    }
    points.push([center + r * Math.cos(a), center + r * Math.sin(a)]);
  }
  const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  const start = mid(points[count - 1], points[0]);
  let path = `M${start[0].toFixed(2)} ${start[1].toFixed(2)}`;
  for (let i = 0; i < count; i++) {
    const p = points[i];
    const m = mid(p, points[(i + 1) % count]);
    path += ` Q${p[0].toFixed(2)} ${p[1].toFixed(2)} ${m[0].toFixed(2)} ${m[1].toFixed(2)}`;
  }
  return `${path} Z`;
}

const BLOB_PATH = buildBlobPath();

// Wax colours: highlight -> body -> shadow -> rim, the flatter pressed centre,
// the dark imprint and its light edge.
const WAX_COLORS = {
  red: { wax: ["#f0566a", "#c8102e", "#8a0018", "#5a000f"], pressed: ["#c11530", "#8f0019"], ink: "#64000f", edge: "rgba(255, 175, 185, 0.45)", light: "#ffe2e6" },
  green: { wax: ["#64c08a", "#1e7a4a", "#0f4a2c", "#072a18"], pressed: ["#1f7f4c", "#0f4f2e"], ink: "#06311b", edge: "rgba(190, 255, 215, 0.4)", light: "#e2ffee" },
  blue: { wax: ["#7397e8", "#1f3f8a", "#122760", "#0a173b"], pressed: ["#2a4a9a", "#152f6c"], ink: "#0a1a44", edge: "rgba(200, 215, 255, 0.4)", light: "#e6ecff" },
  gold: { wax: ["#ffe08a", "#c9962a", "#8a6414", "#5a400a"], pressed: ["#c99a30", "#8f6a18"], ink: "#4f3606", edge: "rgba(255, 240, 200, 0.5)", light: "#fff6dc" },
  black: { wax: ["#6a6a72", "#26262b", "#111114", "#050507"], pressed: ["#2c2c32", "#16161a"], ink: "#000000", edge: "rgba(255, 255, 255, 0.22)", light: "#f0f0f4" },
};

// Smaller letters when more of them have to fit in the seal.
const TEXT_SIZE = { 1: 31, 2: 23, 3: 17 };

// The jagged line where the seal cracks in two.
const CRACK = "100% 51%, 88% 47%, 76% 55%, 63% 46%, 52% 54%, 40% 46%, 28% 55%, 15% 48%, 0 52%";
const CLIP = {
  whole: "none",
  top: `polygon(0 0, 100% 0, ${CRACK})`,
  bottom: `polygon(${CRACK}, 0 100%, 100% 100%)`,
};

function SparkStar({ x, y, size }) {
  const s = size;
  return <path d={`M${x} ${y - s} L${x + s * 0.28} ${y - s * 0.28} L${x + s} ${y} L${x + s * 0.28} ${y + s * 0.28} L${x} ${y + s} L${x - s * 0.28} ${y + s * 0.28} L${x - s} ${y} L${x - s * 0.28} ${y - s * 0.28} Z`} />;
}

// The stamped design. Drawn twice: a light copy offset down-right, then the
// dark copy on top, which makes it look pressed into the wax.
function Imprint({ text, color, offset }) {
  return (
    <g transform={`translate(${offset} ${offset})`} fill={color} stroke={color}>
      <circle cx="60" cy="60" r="33" fill="none" strokeWidth="1.4" />
      <circle cx="60" cy="60" r="28.5" fill="none" strokeWidth="1.6" strokeDasharray="0.1 3.4" strokeLinecap="round" />
      <g stroke="none">
        <SparkStar x={60} y={33.5} size={3} />
        <SparkStar x={60} y={86.5} size={3} />
        <SparkStar x={33.5} y={60} size={3} />
        <SparkStar x={86.5} y={60} size={3} />
      </g>
      <text
        x="60"
        y="61"
        textAnchor="middle"
        dominantBaseline="central"
        stroke="none"
        fontFamily="'Cinzel Decorative', Cambria, serif"
        fontWeight="700"
        fontSize={TEXT_SIZE[text.length] || 17}
        letterSpacing={text.length > 1 ? 0.5 : 0}
      >
        {text}
      </text>
    </g>
  );
}

export default function WaxSeal({ text, color = "red", part = "whole", className = "" }) {
  const id = useSvgId("seal");
  const wax = WAX_COLORS[color] || WAX_COLORS.red;

  return (
    <div className={`wax-seal wax-seal-${part} ${className}`} aria-hidden="true">
      <div className="wax-seal-clip" style={{ clipPath: CLIP[part] }}>
        <svg viewBox="0 0 120 120">
          <defs>
            <radialGradient id={`${id}-wax`} cx="38%" cy="30%" r="78%">
              <stop offset="0" stopColor={wax.wax[0]} />
              <stop offset="0.38" stopColor={wax.wax[1]} />
              <stop offset="0.8" stopColor={wax.wax[2]} />
              <stop offset="1" stopColor={wax.wax[3]} />
            </radialGradient>
            <radialGradient id={`${id}-pressed`} cx="62%" cy="66%" r="72%">
              <stop offset="0" stopColor={wax.pressed[0]} />
              <stop offset="1" stopColor={wax.pressed[1]} />
            </radialGradient>
            {/* Turns the flat shape into glossy, rounded wax */}
            <filter id={`${id}-gloss`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="2.4" result="blur" />
              <feSpecularLighting in="blur" surfaceScale="5" specularConstant="0.95" specularExponent="24" lightingColor={wax.light} result="spec">
                <fePointLight x="-40" y="-70" z="150" />
              </feSpecularLighting>
              <feComposite in="spec" in2="SourceAlpha" operator="in" result="specIn" />
              <feComposite in="SourceGraphic" in2="specIn" operator="arithmetic" k1="0" k2="1" k3="0.75" k4="0" />
            </filter>
          </defs>
          <g filter={`url(#${id}-gloss)`}>
            <path d={BLOB_PATH} fill={`url(#${id}-wax)`} />
            <circle cx="60" cy="60" r="37" fill={`url(#${id}-pressed)`} />
          </g>
          <Imprint text={text} color={wax.edge} offset={0.9} />
          <Imprint text={text} color={wax.ink} offset={0} />
        </svg>
      </div>
    </div>
  );
}
