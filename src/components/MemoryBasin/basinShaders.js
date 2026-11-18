// GLSL for everything in the memory basin that isn't plain stone.

const NOISE = /* glsl */ `
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float noise2(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x),
             mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
}
// Fewer octaves: smooth, flowing shapes without fine crackle.
float fbmSoft(vec2 p) {
  float s = 0.0;
  float a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 3; i++) {
    s += a * noise2(p);
    p = m * p;
    a *= 0.5;
  }
  return s / 0.875;
}
float fbm2(vec2 p) {
  float s = 0.0;
  float a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++) {
    s += a * noise2(p);
    p = m * p;
    a *= 0.5;
  }
  return s;
}
float hash13(vec3 p3) {
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}
float noise3(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash13(i), hash13(i + vec3(1, 0, 0)), f.x), mix(hash13(i + vec3(0, 1, 0)), hash13(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(hash13(i + vec3(0, 0, 1)), hash13(i + vec3(1, 0, 1)), f.x), mix(hash13(i + vec3(0, 1, 1)), hash13(i + vec3(1, 1, 1)), f.x), f.y),
    f.z);
}
float fbm3(vec3 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    s += a * noise3(p);
    p *= 2.03;
    a *= 0.5;
  }
  return s;
}
`;

const OUTPUT = /* glsl */ `
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
`;

// ---------- the glowing teal liquid ----------

export const liquidVertex = /* glsl */ `
uniform float uTime;
uniform float uRadius;
uniform float uAgitation;
uniform float uRippleAge;
uniform float uVortex;
varying vec2 vLocal;
varying vec3 vWorld;
varying vec3 vNormalW;

float height(vec2 q) {
  float r = length(q);
  float edge = 1.0 - smoothstep(0.8, 1.0, r);
  float h = sin(r * 26.0 - uTime * 1.4) * 0.0016 * (0.6 + uAgitation);
  h += sin(q.x * 9.0 + uTime * 0.7) * sin(q.y * 11.0 - uTime * 0.9) * 0.0022 * (0.5 + uAgitation);
  if (uRippleAge >= 0.0) {
    float d = r - uRippleAge * 0.5;
    h += sin(d * 70.0) * exp(-d * d * 90.0) * 0.012 * exp(-uRippleAge * 1.1);
  }
  h -= uVortex * 0.06 * exp(-r * r * 10.0);
  return h * edge;
}

void main() {
  vec2 q = position.xy / uRadius;
  float e = 0.01;
  float h = height(q);
  float hx = height(q + vec2(e, 0.0)) - h;
  float hy = height(q + vec2(0.0, e)) - h;
  vec3 nLocal = normalize(vec3(-hx / (e * uRadius), -hy / (e * uRadius), 1.0));
  vNormalW = normalize(mat3(modelMatrix) * nLocal);
  vLocal = q;
  vec4 world = modelMatrix * vec4(position.xy, h, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const liquidFragment = /* glsl */ `
uniform float uTime;
uniform float uSwirl;
uniform float uGlow;
uniform float uVortex;
uniform vec3 uLightDir;
varying vec2 vLocal;
varying vec3 vWorld;
varying vec3 vNormalW;
${NOISE}

