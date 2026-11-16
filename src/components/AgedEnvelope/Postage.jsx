import useSvgId from "./useSvgId.js";

// Rough, uneven ink, like a real rubber stamp pressed onto old paper.
function RoughInkFilter({ id, scale = 2.4 }) {
  return (
    <filter id={id} x="-10%" y="-10%" width="120%" height="120%">
      <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="2" seed="4" result="noise" />
      <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.4 1.75" result="patches" />
      <feComposite in="SourceGraphic" in2="patches" operator="in" result="spotty" />
      <feDisplacementMap in="spotty" in2="noise" scale={scale} />
    </filter>
  );
}

// ---------- Stamps: a little "storybook cover" set ----------

function OwlAndMoon({ id }) {
  return (
    <g>
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0b1a42" />
          <stop offset="1" stopColor="#3b2c6e" />
        </linearGradient>
      </defs>
      <rect x="5" y="28" width="70" height="56" fill={`url(#${id}-sky)`} />
      {[[12, 36], [68, 34], [14, 62], [70, 60], [24, 31]].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="0.6" fill="#fff" />
      ))}
      <circle cx="40" cy="54" r="21" fill="#f6efd9" opacity="0.16" />
      <circle cx="40" cy="54" r="17" fill="#f6efd9" />
      <circle cx="34" cy="49" r="2.8" fill="#e4dcc2" />
      <circle cx="46" cy="58" r="2" fill="#e4dcc2" />
      {/* an owl carrying a sealed letter */}
      <g transform="translate(40 55) scale(0.74) translate(-40 -46)">
        <g fill="#0b0f1e">
          <path d="M35 42 Q25 29 9 33 Q17 37 19 41 Q13 42 11 46 Q21 45 35 50 Z" />
          <path d="M45 42 Q55 29 71 33 Q63 37 61 41 Q67 42 69 46 Q59 45 45 50 Z" />
          <ellipse cx="40" cy="46" rx="6.2" ry="9" />
          <circle cx="40" cy="35.5" r="5.6" />
          <path d="M35.2 33 L35.6 27.5 L38.6 31.4 Z" />
          <path d="M44.8 33 L44.4 27.5 L41.4 31.4 Z" />
          <path d="M37 53.5 L43 53.5 L40 58.5 Z" />
          <path d="M38 54 L36.8 61.5 M42 54 L43.2 61.5" stroke="#0b0f1e" strokeWidth="0.9" />
        </g>
        <circle cx="38" cy="35.3" r="1.15" fill="#f1ca4a" />
        <circle cx="42" cy="35.3" r="1.15" fill="#f1ca4a" />
        <rect x="32.5" y="61" width="15" height="9.5" fill="#f3ead2" stroke="#6b5238" strokeWidth="0.5" />
        <path d="M32.5 61 L40 66.5 L47.5 61" fill="none" stroke="#6b5238" strokeWidth="0.5" />
        <circle cx="40" cy="66.3" r="1.4" fill="#8f1a24" />
      </g>
    </g>
  );
}

function CastleOnCliff({ id }) {
  return (
    <g>
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#081438" />
          <stop offset="1" stopColor="#2c4c8c" />
        </linearGradient>
      </defs>
      <rect x="5" y="28" width="70" height="56" fill={`url(#${id}-sky)`} />
      {[[10, 34], [30, 32], [50, 38], [70, 44], [18, 46]].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="0.6" fill="#fff" />
      ))}
      <circle cx="62" cy="38" r="9" fill="#f6efd9" opacity="0.18" />
      <circle cx="62" cy="38" r="5.5" fill="#f6efd9" />
      {/* lake with the castle's reflection */}
      <rect x="5" y="72" width="70" height="12" fill="#0d1733" />
      <path d="M12 75 L58 75 M18 78 L52 78 M24 81 L46 81" stroke="#ffc96a" strokeWidth="0.5" opacity="0.5" />
      <path d="M58 76 L66 76 M60 79 L64 79" stroke="#f6efd9" strokeWidth="0.5" opacity="0.6" />
      {/* cliff and castle */}
      <path d="M5 72 L5 66 L9 61 L12 57 L52 57 L56 62 L60 67 L64 72 Z" fill="#0a0e1a" />
      <g fill="#0a0e1a">
        <rect x="14" y="46" width="34" height="12" />
        <rect x="15" y="40" width="5" height="17" />
        <polygon points="14,40 17.5,32 21,40" />
        <rect x="24" y="34" width="7" height="23" />
        <polygon points="23,34 27.5,22 32,34" />
        <rect x="34" y="38" width="5" height="19" />
        <polygon points="33,38 36.5,29 40,38" />
        <rect x="42" y="42" width="5" height="15" />
        <polygon points="41,42 44.5,35 48,42" />
        <polygon points="13,46 31,40 49,46" />
      </g>
      {[[17, 44], [26.5, 39], [26.5, 45], [36, 43], [44, 47], [20, 51], [30, 51], [40, 51]].map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="1.3" height="2.2" fill="#ffc96a" />
      ))}
    </g>
  );
}

const STAMP_DESIGNS = [
  {
    key: "letter",
    band: "#e7b43a",
    ink: "#3a1606",
    bar: "#3a1606",
    title: ["THE BIRTHDAY", "LETTER"],
    sizes: [7.2, 10],
    subtitle: "and the Brightest Star",
    Art: OwlAndMoon,
  },
  {
    key: "castle",
    band: "#1f3f8a",
    ink: "#f1ca4a",
    bar: "#1f3f8a",
    title: ["THE CASTLE", "ON THE HILL"],
    sizes: [8, 7.6],
    subtitle: "and the Midnight Owl",
    Art: CastleOnCliff,
  },
];

