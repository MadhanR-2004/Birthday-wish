// An SVG filter that makes any element look like paper with burnt edges:
// a ragged outline, a charred black rim and brown scorch fading inwards.
// Render this once on the page, then use `filter: url(#burnt-edges)` in CSS.
export default function BurntEdgesFilter() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true" focusable="false">
      <filter id="burnt-edges" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="4" seed="7" result="noise" />

        {/* ragged outline: shrink the shape, then push its edge around with noise */}
        <feMorphology in="SourceAlpha" operator="erode" radius="12" result="shrunk" />
        <feDisplacementMap in="shrunk" in2="noise" scale="36" xChannelSelector="R" yChannelSelector="G" result="ragged" />

        {/* brown scorch: a wide soft band just inside the edge */}
        <feMorphology in="ragged" operator="erode" radius="16" result="deepInside" />
        <feGaussianBlur in="deepInside" stdDeviation="14" result="deepSoft" />
        <feComposite in="ragged" in2="deepSoft" operator="out" result="scorchBand" />
        <feFlood floodColor="#7a4515" floodOpacity="0.55" />
        <feComposite in2="scorchBand" operator="in" result="scorch" />

        {/* charred rim: a narrow, nearly black band right at the edge */}
        <feMorphology in="ragged" operator="erode" radius="4" result="inside" />
        <feGaussianBlur in="inside" stdDeviation="3" result="insideSoft" />
        <feComposite in="ragged" in2="insideSoft" operator="out" result="charBand" />
        <feFlood floodColor="#1c0d03" floodOpacity="0.95" />
        <feComposite in2="charBand" operator="in" result="char" />

        <feComposite in="SourceGraphic" in2="ragged" operator="in" result="paper" />
        <feMerge>
          <feMergeNode in="paper" />
          <feMergeNode in="scorch" />
          <feMergeNode in="char" />
        </feMerge>
      </filter>
    </svg>
  );
}
