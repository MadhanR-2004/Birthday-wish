// A slowly drifting layer of procedural noise: clouds, fog or haze.
// Two seamless tiles sit side by side and the pair slides left forever.
export default function NoiseDrift({ name, seed, baseFrequency, octaves = 4, colorMatrix }) {
  return (
    <div className={`noise-drift ${name}`}>
      {[0, 1].map((copy) => (
        <svg key={copy} viewBox="0 0 1600 1000" preserveAspectRatio="none">
          <filter id={`${name}-${copy}`} x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency={baseFrequency} numOctaves={octaves} seed={seed} stitchTiles="stitch" />
            <feColorMatrix values={colorMatrix} />
          </filter>
          <rect width="1600" height="1000" filter={`url(#${name}-${copy})`} />
        </svg>
      ))}
    </div>
  );
}