function StorybookStamp({ design }) {
  const id = useSvgId(`stamp-${design.key}`);
  const { band, ink, bar, title, sizes, subtitle, Art } = design;
  return (
    <div className={`postage-stamp postage-stamp-${design.key}`} aria-hidden="true">
      <svg viewBox="0 0 80 100">
        <defs>
          <clipPath id={`${id}-art`}>
            <rect x="5" y="5" width="70" height="84" />
          </clipPath>
        </defs>
        <rect width="80" height="100" fill="#f7f2e4" />
        <g clipPath={`url(#${id}-art)`}>
          <Art id={id} />
          {/* title band, like a book cover */}
          <rect x="5" y="5" width="70" height="24" fill={band} />
          <text x="40" y="14.6" textAnchor="middle" fontFamily="'Cinzel Decorative', Cinzel, serif" fontWeight="700" fontSize={sizes[0]} fill={ink}>
            {title[0]}
          </text>
          <text x="40" y="23.4" textAnchor="middle" fontFamily="'Cinzel Decorative', Cinzel, serif" fontWeight="700" fontSize={sizes[1]} fill={ink}>
            {title[1]}
          </text>
          <text x="40" y="27.6" textAnchor="middle" fontFamily="'IM Fell English', serif" fontStyle="italic" fontSize="3.4" fill={ink}>
            {subtitle}
          </text>
          {/* value in the corner */}
          <text x="8" y="80.5" fontFamily="Cinzel, serif" fontWeight="600" fontSize="9" fill="#ffffff" stroke="#140c04" strokeWidth="0.5" paintOrder="stroke">
            1
          </text>
          <text x="13.4" y="80.5" fontFamily="Cinzel, serif" fontWeight="600" fontSize="3.8" fill="#ffffff" stroke="#140c04" strokeWidth="0.35" paintOrder="stroke">
            WISH
          </text>
          {/* bottom bar */}
          <rect x="5" y="83.5" width="70" height="5.5" fill={bar} />
          <text x="40" y="87.6" textAnchor="middle" fontFamily="Cinzel, serif" fontWeight="600" fontSize="3.4" fill="#f7f2e4" letterSpacing="0.8">
            MIDNIGHT POST
          </text>
        </g>
        {/* years of yellowing */}
        <rect width="80" height="100" fill="#a8783a" opacity="0.14" />
      </svg>
    </div>
  );
}

export function Stamps() {
  return (
    <div className="postage-stamps">
      {STAMP_DESIGNS.map((design) => (
        <StorybookStamp key={design.key} design={design} />
      ))}
    </div>
  );
}

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

export function Postmark() {
  const id = useSvgId("postmark");
  const today = new Date();
  const dayMonth = `${today.getDate()} ${MONTHS[today.getMonth()]}`;

  return (
    <div className="postmark" aria-hidden="true">
      <svg viewBox="0 0 330 120">
        <defs>
          <RoughInkFilter id={`${id}-ink`} />
          <path id={`${id}-ring`} d="M60 60 m-43 0 a43 43 0 1 1 86 0 a43 43 0 1 1 -86 0" />
        </defs>
        <g filter={`url(#${id}-ink)`} fill="#2a2420" stroke="#2a2420">
          <circle cx="60" cy="60" r="53" fill="none" strokeWidth="2.6" />
          <circle cx="60" cy="60" r="34" fill="none" strokeWidth="1.8" />
          <text fontFamily="Cinzel, serif" fontWeight="600" fontSize="10" stroke="none">
            <textPath href={`#${id}-ring`} textLength="262" lengthAdjust="spacing">
              MIDNIGHT POST ✦ CASTLE HILL ✦
            </textPath>
          </text>
          <text x="60" y="56" textAnchor="middle" fontFamily="Cinzel, serif" fontWeight="600" fontSize="13" stroke="none">
            {dayMonth}
          </text>
          <text x="60" y="72" textAnchor="middle" fontFamily="Cinzel, serif" fontWeight="600" fontSize="11" stroke="none">
            {today.getFullYear()}
          </text>
          {/* wavy cancellation lines */}
          {[34, 50, 66, 82].map((y) => (
            <path
              key={y}
              d={`M122 ${y} q13 -8 26 0 t26 0 t26 0 t26 0 t26 0 t26 0 t26 0 t26 0`}
              fill="none"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
          ))}
        </g>
      </svg>
    </div>
  );
}

export function OwlPostMark() {
  const id = useSvgId("owlpost");
  return (
    <div className="owl-post-mark" aria-hidden="true">
      <svg viewBox="0 0 200 64">
        <defs>
          <RoughInkFilter id={`${id}-ink`} scale={2} />
        </defs>
        <g filter={`url(#${id}-ink)`} fill="#b0122b" stroke="#b0122b">
          <rect x="3" y="3" width="194" height="58" rx="5" fill="none" strokeWidth="3" />
          <rect x="9" y="9" width="182" height="46" rx="3" fill="none" strokeWidth="1.2" />
          <text x="100" y="33" textAnchor="middle" fontFamily="Cinzel, serif" fontWeight="600" fontSize="20" letterSpacing="3" stroke="none">
            BY OWL POST
          </text>
          <text x="100" y="48" textAnchor="middle" fontFamily="Cinzel, serif" fontWeight="600" fontSize="8.5" letterSpacing="2.5" stroke="none">
            HANDLE WITH MAGIC
          </text>
        </g>
      </svg>
    </div>
  );
}