void main() {
  float r = length(vLocal);
  float a = atan(vLocal.y, vLocal.x);

  // Swirl: a fixed spiral (wound tighter by the vortex) that turns as a whole,
  // with the warping layer turning slower so the liquid seems to flow.
  // Rotations stay rigid so the pattern never winds itself into noise.
  float spiral = (1.0 - r) * (1.0 - r) * (1.8 + uVortex * 5.0);
  float twist = uSwirl + spiral;
  vec2 sp = r * vec2(cos(a + twist), sin(a + twist));
  float slow = uSwirl * 0.55 + spiral;
  vec2 wp = r * vec2(cos(a + slow), sin(a + slow));
  float t = uTime;

  vec2 warp = vec2(fbm2(wp * 2.6 + vec2(0.0, t * 0.06)), fbm2(wp * 2.6 + vec2(5.2, 1.3) - vec2(t * 0.05, 0.0)));
  float n = fbm2(sp * 2.2 + warp * 1.8);

  // silky threads where smooth noise crosses its middle value,
  // with a soft smoky halo around each one
  float d1 = fbmSoft(sp * 3.2 + warp * 2.2 + 3.1) - 0.5;
  float d2 = fbmSoft(sp * 5.0 - warp * 1.6 + 8.4) - 0.5;
  float strands = exp(-d1 * d1 * 1400.0) + 0.45 * exp(-d2 * d2 * 2200.0);
  float smoke = exp(-d1 * d1 * 160.0) * 0.22 + exp(-d2 * d2 * 260.0) * 0.08;

  // Murky deep teal, cloudy turquoise, and glowing cyan threads.
  vec3 deep = vec3(0.0, 0.025, 0.04);
  vec3 body = vec3(0.01, 0.16, 0.2);
  vec3 cloud = vec3(0.1, 0.62, 0.72);
  vec3 cyan = vec3(0.45, 0.95, 1.0);
  vec3 col = mix(deep, body, smoothstep(0.25, 0.75, n));
  col += cloud * smoothstep(0.55, 0.88, n) * 0.35 * uGlow;
  col += cyan * (strands * 1.1 + smoke) * uGlow;
  col += vec3(0.05, 0.45, 0.55) * exp(-r * r * 3.0) * 0.12 * uGlow;
  col += cyan * exp(-r * r * 40.0) * uVortex * 1.8;

  // Glassy surface: a cool sheen at grazing angles and a glint of moonlight.
  vec3 N = normalize(vNormalW);
  vec3 V = normalize(cameraPosition - vWorld);
  float fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 4.0);
  vec3 H = normalize(normalize(uLightDir) + V);
  float spec = pow(clamp(dot(N, H), 0.0, 1.0), 180.0);
  col = mix(col, vec3(0.06, 0.25, 0.3), fres * 0.6);
  col += vec3(0.75, 1.0, 1.0) * spec * 1.0;

  // Darker where it meets the stone, with a thin glowing meniscus.
  col *= mix(1.0, 0.45, smoothstep(0.8, 1.0, r));
  col += cyan * 0.2 * exp(-pow((0.985 - r) * 45.0, 2.0)) * uGlow;

  gl_FragColor = vec4(col, 1.0);
  ${OUTPUT}
}
`;

// ---------- thin teal mist turning over the surface ----------

export const vaporVertex = /* glsl */ `
uniform float uRadius;
varying vec2 vLocal;
void main() {
  vLocal = position.xy / uRadius;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const vaporFragment = /* glsl */ `
uniform float uTime;
uniform float uOpacity;
uniform float uSpin;
uniform float uSeed;
varying vec2 vLocal;
${NOISE}
void main() {
  float r = length(vLocal);
  float s = uTime * uSpin;
  vec2 p = mat2(cos(s), -sin(s), sin(s), cos(s)) * vLocal;
  float n = fbm2(p * 2.4 + uSeed + vec2(uTime * 0.03, -uTime * 0.02));
  float alpha = smoothstep(0.45, 0.8, n) * (1.0 - smoothstep(0.45, 1.0, r)) * uOpacity;
  gl_FragColor = vec4(vec3(0.3, 0.85, 0.95), alpha);
}
`;

// ---------- glittering motes rising from the liquid ----------

export const moteVertex = /* glsl */ `
attribute vec4 aSeed;
uniform float uTime;
uniform float uRadius;
uniform float uRise;
uniform float uViewport;
varying float vAlpha;
void main() {
  float life = fract(uTime * (0.04 + aSeed.x * 0.05) + aSeed.y);
  float ang = aSeed.z * 6.2831;
  float rad = uRadius * (0.05 + 0.75 * sqrt(aSeed.w));
  vec3 p = vec3(cos(ang) * rad + sin(life * 6.0 + aSeed.z * 9.0) * 0.02, life * life * uRise * (0.4 + aSeed.x), sin(ang) * rad);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float size = 0.004 + aSeed.x * 0.008;
  gl_PointSize = size * projectionMatrix[1][1] * uViewport * 0.5 / -mv.z;
  vAlpha = smoothstep(0.0, 0.15, life) * (1.0 - smoothstep(0.45, 1.0, life));
}
`;

export const moteFragment = /* glsl */ `
uniform float uIntensity;
varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = exp(-d * d * 22.0) * vAlpha * uIntensity;
  gl_FragColor = vec4(vec3(0.45, 0.95, 1.0) * 1.3, a * 0.8);
}
`;

// ---------- the moonbeam from the high window ----------

export const beamVertex = /* glsl */ `
varying vec2 vUv;
varying vec3 vNormalW;
varying vec3 vWorld;
void main() {
  vUv = uv;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const beamFragment = /* glsl */ `
uniform float uTime;
uniform float uStrength;
varying vec2 vUv;
varying vec3 vNormalW;
varying vec3 vWorld;
${NOISE}
void main() {
  float facing = abs(dot(normalize(vNormalW), normalize(cameraPosition - vWorld)));
  float soft = pow(facing, 3.0);
  float along = smoothstep(0.0, 0.3, vUv.y) * (1.0 - smoothstep(0.8, 1.0, vUv.y));
  float dust = 0.7 + 0.6 * fbm2(vec2(vUv.x * 12.0, vUv.y * 5.0 - uTime * 0.04));
  float a = soft * along * dust * uStrength;
  gl_FragColor = vec4(vec3(0.55, 0.7, 1.0), a);
}
`;

// ---------- the memory thread drawn down into the basin ----------

export const strandVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const strandFragment = /* glsl */ `
uniform float uProgress;
uniform float uDrain;
uniform float uTime;
varying vec2 vUv;
void main() {
  float head = uProgress * 1.08;
  float drain = uDrain * 1.06;
  float vis = (1.0 - smoothstep(head - 0.06, head, vUv.x)) * smoothstep(drain - 0.06, drain, vUv.x);
  float pulse = 0.65 + 0.35 * sin(vUv.x * 50.0 - uTime * 9.0);
  float tip = exp(-pow((vUv.x - head) * 25.0, 2.0)) * 2.0;
  vec3 col = vec3(0.45, 0.95, 1.0) * (1.8 * pulse + tip);
  gl_FragColor = vec4(col, vis);
}
`;

// ---------- sinking through the liquid, and the haze inside a memory ----------

export const mistVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const mistFragment = /* glsl */ `
uniform float uTime;
uniform float uMix;
uniform float uRush;
uniform float uDepth;
uniform float uAspect;
uniform sampler2D uPic0;
uniform sampler2D uPic1;
uniform sampler2D uPic2;
uniform vec3 uPicAspect;
uniform vec3 uPicLife;
varying vec2 vUv;
${NOISE}

const vec3 DEEP = vec3(0.0, 0.025, 0.04);
const vec3 BODY = vec3(0.01, 0.16, 0.2);
const vec3 CLOUD = vec3(0.1, 0.62, 0.72);
const vec3 CYAN = vec3(0.45, 0.95, 1.0);

// The basin's liquid seen from inside: murky teal clouds and glowing threads,
// the same recipe as the surface, laid flat across the screen.
vec3 water(vec2 p, float seed) {
  float r = length(p);
  float a = atan(p.y, p.x);
  float tw = uTime * 0.12 + 1.2 / (1.0 + r);
  vec2 sp = r * vec2(cos(a + tw), sin(a + tw)) + seed;
  vec2 warp = vec2(fbm2(sp * 1.3 + vec2(0.0, uTime * 0.05)), fbm2(sp * 1.3 + vec2(5.2, 1.3) - vec2(uTime * 0.04, 0.0)));
  float n = fbm2(sp * 1.1 + warp * 1.8);
  float d1 = fbmSoft(sp * 1.6 + warp * 2.2 + 3.1) - 0.5;
  float d2 = fbmSoft(sp * 2.5 - warp * 1.6 + 8.4) - 0.5;
  float strands = exp(-d1 * d1 * 900.0) + 0.45 * exp(-d2 * d2 * 1500.0);
  float smoke = exp(-d1 * d1 * 120.0) * 0.25 + exp(-d2 * d2 * 200.0) * 0.1;
  return mix(DEEP, BODY, smoothstep(0.25, 0.75, n)) + CLOUD * smoothstep(0.55, 0.88, n) * 0.35 + CYAN * (strands * 1.1 + smoke);
}

// A picture of the memory drifting up through the water like a dream:
// it rises from the depths, swells as it nears, wavers with the water and
// dissolves at the edges. life runs 0 -> 1 while it passes (<0 = hidden).
vec4 dreamPicture(sampler2D tex, float aspect, float life, vec2 p, vec2 from, float seed) {
  if (life <= 0.0 || life >= 1.0) return vec4(0.0);
  float size = mix(0.45, 1.4, life * life);
  vec2 centre = from * (1.0 - life * 0.7);
  vec2 q = (p - centre) / vec2(size * aspect, size);
  vec2 warp = vec2(fbm2(q * 2.5 + uTime * 0.25 + seed), fbm2(q * 2.5 + 4.1 - uTime * 0.2 + seed)) - 0.5;
  vec3 c = texture2D(tex, clamp(q + 0.5 + warp * 0.07, 0.0, 1.0)).rgb;
  // washed into the water's teal, a little brighter, like a remembered glow
  float lum = dot(c, vec3(0.299, 0.587, 0.114));
  c = mix(c, lum * vec3(0.6, 1.05, 1.1), 0.45) * 1.15 + CYAN * 0.06;
  float edge = length(q) + (fbm2(q * 4.0 + seed + uTime * 0.1) - 0.5) * 0.25;
  float mask = 1.0 - smoothstep(0.22, 0.5, edge);
  float fade = sin(3.14159 * life);
  return vec4(c, mask * fade * fade * 0.92);
}

void main() {
  vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);
  float r = length(p);
  vec3 col = vec3(0.0);

  // Sinking through the water: three layers of it drift towards you and
  // dissolve as they pass, while new ones loom up from the depths.
  if (uRush > 0.001) {
    vec3 sink = vec3(0.0);
    float total = 0.0;
    for (int i = 0; i < 3; i++) {
      float phase = uDepth * 0.12 + float(i) / 3.0;
      float z = fract(phase);
      float scale = exp2(mix(1.5, -1.5, z));
      float w = sin(3.14159 * z);
      sink += water(p * scale, float(i) * 13.7 + floor(phase) * 7.1) * w;
      total += w;
    }
    sink /= total;
    sink += CLOUD * exp(-r * r * 6.0) * 0.3;
    col += sink * 0.85 * uRush;
  }

  // Inside the memory: slow drifting teal haze.
  if (uRush < 0.999) {
    vec2 fp = p * 1.6;
    vec2 w = vec2(fbm2(fp + vec2(uTime * 0.02, 0.0)), fbm2(fp + vec2(3.7, uTime * 0.015)));
    float fog = fbm2(fp * 1.3 + w * 1.5 + vec2(-uTime * 0.01, uTime * 0.012));
    vec3 calm = mix(vec3(0.0, 0.02, 0.035), vec3(0.02, 0.17, 0.22), smoothstep(0.3, 0.8, fog));
    calm += vec3(0.3, 0.88, 1.0) * pow(smoothstep(0.55, 0.9, fog), 2.0) * 0.22;
    col += calm * (1.0 - uRush);
  }

  vec4 pic = dreamPicture(uPic0, uPicAspect.x, uPicLife.x, p, vec2(-0.22, 0.12), 1.0);
  col = mix(col, pic.rgb, pic.a);
  pic = dreamPicture(uPic1, uPicAspect.y, uPicLife.y, p, vec2(0.24, -0.08), 7.0);
  col = mix(col, pic.rgb, pic.a);
  pic = dreamPicture(uPic2, uPicAspect.z, uPicLife.z, p, vec2(-0.05, -0.2), 13.0);
  col = mix(col, pic.rgb, pic.a);

  col *= 1.0 - smoothstep(0.45, 1.1, r) * 0.6;
  gl_FragColor = vec4(col, uMix);
  ${OUTPUT}
}
`;
