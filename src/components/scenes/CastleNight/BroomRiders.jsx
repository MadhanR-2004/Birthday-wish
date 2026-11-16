// Two original riders sharing one broomstick, drawn as a silhouette.
// The outer div flies across the sky; the svg bobs up and down.
export default function BroomRiders() {
  return (
    <div className="broom-flight" aria-hidden="true">
      <svg className="broom-riders" viewBox="0 0 220 110">
        <line x1="26" y1="77" x2="210" y2="58" strokeWidth="4" strokeLinecap="round" />
        <path d="M34 70 L4 60 L0 74 L6 90 L34 82 Z" />
        <rect x="30" y="70" width="8" height="13" rx="2" transform="rotate(-6 34 76)" />

        <path d="M84 47 Q60 50 48 70 Q66 66 80 73 Z" />
        <path d="M78 73 L104 71 L106 48 Q96 41 84 46 Z" />
        <circle cx="94" cy="35" r="8.5" />
        <path d="M88 29 Q72 28 56 42 Q70 40 74 44 Q62 52 58 56 Q76 50 88 42 Z" />
        <line x1="100" y1="52" x2="124" y2="57" strokeWidth="5" strokeLinecap="round" />
        <path d="M92 72 L103 92" strokeWidth="6" strokeLinecap="round" fill="none" />

        <path d="M128 38 Q100 42 86 64 Q104 60 118 68 Z" />
        <path d="M114 70 L142 68 L144 42 Q134 33 120 40 Z" />
        <circle cx="137" cy="28" r="9" />
        <ellipse cx="137" cy="21" rx="15" ry="3" />
        <path d="M128 21 L146 21 L118 0 Z" />
        <line x1="141" y1="46" x2="166" y2="62" strokeWidth="5" strokeLinecap="round" />
        <path d="M128 70 L141 91" strokeWidth="6" strokeLinecap="round" fill="none" />
      </svg>
    </div>
  );
}
